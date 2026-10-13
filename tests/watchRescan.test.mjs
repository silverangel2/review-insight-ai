import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const { rescanWatchedProduct, watchRescanBudget } = jiti("./lib/watchRescan.ts");

test("watch rescan budget: default 5, capped 0..25", () => {
  assert.equal(watchRescanBudget({}), 5);
  assert.equal(watchRescanBudget({ REVIEWINTEL_WATCH_RESCAN_BUDGET: "0" }), 0);
  assert.equal(watchRescanBudget({ REVIEWINTEL_WATCH_RESCAN_BUDGET: "999" }), 25);
});

test("fresh rescan runs retrieval -> adjudication -> deterministic verdict; failures give no snapshot", async () => {
  const seen = [];
  const deps = {
    retrieve: async (i) => { seen.push(i); return { reviews: [{ body: "a" }, { body: "b" }] }; },
    adjudicate: (r) => ({ acceptedRecords: r }),
    derive: () => ({ verdict: "BUY", acceptedCorpusHash: "h1" }),
  };
  const snap = await rescanWatchedProduct({ listingUrl: "https://www.amazon.ca/dp/B0TEST0001", productName: "Thing" }, deps);
  assert.deepEqual(snap, { verdict: "BUY", acceptedCount: 2, resultHash: "h1" });
  assert.ok(seen[0].politeDelayMs >= 400);
  assert.equal(await rescanWatchedProduct({ listingUrl: "x", productName: "y" }, { ...deps, retrieve: async () => { throw new Error("403"); } }), null);
  assert.equal(await rescanWatchedProduct({ listingUrl: "x", productName: "y" }, { ...deps, derive: () => ({}) }), null);
});

test("cron: flag-gated first, rescans budget-capped, falls back to stored results, OpenAI-free", () => {
  const src = readFileSync(root + "app/api/cron/product-watches/route.ts", "utf8");
  assert.ok(src.indexOf("watchAlertsEnabled()") < src.indexOf("rescanWatchedProduct("));
  assert.match(src, /rescans < budget/);
  assert.match(src, /if \(!next && stored\) next = snapshotFromStoredResult/);
  assert.doesNotMatch(src + readFileSync(root + "lib/watchRescan.ts", "utf8"), /api\.openai|callOpenAi|from "openai"/);
});
