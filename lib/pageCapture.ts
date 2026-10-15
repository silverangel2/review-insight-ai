/**
 * Shopper-submitted product page. The browser already showed these reviews.
 * This module checks the payload and scores it with Buying Score v2.
 * No network. No OpenAI.
 */

import {
  buyingConfidenceFromV2,
  buyingScoreFromReviews,
  customerFacingDecision,
  dedupeAcrossStores,
  hasReadableText,
  shopperBottomLineForBuyingScore,
  type WrittenReview,
} from "@/lib/buyingScore";
import {
  amazonStableId,
  bestBuyIdentity,
  homeDepotIdentity,
  targetTcin,
  walmartItemId,
  type StoreId,
} from "@/lib/storeCollectors";
import { supportedShopperStore } from "@/lib/linkScanBlocked";
import {
  LIBRARY_CORPUS_CAP,
  libraryProductKeyFor,
  loadLibraryCorpus,
  saveLibraryCorpus,
} from "@/lib/productReviewLibrary";

export const PAGE_CAPTURE_LIMITS = {
  maxBytes: 180_000,
  maxReviews: 40,
  maxReviewChars: 4_000,
  maxTitleChars: 300,
  maxUrlChars: 2_000,
};

export type PageCaptureReview = {
  title: string | null;
  text: string;
  stars: number | null;
  date: string | null;
  verified: boolean;
};

export type PageCapture = {
  url: string;
  productId: string;
  store: StoreId;
  title: string;
  rating: number | null;
  ratingCount: number | null;
  reviews: PageCaptureReview[];
  duplicatesRemoved: number;
};

export type PageCaptureRejection = { ok: false; status: number; error: string; code: string };
export type PageCaptureOk = { ok: true; capture: PageCapture };

const FORBIDDEN_SHOPPER_COPY = /written reviews read|not scored|not enough evidence|no reviews analyzed|vercel/i;

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, digits: string) => {
      const code = Number(digits);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    });
}

/** Drop tags and control characters. Review text is plain text after this. */
export function sanitizeShopperText(value: unknown, max: number) {
  const text = decodeEntities(String(value ?? ""))
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).trim() : text;
}

function rejection(status: number, error: string, code: string): PageCaptureRejection {
  return { ok: false, status, error, code };
}

export function productIdentityFromUrl(value: string): { store: StoreId; id: string } | null {
  const url = String(value || "").trim();
  if (!supportedShopperStore(url)) return null;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== "https:") return null;
  const amazon = amazonStableId(url);
  if (amazon && /amazon\./i.test(parsed.hostname)) return { store: "amazon", id: amazon };
  const walmart = walmartItemId(url);
  if (walmart) return { store: "walmart", id: walmart };
  const bestBuy = bestBuyIdentity(url);
  if (bestBuy) return { store: "bestbuy", id: bestBuy.sku };
  const target = targetTcin(url);
  if (target) return { store: "target", id: target };
  const homeDepot = homeDepotIdentity(url);
  if (homeDepot) return { store: "homedepot", id: homeDepot.id };
  return null;
}

function finiteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function starsOf(value: unknown) {
  const number = finiteNumber(value);
  if (number === null || number < 1 || number > 5) return null;
  return Math.round(number * 10) / 10;
}

function countOf(value: unknown) {
  const number = finiteNumber(value);
  if (number === null || number <= 0 || number > 50_000_000) return null;
  return Math.floor(number);
}

