// Scan time budget: live collection can never hang a scan, and operations always end.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import http from "node:http";
import test from "node:test";

process.env.REVIEWINTEL_DISABLE_OPENAI = "1";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://persist.invalid";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const d = jiti("./lib/scanDeadline.ts");

// A local server that never answers (simulates a hung retailer request).
const server = http.createServer(() => {});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const hang = `http://127.0.0.1:${server.address().port}/slow`;
test.after(() => server.close());

test("budgets: defaults keep a scan under 90s and env cannot raise them past the caps", () => {
  const b = d.scanBudgets({});
  assert.ok(b.collectionMs <= 60000 && b.totalMs <= 85000 && b.perRequestMs <= 15000);
  const capped = d.scanBudgets({ REVIEWINTEL_SCAN_TOTAL_BUDGET_MS: "999999", REVIEWINTEL_SCAN_COLLECTION_BUDGET_MS: "999999" });
  assert.equal(capped.totalMs, 85000); assert.equal(capped.collectionMs, 60000);
});

test("per-request timeout aborts a hung fetch inside a scan", async () => {
  const t0 = Date.now();
  await assert.rejects(d.withScanDeadline(5000, () => fetch(hang), 300));
  assert.ok(Date.now() - t0 < 2000, "aborted quickly");
});

test("after the collection deadline, new fetches fail immediately (early stop)", async () => {
  const t0 = Date.now();
  const out = await d.withScanDeadline(200, async () => {
    await new Promise((r) => setTimeout(r, 300));
    try { await fetch(hang); return "fetched"; } catch (e) { return e.code || e.name; }
  }, 5000);
  assert.equal(out, "SCAN_TIME_BUDGET");
  assert.ok(Date.now() - t0 < 1500);
});

test("fetches outside a scan are untouched", async () => {
  const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 100);
  await assert.rejects(fetch(hang, { signal: ctrl.signal }), /abort/i);
});

test("raceWithBudget returns the fallback when the work runs long", async () => {
  const slow = await d.raceWithBudget(100, () => new Promise((r) => setTimeout(() => r("late"), 1000)), () => "fallback");
  assert.deepEqual(slow, { value: "fallback", timedOut: true });
  const fast = await d.raceWithBudget(1000, async () => "done", () => "fallback");
  assert.deepEqual(fast, { value: "done", timedOut: false });
});

test("analyze route: collection is budgeted and the total backstop closes the operation as FAILED", () => {
  const src = readFileSync(root + "app/api/analyze/route.ts", "utf8");
  assert.match(src, /withScanDeadline\(budgets\.collectionMs/);
  assert.match(src, /Review collection reached the scan time limit/);
  assert.match(src, /raceWithBudget\(\s*scanBudgets\(\)\.totalMs/);
  assert.match(src, /status: "FAILED", errorCode: "SCAN_TIME_BUDGET"/);
  const max = Number(src.match(/export const maxDuration = (\d+)/)[1]);
  assert.ok(max * 1000 > d.scanBudgets({}).totalMs + 10000, "platform ceiling stays above the backstop so FAILED is always written");
});
