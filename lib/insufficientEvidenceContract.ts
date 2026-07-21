export const INSUFFICIENT_WRITTEN_REVIEW_MESSAGE =
  "ReviewIntel identified the product, but could not retrieve enough readable written reviews to issue a verdict.";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function firstRecord(...values: unknown[]): AnyRecord {
  for (const value of values) {
    const record = asRecord(value);
    if (Object.keys(record).length) return record;
  }

  return {};
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function firstFiniteNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = asFiniteNumber(value);
    if (parsed !== null) return parsed;
  }

  return 0;
}

function evidenceRecordFor(result: unknown): AnyRecord {
  const root = asRecord(result);
  const analysis = asRecord(root.analysis);
  return firstRecord(root.reviewEvidence, analysis.reviewEvidence);
}

export function reviewEvidenceDiagnosticsFromResult(result: unknown) {
  const root = asRecord(result);
  const evidence = evidenceRecordFor(root);
  const collector = asRecord(evidence.reviewCollector);
  const live = firstRecord(
    collector.liveRetrieval,
    evidence.liveRetrieval,
    evidence.diagnostics,
    asRecord(root.reviewIntelTrace).extractionDiagnostics
  );
  const threshold = firstRecord(evidence.evidenceThreshold, live.evidenceThreshold);

  const usableWrittenReviewCount = firstFiniteNumber(
    evidence.commentsAnalyzed,
    evidence.reviewsCollected,
    collector.reviewsCollected,
    live.extractedWrittenReviewCount
  );
  const acceptedEvidenceCount = firstFiniteNumber(
    live.acceptedEvidenceCount,
    threshold.usableReviewCount,
    live.extractedWrittenReviewCount,
    evidence.commentsAnalyzed
  );
  const acceptedIndependentSourceCount = firstFiniteNumber(
    threshold.acceptedIndependentSourceCount,
    live.acceptedIndependentSourceCount
  );
  const evidenceThresholdPassed =
    threshold.passed === true ||
    live.evidenceThresholdPassed === true ||
    String(evidence.status || "") === "sufficient_evidence";

  return {
    firecrawlCalled:
      live.firecrawlCalled === true ||
      (live.enabled === true && String(live.provider || "").toLowerCase() === "firecrawl"),
    candidateUrlCount: firstFiniteNumber(live.candidateUrlCount, Array.isArray(live.candidateUrls) ? live.candidateUrls.length : 0),
    retrievedPageCount: firstFiniteNumber(live.retrievedPageCount, Array.isArray(live.retrievedUrls) ? live.retrievedUrls.length : 0),
    extractedTextCharacters: firstFiniteNumber(live.extractedTextCharacters),
    extractedWrittenReviewCount: firstFiniteNumber(live.extractedWrittenReviewCount, collector.reviewsCollected),
    usableWrittenReviewCount,
    acceptedEvidenceCount,
    acceptedIndependentSourceCount,
    rejectedEvidenceReasons: Array.isArray(live.rejectedEvidenceReasons)
      ? live.rejectedEvidenceReasons.map(String).filter(Boolean)
      : Array.isArray(live.rejectedPages)
        ? live.rejectedPages
            .map((item) => asRecord(item).reason)
            .map(String)
            .filter(Boolean)
        : [],
    evidenceThresholdPassed,
  };
}

export function isInsufficientWrittenReviewEvidence(result: unknown): boolean {
  const root = asRecord(result);
  const evidence = evidenceRecordFor(root);
  const trace = asRecord(root.reviewIntelTrace);
  const diagnostics = reviewEvidenceDiagnosticsFromResult(root);
  const analysisVersion = String(root.analysisVersion || "");
  const evidenceStatus = String(evidence.status || root.status || "");
  const decisionStatus = String(root.decisionStatus || "");
  const finalDecisionSource = String(trace.finalDecisionSource || root.finalDecisionSource || root.decisionSource || "");
  const verdict = String(root.verdict || root.finalVerdict || root.recommendation || "").toUpperCase();
  const message = String(evidence.message || root.message || root.bottomLine || "").toLowerCase();

  if (evidenceStatus === "insufficient_evidence") return true;
  if (decisionStatus === "not_enough_evidence") return true;
  if (finalDecisionSource === "reviewEvidenceNotEnough") return true;
  if (verdict === "REVIEW EVIDENCE NOT ENOUGH") return true;
  if (message.includes("sufficient written reviews could not be retrieved")) return true;
  if (message.includes("could not retrieve enough readable written reviews")) return true;

  if (analysisVersion === "review-evidence-v2") {
    return (
      diagnostics.usableWrittenReviewCount === 0 ||
      diagnostics.acceptedEvidenceCount === 0 ||
      !diagnostics.evidenceThresholdPassed
    );
  }

  return false;
}

export function normalizeInsufficientEvidenceResult<T extends AnyRecord>(value: T): T {
  if (!isInsufficientWrittenReviewEvidence(value)) return value;

  const evidence = evidenceRecordFor(value);
  const trace = asRecord(value.reviewIntelTrace);
  const diagnostics = reviewEvidenceDiagnosticsFromResult(value);

  return {
    ...value,
    status: "insufficient_evidence",
    evidenceStatus: "insufficient_written_review_evidence",
    evidenceReason: "product_metadata_found",
    verdict: null,
    recommendation: null,
    finalVerdict: null,
    stableVerdict: null,
    decisionStatus: "not_enough_evidence",
    buyerConfidence: null,
    buyingConfidence: null,
    confidence: null,
    verdictConfidence: null,
    buyScore: null,
    score: null,
    productScore: null,
    aiLikeReviewRisk: null,
    valueForMoney: "Unknown",
    value: "Unknown",
    topStrengths: [],
    topComplaints: [],
    strengths: [],
    complaints: [],
    bestFor: [],
    notIdealFor: [],
    bottomLine: INSUFFICIENT_WRITTEN_REVIEW_MESSAGE,
    summary: INSUFFICIENT_WRITTEN_REVIEW_MESSAGE,
    stableVerdictReason: INSUFFICIENT_WRITTEN_REVIEW_MESSAGE,
    reviewEvidence: {
      ...evidence,
      status: "insufficient_evidence",
      verdict: null,
      confidence: null,
      message: INSUFFICIENT_WRITTEN_REVIEW_MESSAGE,
      reviewSnippets: [],
      repeatedPraises: [],
      repeatedComplaints: [],
      productPros: [],
      productCons: [],
    },
    reviewIntelTrace: {
      ...trace,
      finalDecisionSource: "reviewEvidenceNotEnough",
      extractionDiagnostics: diagnostics,
    },
  } as T;
}

export function shouldShowAlternativeRecommendations(result: unknown): boolean {
  return !isInsufficientWrittenReviewEvidence(result);
}