export function validatePageCapture(body: unknown): PageCaptureOk | PageCaptureRejection {
  const raw = JSON.stringify(body ?? "");
  if (raw.length > PAGE_CAPTURE_LIMITS.maxBytes) {
    return rejection(413, "That page is too large to analyze. Stay on the product page you are viewing and try again.", "PAYLOAD_TOO_LARGE");
  }
  const source = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  if (!source) return rejection(400, "Send the product page you are viewing.", "INVALID_CAPTURE");

  const url = sanitizeShopperText(source.url, PAGE_CAPTURE_LIMITS.maxUrlChars);
  const identity = productIdentityFromUrl(url);
  if (!identity) return rejection(400, "Open a product page, then try again.", "UNSUPPORTED_PAGE");

  const productId = sanitizeShopperText(source.productId, 40);
  if (!productId || productId.toLowerCase() !== identity.id.toLowerCase()) {
    return rejection(400, "The product on the page does not match that link.", "PRODUCT_ID_MISMATCH");
  }

  const title = sanitizeShopperText(source.title, PAGE_CAPTURE_LIMITS.maxTitleChars);
  const reviewsIn = Array.isArray(source.reviews) ? source.reviews : null;
  if (!reviewsIn) return rejection(400, "Send the reviews that are visible on the page.", "INVALID_CAPTURE");
  if (reviewsIn.length > PAGE_CAPTURE_LIMITS.maxReviews) {
    return rejection(400, "Only the reviews already visible on this page can be analyzed.", "TOO_MANY_REVIEWS");
  }

  const cleaned: Array<WrittenReview & { verified: boolean }> = [];
  for (const item of reviewsIn) {
    const review = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const text = sanitizeShopperText(review.text ?? review.body, PAGE_CAPTURE_LIMITS.maxReviewChars);
    const reviewTitle = sanitizeShopperText(review.title, 200);
    if (!hasReadableText({ body: text })) continue;
    cleaned.push({
      body: text,
      title: reviewTitle || null,
      rating: starsOf(review.stars ?? review.rating),
      date: sanitizeShopperText(review.date, 80) || null,
      source: identity.store,
      sourceUrl: url,
      verified: review.verified === true || review.verified === "true",
    });
  }

  const deduped = dedupeAcrossStores(cleaned);
  const reviews: PageCaptureReview[] = deduped.map((review) => ({
    title: review.title || null,
    text: review.body,
    stars: starsOf(review.rating),
    date: review.date || null,
    verified: review.verified === true,
  }));

  return {
    ok: true,
    capture: {
      url,
      productId: identity.id,
      store: identity.store,
      title: title || "Product",
      rating: starsOf(source.rating),
      ratingCount: countOf(source.ratingCount),
      reviews,
      duplicatesRemoved: cleaned.length - deduped.length,
    },
  };
}

const STORE_LABEL: Record<StoreId, string> = {
  amazon: "Amazon",
  walmart: "Walmart",
  bestbuy: "Best Buy",
  target: "Target",
  homedepot: "Home Depot",
};

/**
 * Product review library integration for the page-capture lane.
 *
 * A validated capture knows the product identity exactly (URL + productId),
 * so captures consolidate with the stored corpus the same way scans do:
 * stored reviews merge with the captured ones BEFORE scoring, and the scored
 * corpus is saved back. Everything is fail-soft: any library error leaves
 * page-capture behaving exactly as it did without the library. Zero OpenAI.
 */
export const CAPTURE_LIBRARY_PROVENANCE = "shopper_page_capture";

type LibraryScoredReview = WrittenReview & { verified: boolean; provenance?: unknown };

/**
 * Exact library key for a validated capture. The marketplace comes from the
 * capture URL's hostname so the key space matches the scan path's
 * (e.g. "amazon.ca:B0DGJDKHRQ"), not the short store id.
 */
export function pageCaptureLibraryKey(capture: PageCapture): string | null {
  let marketplace: string | null = null;
  try {
    marketplace = new URL(capture.url).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    marketplace = null;
  }
  return libraryProductKeyFor({
    asin: capture.productId,
    canonicalMarketplace: marketplace,
    store: capture.store,
    listingUrl: capture.url,
  });
}

export function captureReviewToWritten(review: PageCaptureReview, capture: PageCapture): LibraryScoredReview {
  return {
    body: review.text,
    title: review.title,
    rating: review.stars,
    date: review.date,
    source: capture.store,
    sourceUrl: capture.url,
    verified: review.verified === true,
  };
}

/** Map a stored library record back into a scorable review. Records without readable text are dropped. */
export function libraryRecordToWrittenReview(record: unknown): LibraryScoredReview | null {
  if (!record || typeof record !== "object") return null;
  const rec = record as Record<string, unknown>;
  const body = String(rec.body ?? "");
  if (!hasReadableText({ body })) return null;
  const rating = typeof rec.rating === "number" && Number.isFinite(rec.rating) ? rec.rating : null;
  const review: LibraryScoredReview = {
    body,
    title: typeof rec.title === "string" ? rec.title : null,
    rating,
    date: typeof rec.date === "string" ? rec.date : null,
    source: typeof rec.source === "string" && rec.source ? rec.source : "unknown",
    sourceUrl: typeof rec.sourceUrl === "string" && rec.sourceUrl ? rec.sourceUrl : null,
    verified: rec.verified === true,
  };
  if (rec.provenance !== undefined) review.provenance = rec.provenance;
  return review;
}

