import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const jiti = require("jiti")(process.cwd(), { alias: { "@": process.cwd() } });
const { completeAccountScan } = jiti("./lib/scanCompletion.ts");

function dependencies(override = {}) {
  const calls = [];
  const row = { id: "persisted-id", profile_email: "owner@example.com", created_at: "2026-10-07T12:00:00Z", analysis_json: { scanId: "scan-exact" } };
  return {
    calls,
    input: {
      email: row.profile_email, scanId: "scan-exact", result: row.analysis_json,
      save: async () => { calls.push("save"); return row; },
      read: async () => { calls.push("read"); return row; },
      consume: async () => { calls.push("usage"); return { ok: true, quota: { remaining: 2 } }; },
      finish: async () => { calls.push("complete"); return { ok: true }; },
      ...override,
    },
  };
}

test("completion is save -> account-visible read -> usage -> durable completion", async () => {
  const { calls, input } = dependencies();
  const result = await completeAccountScan(input);
  assert.deepEqual(calls, ["save", "read", "usage", "complete"]);
  assert.equal(result.scanId, "scan-exact");
  assert.equal(result.analysisId, "persisted-id");
});
for (const [name, override, reason] of [
  ["missing insert", { save: async () => null }, /RESULT_PERSISTENCE_FAILED/],
  ["missing account-visible record", { read: async () => null }, /IDENTITY_MISMATCH/],
  ["wrong owner", { read: async () => ({ id: "x", profile_email: "other@example.com", analysis_json: { scanId: "scan-exact" } }) }, /IDENTITY_MISMATCH/],
  ["wrong scan", { read: async () => ({ id: "x", profile_email: "owner@example.com", analysis_json: { scanId: "scan-other" } }) }, /IDENTITY_MISMATCH/],
  ["different readback row", { read: async () => ({ id: "other-id", profile_email: "owner@example.com", analysis_json: { scanId: "scan-exact" } }) }, /IDENTITY_MISMATCH/],
  ["usage persistence failure", { consume: async () => ({ ok: false }) }, /USAGE_PERSISTENCE_FAILED/],
]) {
  test(`${name} cannot mark the operation completed`, async () => {
    const { calls, input } = dependencies(override);
    await assert.rejects(completeAccountScan(input), reason);
    assert.equal(calls.includes("complete"), false);
  });
}
test("unconfirmed durable completion cannot return apparent success", async () => {
  const { input } = dependencies({ finish: async () => null });
  await assert.rejects(completeAccountScan(input), /COMPLETION_NOT_CONFIRMED/);
});
