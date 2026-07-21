import assert from "node:assert/strict";
import test from "node:test";
import {
  isInsufficientWrittenReviewEvidence,
  normalizeInsufficientEvidenceResult,
  reviewEvidenceDiagnosticsFromResult,
  shouldShowAlternativeRecommendations,
} from "../lib/insufficientEvidenceContract.ts";

function metadataOnlyResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    analysisVersion: "review-evidence-v2",
    verdict: "CONSIDER",
    confidence: 54,
    buyerConfidence: 54,
    buyingConfidence: 54,
    verdictConfidence: 54,
    buyScore: 5,
    productScore: 5,
    topStrengths: ["No clear strengths found."],
    topComplaints: ["No repeated complaints found."],
    reviewEvidence: {
      status: "insufficient_evidence",
      message: "The product was identified, but sufficient written reviews could not be retrieved.",
      rating: 4.2,
      marketplaceReviewCount: 235,
      commentsAnalyzed: 0,
      reviewsCollected: 0,
      reviewCollector: {
        attempted: true,
        reviewsCollected: 0,
        collectorHasWrittenReviews: false,
        liveRetrieval: {
          enabled: true,
          provider: "firecrawl",
          firecrawlCalled: true,
          candidateUrlCount: 4,
          candidateUrls: ["https://www.amazon.ca/example-product"],
          retrievedPageCount: 1,
          retrievedUrls: ["https://www.amazon.ca/example-product"],
          extractedTextCharacters: 4200,
          extractedWrittenReviewCount: 0,
          acceptedEvidenceCount: 0,
          acceptedIndependentSourceCount: 0,
          rejectedEvidenceReasons: ["no written review bodies extracted"],
          evidenceThresholdPassed: false,
        },
      },
      listingEvidence: {
        exactListingTitle: "PLANTIFIQUE PDRN Exosome Reedle",
        exactListingUrl: "https://www.amazon.ca/example-product",
        store: "Amazon.ca",
        rating: 4.2,
        reviewCount: 235,
      },
    },
    reviewIntelTrace: {
      productIdentityConfidence: "high",
      finalDecisionSource: "verifiedListingMetadata",
    },
    ...overrides,
  };
}

test("listing metadata with zero written reviews returns null confidence", () => {
  const normalized = normalizeInsufficientEvidenceResult(metadataOnlyResult());

  assert.equal(normalized.status, "insufficient_evidence");
  assert.equal(normalized.verdict, null);
  assert.equal(normalized.confidence, null);
  assert.equal(normalized.buyerConfidence, null);
  assert.equal(normalized.buyingConfidence, null);
  assert.equal(normalized.verdictConfidence, null);
  assert.equal(normalized.buyScore, null);
});

test("rating and marketplace review count alone never generate a verdict", () => {
  const normalized = normalizeInsufficientEvidenceResult(metadataOnlyResult({
    verdict: "BUY",
    recommendation: "BUY",
    finalVerdict: "BUY",
  }));

  assert.equal(normalized.verdict, null);
  assert.equal(normalized.recommendation, null);
  assert.equal(normalized.finalVerdict, null);
});

test("no strengths or complaints remain without written evidence", () => {
  const normalized = normalizeInsufficientEvidenceResult(metadataOnlyResult({
    strengths: ["Looks popular"],
    complaints: ["Unknown"],
  }));

  assert.deepEqual(normalized.topStrengths, []);
  assert.deepEqual(normalized.topComplaints, []);
  assert.deepEqual(normalized.strengths, []);
  assert.deepEqual(normalized.complaints, []);
});

test("alternative recommendations are disabled for insufficient evidence", () => {
  assert.equal(shouldShowAlternativeRecommendations(metadataOnlyResult()), false);
});

test("product-identification confidence never appears as verdict confidence", () => {
  const normalized = normalizeInsufficientEvidenceResult(metadataOnlyResult({
    reviewIntelTrace: {
      productIdentityConfidence: "high",
      verdictConfidenceAudit: { verdictConfidence: 54 },
    },
  }));

  assert.equal(normalized.confidence, null);
  assert.equal(normalized.verdictConfidence, null);
});

test("Firecrawl response with only product metadata is rejected", () => {
  const result = metadataOnlyResult();
  const diagnostics = reviewEvidenceDiagnosticsFromResult(result);

  assert.equal(diagnostics.firecrawlCalled, true);
  assert.equal(diagnostics.extractedTextCharacters, 4200);
  assert.equal(diagnostics.extractedWrittenReviewCount, 0);
  assert.equal(diagnostics.evidenceThresholdPassed, false);
  assert.equal(isInsufficientWrittenReviewEvidence(result), true);
});

test("Firecrawl response with actual written reviews can proceed to analysis", () => {
  const result = metadataOnlyResult({
    status: "sufficient_evidence",
    verdict: "BUY",
    confidence: 82,
    reviewEvidence: {
      status: "sufficient_evidence",
      commentsAnalyzed: 8,
      reviewsCollected: 8,
      reviewCollector: {
        attempted: true,
        reviewsCollected: 8,
        collectorHasWrittenReviews: true,
        liveRetrieval: {
          enabled: true,
          provider: "firecrawl",
          firecrawlCalled: true,
          candidateUrlCount: 5,
          retrievedPageCount: 4,
          extractedTextCharacters: 24000,
          extractedWrittenReviewCount: 8,
          acceptedEvidenceCount: 8,
          acceptedIndependentSourceCount: 3,
          evidenceThresholdPassed: true,
          evidenceThreshold: {
            passed: true,
            status: "sufficient_evidence",
            acceptedIndependentSourceCount: 3,
            usableReviewCount: 8,
            confidence: 82,
          },
        },
      },
      evidenceThreshold: {
        passed: true,
        status: "sufficient_evidence",
        acceptedIndependentSourceCount: 3,
        usableReviewCount: 8,
        confidence: 82,
      },
    },
    reviewIntelTrace: {
      finalDecisionSource: "reviewEvidence",
    },
  });

  assert.equal(isInsufficientWrittenReviewEvidence(result), false);
  assert.equal(normalizeInsufficientEvidenceResult(result).confidence, 82);
});
