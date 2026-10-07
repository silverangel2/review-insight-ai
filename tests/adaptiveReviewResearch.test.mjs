import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../tests/adaptive-review-test.js", import.meta.url).pathname);
const { runAdaptiveReviewResearch } = jiti("../lib/adaptiveReviewResearch.ts");

const queries = [
  "TEST PRODUCT ALPHA reviews",
  "TEST PRODUCT ALPHA customer reviews",
  "TEST PRODUCT ALPHA complaints problems",
  "TEST PRODUCT ALPHA Reddit community discussion",
  "TEST PRODUCT ALPHA model reviews",
];

function record(id, product = "TEST PRODUCT ALPHA") {
  return { body: `${product} review ${id}: I used it and the battery lasts all day.`, source: product };
}

function run({ batches, sufficientAt = 3, maxCalls = 5, stagnantPasses = 2 } = {}) {
  let searches = 0;
  return runAdaptiveReviewResearch({
    queries,
    maxCalls,
    stagnantPasses,
    sufficient: (records) => records.length >= sufficientAt,
    search: async () => {
      searches += 1;
      return [`https://example.test/reviews/${searches}`];
    },
    collect: async (_urls, _query, pass) => batches?.[pass - 1] || [],
    exactProduct: (review) => review.source === "TEST PRODUCT ALPHA",
  }).then((result) => ({ result, searches }));
}

test("native sufficient path needs no adaptive provider call", async () => {
  const { result, searches } = await run({ batches: [], sufficientAt: 0 });
  assert.equal(searches, 0);
  assert.equal(result.stopReason, "no_research_passes_available");
});

test("native insufficiency recovers exact-product written reviews and stops when sufficient", async () => {
  const { result, searches } = await run({ batches: [[record("1")], [record("2"), record("3")]] });
  assert.equal(searches, 2);
  assert.equal(result.records.length, 3);
  assert.equal(result.stopReason, "sufficient");
  assert.deepEqual(result.diagnostics.map((item) => item.SUFFICIENCY), ["NOT_ENOUGH", "SUFFICIENT"]);
});

test("two stagnant passes stop without inventing evidence", async () => {
  const { result, searches } = await run({ batches: [[], []], sufficientAt: 3 });
  assert.equal(searches, 2);
  assert.equal(result.records.length, 0);
  assert.equal(result.stopReason, "stagnant_pass_limit");
});

test("five-call maximum is hard even when every pass is useful", async () => {
  const { result, searches } = await run({
    batches: [[record("1")], [record("2")], [record("3")], [record("4")], [record("5")]],
    sufficientAt: 99,
  });
  assert.equal(searches, 5);
  assert.equal(result.providerCalls, 5);
  assert.equal(result.stopReason, "max_web_search_calls");
});

test("wrong product is rejected, duplicate copies are deduplicated, and one review cannot multiply themes", async () => {
  const duplicate = record("same");
  const { result } = await run({
    batches: [[duplicate, duplicate, record("wrong", "TEST PRODUCT BETA")]],
    sufficientAt: 2,
  });
  assert.equal(result.records.length, 1);
  assert.equal(result.diagnostics[0].NEW_RECORDS, 1);
  assert.equal(result.diagnostics[0].DEDUPED_RECORDS, 1);
  assert.equal(result.stopReason, "stagnant_pass_limit");
});

test("metadata-only and timeout-like empty provider responses remain NOT_ENOUGH", async () => {
  const { result } = await run({ batches: [[], [], [], [], []], sufficientAt: 3 });
  assert.equal(result.records.length, 0);
  assert.equal(result.diagnostics.at(-1).SUFFICIENCY, "NOT_ENOUGH");
  assert.ok(["stagnant_pass_limit", "max_web_search_calls"].includes(result.stopReason));
});

test("provider timing failure is explicit retrieval failure with no evidence", async () => {
  const result = await runAdaptiveReviewResearch({
    queries,
    maxCalls: 5,
    sufficient: (records) => records.length >= 3,
    search: async () => { throw new Error("timeout"); },
    collect: async () => [],
    exactProduct: () => true,
  });
  assert.equal(result.records.length, 0);
  assert.equal(result.stopReason, "retrieval_failure");
  assert.equal(result.diagnostics[0].SUFFICIENCY, "NOT_ENOUGH");
});
