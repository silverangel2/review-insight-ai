import { NextResponse } from "next/server";
import { collectAndAnalyzeReviewEvidence } from "@/lib/reviewEvidence";
import { deriveDeterministicEvidenceResult } from "@/lib/reviewEvidenceDeterminism";
import { ScanCostTelemetry } from "@/lib/scanCostTelemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const telemetry = new ScanCostTelemetry();
  const startedAt = Date.now();
  const evidence = await collectAndAnalyzeReviewEvidence({
    productName: String(body.productName || ""),
    brand: body.brand ? String(body.brand) : undefined,
    model: body.model ? String(body.model) : undefined,
    color: body.color ? String(body.color) : undefined,
    store: body.store ? String(body.store) : undefined,
    price: body.price ?? null,
    rating: body.rating ?? null,
    reviewCount: body.reviewCount ?? null,
    listingUrl: body.listingUrl ? String(body.listingUrl) : null,
    forceRefresh: true,
    costTelemetry: telemetry,
  });
  const adjudication = evidence.evidenceAdjudication;
  const listing = evidence.listingEvidence;
  const canonicalUrl = evidence.verifiedListingUrl || listing?.exactListingUrl || null;
  const asin = listing?.asin || canonicalUrl?.match(/\/(?:dp|product-reviews|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1] || null;
  const exactProductAccepted = evidence.exactListingAccepted === true && Boolean(canonicalUrl) &&
    (!/amazon\.[a-z.]+/i.test(canonicalUrl || "") || Boolean(asin));
  const acceptedRecords = adjudication?.acceptedRecords || [];
  const deterministic = deriveDeterministicEvidenceResult({
    acceptedRecords,
    exactProductAccepted,
    rating: (() => { const value = evidence.rating ?? listing?.rating ?? body.rating; const parsed = Number(String(value || "").replace(/[^0-9.]/g, "")); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; })(),
    marketplaceReviewCount: Number(evidence.marketplaceReviewCount ?? body.reviewCount ?? 0),
    price: (listing?.price ?? body.price) == null ? null : Number(listing?.price ?? body.price),
    verifiedProductMetadata: {
      productName: listing?.exactListingTitle || body.productName || null,
      brand: body.brand || null,
      store: body.store || null,
      canonicalUrl,
      asin,
    },
    riskFeatures: { reviewAuthenticityScore: evidence.reviewAuthenticity?.score ?? null },
    summaryModelVersion: process.env.OPENAI_REVIEW_SEARCH_MODEL || process.env.OPENAI_MODEL || null,
  });
  const snapshot = telemetry.snapshot();

  return NextResponse.json({
    productVerified: exactProductAccepted,
    productName: body.productName || null,
    marketplace: body.store || null,
    canonicalUrl,
    asinOrProductId: asin,
    canCollectReviews: evidence.canCollectReviews === true,
    rejectedListingUrls: evidence.rejectedListingUrls || [],
    listingNotes: evidence.listingEvidence?.notes || [],
    nativeScraperStarted: evidence.retrievalDiagnostics?.nativeScraperStarted === true,
    pagesAttempted: evidence.retrievalDiagnostics?.pagesAttempted ?? null,
    pagesFetched: evidence.retrievalDiagnostics?.pagesFetched ?? null,
    pagesBlocked: evidence.retrievalDiagnostics?.pagesBlocked ?? null,
    rawReviews: evidence.retrievalDiagnostics?.rawWrittenReviews ?? evidence.retrievalDiagnostics?.writtenReviewsExtracted ?? evidence.reviewsCollected ?? 0,
    uniqueReviews: evidence.retrievalDiagnostics?.uniqueWrittenReviews ?? evidence.retrievalDiagnostics?.writtenReviewsExtracted ?? evidence.reviewsCollected ?? 0,
    acceptedExactProductReviews: evidence.retrievalDiagnostics?.writtenReviewsAccepted ?? 0,
    rejectedReviews: evidence.retrievalDiagnostics?.rejectedWrittenReviews ?? adjudication?.rejectedRecordCount ?? null,
    marketplaceReviewCount: evidence.marketplaceReviewCount ?? 0,
    sourceDistribution: acceptedRecords.reduce<Record<string, number>>((counts, record) => { counts[record.sourceUrl || record.source] = (counts[record.sourceUrl || record.source] || 0) + 1; return counts; }, {}),
    corpusHash: deterministic.acceptedCorpusHash,
    retrievalStopReason: evidence.retrievalDiagnostics?.finalStopReason || evidence.exactListingRejectedReason || null,
    analysisReceivedAcceptedCorpus: acceptedRecords.length > 0 && deterministic.acceptedReviewHashes.length === acceptedRecords.length,
    strengthsGrounded: deterministic.strengths.length > 0,
    complaintsGrounded: deterministic.complaints.length > 0,
    openAiDiagnostics: evidence.openAiWebSearchDiagnostics || null,
    cost: snapshot,
    scorerVersion: deterministic.scorerVersion,
    verdictPolicyVersion: deterministic.verdictPolicyVersion,
    buyScore: deterministic.buyScore,
    verdict: deterministic.customerVerdict,
    deterministicResult: deterministic,
    confidence: null,
    value: deterministic.valueForMoney,
    finalEvaluationCompleted: Boolean(deterministic.finalResultHash),
    durationMs: Date.now() - startedAt,
  });
}
