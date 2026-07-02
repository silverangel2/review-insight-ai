type ToolAuditInput = {
  hasVision?: boolean;
  hasExactListing?: boolean;
  hasReviewEvidence?: boolean;
  hasMemory?: boolean;
  hasStableVerdict?: boolean;
  commentsAnalyzed?: number | null;
  sourcesChecked?: number | null;
  exactListingConfidence?: string | null;
};

export function buildToolAudit(input: ToolAuditInput) {
  const toolsUsed = [
    input.hasVision ? "vision_product_identity" : null,
    input.hasExactListing ? "exact_listing_search" : null,
    input.hasReviewEvidence ? "review_evidence_scan" : null,
    input.hasMemory ? "supabase_product_memory" : null,
    input.hasStableVerdict ? "stable_verdict_engine" : null,
  ].filter(Boolean);

  const commentsAnalyzed = input.commentsAnalyzed ?? 0;
  const sourcesChecked = input.sourcesChecked ?? 0;

  const evidenceLevel =
    commentsAnalyzed >= 30
      ? "strong"
      : commentsAnalyzed >= 15
        ? "usable"
        : commentsAnalyzed >= 5
          ? "limited"
          : commentsAnalyzed > 0 || sourcesChecked > 0
            ? "weak"
            : "none";

  const decisionBasis =
    evidenceLevel === "none"
      ? "screenshot_and_product_identity_only"
      : input.hasMemory
        ? "product_memory_and_review_evidence"
        : "fresh_review_evidence";

  return {
    toolsUsed,
    toolStatus: {
      vision: input.hasVision ? "completed" : "not_used",
      exactListingSearch: input.hasExactListing ? "completed" : "not_confirmed",
      reviewEvidenceScan: input.hasReviewEvidence ? "completed" : "not_enough_evidence",
      productMemory: input.hasMemory ? "completed" : "new_or_not_found",
      stableVerdict: input.hasStableVerdict ? "completed" : "not_used",
    },
    evidenceLevel,
    decisionBasis,
    auditSummary:
      evidenceLevel === "none"
        ? "ReviewIntel identified the product, but review evidence was not enough for a review-based verdict."
        : `ReviewIntel checked ${sourcesChecked} source(s) and analyzed ${commentsAnalyzed} review/comment signal(s).`,
  };
}
