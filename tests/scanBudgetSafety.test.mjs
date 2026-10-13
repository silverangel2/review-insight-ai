import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../", import.meta.url).pathname, { alias: { "@": new URL("../", import.meta.url).pathname } });
const { scanOperationKey, requestFingerprint, beginDurableScanOperation, SCAN_BUDGET_LIMITS } = jiti("./lib/scanBudget.ts");
const migration = fs.readFileSync(new URL("../supabase/migrations/20261006_reviewintel_scan_cost_safety.sql", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");

test("operation identity is stable for retries and distinct for different screenshots", () => {
  const image = requestFingerprint(new Uint8Array([1, 2, 3]));
  assert.equal(scanOperationKey("a@example.com:free_buyer", "scan-1", image), scanOperationKey("a@example.com:free_buyer", "scan-1", image));
  assert.notEqual(scanOperationKey("a@example.com:free_buyer", "scan-1", image), scanOperationKey("a@example.com:free_buyer", "scan-1", requestFingerprint(new Uint8Array([4]))));
});

test("idempotency control reports infrastructure unavailability without calling it a budget failure", async () => {
  const result = await beginDurableScanOperation({ operationKey: "x", accountKey: "a", scanId: "s" });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.errorCode, "IDEMPOTENCY_STORE_UNAVAILABLE");
  assert.equal(SCAN_BUDGET_LIMITS.perScan.openAiTotalTokens, 120000);
});

test("historical budget exhaustion is observational and does not block a new operation", async () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  globalThis.fetch = async (url, init = {}) => {
    if (String(init.method || "GET") === "GET") return new Response("[]", { status: 200 });
    return new Response(JSON.stringify([{ status: "RUNNING", scan_id: "s" }]), { status: 201 });
  };
  try {
    const result = await beginDurableScanOperation({ operationKey: "new-operation", accountKey: "a", scanId: "s" });
    assert.equal(result.status, "RUNNING");
    assert.equal(result.created, true);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test("migration uses row locks and operation uniqueness for concurrency safety", () => {
  assert.match(migration, /operation_key text primary key/);
  assert.match(migration, /for update/gi);
  assert.match(migration, /reviewintel_daily_budget_usage/);
  assert.match(migration, /reviewintel_begin_scan_operation/);
  assert.match(migration, /reviewintel_finish_scan_operation/);
});

test("analyze reserves an operation before screenshot OpenAI work", () => {
  assert.match(route, /beginDurableScanOperation/);
  assert.ok(route.indexOf("beginDurableScanOperation") < route.indexOf("extractScreenshotFacts(imageDataUrl"));
  assert.match(route, /SCAN_ALREADY_FAILED/);
  assert.match(route, /finishDurableScanOperation/);
});
