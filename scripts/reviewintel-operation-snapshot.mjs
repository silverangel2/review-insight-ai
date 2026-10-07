const missing = "NOT_CAPTURED";
const knownNumber = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

function groundedClaims(claims, acceptedHashes) {
  if (!Array.isArray(claims) || !Array.isArray(acceptedHashes)) return missing;
  const accepted = new Set(acceptedHashes);
  return claims.every(item => item?.provenance === "ACCEPTED_WRITTEN_REVIEW"
    && Array.isArray(item.sourceHashes) && item.sourceHashes.length > 0
    && item.sourceHashes.every(hash => accepted.has(hash))
    && Array.isArray(item.sourceIds) && item.sourceIds.length > 0) ? "YES" : "NO";
}

// Pure formatting: importing this module never reads credentials or starts polling.
export function operationMonitorSnapshot(row) {
  const result = row?.result_json && typeof row.result_json === "object" ? row.result_json : {};
  const evidence = result.reviewEvidence && typeof result.reviewEvidence === "object" ? result.reviewEvidence : {};
  const trace = result.reviewIntelTrace && typeof result.reviewIntelTrace === "object" ? result.reviewIntelTrace : {};
  const cost = result.costTelemetry && typeof result.costTelemetry === "object" ? result.costTelemetry : {};
  const diagnostics = evidence.retrievalDiagnostics && typeof evidence.retrievalDiagnostics === "object" ? evidence.retrievalDiagnostics : {};
  const native = evidence.nativeRetrievalDiagnostics && typeof evidence.nativeRetrievalDiagnostics === "object" ? evidence.nativeRetrievalDiagnostics : {};
  const identity = result.productIdentity && typeof result.productIdentity === "object" ? result.productIdentity : {};
  const accepted = knownNumber(result.acceptedExactProductReviews)
    ?? (Array.isArray(result.acceptedReviewHashes) ? result.acceptedReviewHashes.length : null);
  const searchCalls = knownNumber(cost.searchProviderCalls);
  const otherPaidCalls = knownNumber(cost.otherPaidProviderCalls);
  return {
    SCAN_ID: row?.scan_id || result.scanId || missing,
    RESULT_ID: result.analysisId || result.resultId || missing,
    PRODUCT_NAME: result.productName || result.product?.name || missing,
    MARKETPLACE: result.store || result.product?.store || identity.store || missing,
    ASIN_OR_PRODUCT_ID: identity.asin || result.verifiedProductMetadata?.asin || missing,
    PRODUCT_VERIFIED: typeof result.exactListingAccepted === "boolean" ? (result.exactListingAccepted ? "YES" : "NO") : missing,
    RETRIEVAL_LAYERS_INVOKED: result.retrievalLayersInvoked ?? missing,
    PAGES_ATTEMPTED: native.attemptedPages ?? diagnostics.pagesFetched ?? missing,
    PAGES_FETCHED: diagnostics.pagesFetched ?? native.normalFetchSuccesses ?? missing,
    PAGES_BLOCKED: native.pagesBlocked ?? missing,
    RAW_REVIEWS_RETRIEVED: evidence.reviewsFound ?? missing,
    UNIQUE_REVIEWS: evidence.reviewsCollected ?? missing,
    ACCEPTED_EXACT_PRODUCT_REVIEWS: accepted ?? missing,
    REJECTED_REVIEWS: evidence.evidenceAdjudication?.rejectedRecordCount ?? missing,
    SOURCE_DISTRIBUTION: trace.reviewEvidence?.sourceDistribution ?? result.sourceDistribution ?? missing,
    FINAL_RETRIEVAL_STOP_REASON: native.stopReason || evidence.nativeRetrievalStopReason || missing,
    CORPUS_HASH: result.acceptedCorpusHash || missing,
    OPENAI_CALLS: cost.openAiCalls ?? missing,
    OPENAI_INPUT_TOKENS: cost.openAiInputTokens ?? missing,
    OPENAI_OUTPUT_TOKENS: cost.openAiOutputTokens ?? missing,
    OPENAI_TOTAL_TOKENS: cost.openAiTotalTokens ?? missing,
    FIRECRAWL_CALLS: cost.firecrawlCalls ?? missing,
    SEARCH_PROVIDER_CALLS: cost.searchProviderCalls ?? missing,
    TOTAL_PAID_PROVIDER_CALLS: searchCalls !== null && otherPaidCalls !== null ? searchCalls + otherPaidCalls : missing,
    TOTAL_RETRIEVAL_REQUESTS: cost.totalRetrievalRequests ?? missing,
    SCAN_DURATION_MS: cost.totalScanDurationMs ?? missing,
    ESTIMATED_SCAN_COST_USD: cost.estimatedScanCostUsd ?? missing,
    SCORER_VERSION: result.scorerVersion || missing,
    VERDICT_POLICY_VERSION: result.verdictPolicyVersion || missing,
    BUY_SCORE: result.buyScore ?? missing,
    VERDICT: result.verdict || missing,
    CONFIDENCE: result.confidence ?? result.verdictConfidence ?? missing,
    VALUE: result.valueForMoney || result.value || missing,
    STRENGTHS_GROUNDED: groundedClaims(result.strengthProvenance, result.acceptedReviewHashes),
    COMPLAINTS_GROUNDED: groundedClaims(result.complaintProvenance, result.acceptedReviewHashes),
    COST_SAFE_FOR_PUBLIC_APP: "NOT_VALIDATED",
    DEEP_RETRIEVAL_PROVEN: "NOT_VALIDATED",
    PASSIVE_MONITOR_CAPTURED_SCAN: "YES",
  };
}
