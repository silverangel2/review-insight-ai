import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { operationMonitorSnapshot } from "../scripts/reviewintel-operation-snapshot.mjs";

const source = fs.readFileSync(new URL("../scripts/reviewintel-passive-monitor.mjs", import.meta.url), "utf8");

test("passive monitor watches persisted operations and attaches to the exact new scan", () => {
  assert.match(source, /created_at=gte\./);
  assert.match(source, /NEW_SCAN_CREATED=\$\{operation\.scan_id\}/);
  assert.match(source, /scan_id=eq\.\$\{encodeURIComponent\(scanId\)\}/);
  assert.match(source, /recordFromOperation = operationMonitorSnapshot/);
  assert.doesNotMatch(source, /FIRECRAWL_CALLS: cost\.firecrawlCalls \?\? 0/);
});

test("missing persisted evidence and telemetry remain unknown", () => {
  const snapshot = operationMonitorSnapshot({scan_id:"missing",result_json:{}});
  for (const field of ["ACCEPTED_EXACT_PRODUCT_REVIEWS", "FIRECRAWL_CALLS", "TOTAL_PAID_PROVIDER_CALLS", "PRODUCT_VERIFIED", "RETRIEVAL_LAYERS_INVOKED", "STRENGTHS_GROUNDED"]) {
    assert.equal(snapshot[field], "NOT_CAPTURED", field);
  }
  assert.equal(snapshot.COST_SAFE_FOR_PUBLIC_APP,"NOT_VALIDATED");
  assert.equal(snapshot.DEEP_RETRIEVAL_PROVEN,"NOT_VALIDATED");
});

test("observed zeros and current accepted-review provenance are preserved", () => {
  const result = {
    acceptedExactProductReviews:0, exactListingAccepted:false,
    costTelemetry:{firecrawlCalls:0,searchProviderCalls:0,otherPaidProviderCalls:0,openAiTotalTokens:null},
    acceptedReviewHashes:["accepted-hash"],
    strengthProvenance:[{provenance:"ACCEPTED_WRITTEN_REVIEW",sourceHashes:["accepted-hash"],sourceIds:["evidence-id"]}],
    complaintProvenance:[{provenance:"ACCEPTED_WRITTEN_REVIEW",sourceHashes:["wrong-hash"],sourceIds:["other-id"]}],
  };
  const snapshot=operationMonitorSnapshot({result_json:result});
  assert.equal(snapshot.ACCEPTED_EXACT_PRODUCT_REVIEWS,0);
  assert.equal(snapshot.PRODUCT_VERIFIED,"NO");
  assert.equal(snapshot.FIRECRAWL_CALLS,0);
  assert.equal(snapshot.TOTAL_PAID_PROVIDER_CALLS,0);
  assert.equal(snapshot.OPENAI_TOTAL_TOKENS,"NOT_CAPTURED");
  assert.equal(snapshot.STRENGTHS_GROUNDED,"YES");
  assert.equal(snapshot.COMPLAINTS_GROUNDED,"NO");
});