/**
 * Fresh-first concat + exact-JSON dedupe + cap. Mirrors mergeUnknownArrays in
 * lib/reviewEvidence.ts (which is not exported there) — the same dedupe the
 * scan path applies before its shared adjudication pass.
 */
export function mergeCaptureReviewSets(
  left: LibraryScoredReview[],
  right: LibraryScoredReview[],
  limit: number
): LibraryScoredReview[] {
  const merged = [...left, ...right];
  const seen = new Set<string>();
  const next: LibraryScoredReview[] = [];
  for (const item of merged) {
    let key: string;
    try {
      key = JSON.stringify(item).toLowerCase();
    } catch {
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
    if (next.length >= limit) break;
  }
  return next;
}

export type CaptureLibraryConsolidation = {
  written: LibraryScoredReview[];
  productKey: string | null;
  previousScanCount: number;
  libraryReviewCount: number;
};

/** Load the stored corpus for this capture's product and merge it with the fresh reviews. Fail-soft. */
export async function consolidateCaptureWithLibrary(capture: PageCapture): Promise<CaptureLibraryConsolidation> {
  const fresh = capture.reviews.map((review) => captureReviewToWritten(review, capture));
  const productKey = pageCaptureLibraryKey(capture);
  if (!productKey) return { written: fresh, productKey: null, previousScanCount: 0, libraryReviewCount: 0 };
  try {
    const entry = await loadLibraryCorpus(productKey);
    const stored: LibraryScoredReview[] = [];
    for (const record of entry.reviews) {
      const review = libraryRecordToWrittenReview(record);
      if (review) stored.push(review);
    }
    // Exact dedupe first, then the cross-store fuzzy dedupe — the same
    // family of helpers the scan path uses.
    const merged = dedupeAcrossStores(mergeCaptureReviewSets(fresh, stored, LIBRARY_CORPUS_CAP));
    return { written: merged, productKey, previousScanCount: entry.scanCount, libraryReviewCount: stored.length };
  } catch {
    return { written: fresh, productKey: null, previousScanCount: 0, libraryReviewCount: 0 };
  }
}

export function scorePageCapture(capture: PageCapture, scanId: string) {
  return scoreCaptureReviews(
    capture,
    capture.reviews.map((review) => captureReviewToWritten(review, capture)),
    scanId
  );
}

/**
 * Library-consolidated scoring for the page-capture route: stored reviews
 * merge with the captured ones BEFORE the verdict, and the scored corpus is
 * saved back to the library. Any library failure (load or save) leaves the
 * capture scoring exactly as it would have been without the library.
 */
export async function scorePageCaptureWithLibrary(capture: PageCapture, scanId: string) {
  const consolidation = await consolidateCaptureWithLibrary(capture);
  const result = scoreCaptureReviews(capture, consolidation.written, scanId);
  if (consolidation.productKey && consolidation.written.length > 0) {
    try {
      await saveLibraryCorpus({
        productKey: consolidation.productKey,
        canonicalUrl: capture.url,
        productName: capture.title || null,
        brand: null,
        store: (() => {
          try {
            return new URL(capture.url).hostname.toLowerCase().replace(/^www\./, "") || capture.store;
          } catch {
            return capture.store;
          }
        })(),
        aggregateRating: capture.rating,
        aggregateCount: capture.ratingCount,
        corpus: consolidation.written.map((review) => ({
          ...(review as unknown as Record<string, unknown>),
          provenance: (review as unknown as Record<string, unknown>).provenance ?? CAPTURE_LIBRARY_PROVENANCE,
        })),
        previousScanCount: consolidation.previousScanCount,
      });
    } catch {
      // Fail-soft: the capture already scored; storage must never break it.
    }
  }
  return result;
}

function scoreCaptureReviews(capture: PageCapture, written: LibraryScoredReview[], scanId: string) {
  const card = buyingScoreFromReviews({
    marketplace: {
      rating: capture.rating,
      count: capture.ratingCount,
      matchesExactModel: true,
    },
    reviews: written,
    variantResolved: true,
    primaryStore: (() => {
      try { return new URL(capture.url).hostname.replace(/^www\./, ""); } catch { return null; }
    })(),
    recall: null,
  });
  const faced = customerFacingDecision({ analyzedReviews: card.audit.n, buyingScore: card });
  const buyingScore = faced.buyingScore;
  const bottomLine = shopperBottomLineForBuyingScore(buyingScore, faced.verdict);
  const shopperFields = [bottomLine, buyingScore.evidenceLine, buyingScore.confidenceReason, buyingScore.label, ...buyingScore.notes];
  if (shopperFields.some((line) => FORBIDDEN_SHOPPER_COPY.test(String(line || "")))) {
    throw new Error("PAGE_CAPTURE_COPY");
  }

  const acceptedRecords = written.map((review, index) => ({
    id: `page-${index + 1}`,
    body: review.body,
    sourceUrl: review.sourceUrl ?? capture.url,
    source: review.source ?? capture.store,
    title: review.title ?? null,
    rating: review.rating ?? null,
    date: review.date ?? null,
    verified: review.verified === true,
    provenance: (review as unknown as Record<string, unknown>).provenance ?? CAPTURE_LIBRARY_PROVENANCE,
  }));

  return {
    analysisVersion: "review-evidence-v2",
    pageCapture: true,
    linkOnlyScan: false,
    linkScanBlocked: false,
    openAiCalls: 0,
    scanId,
    resultSource: "analyze" as const,
    finalDecisionSource: faced.finalDecisionSource,
    decisionStatus: buyingScore.mode === "buying_score" || buyingScore.mode === "written_only"
      ? "evidence_based"
      : buyingScore.mode === "provisional_marketplace" ? "provisional_marketplace" : "needs_exact_listing",
    exactListingAccepted: true,
    exactListingUrl: capture.url,
    collectorSourceAccepted: capture.reviews.length > 0,
    buyingScoreV2: buyingScore,
    verdict: faced.verdict,
    recommendation: faced.verdict,
    finalVerdict: faced.verdict,
    stableVerdict: faced.verdict,
    buyScore: faced.buyScore,
    score: faced.buyScore,
    productScore: faced.buyScore,
    buyingConfidence: buyingConfidenceFromV2(buyingScore.confidence),
    buyerConfidence: buyingConfidenceFromV2(buyingScore.confidence),
    verdictConfidence: buyingConfidenceFromV2(buyingScore.confidence),
    confidence: buyingConfidenceFromV2(buyingScore.confidence),
    valueForMoney: "Unknown",
    bottomLine,
    summary: bottomLine,
    productName: capture.title,
    name: capture.title,
    title: capture.title,
    store: STORE_LABEL[capture.store],
    product: {
      name: capture.title,
      title: capture.title,
      store: STORE_LABEL[capture.store],
      rating: capture.rating ? `${capture.rating}/5` : "",
      reviewCount: capture.ratingCount ? String(capture.ratingCount) : "",
    },
    productIdentity: {
      title: capture.title,
      store: STORE_LABEL[capture.store],
      rating: capture.rating,
      reviewCount: capture.ratingCount,
      exactListingUrl: capture.url,
    },
    rating: capture.rating,
    reviewCount: capture.ratingCount,
    marketplaceReviewCount: capture.ratingCount,
    duplicatesRemoved: capture.duplicatesRemoved,
    meta: {
      audience: "buyer" as const,
      mode: "local-fallback" as const,
      source: "shopper-page",
      scanId,
      resultSource: "analyze" as const,
      platform: capture.store === "bestbuy" ? "best_buy" as const : capture.store,
      quota: null,
      review_count_estimate: 0,
      image_count: 0,
    },
    reviewEvidence: {
      exactListingAccepted: true,
      collectorSourceAccepted: capture.reviews.length > 0,
      listingEvidence: {
        exactListingUrl: capture.url,
        exactListingTitle: capture.title,
        store: STORE_LABEL[capture.store],
        rating: capture.rating,
        reviewCount: capture.ratingCount,
        confidence: "Accepted",
      },
      evidenceAdjudication: {
        acceptedRecords,
        acceptedRecordCount: acceptedRecords.length,
      },
      sourcesChecked: [],
      reviewIntelligenceMode: capture.reviews.length ? "written_reviews" : "listing_metadata",
    },
    researchQuality: {
      evidenceLevel: capture.reviews.length ? "verified" : "limited",
      exactProductMatch: true,
      sourceCount: 1,
      citationCount: 0,
      notes: ["Read from the product page open in the browser."],
    },
    topStrengths: [],
    topComplaints: [],
    strengths: [],
    complaints: [],
    screenshotOnly: false,
  };
}
