import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../", import.meta.url).pathname, { alias: { "@": new URL("../", import.meta.url).pathname } });
const { ScanCostTelemetry, SCAN_COST_LIMITS, IDENTITY_STAGE_LIMITS } = jiti("./lib/scanCostTelemetry.ts");

test("scan telemetry records high OpenAI usage without blocking the scan", () => {
  const telemetry = new ScanCostTelemetry();
  for (let index = 0; index < SCAN_COST_LIMITS.maxOpenAiCalls; index += 1) {
    assert.equal(telemetry.canStartOpenAiCall(), true);
    telemetry.recordOpenAiCall({ inputTokens: 10, outputTokens: 5 });
  }
  assert.equal(telemetry.canStartOpenAiCall(), true);
  const snapshot = telemetry.snapshot();
  assert.equal(snapshot.openAiCalls, SCAN_COST_LIMITS.maxOpenAiCalls);
  assert.equal(snapshot.openAiTotalTokens, SCAN_COST_LIMITS.maxOpenAiCalls * 15);
  assert.equal(snapshot.tokenUsageHigh, false);
  assert.deepEqual(snapshot.blockedReasons, []);

  const high = new ScanCostTelemetry();
  high.recordOpenAiUsage({ inputTokens: 100_000, outputTokens: 30_000 });
  for (let index = 0; index < SCAN_COST_LIMITS.maxRetrievalRequests; index += 1) {
    high.recordRetrievalRequest("paid");
  }
  const highSnapshot = high.snapshot();
  assert.equal(high.canStartOpenAiCall(), true);
  assert.equal(high.canStartRetrievalRequest(), true);
  assert.equal(highSnapshot.tokenUsageHigh, true);
  assert.equal(highSnapshot.providerUsageHigh, true);
});

test("unknown provider usage remains unknown instead of being reported as zero", () => {
  const telemetry = new ScanCostTelemetry();
  telemetry.recordOpenAiCall();
  telemetry.recordOpenAiUsage();
  const snapshot = telemetry.snapshot();
  assert.equal(snapshot.openAiCalls, 1);
  assert.equal(snapshot.openAiTotalTokens, null);
  assert.equal(snapshot.estimatedScanCostUsd, null);
});

test("identity-stage provider work remains observable without hard cost blocking", () => {
  const telemetry = new ScanCostTelemetry();
  for (let index = 0; index < IDENTITY_STAGE_LIMITS.maxSearchRequests; index += 1) {
    assert.equal(telemetry.canStartIdentitySearchRequest(), true);
    telemetry.recordIdentitySearchRequest("search");
  }
  assert.equal(telemetry.canStartIdentitySearchRequest(), true);

  const identityAi = new ScanCostTelemetry();
  for (let index = 0; index < IDENTITY_STAGE_LIMITS.maxOpenAiCalls; index += 1) {
    assert.equal(identityAi.canStartIdentityOpenAiCall(), true);
    identityAi.recordIdentityOpenAiCall();
    identityAi.recordIdentityOpenAiUsage({ inputTokens: 100, outputTokens: 50 });
  }
  assert.equal(identityAi.canStartIdentityOpenAiCall(), true);
  assert.equal(identityAi.snapshot().identityStage.openAiCalls, IDENTITY_STAGE_LIMITS.maxOpenAiCalls);

  const unknown = new ScanCostTelemetry();
  unknown.recordIdentityOpenAiCall();
  unknown.recordIdentityOpenAiUsage();
  assert.equal(unknown.canStartIdentityOpenAiCall(), true);
  assert.equal(unknown.snapshot().identityStage.openAiTokens, null);
});

test('a missing key is not counted as an OpenAI request', async () => {
  const { callOpenAiResponseWithoutWebSearch, createOpenAiWebSearchContext } = jiti('./lib/openAiWebSearch.ts');
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const telemetry = new ScanCostTelemetry();
    await callOpenAiResponseWithoutWebSearch({ input: 'test-only', context: createOpenAiWebSearchContext({costTelemetry: telemetry}) });
    assert.equal(telemetry.snapshot().openAiCalls, 0);
    assert.equal(telemetry.snapshot().openAiTotalTokens, 0);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test('a started request with unreported usage cannot appear as zero tokens', () => {
  const telemetry = new ScanCostTelemetry();
  telemetry.recordOpenAiCall();
  assert.equal(telemetry.snapshot().openAiTotalTokens, null);
  assert.equal(telemetry.canStartOpenAiCall(), true);
});
