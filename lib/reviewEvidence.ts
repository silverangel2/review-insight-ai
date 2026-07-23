
function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function firstPositiveNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = toOptionalNumber(value);
    if (typeof parsed === "number" && parsed > 0) return parsed;
  }

  return null;
}

import { normalizeSourceLinks } from "@/lib/reviewToolHelpers";
import { createClient } from "@supabase/supabase-js";
import { localeLabel, normalizeLocale } from "@/lib/i18n";
import {
  findExactProductCandidates,
  type ExactProductCandidate,
  type ExactProductSearchResult,
} from "@/lib/exactProductSearch";
import { runFirecrawlFallback } from "@/lib/firecrawlFallback";
import {
  runNativeReviewRetrieval,
  type NativeReviewRetrievalResult,
} from "@/lib/nativeReviewRetrieval";

import {
  verifyProductCandidate,
  buildProductRetryQueries,
  type ProductCandidate,
  type ProductSearchJob,
  type ProductVerifierResult,
} from "./productSearchVerifier";
import {
  collectWrittenReviewsFromListing,
  formatCollectedReviewsForPrompt,
  type ReviewCollectorResult,
} from "@/lib/reviewCollector";
type ReviewEvidenceInput = {
  productName: string;
  brand?: string;
  model?: string;
  forceRefresh?: boolean;
  store?: string | null;
  price?: string | number | null;
  rating?: string | number | null;
  reviewCount?: string | number | null;
  locale?: string;
  outputLanguage?: string;

};

export type ReviewEvidenceResult = {
  locale?: string;
  outputLanguage?: string;
  detectedProductKey?: string | null;
  exactListingAccepted?: boolean;
  exactListingRejectedReason?: string | null;
  collectorSourceAccepted?: boolean;
  collectorSourceRejectedReason?: string | null;
  resultSource?: "analyze" | "recommendations" | "history";
  exactSearchAttemptCount?: number;
  exactSearchElapsedMs?: number;
  exactSearchTimedOut?: boolean;
  verifierRetryCount?: number;
  verifierStatus?: string | null;
  verifierReasons?: string[];
  retrySearchQueries?: string[];
  verifiedListingUrl?: string | null;
  rejectedListingUrls?: string[];
  canCollectReviews?: boolean;
  sourcesChecked: string[];
  reviewsFound: number;
  marketplaceReviewCount?: number | null;
  reviewCollector?: {
    attempted: boolean;
    sourceUrl: string | null;
    extractor?: string;
    reviewsCollected: number;
    collectorHasWrittenReviews?: boolean;
    collectorSourceAccepted?: boolean;
    collectorSourceRejectedReason?: string | null;
    coverageNote: string;
    fallbackUrlsTried?: string[];
  };
  reviewsCollected?: number;
  collectorHasWrittenReviews?: boolean;
  reviewIntelligenceSignals?: number;
  reviewIntelligenceMode?: "written_reviews" | "open_web_intelligence" | "listing_metadata";
  reviewCoverageRatio?: number;
  decisionStatus?: string;
  finalDecisionSource?: string;
  commentsAnalyzed: number;
  evidenceStrength: "none" | "weak" | "limited" | "usable" | "strong";
  aiPatternSignals?: string[];
  buyerExperienceSignals?: string[];
  productPros?: string[];
  productCons?: string[];
  overallImpact?: string;
  buyAssessment?: string;
  reviewSnippets?: Array<{
    source: string;
    snippet: string;
    sentiment: "positive" | "mixed" | "negative";
    evidenceType?: string;
  }>;
  repeatedPraises?: Array<{
    theme: string;
    evidenceCount: number;
    supportingSnippets?: string[];
  }>;
  repeatedComplaints?: Array<{
    theme: string;
    evidenceCount: number;
    supportingSnippets?: string[];
  }>;
  sourceNotes: string[];
  sourceLinks?: Array<{ label: string; url: string; domain?: string }>;
  exactListingConfirmed?: boolean;
  listingEvidence?: ExactProductSearchResult | null;
  reviewAuthenticity: {
    score: number | null;
    label: string;
    suspiciousReviewRisk: "Not scored" | "Low" | "Medium" | "High" | "Very high";
    reasons: string[];
    suspiciousComments: Array<{
      source: string;
      snippet: string;
      riskScore: number;
      reason: string;
    }>;
  };
};



function getReviewEvidenceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeEvidenceProductKey(input: ReviewEvidenceInput) {
  return uniqueIdentityTokens([input.brand, input.productName, input.model], 14)
    .toLowerCase()
    .replace(/\b(with|and|for|the|a|an|set|bag|bags|suitcase|spinner|wheels|lock|lightweight|travel|women|men)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 10)
    .join(" ");
}


function uniqueSearchWordsFromText(value: unknown, limit = 42) {
  const seen = new Set<string>();
  const words: string[] = [];

  for (const word of String(value || "")
    .replace(/amazon'?s choice/gi, " ")
    .replace(/https?:\/\/[^\s]+/g, " ")
    .replace(/[^a-z0-9.%+-]+/gi, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
    if (words.length >= limit) break;
  }

  return words.join(" ").replace(/\s+/g, " ").trim();
}

function uniqueIdentityTokens(values: unknown[], limit = 28) {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const value of values) {
    const words = String(value || "")
      .replace(/https?:\/\/[^\s]+/g, " ")
      .replace(/[^a-z0-9.%+-]+/gi, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    for (const word of words) {
      const key = word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push(word);
      if (tokens.length >= limit) return tokens.join(" ");
    }
  }

  return tokens.join(" ").replace(/\s+/g, " ").trim();
}

function isFreshEvidence(updatedAt: unknown) {
  if (typeof updatedAt !== "string") return false;
  const time = new Date(updatedAt).getTime();
  if (!Number.isFinite(time)) return false;

  const ageMs = Date.now() - time;
  const configuredHours = Number(process.env.REVIEWINTEL_PRODUCT_MEMORY_HOURS || 72);
  const safeHours = Math.max(1, Math.min(Number.isFinite(configuredHours) ? configuredHours : 72, 24 * 14));
  const maxAgeMs = 1000 * 60 * 60 * safeHours;
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

async function loadRecentReviewEvidenceFromMemory(input: ReviewEvidenceInput): Promise<ReviewEvidenceResult | null> {
  const supabase = getReviewEvidenceSupabaseClient();
  if (!supabase) return null;

  const normalized = normalizeEvidenceProductKey(input);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("reviewintel_product_memory")
    .select("product_key, review_evidence, updated_at")
    .ilike("normalized_title", `%${normalized.split(" ").slice(0, 4).join("%")}%`)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const row = data[0] as {
    product_key?: string;
    review_evidence?: ReviewEvidenceResult | null;
    updated_at?: string;
  };

  if (!row.review_evidence || !isFreshEvidence(row.updated_at)) return null;

  const evidence = row.review_evidence;
  const requestedLocale = normalizeLocale(input.locale || "en");
  const evidenceLocale = normalizeLocale(evidence.locale || "en");

  if (evidenceLocale !== requestedLocale) return null;

  return {
    ...evidence,
    sourceNotes: [
      "Reused recent ReviewIntel product memory instead of repeating a fresh web search.",
      ...(Array.isArray(evidence.sourceNotes) ? evidence.sourceNotes : []),
    ],
  };
}

async function saveReviewEvidenceToMemory(input: ReviewEvidenceInput, evidence: ReviewEvidenceResult) {
  const supabase = getReviewEvidenceSupabaseClient();
  if (!supabase) return;

  const normalized = normalizeEvidenceProductKey(input);
  if (!normalized) return;

  const listing = evidence.listingEvidence || null;
  const productKey = [
    input.store || listing?.store || "",
    input.brand || listing?.exactListingTitle || "",
    normalized,
  ]
    .filter(Boolean)
    .join("::")
    .toLowerCase()
    .replace(/[^a-z0-9:]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/:+/g, ":")
    .slice(0, 180);

  if (!productKey) return;

  const price = toOptionalNumber(listing?.price) ?? toOptionalNumber(input.price) ?? null;
  const rating = toOptionalNumber(listing?.rating) ?? toOptionalNumber(input.rating) ?? null;
  const reviewCount =
    toOptionalNumber(evidence.marketplaceReviewCount) ??
    toOptionalNumber(listing?.reviewCount) ??
    toOptionalNumber(input.reviewCount) ??
    null;

  const row = {
    product_key: productKey,
    store: listing?.store || input.store || null,
    brand: input.brand || null,
    title: listing?.exactListingTitle || input.productName || null,
    normalized_title: normalized,
    price,
    rating,
    review_count: reviewCount,
    review_evidence: evidence,
    product_identity: {
      store: listing?.store || input.store || null,
      brand: input.brand || null,
      title: listing?.exactListingTitle || input.productName || null,
      normalizedTitle: normalized,
      exactListingUrl: listing?.exactListingUrl || null,
      price,
      rating,
      reviewCount,
    },
    last_scanned_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from("reviewintel_product_memory")
      .upsert(row, { onConflict: "product_key" });

    if (error) {
      console.warn("[ReviewIntel DEBUG productMemorySaveFailed]", error.message);
    }
  } catch (error) {
    console.warn(
      "[ReviewIntel DEBUG productMemorySaveFailed]",
      error instanceof Error ? error.message : "Unknown Supabase product memory error"
    );
  }
}


function emptyEvidence(reason = "No review evidence collected."): ReviewEvidenceResult {
  return {
    sourcesChecked: [],
    reviewsFound: 0,
    commentsAnalyzed: 0,
    evidenceStrength: "none",
    sourceNotes: [reason],
    sourceLinks: [],
    listingEvidence: null,
    reviewCollector: {
      attempted: false,
      sourceUrl: null,
      extractor: "none",
      reviewsCollected: 0,
      collectorHasWrittenReviews: false,
      coverageNote: reason,
    },
    reviewsCollected: 0,
    collectorHasWrittenReviews: false,
    reviewCoverageRatio: 0,
    reviewAuthenticity: {
      score: null,
      label: "Review scan not verified",
      suspiciousReviewRisk: "Not scored",
      reasons: [reason],
      suspiciousComments: [],
    },
  };
}

function extractNumberFromEvidenceText(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = Number(String(match[1]).replace(/,/g, ""));
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function normalizeListingEvidenceNumbers(
  listingEvidence: ExactProductSearchResult | null | undefined
): ExactProductSearchResult | null | undefined {
  if (!listingEvidence || typeof listingEvidence !== "object") return listingEvidence;

  const record = listingEvidence as Record<string, unknown>;

  const notesText = [
    typeof record.exactListingTitle === "string" ? record.exactListingTitle : "",
    ...(Array.isArray(record.notes) ? record.notes : []),
  ]
    .filter(Boolean)
    .join(" ");

  const parsedRating =
    typeof record.rating === "number"
      ? record.rating
      : extractNumberFromEvidenceText(notesText, [
          /rating\s*\(?\s*(\d+(?:\.\d+)?)\s*(?:out of|\/)?\s*5/i,
          /(\d+(?:\.\d+)?)\s*(?:out of|\/)\s*5\s*stars/i,
          /(\d+(?:\.\d+)?)\s*stars/i,
        ]);

  const parsedReviewCount =
    typeof record.reviewCount === "number"
      ? record.reviewCount
      : extractNumberFromEvidenceText(notesText, [
          /(\d[\d,]*)\s*(?:ratings|reviews|review count)/i,
          /review count\s*\(?\s*(\d[\d,]*)/i,
        ]);

  return {
    ...listingEvidence,
    rating: parsedRating,
    reviewCount: parsedReviewCount,
  };
}


function extractRequestedReviewSignals(input: {
  productName?: string;
  brand?: string;
  model?: string;
  price?: string | number | null;
  rating?: string | number | null;
  reviewCount?: string | number | null;
}) {
  const text = [input.productName, input.brand, input.model].filter(Boolean).join(" ");

  const ratingMatch =
    text.match(/(\d+(?:\.\d+)?)\s*(?:out of|\/)?\s*5/i) ||
    text.match(/rating\s*(\d+(?:\.\d+)?)/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*stars?/i);

  const reviewMatch =
    text.match(/(\d[\d,]*)\s*(?:reviews?|ratings?)/i) ||
    text.match(/review\s*count\s*(\d[\d,]*)/i);

  const priceMatch =
    text.match(/\$\s*(\d+(?:\.\d+)?)/i) ||
    text.match(/price\s*(\d+(?:\.\d+)?)/i);

  return {
    requestedRating:
      toOptionalNumber(input.rating) ??
      (ratingMatch?.[1] ? Number(ratingMatch[1].replace(/,/g, "")) : null),
    requestedReviewCount:
      toOptionalNumber(input.reviewCount) ??
      (reviewMatch?.[1] ? Number(reviewMatch[1].replace(/,/g, "")) : null),
    requestedPrice:
      toOptionalNumber(input.price) ??
      (priceMatch?.[1] ? Number(priceMatch[1].replace(/,/g, "")) : null),
  };
}

const GENERIC_PRODUCT_TOKENS = new Set([
  "piece",
  "carry",
  "luggage",
  "suitcase",
  "hardside",
  "hard",
  "side",
  "with",
  "wheels",
  "wheel",
  "women",
  "woman",
  "mens",
  "men",
  "shown",
  "travel",
  "traveling",
  "travelling",
  "front",
]);

const PRODUCT_COLOR_TOKENS = new Set([
  "black",
  "white",
  "gray",
  "grey",
  "pink",
  "blue",
  "green",
  "red",
  "purple",
  "yellow",
  "orange",
  "silver",
  "gold",
  "beige",
  "brown",
  "navy",
  "cream",
  "clear",
]);

function extractRequestedColors(value: unknown) {
  const text = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const found = new Set<string>();

  for (const token of text.split(/\s+/)) {
    const normalized = token === "grey" ? "gray" : token;
    if (PRODUCT_COLOR_TOKENS.has(normalized)) found.add(normalized);
  }

  return found;
}

function meaningfulTitleTokens(value: unknown) {
  return Array.from(
    new Set(
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4 && !GENERIC_PRODUCT_TOKENS.has(token))
    )
  ).slice(0, 14);
}

function tokenAppearsInTitle(token: string, title: string) {
  if (title.includes(token)) return true;
  const singular = token.endsWith("s") ? token.slice(0, -1) : token;
  return singular.length >= 4 && title.includes(singular);
}

function titleIdentityMatch(
  input: { productName?: string; brand?: string; model?: string },
  listingEvidence: ExactProductSearchResult
) {
  const requested = meaningfulTitleTokens([input.brand, input.productName, input.model].filter(Boolean).join(" "));
  const listingTitle = String(listingEvidence.exactListingTitle || "").toLowerCase();

  if (requested.length < 3 || !listingTitle) {
    return { acceptable: true, strong: false, matched: requested, requested };
  }

  const matched = requested.filter((token) => tokenAppearsInTitle(token, listingTitle));
  const ratio = matched.length / requested.length;

  return {
    acceptable: matched.length >= 2 && ratio >= 0.45,
    strong: matched.length >= 3 && ratio >= 0.6,
    matched,
    requested,
  };
}

function listingMatchesRequestedSignals(
  listingEvidence: ExactProductSearchResult | null | undefined,
  input: {
    productName?: string;
    brand?: string;
    model?: string;
  }
): ExactProductSearchResult | null | undefined {
  if (!listingEvidence) return listingEvidence;

  const signals = extractRequestedReviewSignals(input);
  const notes = Array.isArray(listingEvidence.notes) ? listingEvidence.notes : [];
  const mismatchNotes: string[] = [];
  const titleMatch = titleIdentityMatch(input, listingEvidence);
  const requestedColors = extractRequestedColors([input.productName, input.brand, input.model].filter(Boolean).join(" "));
  const listingColors = extractRequestedColors(listingEvidence.exactListingTitle || "");

  let mismatchCount = 0;
  let hasVariantMismatch = false;
  let hasRatingMismatch = false;
  let hasReviewCountMismatch = false;

  if (!titleMatch.acceptable) {
    mismatchCount += 2;
    mismatchNotes.push(
      `Matched listing title is missing distinctive requested product terms. Requested: ${titleMatch.requested.join(", ")}. Matched: ${titleMatch.matched.join(", ") || "none"}.`
    );
  }

  if (requestedColors.size > 0 && listingColors.size > 0) {
    const hasRequestedColor = Array.from(requestedColors).some((color) => listingColors.has(color));
    const hasDifferentColor = Array.from(listingColors).some((color) => !requestedColors.has(color));

    if (!hasRequestedColor && hasDifferentColor) {
      hasVariantMismatch = true;
      mismatchCount += 2;
      mismatchNotes.push(
        `Requested color/variant ${Array.from(requestedColors).join(", ")}, but matched listing appears to be ${Array.from(listingColors).join(", ")}.`
      );
    }
  }

  if (
    typeof signals.requestedRating === "number" &&
    typeof listingEvidence.rating === "number" &&
    Math.abs(signals.requestedRating - listingEvidence.rating) > 0.15
  ) {
    hasRatingMismatch = true;
    mismatchCount += 1;
    mismatchNotes.push(
      `Requested rating ${signals.requestedRating}, but matched listing rating is ${listingEvidence.rating}.`
    );
  }

  if (
    typeof signals.requestedReviewCount === "number" &&
    typeof listingEvidence.reviewCount === "number"
  ) {
    const diff = Math.abs(signals.requestedReviewCount - listingEvidence.reviewCount);
    const tolerance = Math.max(20, signals.requestedReviewCount * 0.2);

    if (diff > tolerance) {
      hasReviewCountMismatch = true;
      mismatchCount += 1;
      mismatchNotes.push(
        `Requested review count ${signals.requestedReviewCount}, but matched listing review count is ${listingEvidence.reviewCount}.`
      );
    }
  }

  if (
    typeof signals.requestedPrice === "number" &&
    listingEvidence.price == null
  ) {
    mismatchCount += 1;
    mismatchNotes.push(
      `Requested price ${signals.requestedPrice}, but matched listing price was not confirmed.`
    );
  }

  if (
    typeof signals.requestedPrice === "number" &&
    typeof listingEvidence.price === "number" &&
    Math.abs(signals.requestedPrice - listingEvidence.price) > 5
  ) {
    mismatchCount += 1;
    mismatchNotes.push(
      `Requested price ${signals.requestedPrice}, but matched listing price is ${listingEvidence.price}.`
    );
  }

  if (mismatchCount === 0) {
    return listingEvidence;
  }

  const shouldRejectAsSimilar =
    hasVariantMismatch ||
    (hasRatingMismatch && hasReviewCountMismatch) ||
    (!titleMatch.strong && mismatchCount >= 2);

  return {
    ...listingEvidence,
    confidence: listingEvidence.confidence === "low" || shouldRejectAsSimilar ? "low" : "medium",
    notes: [
      ...notes,
      ...mismatchNotes,
      shouldRejectAsSimilar
        ? "Matched listing was downgraded because it appears to be a similar product, not the exact scanned product."
        : "Exact listing identity was kept because the product title/domain matched; price, rating, or review count may have changed after the screenshot.",
    ],
  };
}


function normalizeListingConfidence(
  listingEvidence: ExactProductSearchResult | null | undefined,
  input: {
    productName?: string;
    brand?: string;
    model?: string;
  }
): ExactProductSearchResult | null | undefined {
  if (!listingEvidence) return listingEvidence;

  const signals = extractRequestedReviewSignals(input);
  const notes = Array.isArray(listingEvidence.notes) ? listingEvidence.notes : [];

  const requestedHasRatingOrReviews =
    typeof signals.requestedRating === "number" ||
    typeof signals.requestedReviewCount === "number" ||
    typeof signals.requestedPrice === "number";

  const listingMissingRatingOrReviews =
    listingEvidence.rating == null ||
    listingEvidence.reviewCount == null;

  if (requestedHasRatingOrReviews && listingMissingRatingOrReviews) {
    return {
      ...listingEvidence,
      confidence: "medium",
      notes: [
        ...notes,
        "Exact listing URL was found, but rating/review count were not confirmed from the listing fields.",
        "Screenshot/requested rating or review count should be treated as observed product identity, not as independently verified listing evidence.",
      ],
    };
  }

  return listingEvidence;
}


function listingDomainMatchesRequestedStore(
  listingEvidence: ExactProductSearchResult | null | undefined,
  input: {
    productName?: string;
    brand?: string;
    model?: string;
  }
): ExactProductSearchResult | null | undefined {
  if (!listingEvidence) return listingEvidence;

  const requestText = [input.productName, input.brand, input.model]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const url = String(listingEvidence.exactListingUrl || "").toLowerCase();
  const notes = Array.isArray(listingEvidence.notes) ? listingEvidence.notes : [];

  const requestedWalmart = requestText.includes("walmart");
  const requestedCanada =
    requestText.includes("walmart.ca") ||
    requestText.includes("canada") ||
    requestText.includes("cad") ||
    requestText.includes("$59.99");

  const foundWalmartCom = url.includes("walmart.com/");
  const foundWalmartCa = url.includes("walmart.ca/");

  if (requestedWalmart && requestedCanada && foundWalmartCom && !foundWalmartCa) {
    return {
      ...listingEvidence,
      confidence: "low",
      notes: [
        ...notes,
        "Requested product appears to be Walmart Canada/CAD, but the matched listing is Walmart.com. Treat this as a similar listing, not confirmed exact product evidence.",
      ],
    };
  }

  return listingEvidence;
}


function stripJsonCodeFence(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function extractJsonObjectText(text: string) {
  const cleaned = stripJsonCodeFence(text);
  const first = cleaned.indexOf("{");
  if (first === -1) return cleaned;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = first; i < cleaned.length; i += 1) {
    const char = cleaned[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return cleaned.slice(first, i + 1);
    }
  }

  // If JSON is truncated, close braces as best effort.
  let partial = cleaned.slice(first);
  if (inString) partial += '"';
  while (depth > 0) {
    partial += "}";
    depth -= 1;
  }
  return partial;
}


function recoverPartialReviewEvidenceFromText(text: string) {
  const urls = Array.from(
    new Set(
      (text.match(/https?:\/\/[^\s"'<>]+/g) || [])
        .map((url) => url.replace(/[),.]+$/, ""))
    )
  ).slice(0, 12);

  const ratingMatch =
    text.match(/(\d+(?:\.\d+)?)\s*(?:out of|\/)\s*5/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*stars?/i) ||
    text.match(/rating[^0-9]*(\d+(?:\.\d+)?)/i);

  const reviewMatch =
    text.match(/(\d[\d,]*)\s*(?:reviews?|ratings?)/i) ||
    text.match(/review count[^0-9]*(\d[\d,]*)/i);

  const priceMatch =
    text.match(/\$\s*(\d+(?:\.\d+)?)/i) ||
    text.match(/price[^0-9]*(\d+(?:\.\d+)?)/i);

  return {
    sourcesChecked: urls,
    reviewsFound: reviewMatch?.[1] ? Number(reviewMatch[1].replace(/,/g, "")) : 0,
    // URLs/source links are not analyzed reviews.
    commentsAnalyzed: 0,
    evidenceStrength: urls.length > 0 ? "limited" : "none",
    sourceNotes: [
      "ReviewIntel found the exact product listing and recovered available public evidence from the web search results. Written review comments were not available from the source.",
    ],
    sourceLinks: urls.map((url) => ({
      label: url.replace(/^https?:\/\//, "").slice(0, 80),
      url,
      domain: (() => {
        try {
          return new URL(url).hostname;
        } catch {
          return undefined;
        }
      })(),
    })),
    listingEvidence: urls.length > 0
      ? {
          exactListingUrl: urls[0],
          exactListingTitle: "Recovered source from malformed review evidence response",
          store: urls[0].includes("walmart") ? "Walmart" : null,
          price: priceMatch?.[1] ? Number(priceMatch[1]) : null,
          rating: ratingMatch?.[1] ? Number(ratingMatch[1]) : null,
          reviewCount: reviewMatch?.[1] ? Number(reviewMatch[1].replace(/,/g, "")) : null,
          confidence: "low",
          sourcesChecked: urls,
          notes: [
            "Recovered from malformed JSON. Treat as partial evidence, not confirmed exact listing evidence.",
          ],
        }
      : null,
    reviewAuthenticity: {
      score: null,
      label: "Review scan partially recovered",
      suspiciousReviewRisk: "Not scored",
      reasons: [
        "The model response was malformed, but ReviewIntel recovered available links/numbers instead of discarding the scan.",
      ],
      suspiciousComments: [],
    },
  };
}

function safeParseReviewEvidenceJson(text: string) {
  const jsonText = extractJsonObjectText(text);

  try {
    return JSON.parse(jsonText);
  } catch {
    try {
      const repaired = jsonText
        .replace(/[\u0000-\u001F]+/g, " ")
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/\\(?!["\\/bfnrtu])/g, "\\\\");

      return JSON.parse(repaired);
    } catch {
      return recoverPartialReviewEvidenceFromText(text);
    }
  }
}



function applyObservedScreenshotSignalsToListing(
  listingEvidence: ExactProductSearchResult | null,
  input: ReviewEvidenceInput
): ExactProductSearchResult | null {
  if (!listingEvidence?.exactListingUrl) return listingEvidence;

  const observedPrice = toOptionalNumber(input.price);
  const observedRating = toOptionalNumber(input.rating);
  const observedReviewCount = toOptionalNumber(input.reviewCount);

  const notes = Array.isArray(listingEvidence.notes) ? [...listingEvidence.notes] : [];

  const next: ExactProductSearchResult = {
    ...listingEvidence,
    price:
      typeof listingEvidence.price === "number" && listingEvidence.price > 0
        ? listingEvidence.price
        : observedPrice ?? listingEvidence.price ?? null,
    rating:
      typeof listingEvidence.rating === "number" && listingEvidence.rating > 0
        ? listingEvidence.rating
        : observedRating ?? listingEvidence.rating ?? null,
    reviewCount:
      typeof listingEvidence.reviewCount === "number" && listingEvidence.reviewCount > 0
        ? listingEvidence.reviewCount
        : observedReviewCount ?? listingEvidence.reviewCount ?? null,
    notes,
  };

  if (
    observedPrice &&
    (typeof listingEvidence.price !== "number" || listingEvidence.price <= 0)
  ) {
    next.notes.push(
      `Price ${observedPrice} was observed from the screenshot/request and used as an identity clue, but was not independently confirmed from Walmart.ca structured fields.`
    );
  }

  if (
    observedRating &&
    (typeof listingEvidence.rating !== "number" || listingEvidence.rating <= 0)
  ) {
    next.notes.push(
      `Rating ${observedRating} was observed from the screenshot/request and used as an identity clue, but was not independently confirmed from Walmart.ca structured fields.`
    );
  }

  if (
    observedReviewCount &&
    (typeof listingEvidence.reviewCount !== "number" || listingEvidence.reviewCount <= 0)
  ) {
    next.notes.push(
      `Review count ${observedReviewCount} was observed from the screenshot/request and used as an identity clue, but was not independently confirmed from Walmart.ca structured fields.`
    );
  }

  return next;
}

function cleanFinalReviewEvidence(result: ReviewEvidenceResult): ReviewEvidenceResult {
  const listingEvidence = result.listingEvidence;

  const cleanedListingEvidence =
    listingEvidence && typeof listingEvidence === "object"
      ? {
          ...listingEvidence,
          notes: Array.isArray(listingEvidence.notes)
            ? listingEvidence.notes.filter((note) => {
                const text = String(note || "").toLowerCase();

                if (
                  text.includes("matches the provided details") &&
                  (listingEvidence.price == null ||
                    listingEvidence.rating == null ||
                    listingEvidence.reviewCount == null)
                ) {
                  return false;
                }

                return true;
              })
            : [],
        }
      : listingEvidence;

  const suspiciousComments = Array.isArray(result.reviewAuthenticity?.suspiciousComments)
    ? result.reviewAuthenticity.suspiciousComments
    : [];

  const isWalmartCaListing =
    String(listingEvidence?.store || "").toLowerCase().includes("walmart.ca") ||
    String(listingEvidence?.exactListingUrl || "").toLowerCase().includes("walmart.ca");

  const filteredSuspiciousComments = suspiciousComments.filter((comment) => {
    const source = String(comment?.source || "").toLowerCase();

    // Do not use Walmart.com reviews as exact authenticity evidence for a Walmart.ca listing.
    if (isWalmartCaListing && source.includes("walmart.com")) return false;

    return true;
  });

  const commentsAnalyzed =
    typeof result.commentsAnalyzed === "number" && Number.isFinite(result.commentsAnalyzed)
      ? result.commentsAnalyzed
      : 0;

  const cleanedAuthenticity =
    result.reviewAuthenticity && commentsAnalyzed <= 0
      ? {
          ...result.reviewAuthenticity,
          score: null,
          label: "Review scan not verified",
          suspiciousReviewRisk: "Not scored" as const,
          reasons:
            Array.isArray(result.reviewAuthenticity.reasons) &&
            result.reviewAuthenticity.reasons.length > 0
              ? result.reviewAuthenticity.reasons
              : ["No written buyer review bodies were collected, so ReviewIntel did not score fake-review risk."],
          suspiciousComments: [],
        }
      : result.reviewAuthenticity && filteredSuspiciousComments.length === 0
      ? {
          ...result.reviewAuthenticity,
          score: 0,
          label: "Low AI-like review risk",
          suspiciousReviewRisk: "Low" as const,
          reasons: [
            "No suspicious review patterns were found in the exact product evidence available. Review risk remains limited because written Walmart.ca review comments were not fully available.",
          ],
          suspiciousComments: [],
        }
      : result.reviewAuthenticity
        ? {
            ...result.reviewAuthenticity,
            suspiciousComments: filteredSuspiciousComments,
          }
        : result.reviewAuthenticity;

  const cleanedSourceNotes = Array.isArray(result.sourceNotes)
    ? result.sourceNotes.filter((note) => {
        const text = String(note || "").toLowerCase();

        if (
          text.includes("matches the provided details") &&
          (listingEvidence?.price == null ||
            listingEvidence?.rating == null ||
            listingEvidence?.reviewCount == null)
        ) {
          return false;
        }

        // Do not let Walmart.com review summaries appear as exact evidence for Walmart.ca products.
        if (isWalmartCaListing && text.includes("walmart.com")) {
          return false;
        }

        return true;
      })
    : result.sourceNotes;

  const uniqueSourceLinks = Array.isArray(result.sourceLinks)
    ? result.sourceLinks.filter((link, index, links) => {
        const url = String(link?.url || "");
        const lowerUrl = url.toLowerCase();
        const exactUrl = String(listingEvidence?.exactListingUrl || "").trim();

        const hostFor = (value: string) => {
          try {
            return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
          } catch {
            return "";
          }
        };

        const linkHost = hostFor(url);
        const exactHost = hostFor(exactUrl);

        // Keep Walmart.ca exact listing. Drop all Walmart.com links for Walmart.ca exact listings.
        if (isWalmartCaListing && lowerUrl.includes("walmart.com")) {
          return false;
        }

        // If the confirmed listing is already known, do not display another
        // product page from the same marketplace as evidence. Similar listings
        // may be useful during investigation, but not as final source proof.
        if (
          exactUrl &&
          exactHost &&
          linkHost === exactHost &&
          url !== exactUrl
        ) {
          return false;
        }

        return url && links.findIndex((candidate) => String(candidate?.url || "") === url) === index;
      })
    : result.sourceLinks;

  return {
    ...result,
    sourceNotes: cleanedSourceNotes,
    sourceLinks: uniqueSourceLinks,
    listingEvidence: cleanedListingEvidence,
    reviewAuthenticity: cleanedAuthenticity,
  };
}

function reviewEvidenceMatchesRequestedStore(
  evidence: ReviewEvidenceResult | null,
  input: ReviewEvidenceInput
): boolean {
  if (!evidence) return false;

  const requestedStore = String(input.store || "").toLowerCase();
  const requiresWalmartCa =
    requestedStore.includes("walmart.ca") ||
    requestedStore.includes("walmart canada");

  if (!requiresWalmartCa) return true;

  const url = evidence.listingEvidence?.exactListingUrl;
  if (!url) return true;

  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host === "walmart.ca" || host.endsWith(".walmart.ca");
  } catch {
    return false;
  }
}

function reviewEvidenceMatchesExactIdentity(
  evidence: ReviewEvidenceResult | null,
  input: ReviewEvidenceInput
): boolean {
  if (!evidence?.listingEvidence?.exactListingUrl) return false;

  const checked = listingMatchesRequestedSignals(
    normalizeListingEvidenceNumbers(evidence.listingEvidence),
    input
  );
  const notesText = Array.isArray(checked?.notes) ? checked.notes.join(" ").toLowerCase() : "";

  return Boolean(
    checked?.exactListingUrl &&
      checked.confidence !== "low" &&
      !/similar product|missing distinctive|rejected returned listing|requested product appears|downgraded/.test(notesText)
  );
}

function parsedEvidenceSignalCount(value: Record<string, unknown>) {
  return Math.max(
    Array.isArray(value.reviewSnippets) ? value.reviewSnippets.length : 0,
    Array.isArray(value.repeatedPraises) ? value.repeatedPraises.length : 0,
    Array.isArray(value.repeatedComplaints) ? value.repeatedComplaints.length : 0,
    Array.isArray(value.productPros) ? value.productPros.length : 0,
    Array.isArray(value.productCons) ? value.productCons.length : 0,
    Array.isArray(value.buyerExperienceSignals) ? value.buyerExperienceSignals.length : 0,
    Array.isArray(value.aiPatternSignals) ? value.aiPatternSignals.length : 0
  );
}

function mergeUnknownArrays<T = unknown>(left: unknown, right: unknown, limit: number): T[] {
  const merged = [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])];
  const seen = new Set<string>();
  const next: T[] = [];

  for (const item of merged) {
    const key = JSON.stringify(item).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item as T);
    if (next.length >= limit) break;
  }

  return next;
}

function evidenceStrengthForCount(count: number): ReviewEvidenceResult["evidenceStrength"] {
  if (count >= 30) return "strong";
  if (count >= 15) return "usable";
  if (count >= 5) return "limited";
  if (count > 0) return "weak";
  return "none";
}

function reviewCollectorResultWith(
  current: ReviewCollectorResult,
  input: {
    reviews?: ReviewCollectorResult["reviews"];
    coverageNote?: string;
    fallbackUrlsTried?: string[];
  }
): ReviewCollectorResult {
  const reviews = input.reviews || current.reviews;

  return {
    ...current,
    attempted: true,
    reviews,
    reviewsCollected: reviews.length,
    collectorHasWrittenReviews: reviews.length > 0,
    coverageNote: input.coverageNote || current.coverageNote,
    fallbackUrlsTried: Array.from(
      new Set([
        ...(current.fallbackUrlsTried || []),
        ...(input.fallbackUrlsTried || []),
      ])
    ).slice(0, 24),
  };
}

function mergeParsedReviewEvidence(primary: Record<string, unknown>, secondary: Record<string, unknown>) {
  const primaryAuth =
    primary.reviewAuthenticity && typeof primary.reviewAuthenticity === "object"
      ? (primary.reviewAuthenticity as Record<string, unknown>)
      : {};
  const secondaryAuth =
    secondary.reviewAuthenticity && typeof secondary.reviewAuthenticity === "object"
      ? (secondary.reviewAuthenticity as Record<string, unknown>)
      : {};

  return {
    ...primary,
    sourcesChecked: mergeUnknownArrays<string>(primary.sourcesChecked, secondary.sourcesChecked, 16),
    sourceLinks: mergeUnknownArrays<Record<string, unknown>>(primary.sourceLinks, secondary.sourceLinks, 12),
    sourceNotes: mergeUnknownArrays<string>(primary.sourceNotes, secondary.sourceNotes, 12),
    reviewSnippets: mergeUnknownArrays<Record<string, unknown>>(primary.reviewSnippets, secondary.reviewSnippets, 40),
    repeatedPraises: mergeUnknownArrays<Record<string, unknown>>(primary.repeatedPraises, secondary.repeatedPraises, 16),
    repeatedComplaints: mergeUnknownArrays<Record<string, unknown>>(primary.repeatedComplaints, secondary.repeatedComplaints, 16),
    aiPatternSignals: mergeUnknownArrays<string>(primary.aiPatternSignals, secondary.aiPatternSignals, 16),
    buyerExperienceSignals: mergeUnknownArrays<string>(primary.buyerExperienceSignals, secondary.buyerExperienceSignals, 20),
    productPros: mergeUnknownArrays<string>(primary.productPros, secondary.productPros, 20),
    productCons: mergeUnknownArrays<string>(primary.productCons, secondary.productCons, 20),
    marketplaceReviewCount:
      toOptionalNumber(primary.marketplaceReviewCount) ??
      toOptionalNumber(secondary.marketplaceReviewCount) ??
      toOptionalNumber(primary.reviewsFound) ??
      toOptionalNumber(secondary.reviewsFound) ??
      null,
    reviewsFound:
      toOptionalNumber(primary.reviewsFound) ??
      toOptionalNumber(secondary.reviewsFound) ??
      toOptionalNumber(primary.marketplaceReviewCount) ??
      toOptionalNumber(secondary.marketplaceReviewCount) ??
      0,
    evidenceStrength:
      String(primary.evidenceStrength || "") === "strong" || String(secondary.evidenceStrength || "") === "strong"
        ? "strong"
        : String(primary.evidenceStrength || "") === "usable" || String(secondary.evidenceStrength || "") === "usable"
          ? "usable"
          : String(primary.evidenceStrength || "") === "limited" || String(secondary.evidenceStrength || "") === "limited"
            ? "limited"
            : String(primary.evidenceStrength || secondary.evidenceStrength || "weak"),
    overallImpact: String(primary.overallImpact || secondary.overallImpact || ""),
    buyAssessment: String(primary.buyAssessment || secondary.buyAssessment || ""),
    reviewAuthenticity: {
      ...secondaryAuth,
      ...primaryAuth,
      reasons: mergeUnknownArrays<string>(primaryAuth.reasons, secondaryAuth.reasons, 8),
      suspiciousComments: mergeUnknownArrays<Record<string, unknown>>(
        primaryAuth.suspiciousComments,
        secondaryAuth.suspiciousComments,
        8
      ),
      score:
        typeof primaryAuth.score === "number"
          ? primaryAuth.score
          : typeof secondaryAuth.score === "number"
            ? secondaryAuth.score
            : null,
    },
  };
}

function reviewEvidenceSignalCount(evidence: ReviewEvidenceResult | null | undefined) {
  if (!evidence) return 0;

  return Math.max(
    Array.isArray(evidence.reviewSnippets) ? evidence.reviewSnippets.length : 0,
    Array.isArray(evidence.repeatedPraises) ? evidence.repeatedPraises.length : 0,
    Array.isArray(evidence.repeatedComplaints) ? evidence.repeatedComplaints.length : 0,
    Array.isArray(evidence.productPros) ? evidence.productPros.length : 0,
    Array.isArray(evidence.productCons) ? evidence.productCons.length : 0,
    Array.isArray(evidence.buyerExperienceSignals) ? evidence.buyerExperienceSignals.length : 0,
    Array.isArray(evidence.aiPatternSignals) ? evidence.aiPatternSignals.length : 0,
    typeof evidence.reviewIntelligenceSignals === "number" && Number.isFinite(evidence.reviewIntelligenceSignals)
      ? evidence.reviewIntelligenceSignals
      : 0
  );
}

function reviewEvidenceNeedsAutomaticRecovery(evidence: ReviewEvidenceResult | null | undefined) {
  if (!evidence) return true;

  const reviewCollector = evidence.reviewCollector;
  const reviewsCollected =
    typeof evidence.reviewsCollected === "number" && Number.isFinite(evidence.reviewsCollected)
      ? evidence.reviewsCollected
      : typeof reviewCollector?.reviewsCollected === "number" && Number.isFinite(reviewCollector.reviewsCollected)
        ? reviewCollector.reviewsCollected
        : 0;

  const commentsAnalyzed =
    typeof evidence.commentsAnalyzed === "number" && Number.isFinite(evidence.commentsAnalyzed)
      ? evidence.commentsAnalyzed
      : 0;

  return reviewsCollected <= 0 && commentsAnalyzed <= 0 && reviewEvidenceSignalCount(evidence) <= 0;
}

type ExactProductAgentResult = {
  listingEvidence: ExactProductSearchResult;
  verifierResult: ProductVerifierResult;
  exactSearchAttemptCount: number;
  exactSearchElapsedMs: number;
  exactSearchTimedOut: boolean;
  verifierRetryCount: number;
  verifierStatus: string;
  verifierReasons: string[];
  retrySearchQueries: string[];
  verifiedListingUrl: string | null;
  rejectedListingUrls: string[];
  canCollectReviews: boolean;
};

function defaultVerifierResult(job: ProductSearchJob, reason: string): ProductVerifierResult {
  return {
    verifierStatus: "possible_match_needs_more_search",
    verifierConfidence: 0,
    verifierReasons: [reason],
    verifiedListingUrl: null,
    rejectedListingUrl: null,
    rejectedListingTitle: null,
    retrySearchQueries: buildProductRetryQueries(job, reason),
    canCollectReviews: false,
    canScoreProduct: false,
  };
}

function productCandidateFromEvidence(
  evidence: ReviewEvidenceResult | null | undefined
): ProductCandidate | null {
  const listing = evidence?.listingEvidence;
  if (!listing?.exactListingUrl) return null;

  return {
    url: listing.exactListingUrl,
    title: listing.exactListingTitle || null,
    store: listing.store || null,
    price: listing.price,
    rating: listing.rating,
    reviewCount: listing.reviewCount,
    source: "verifiedSourceMemory",
    notes: [
      "Recent verified source memory matched the current product identity.",
      ...(Array.isArray(listing.notes) ? listing.notes : []),
    ].slice(0, 6),
  };
}

function exactListingFromCandidate(
  candidate: ProductCandidate | ExactProductCandidate,
  verifierResult: ProductVerifierResult,
  sourcesChecked: string[],
  sourceLinks: Array<{ label: string; url: string; domain?: string }>,
  notes: string[]
): ExactProductSearchResult {
  const confidence =
    verifierResult.verifierConfidence >= 90
      ? "high"
      : verifierResult.verifierConfidence >= 65
        ? "medium"
        : "low";

  return {
    exactListingUrl: verifierResult.verifiedListingUrl,
    exactListingTitle: candidate.title || null,
    store: candidate.store || candidate.domain || null,
    price: toOptionalNumber(candidate.price) ?? null,
    rating: toOptionalNumber(candidate.rating) ?? null,
    reviewCount: toOptionalNumber(candidate.reviewCount) ?? null,
    confidence,
    sourcesChecked,
    sourceLinks,
    notes: [
      ...notes,
      ...(Array.isArray(candidate.notes) ? candidate.notes : []),
      ...verifierResult.verifierReasons,
    ].filter(Boolean).slice(0, 12),
  };
}

function emptyAgentListing(
  input: ReviewEvidenceInput,
  sourcesChecked: string[],
  sourceLinks: Array<{ label: string; url: string; domain?: string }>,
  notes: string[]
): ExactProductSearchResult {
  return {
    exactListingUrl: null,
    exactListingTitle: null,
    store: input.store || null,
    price: null,
    rating: null,
    reviewCount: null,
    confidence: "low",
    sourcesChecked,
    sourceLinks,
    notes: notes.length ? notes.slice(0, 12) : ["No verified exact product listing was found within the fast retry limit."],
  };
}

function mergeUniqueStrings(values: unknown[], limit = 24) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }

  return out;
}

function agentQueryKey(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function takeNextAgentQuery(queries: unknown[], usedQueries: Set<string>) {
  for (const query of queries) {
    const text = String(query || "").replace(/\s+/g, " ").trim();
    const key = agentQueryKey(text);
    if (!key || usedQueries.has(key)) continue;
    usedQueries.add(key);
    return text;
  }

  return null;
}

async function runExactProductAgent({
  input,
  product,
  reviewSearchIdentity,
  cleanVisibleIdentity,
  rememberedEvidence,
}: {
  input: ReviewEvidenceInput;
  product: string;
  reviewSearchIdentity: string;
  cleanVisibleIdentity: string;
  rememberedEvidence: ReviewEvidenceResult | null;
}): Promise<ExactProductAgentResult> {
  const startedAt = Date.now();
  const configuredTimeoutMs = Number(process.env.REVIEWINTEL_EXACT_SEARCH_TIMEOUT_MS || 18000);
  const timeoutMs = Math.max(
    5000,
    Math.min(Number.isFinite(configuredTimeoutMs) ? configuredTimeoutMs : 18000, 18000)
  );
  const deadline = startedAt + timeoutMs;
  const maxCandidates = 5;
  const maxRetryRounds = 2;
  const perAttemptTimeoutMs = 5500;
  const job: ProductSearchJob = {
    scanId: reviewSearchIdentity || cleanVisibleIdentity || input.productName || "unknown-scan",
    store: input.store,
    brand: input.brand,
    productName: input.productName,
    productKey: reviewSearchIdentity || cleanVisibleIdentity || product,
    price: input.price,
    rating: input.rating,
    reviewCount: input.reviewCount,
  };

  let exactSearchAttemptCount = 0;
  let exactSearchTimedOut = false;
  let verifierRetryCount = 0;
  let verifierResult = defaultVerifierResult(job, "No exact product candidate has been verified yet.");
  let verifierReasons: string[] = [];
  let retrySearchQueries = buildProductRetryQueries(job);
  const rejectedListingUrls: string[] = [];
  const sourcesChecked: string[] = [];
  const sourceLinks: Array<{ label: string; url: string; domain?: string }> = [];
  const notes: string[] = [];
  const checkedCandidateUrls = new Set<string>();
  const usedSearchQueries = new Set<string>();
  const initialSearchQueries = mergeUniqueStrings([
    reviewSearchIdentity,
    cleanVisibleIdentity,
    product,
  ], 6);

  const verifyCandidate = (
    candidate: ProductCandidate | ExactProductCandidate,
    sourceLabel: string
  ): ExactProductAgentResult | null => {
    const candidateUrl = String(candidate.url || "").trim();
    if (!candidateUrl) return null;
    const dedupeKey = candidateUrl.toLowerCase().replace(/[?#].*$/, "");
    if (checkedCandidateUrls.has(dedupeKey)) return null;
    checkedCandidateUrls.add(dedupeKey);

    const result = verifyProductCandidate(job, {
      ...candidate,
      source: candidate.source || sourceLabel,
    });
    verifierResult = result;
    verifierReasons = mergeUniqueStrings([...verifierReasons, ...result.verifierReasons], 16);
    retrySearchQueries = mergeUniqueStrings([...result.retrySearchQueries, ...retrySearchQueries], 8);

    if (result.canCollectReviews && result.verifiedListingUrl) {
      const listingEvidence = exactListingFromCandidate(
        candidate,
        result,
        mergeUniqueStrings([...sourcesChecked, result.verifiedListingUrl, candidateUrl], 40),
        normalizeSourceLinks([
          ...sourceLinks,
          {
            label: candidate.title || "Verified exact product listing",
            url: result.verifiedListingUrl,
            domain: candidate.domain || candidate.store || undefined,
          },
        ]),
        mergeUniqueStrings([...notes, `${sourceLabel} verified exact product candidate.`], 12)
      );

      return {
        listingEvidence,
        verifierResult: result,
        exactSearchAttemptCount,
        exactSearchElapsedMs: Date.now() - startedAt,
        exactSearchTimedOut,
        verifierRetryCount,
        verifierStatus: result.verifierStatus,
        verifierReasons: result.verifierReasons,
        retrySearchQueries,
        verifiedListingUrl: result.verifiedListingUrl,
        rejectedListingUrls,
        canCollectReviews: true,
      };
    }

    if (result.rejectedListingUrl) rejectedListingUrls.push(result.rejectedListingUrl);
    return null;
  };

  const rememberedCandidate =
    rememberedEvidence && reviewEvidenceMatchesExactIdentity(rememberedEvidence, input)
      ? productCandidateFromEvidence(rememberedEvidence)
      : null;

  if (rememberedCandidate) {
    const rememberedResult = verifyCandidate(rememberedCandidate, "verified source memory");
    if (rememberedResult) {
      console.log("[ReviewIntel DEBUG exactProductAgent]", {
        exactSearchAttemptCount: rememberedResult.exactSearchAttemptCount,
        exactSearchElapsedMs: rememberedResult.exactSearchElapsedMs,
        exactSearchTimedOut: rememberedResult.exactSearchTimedOut,
        verifierRetryCount: rememberedResult.verifierRetryCount,
        verifierStatus: rememberedResult.verifierStatus,
        verifierReasons: rememberedResult.verifierReasons,
        retrySearchQueries: rememberedResult.retrySearchQueries,
        verifiedListingUrl: rememberedResult.verifiedListingUrl,
        rejectedListingUrls: rememberedResult.rejectedListingUrls,
        canCollectReviews: rememberedResult.canCollectReviews,
      });
      return rememberedResult;
    }
  }

  for (let round = 0; round <= maxRetryRounds; round += 1) {
    if (checkedCandidateUrls.size >= maxCandidates) break;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 1000) {
      exactSearchTimedOut = true;
      break;
    }

    const queryPool =
      round === 0
        ? initialSearchQueries
        : retrySearchQueries.length
          ? retrySearchQueries
          : initialSearchQueries;
    const primaryQuery = takeNextAgentQuery(queryPool, usedSearchQueries);
    if (!primaryQuery) break;

    if (round > 0) {
      verifierRetryCount += 1;
    }
    exactSearchAttemptCount += 1;

    const remainingCandidateSlots = Math.max(1, maxCandidates - checkedCandidateUrls.size);
    const candidatesThisRound =
      round === 0
        ? Math.min(2, remainingCandidateSlots)
        : Math.min(2, remainingCandidateSlots);

    console.log("[ReviewIntel DEBUG exactProductAgentRound]", {
      round: round + 1,
      primaryQuery,
      exactSearchAttemptCount,
      verifierRetryCount,
      remainingMs,
      candidatesThisRound,
    });

    const searchResult = await findExactProductCandidates({
      productName: product,
      brand: input.brand,
      store: input.store || undefined,
      price: toOptionalNumber(input.price),
      rating: toOptionalNumber(input.rating),
      reviewCount: toOptionalNumber(input.reviewCount),
      searchQueries: [primaryQuery],
      maxCandidates: candidatesThisRound,
      timeoutMs: Math.max(1000, Math.min(remainingMs, perAttemptTimeoutMs)),
      appendProductQuery: false,
      searchRoundLabel: round === 0 ? "initial_exact_product_search" : `verifier_retry_${round}`,
    });

    if (searchResult.timedOut) exactSearchTimedOut = true;
    sourcesChecked.push(...searchResult.sourcesChecked, ...searchResult.candidates.map((candidate) => candidate.url || ""));
    sourceLinks.push(...searchResult.sourceLinks);
    notes.push(`Agent round ${round + 1} query: ${primaryQuery}`, ...searchResult.notes);
    retrySearchQueries = mergeUniqueStrings([
      ...retrySearchQueries,
      ...searchResult.queries,
    ], 8);

    for (const candidate of searchResult.candidates) {
      const verified = verifyCandidate(candidate, round === 0 ? "initial exact search" : "retry exact search");
      if (verified) {
        console.log("[ReviewIntel DEBUG exactProductAgent]", {
          exactSearchAttemptCount: verified.exactSearchAttemptCount,
          exactSearchElapsedMs: verified.exactSearchElapsedMs,
          exactSearchTimedOut: verified.exactSearchTimedOut,
          verifierRetryCount: verified.verifierRetryCount,
          verifierStatus: verified.verifierStatus,
          verifierReasons: verified.verifierReasons,
          retrySearchQueries: verified.retrySearchQueries,
          verifiedListingUrl: verified.verifiedListingUrl,
          rejectedListingUrls: verified.rejectedListingUrls,
          canCollectReviews: verified.canCollectReviews,
        });
        return verified;
      }
      if (checkedCandidateUrls.size >= maxCandidates) break;
    }

    if (!retrySearchQueries.length || Date.now() >= deadline - 1000) break;
  }

  const result: ExactProductAgentResult = {
    listingEvidence: emptyAgentListing(
      input,
      mergeUniqueStrings(sourcesChecked, 40),
      normalizeSourceLinks(sourceLinks),
      mergeUniqueStrings([...notes, ...verifierReasons], 12)
    ),
    verifierResult,
    exactSearchAttemptCount,
    exactSearchElapsedMs: Date.now() - startedAt,
    exactSearchTimedOut,
    verifierRetryCount,
    verifierStatus: verifierResult.verifierStatus,
    verifierReasons,
    retrySearchQueries,
    verifiedListingUrl: null,
    rejectedListingUrls: mergeUniqueStrings(rejectedListingUrls, 12),
    canCollectReviews: false,
  };

  console.log("[ReviewIntel DEBUG exactProductAgent]", {
    exactSearchAttemptCount: result.exactSearchAttemptCount,
    exactSearchElapsedMs: result.exactSearchElapsedMs,
    exactSearchTimedOut: result.exactSearchTimedOut,
    verifierRetryCount: result.verifierRetryCount,
    verifierStatus: result.verifierStatus,
    verifierReasons: result.verifierReasons,
    retrySearchQueries: result.retrySearchQueries,
    verifiedListingUrl: result.verifiedListingUrl,
    rejectedListingUrls: result.rejectedListingUrls,
    canCollectReviews: result.canCollectReviews,
  });

  return result;
}

export async function collectAndAnalyzeReviewEvidence(
  input: ReviewEvidenceInput
): Promise<ReviewEvidenceResult> {
  const requestedLocale = normalizeLocale(input.locale || "en");
  const outputLanguage = String(input.outputLanguage || localeLabel(requestedLocale) || "English");
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      ...emptyEvidence("OPENAI_API_KEY is missing, so ReviewIntel could not search review evidence."),
      locale: requestedLocale,
      outputLanguage,
    };
  }

  const product = uniqueIdentityTokens([input.brand, input.productName, input.model], 30);
  const cleanVisibleIdentity = uniqueSearchWordsFromText([
    input.store,
    input.brand,
    input.productName,
    input.model,
    input.price ? `$${input.price}` : "",
    input.rating ? `${input.rating} stars` : "",
    input.reviewCount ? `${input.reviewCount} reviews` : "",
  ].filter(Boolean).join(" "));

  const reviewSearchIdentity = uniqueIdentityTokens([
    input.store,
    cleanVisibleIdentity,
  ], 36);

  if (!product || product.length < 3) {
    return {
      ...emptyEvidence("Product name was not clear enough to search reviews."),
      locale: requestedLocale,
      outputLanguage,
    };
  }

  const rememberedEvidence = input.forceRefresh ? null : await loadRecentReviewEvidenceFromMemory(input);
  if (
    rememberedEvidence &&
    reviewEvidenceMatchesRequestedStore(rememberedEvidence, input) &&
    reviewEvidenceMatchesExactIdentity(rememberedEvidence, input) &&
    !reviewEvidenceNeedsAutomaticRecovery(rememberedEvidence)
  ) {
    return rememberedEvidence;
  }

  if (
    rememberedEvidence &&
    reviewEvidenceMatchesRequestedStore(rememberedEvidence, input) &&
    reviewEvidenceMatchesExactIdentity(rememberedEvidence, input) &&
    reviewEvidenceNeedsAutomaticRecovery(rememberedEvidence)
  ) {
    console.log("[ReviewIntel DEBUG memory rejected]", {
      inputStore: input.store,
      rememberedExactListingUrl: rememberedEvidence.listingEvidence?.exactListingUrl,
      reason: "Remembered evidence had zero review signals, so automatic recovery will run again.",
    });
  }

  if (
    rememberedEvidence &&
    reviewEvidenceMatchesRequestedStore(rememberedEvidence, input) &&
    !reviewEvidenceMatchesExactIdentity(rememberedEvidence, input)
  ) {
    console.log("[ReviewIntel DEBUG memory rejected]", {
      inputStore: input.store,
      rememberedExactListingUrl: rememberedEvidence.listingEvidence?.exactListingUrl,
      reason: "Remembered evidence did not pass exact-product identity checks for this scan.",
    });
  }

  if (rememberedEvidence && !reviewEvidenceMatchesRequestedStore(rememberedEvidence, input)) {
    console.log("[ReviewIntel DEBUG memory rejected]", {
      inputStore: input.store,
      rememberedExactListingUrl: rememberedEvidence.listingEvidence?.exactListingUrl,
      reason: "Remembered evidence host does not match requested store.",
    });
  }

  const exactProductAgent = await runExactProductAgent({
    input,
    product,
    reviewSearchIdentity,
    cleanVisibleIdentity,
    rememberedEvidence,
  });
  const rawListingEvidence = exactProductAgent.listingEvidence;
  const productVerifierResult = exactProductAgent.verifierResult;

  console.log("[ReviewIntel DEBUG exactListingSearch]", {
    reviewSearchIdentity,
    exactSearchAttemptCount: exactProductAgent.exactSearchAttemptCount,
    exactSearchElapsedMs: exactProductAgent.exactSearchElapsedMs,
    exactSearchTimedOut: exactProductAgent.exactSearchTimedOut,
    verifierRetryCount: exactProductAgent.verifierRetryCount,
    verifierStatus: exactProductAgent.verifierStatus,
    verifierReasons: exactProductAgent.verifierReasons,
    exactListingUrl: rawListingEvidence.exactListingUrl,
    exactListingTitle: rawListingEvidence.exactListingTitle,
    store: rawListingEvidence.store,
    confidence: rawListingEvidence.confidence,
    notes: rawListingEvidence.notes,
  });

  const requestedStoreHost = String(input.store || "").toLowerCase();
  const requiresWalmartCa =
    requestedStoreHost.includes("walmart.ca") ||
    requestedStoreHost.includes("walmart canada");

  const returnedExactHost = (() => {
    try {
      return rawListingEvidence.exactListingUrl
        ? new URL(rawListingEvidence.exactListingUrl).hostname.toLowerCase().replace(/^www\./, "")
        : "";
    } catch {
      return "";
    }
  })();

  const listingEvidence =
    requiresWalmartCa &&
    returnedExactHost &&
    returnedExactHost !== "walmart.ca" &&
    !returnedExactHost.endsWith(".walmart.ca")
      ? {
          ...rawListingEvidence,
          exactListingUrl: null,
          price: null,
          rating: null,
          reviewCount: null,
          confidence: "low" as const,
          notes: [
            ...(Array.isArray(rawListingEvidence.notes) ? rawListingEvidence.notes : []),
            `Rejected returned listing because requested store is Walmart.ca, but returned host was ${returnedExactHost}.`,
            "ReviewIntel did not use this listing as exact product evidence.",
          ],
        }
      : rawListingEvidence;

  const listingEvidenceForCollection = listingDomainMatchesRequestedStore(
    listingMatchesRequestedSignals(
      normalizeListingEvidenceNumbers(listingEvidence),
      input
    ),
    input
  );

  const collectionNotesText = Array.isArray(listingEvidenceForCollection?.notes)
    ? listingEvidenceForCollection.notes.join(" ").toLowerCase()
    : "";
  const listingRejectedByEvidence =
    listingEvidenceForCollection?.confidence === "low" &&
    /similar product|missing distinctive|rejected returned listing|requested product appears/.test(
      collectionNotesText
    );

  const verifiedListingUrlForCollection = productVerifierResult.canCollectReviews
    ? productVerifierResult.verifiedListingUrl
    : null;

  const listingUrlForReviewCollector =
    !listingRejectedByEvidence &&
    typeof verifiedListingUrlForCollection === "string" &&
    verifiedListingUrlForCollection.trim()
      ? verifiedListingUrlForCollection
      : null;
  const listingRejectedForCollection = !listingUrlForReviewCollector;
  const exactListingRejectedReason = listingRejectedForCollection
    ? collectionNotesText ||
      productVerifierResult.verifierReasons.join(" ") ||
      "No exact listing URL was accepted for written review collection."
    : null;

  const exactListingAccepted = Boolean(listingUrlForReviewCollector);
  const collectorSourceAccepted = Boolean(exactListingAccepted && listingUrlForReviewCollector);
  const collectorSourceRejectedReason = collectorSourceAccepted
    ? null
    : exactListingRejectedReason || "Written review collection requires a confirmed exact listing.";

  const marketplaceReviewCountForCollector =
    !listingRejectedForCollection &&
    typeof listingEvidenceForCollection?.reviewCount === "number" &&
    Number.isFinite(listingEvidenceForCollection.reviewCount)
      ? listingEvidenceForCollection.reviewCount
      : null;

  let collectedWrittenReviews: ReviewCollectorResult = listingUrlForReviewCollector
      ? await collectWrittenReviewsFromListing({
        listingUrl: listingUrlForReviewCollector,
        productName: listingEvidenceForCollection?.exactListingTitle || input.productName,
        marketplaceReviewCount: marketplaceReviewCountForCollector,
        maxReviews: 80,
      })
    : {
        attempted: false,
        sourceUrl: null,
        extractor: "none" as const,
        reviewsCollected: 0,
        collectorHasWrittenReviews: false,
        reviews: [],
        coverageNote: collectorSourceRejectedReason || "No exact listing URL was available for written review collection.",
        fallbackUrlsTried: [],
      };

  let nativeReviewRetrieval: NativeReviewRetrievalResult | null = null;
  let nativeRetrievalNote =
    collectedWrittenReviews.reviewsCollected >= 3
      ? "Native retrieval was not needed because the listing collector already found written review text."
      : "Native retrieval was not attempted.";

  if (collectorSourceAccepted && collectedWrittenReviews.reviewsCollected < 3) {
    nativeReviewRetrieval = await runNativeReviewRetrieval({
      productTitle: listingEvidenceForCollection?.exactListingTitle || input.productName,
      brand: input.brand,
      model: input.model,
      store: input.store,
      listingUrl: listingUrlForReviewCollector,
      sourceLinks: listingEvidenceForCollection?.sourceLinks,
      maxQueries: 8,
      maxPages: 12,
      maxSnippets: 80,
    });

    nativeRetrievalNote = nativeReviewRetrieval.coverageNote;

    if (nativeReviewRetrieval.reviewsCollected > 0) {
      const nativeReviews = nativeReviewRetrieval.reviews.map((review) => ({
        ...review,
        source: review.source || "Native public review retrieval",
      }));
      const combinedReviews = mergeUnknownArrays<ReviewCollectorResult["reviews"][number]>(
        collectedWrittenReviews.reviews,
        nativeReviews,
        80
      );

      collectedWrittenReviews = reviewCollectorResultWith(collectedWrittenReviews, {
        reviews: combinedReviews,
        coverageNote: `${collectedWrittenReviews.coverageNote} ${nativeReviewRetrieval.coverageNote}`,
        fallbackUrlsTried: nativeReviewRetrieval.sourcesChecked,
      });
    } else {
      collectedWrittenReviews = reviewCollectorResultWith(collectedWrittenReviews, {
        coverageNote: `${collectedWrittenReviews.coverageNote} ${nativeReviewRetrieval.coverageNote}`,
        fallbackUrlsTried: nativeReviewRetrieval.sourcesChecked,
      });
    }
  } else if (!collectorSourceAccepted) {
    nativeRetrievalNote =
      collectorSourceRejectedReason || "Native retrieval skipped because no accepted exact product source was available.";
  }

  const hasCollectedWrittenReviewEvidence =
    collectorSourceAccepted &&
    (
      collectedWrittenReviews.reviews.length > 0 ||
      collectedWrittenReviews.reviewsCollected > 0 ||
      collectedWrittenReviews.collectorHasWrittenReviews
    );

  let firecrawlRecoveryNote = "Firecrawl fallback was not needed.";
  const firecrawlLastResortAllowed = Boolean(
    listingUrlForReviewCollector &&
      collectedWrittenReviews.reviewsCollected <= 0 &&
      nativeReviewRetrieval?.attempted &&
      nativeReviewRetrieval.normalFetchFailed &&
      nativeReviewRetrieval.playwrightFailed &&
      !nativeReviewRetrieval.usableSnippetsExtracted &&
      process.env.FIRECRAWL_API_KEY
  );

  if (listingUrlForReviewCollector && collectedWrittenReviews.reviewsCollected <= 0 && firecrawlLastResortAllowed) {
    const firecrawlFallback = await runFirecrawlFallback({
      url: listingUrlForReviewCollector,
      reason: collectedWrittenReviews.coverageNote,
      timeoutMs: 12000,
    });

    firecrawlRecoveryNote = firecrawlFallback.reason;

    if (firecrawlFallback.reviewSnippets.length > 0) {
      const firecrawlReviews = firecrawlFallback.reviewSnippets.map((snippet) => ({
        source: firecrawlFallback.title || "Firecrawl fallback review snippet",
        sourceUrl: firecrawlFallback.sourceUrl || listingUrlForReviewCollector,
        rating: null,
        body: snippet,
        date: null,
        verified: null,
      }));

      collectedWrittenReviews = {
        ...collectedWrittenReviews,
        attempted: true,
        reviews: firecrawlReviews,
        reviewsCollected: firecrawlReviews.length,
        collectorHasWrittenReviews: true,
        coverageNote: `${collectedWrittenReviews.coverageNote} ${firecrawlFallback.reason}`,
        fallbackUrlsTried: Array.from(
          new Set([
            ...(collectedWrittenReviews.fallbackUrlsTried || []),
            firecrawlFallback.sourceUrl || listingUrlForReviewCollector,
          ])
        ).slice(0, 12),
      };
    } else if (firecrawlFallback.used) {
      collectedWrittenReviews = {
        ...collectedWrittenReviews,
        attempted: true,
        coverageNote: `${collectedWrittenReviews.coverageNote} ${firecrawlFallback.reason}`,
        fallbackUrlsTried: Array.from(
          new Set([
            ...(collectedWrittenReviews.fallbackUrlsTried || []),
            firecrawlFallback.sourceUrl || listingUrlForReviewCollector,
          ])
        ).slice(0, 12),
      };
    }
  } else if (listingUrlForReviewCollector && collectedWrittenReviews.reviewsCollected <= 0) {
    if (!process.env.FIRECRAWL_API_KEY) {
      firecrawlRecoveryNote = "Firecrawl fallback skipped because FIRECRAWL_API_KEY is missing.";
    } else if (!nativeReviewRetrieval?.attempted) {
      firecrawlRecoveryNote = "Firecrawl fallback skipped because native retrieval did not run.";
    } else if (!nativeReviewRetrieval.normalFetchFailed || !nativeReviewRetrieval.playwrightFailed) {
      firecrawlRecoveryNote =
        "Firecrawl fallback skipped because native fetch or Playwright was not fully exhausted.";
    } else {
      firecrawlRecoveryNote =
        "Firecrawl fallback skipped because native retrieval found usable snippets or no product URL required Firecrawl.";
    }
  }

  const localAttemptedSources = Array.from(
    new Set(
      [
        ...listingEvidence.sourcesChecked,
        listingUrlForReviewCollector,
        ...(collectedWrittenReviews.fallbackUrlsTried || []),
        ...(nativeReviewRetrieval?.sourcesChecked || []),
      ]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  ).slice(0, 80);

  const localSourceLinks = normalizeSourceLinks([
    ...(Array.isArray(listingEvidenceForCollection?.sourceLinks)
      ? listingEvidenceForCollection.sourceLinks
      : []),
    ...(nativeReviewRetrieval?.sourceLinks || []),
    ...(listingUrlForReviewCollector
      ? [
          {
            label: listingEvidenceForCollection?.exactListingTitle || "Exact product listing",
            url: listingUrlForReviewCollector,
            domain: listingEvidenceForCollection?.store || undefined,
          },
        ]
      : []),
  ]);

  const normalizedLocalDisplayListingEvidence = applyObservedScreenshotSignalsToListing(
    normalizeListingConfidence(
      listingDomainMatchesRequestedStore(
        listingMatchesRequestedSignals(
          normalizeListingEvidenceNumbers(listingEvidenceForCollection),
          input
        ),
        input
      ),
      input
    ) ?? null,
    input
  );
  const localDisplayListingEvidence = collectorSourceAccepted
    ? normalizedLocalDisplayListingEvidence
    : normalizedLocalDisplayListingEvidence
      ? {
          ...normalizedLocalDisplayListingEvidence,
          exactListingUrl: null,
          exactListingTitle: null,
          price: toOptionalNumber(input.price) ?? null,
          rating: toOptionalNumber(input.rating) ?? null,
          reviewCount: toOptionalNumber(input.reviewCount) ?? null,
          confidence: "low" as const,
          notes: [
            ...(Array.isArray(normalizedLocalDisplayListingEvidence.notes)
              ? normalizedLocalDisplayListingEvidence.notes
              : []),
            collectorSourceRejectedReason ||
              "Rejected listing was kept only as diagnostic metadata, not review evidence.",
          ],
        }
      : {
          exactListingUrl: null,
          exactListingTitle: null,
          store: input.store || null,
          price: toOptionalNumber(input.price) ?? null,
          rating: toOptionalNumber(input.rating) ?? null,
          reviewCount: toOptionalNumber(input.reviewCount) ?? null,
          confidence: "low" as const,
          sourcesChecked: localAttemptedSources,
          sourceLinks: [],
          notes: [
            collectorSourceRejectedReason ||
              "No accepted exact listing was available for written review collection.",
          ],
        };

  const recoveryEvidenceFromLocalRetrieval = (reason: string): ReviewEvidenceResult => {
    const reviewSnippets = collectorSourceAccepted
      ? collectedWrittenReviews.reviews
      .map((review) => ({
        source: review.source || collectedWrittenReviews.extractor || "Native public review retrieval",
        snippet: review.body,
        sentiment:
          typeof review.rating === "number"
            ? review.rating >= 4
              ? "positive" as const
              : review.rating <= 2
                ? "negative" as const
                : "mixed" as const
            : "mixed" as const,
        evidenceType: review.source?.toLowerCase().includes("search snippet")
          ? "open web review intelligence"
          : "marketplace review",
      }))
      .filter((item) => item.snippet.trim().length >= 12)
      .slice(0, 40)
      : [];
    const commentsAnalyzed = reviewSnippets.length;
    const sourcesChecked = localAttemptedSources.length
      ? localAttemptedSources
      : [reviewSearchIdentity || product || "native review retrieval attempted"];

    return cleanFinalReviewEvidence({
      ...emptyEvidence(reason),
      locale: requestedLocale,
      outputLanguage,
      sourcesChecked,
      sourceLinks: collectorSourceAccepted ? localSourceLinks : [],
      listingEvidence: localDisplayListingEvidence,
      exactListingAccepted,
      exactListingRejectedReason,
      collectorSourceAccepted,
      collectorSourceRejectedReason,
      exactSearchAttemptCount: exactProductAgent.exactSearchAttemptCount,
      exactSearchElapsedMs: exactProductAgent.exactSearchElapsedMs,
      exactSearchTimedOut: exactProductAgent.exactSearchTimedOut,
      verifierRetryCount: exactProductAgent.verifierRetryCount,
      verifierStatus: exactProductAgent.verifierStatus,
      verifierReasons: exactProductAgent.verifierReasons,
      retrySearchQueries: exactProductAgent.retrySearchQueries,
      verifiedListingUrl: exactProductAgent.verifiedListingUrl,
      rejectedListingUrls: exactProductAgent.rejectedListingUrls,
      canCollectReviews: exactProductAgent.canCollectReviews,
      detectedProductKey: normalizeEvidenceProductKey(input),
      resultSource: "analyze",
      reviewsFound: Number(
        firstPositiveNumber(
          localDisplayListingEvidence?.reviewCount,
          input.reviewCount,
          commentsAnalyzed
        ) || commentsAnalyzed
      ),
      marketplaceReviewCount: firstPositiveNumber(
        localDisplayListingEvidence?.reviewCount,
        input.reviewCount
      ),
      reviewCollector: {
        attempted: collectedWrittenReviews.attempted,
        sourceUrl: collectedWrittenReviews.sourceUrl,
        extractor: collectedWrittenReviews.extractor,
        reviewsCollected: commentsAnalyzed,
        collectorHasWrittenReviews: commentsAnalyzed > 0,
        collectorSourceAccepted,
        collectorSourceRejectedReason,
        coverageNote: collectedWrittenReviews.coverageNote,
        fallbackUrlsTried: collectedWrittenReviews.fallbackUrlsTried,
      },
      reviewsCollected: commentsAnalyzed,
      collectorHasWrittenReviews: commentsAnalyzed > 0,
      reviewIntelligenceSignals: commentsAnalyzed,
      reviewIntelligenceMode: commentsAnalyzed > 0 ? "written_reviews" : "listing_metadata",
      reviewCoverageRatio: commentsAnalyzed > 0 ? 1 : 0,
      commentsAnalyzed,
      evidenceStrength: evidenceStrengthForCount(commentsAnalyzed),
      reviewSnippets,
      sourceNotes: [
        reason,
        collectedWrittenReviews.coverageNote,
        nativeRetrievalNote,
        firecrawlRecoveryNote,
      ].filter(Boolean),
      reviewAuthenticity: {
        score: null,
        label: commentsAnalyzed > 0 ? "Review evidence collected" : "Review evidence not found",
        suspiciousReviewRisk: "Not scored",
        reasons:
          commentsAnalyzed > 0
            ? [
                "ReviewIntel collected public review-like snippets, but AI review analysis did not complete.",
              ]
            : [
                "No written review bodies were collected or analyzed.",
                "Marketplace rating/review count from a screenshot or listing is metadata only, not review evidence.",
              ],
        suspiciousComments: [],
      },
    });
  };

  const collectedWrittenReviewsPrompt = formatCollectedReviewsForPrompt(
    collectedWrittenReviews
  );

  const checkedListingUrl = String(listingEvidenceForCollection?.exactListingUrl || "").trim();
  const checkedListingTitle = String(listingEvidenceForCollection?.exactListingTitle || input.productName || "").trim();
  const checkedListingId =
    checkedListingUrl.match(/\/([A-Z0-9]{8,})(?:[/?#]|$)/i)?.[1] || "";
  const checkedShortTitle = checkedListingTitle
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10)
    .join(" ");

  console.log("[ReviewIntel DEBUG reviewCollectorInput]", {
    listingUrlForReviewCollector,
    marketplaceReviewCountForCollector,
    listingRejectedForCollection,
    exactListingAccepted,
    exactListingRejectedReason,
    collectorSourceAccepted,
    collectorSourceRejectedReason,
    exactSearchAttemptCount: exactProductAgent.exactSearchAttemptCount,
    exactSearchElapsedMs: exactProductAgent.exactSearchElapsedMs,
    exactSearchTimedOut: exactProductAgent.exactSearchTimedOut,
    verifierRetryCount: exactProductAgent.verifierRetryCount,
    verifierStatus: exactProductAgent.verifierStatus,
    verifierReasons: exactProductAgent.verifierReasons,
    retrySearchQueries: exactProductAgent.retrySearchQueries,
    verifiedListingUrl: exactProductAgent.verifiedListingUrl,
    rejectedListingUrls: exactProductAgent.rejectedListingUrls,
    canCollectReviews: exactProductAgent.canCollectReviews,
    listingEvidenceForCollectionConfidence: listingEvidenceForCollection?.confidence,
    listingEvidenceForCollectionNotes: listingEvidenceForCollection?.notes,
    extractor: collectedWrittenReviews.extractor,
    reviewsCollected: collectedWrittenReviews.reviewsCollected,
    collectorHasWrittenReviews: collectedWrittenReviews.collectorHasWrittenReviews,
    coverageNote: collectedWrittenReviews.coverageNote,
    firecrawlRecoveryNote,
  });

  if (!collectorSourceAccepted) {
    const insufficientEvidence = recoveryEvidenceFromLocalRetrieval(
      collectorSourceRejectedReason ||
        "ReviewIntel rejected the matched listing, so written review collection was skipped."
    );

    await saveReviewEvidenceToMemory(input, insufficientEvidence);

    return insufficientEvidence;
  }

  const prompt = `
Collected written reviews from exact listing:
${collectedWrittenReviewsPrompt}

Written review collection coverage:
${collectedWrittenReviews.coverageNote}

Native retrieval recovery:
${nativeRetrievalNote}

Firecrawl fallback recovery:
${firecrawlRecoveryNote}

You are ReviewIntel's review-evidence scanner.

Language rule:
- Return every user-facing value in ${outputLanguage}: sourceNotes, overallImpact, buyAssessment, reviewSnippets.snippet, repeatedPraises.theme, repeatedComplaints.theme, aiPatternSignals, buyerExperienceSignals, productPros, productCons, and reviewAuthenticity.reasons.
- Keep JSON keys and enum values exactly in English.
- Keep product titles, brand names, marketplace names, source labels, URLs, prices, ratings, and quoted technical terms unchanged.

Task:
Search the web for public review evidence about this product:
"${reviewSearchIdentity || product}"

Visible product identity bundle:
${JSON.stringify(
  {
    store: input.store || null,
    brand: input.brand || null,
    title: input.productName || null,
    model: input.model || null,
    price: input.price ?? null,
    rating: input.rating ?? null,
    reviewCount: input.reviewCount ?? null,
  },
  null,
  2
)}

Detective investigation seeds:
${JSON.stringify(
  {
    exactListingUrl: checkedListingUrl || null,
    exactListingId: checkedListingId || null,
    exactListingTitle: checkedListingTitle || null,
    shorterTitleQuery: checkedShortTitle || null,
  },
  null,
  2
)}

Same-product checked listing evidence already collected by ReviewIntel:
${JSON.stringify(listingEvidenceForCollection, null, 2)}

Use same-product checked listing evidence as the anchor only when it is medium or high confidence.
If the checked listing evidence is low confidence or says "similar product", do not use it as the anchor; search again for the exact same product instead.
If exact listing evidence contains rating or reviewCount, preserve it.
Do not override it with weaker screenshot-only assumptions.

Search intent:
- buyer reviews
- complaints
- product review comments
- Reddit/user discussions
- YouTube review snippets or transcript snippets
- public Q&A sections
- forum complaints
- product review blogs
- marketplace review snippets
- repeated praise/complaint patterns
- fake-review or AI-like review signals

Important:
Do not invent reviews.
Use OpenAI web search like an analyst: verify the exact product first, then keep searching for review evidence across the public web.
Zero evidence is not a final result. If reviewsCollected, commentsAnalyzed, sourcesChecked, and review-intelligence signals are all zero, automatically enter evidence recovery instead of returning a normal verdict or score.
Only analyze buyer statements, public review snippets, complaints, Q&A/user discussions, reputable review-page summaries, or source-visible review intelligence that you can find from search-accessible sources.
Do not stop at blocked marketplace review bodies. If direct review bodies are blocked, continue with open-web review intelligence for the exact same product and return a cautious score.
The local ReviewIntel collector above is the authority for written review bodies.
Never pretend marketplace rating or marketplace review count are written review bodies.
If you use public search/page snippets or reputable review-page summaries because direct bodies are blocked, label them as "open web review intelligence" in reviewSnippets.evidenceType and explain the limitation in sourceNotes.
If the exact marketplace blocks written reviews, do not stop. Continue with a same-product review-source fallback from another legitimate source.
The fallback should prefer actual written buyer review body text from another marketplace listing, manufacturer review page, syndicated review provider, public review API, embedded review app data, forum/user review page, or public review page.
If actual bodies are still inaccessible, use exact-product public review intelligence from search-accessible snippets/summaries and keep the verdict cautious.
If you use a fallback source, it must still match the same product by brand, title/model, image/listing context, and product type.

Review acquisition rules:
1. First confirm the exact product/listing using store + brand + normalized title + price/image clues.
2. Extract the public marketplace rating and public marketplace review count when visible.
   Example: if Walmart shows 4.3 stars and 273 reviews, return marketplaceReviewCount: 273.
3. Then perform a separate review-content drill-down. The goal is to find the written review text inside or about those public reviews.
4. Search specifically for written buyer review content using:
   - exact product title
   - exact product title + reviews
   - exact product title + Amazon.ca
   - exact product title + Walmart
   - exact product title + Reddit
   - exact product title + YouTube review
   - exact product title + complaints
   - exact product title + "worth it"
   - exact product title + "problems"
   - exact listing URL + reviews
   - exact listing item/product ID + reviews
   - shorter exact title + reviews
   - exact listing title + Walmart reviews
   - exact listing title + customer reviews
   - exact listing title + complaints
   - brand + exact product title + reviews
   - brand + exact product title + complaints
   - brand + exact product title + Amazon reviews
   - brand + exact product title + Walmart reviews
   - brand + exact product title + Best Buy reviews
   - brand + exact product title + Costco reviews
   - brand + exact product title + Sephora reviews
   - brand + exact product title + Temu reviews
   - product title + reddit
   - product title + forum
   - product title + Q&A
   - product title + review blog
   - product title + "verified purchase"
5. Exact listing evidence is identity evidence. Use it to anchor the product match only when paired with public review intelligence.
6. Public rating/review count is listing metadata, not written review text. It can influence confidence and reliability, but not replace pros/cons evidence.
7. reviewSnippets must contain exact-product evidence: direct buyer-review/comment evidence when available, or clearly labeled open-web review intelligence when direct review bodies are blocked.
8. commentsAnalyzed must equal the number of exact-product review/comment/intelligence signals you analyzed. Do not copy marketplaceReviewCount into commentsAnalyzed.
9. repeatedPraises, repeatedComplaints, aiPatternSignals, buyerExperienceSignals, productPros, and productCons must be built from reviewSnippets and exact-product open-web signals.
10. If marketplaceReviewCount is high but commentsAnalyzed is low, clearly say coverage is limited.
11. If you find the first listing but cannot access/read written buyer reviews, search another legitimate same-product review source before returning.
12. Return no score if you cannot find exact-product written reviews, buyer comments, Q&A, Reddit/forum comments, YouTube review snippets/transcripts, public retailer snippets, review blog evidence, or other public review intelligence. Product identity, rating, and review count alone are not enough.
13. Do not convert rating or public review count alone into a strong Buy. Use them as reliability context and keep confidence limited unless written/open-web review signals are visible.
14. The analysis must answer from exact-product evidence:
   - Are there AI-pattern or fake-review signals?
   - What are the real pros?
   - What are the real cons?
   - What is the buyer experience?
   - What is the overall product impact?
   - Is this really a good product to buy?

Buyer highlight rules:
- productPros and productCons must be concise buyer decision highlights, not repeated summaries.
- Return only the strongest 3-5 distinct pros and 3-5 distinct cons.
- Merge duplicate themes into one bullet; do not repeat the same noun phrase across multiple bullets.
- Do not repeat a product feature unless the repeated buyer experience changes the decision.
- Write each pro/cons bullet as one clear factor a buyer should know before checkout.

Analyze each collected review/comment snippet for suspicious or AI-like signals:
- generic praise with no product-specific detail
- repeated wording
- overly polished marketing tone
- same structure across comments
- rating/text mismatch
- vague "highly recommend" style
- no real usage details
- clustered complaints or suspicious patterns

Return ONLY valid JSON. No markdown.

Required JSON shape:
{
  "sourcesChecked": ["source name or domain"],
  "reviewsFound": 0,
  "marketplaceReviewCount": null,
  "commentsAnalyzed": 0,
  "evidenceStrength": "none | weak | limited | usable | strong",

  "aiPatternSignals": [
    "short signal about repetitive wording, generic praise, suspicious timing, review stuffing, or low-detail review patterns"
  ],

  "buyerExperienceSignals": [
    "short signal about what buyers actually experienced after purchase/use"
  ],

  "productPros": [
    "specific positive product signal supported by reviewSnippets"
  ],

  "productCons": [
    "specific negative product signal supported by reviewSnippets"
  ],

  "overallImpact": "short evidence-based summary of the product's real buyer impact",
  "buyAssessment": "short answer: is this really a good product to buy based only on analyzed review text?",

  "reviewSnippets": [
    {
      "source": "source name or domain",
      "snippet": "short verbatim or closely paraphrased buyer review/comment evidence",
      "sentiment": "positive | mixed | negative",
      "evidenceType": "marketplace review | buyer comment | forum discussion | third-party review | open web review intelligence | listing metadata"
    }
  ],

  "repeatedPraises": [
    {
      "theme": "short repeated praise theme",
      "evidenceCount": 0,
      "supportingSnippets": ["short snippets supporting this praise"]
    }
  ],

  "repeatedComplaints": [
    {
      "theme": "short repeated complaint theme",
      "evidenceCount": 0,
      "supportingSnippets": ["short snippets supporting this complaint"]
    }
  ],

  "sourceNotes": ["short notes"],
  "sourceLinks": [
    {
      "label": "source title",
      "url": "https://example.com",
      "domain": "example.com"
    }
  ],
  "reviewAuthenticity": {
    "score": null,
    "label": "Review scan not verified",
    "suspiciousReviewRisk": "Not scored",
    "reasons": ["short reasons"],
    "suspiciousComments": [
      {
        "source": "source name or domain",
        "snippet": "short review/comment snippet only",
        "riskScore": 0,
        "reason": "why suspicious or not"
      }
    ]
  }
}

Scoring rules:
- score means AI-like/fake-review RISK, not credibility.
- 0 means very low fake-review risk.
- 100 means very high fake-review risk.
- Do NOT give a high score because sources are reputable.
- Reputable sources, verified purchases, diverse user feedback, and specific complaints should LOWER the score.
- Only give score above 60 when there are actual suspicious review snippets or repeated suspicious patterns.
- marketplaceReviewCount means the public total review count shown on the marketplace/listing, for example 273 reviews.
- commentsAnalyzed means the number of exact-product written review/comment texts or clearly labeled open-web review-intelligence signals you read and analyzed.
- reviewsFound should equal marketplaceReviewCount when the listing exposes a public review count.
- Do not treat marketplaceReviewCount as analyzed evidence.
- commentsAnalyzed must equal the number of actual review/comment/intelligence snippets you found and analyzed, never the marketplace total.
- reviewSnippets must contain the evidence used for the assessment.
- repeatedPraises, repeatedComplaints, aiPatternSignals, buyerExperienceSignals, productPros, and productCons must only be based on reviewSnippets.
- If marketplaceReviewCount is high but commentsAnalyzed is low, evidenceStrength must remain weak or limited.
- Do not give a strong Buy from rating or marketplaceReviewCount alone; if exact-product review intelligence is thin, return a cautious Consider/Avoid with low confidence.
- The final review intelligence must answer: AI-pattern risk, pros, cons, buyer experience, overall impact, and whether this is really a good product to buy.
- If direct written bodies are blocked, include open-web review intelligence snippets instead of returning an empty result.
- If commentsAnalyzed is 0 after recovery, return evidenceStrength "none", score null, reviewAuthenticity.score null, and explain that ReviewIntel could not access enough public review evidence. Do not return BUY, CONSIDER, AVOID, or any Buy Score from listing reliability alone.
- commentsAnalyzed 1-4: evidenceStrength = "weak"
- commentsAnalyzed 5-14: evidenceStrength = "limited"
- commentsAnalyzed 15-29: evidenceStrength = "usable"
- commentsAnalyzed 30+: evidenceStrength = "strong"
- Do NOT use 50 as a lazy fallback. If evidence is mixed, calculate a cautious score from rating, review volume, visible pros/cons, and complaint severity.
- Only return suspiciousComments when riskScore is 60 or higher.
- Return a number score only when exact product identity is verified and public review intelligence is available; lower confidence when direct written review coverage is blocked.
`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REVIEW_SEARCH_MODEL || "gpt-4.1-mini",
        tools: [{ type: "web_search" }],
        input: prompt,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return recoveryEvidenceFromLocalRetrieval(
        `OpenAI web review search failed: ${response.status} ${errorText.slice(0, 180)}`
      );
    }

    const data = await response.json();

    const outputText =
      data.output_text ||
      data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
        ?.map((content: { text?: string }) => content.text || "")
        ?.join("\n") ||
      "";

    if (!outputText.trim()) {
      return recoveryEvidenceFromLocalRetrieval("OpenAI web review search returned no review evidence.");
    }

    let parsed = safeParseReviewEvidenceJson(outputText);

    const reliableSignalTarget = Math.max(
      12,
      Math.min(Number(process.env.REVIEWINTEL_RELIABLE_SIGNAL_TARGET || 35), 50)
    );
    const maxDeepSearchPasses = Math.max(
      1,
      Math.min(Number(process.env.REVIEWINTEL_DEEP_SEARCH_PASSES || 5), 5)
    );

    for (
      let deepSearchPass = 1;
      deepSearchPass <= maxDeepSearchPasses && parsedEvidenceSignalCount(parsed) < reliableSignalTarget;
      deepSearchPass += 1
    ) {
      const deepPrompt = `
You are ReviewIntel's deep public-review intelligence pass.

Language rule:
- Return every user-facing value in ${outputLanguage}.
- Keep JSON keys and enum values exactly in English.
- Keep product titles, brand names, marketplace names, source labels, URLs, prices, and ratings unchanged.

The current scan is too thin for a high-confidence ReviewIntel verdict.
Work harder with web_search. This is pass ${deepSearchPass} of ${maxDeepSearchPasses}.
Target: collect up to ${reliableSignalTarget} distinct exact-product review/comment/Q&A/open-web review-intelligence signals.
Zero evidence is not a final result. If reviewsCollected, commentsAnalyzed, sourcesChecked, and review-intelligence signals are all zero, search harder before returning.

Already collected written reviews from ReviewIntel's marketplace collector:
${collectedWrittenReviewsPrompt}

Native retrieval recovery:
${nativeRetrievalNote}

Firecrawl fallback recovery:
${firecrawlRecoveryNote}

Use these exact-product search seeds before giving up:
${JSON.stringify(
  {
    exactListingUrl: checkedListingUrl || null,
    exactListingId: checkedListingId || null,
    exactListingTitle: checkedListingTitle || null,
    shorterTitleQuery: checkedShortTitle || null,
  },
  null,
  2
)}

Current first-pass JSON evidence:
${JSON.stringify(parsed, null, 2)}

Exact product target:
${JSON.stringify(
  {
    requestedStore: input.store || null,
    requestedBrand: input.brand || null,
    requestedTitle: input.productName,
    model: input.model || null,
    requestedPrice: input.price ?? null,
    requestedRating: input.rating ?? null,
    requestedReviewCount: input.reviewCount ?? null,
    exactListingUrl: listingEvidenceForCollection?.exactListingUrl || null,
    exactListingTitle: listingEvidenceForCollection?.exactListingTitle || null,
    listingStore: listingEvidenceForCollection?.store || null,
    listingConfidence: listingEvidenceForCollection?.confidence || null,
    listingRating: listingEvidenceForCollection?.rating ?? null,
    listingReviewCount: listingEvidenceForCollection?.reviewCount ?? null,
    listingNotes: listingEvidenceForCollection?.notes || [],
  },
  null,
  2
)}

Search harder. Try exact listing URL searches, exact item/product ID searches, exact phrase searches, quoted shorter-title searches, store-specific review searches, low-star review searches, complaints, Q&A, Reddit/forum discussions, manufacturer pages, other marketplaces with the same exact product, syndicated review providers, and public snippets.
Mandatory query ladder before giving up: exact product title; exact product title + reviews; exact product title + Amazon.ca; exact product title + Walmart; exact product title + Reddit; exact product title + YouTube review; exact product title + complaints; exact product title + "worth it"; exact product title + "problems"; exact product title + Q&A; exact product title + review blog.
Specifically try Amazon.ca and Amazon.com, but only use Amazon evidence if it is clearly the same exact product/bundle/size/color/model. If Amazon has only a similar product, put that in sourceNotes and do not use it as evidence.
Also try Walmart, Best Buy, Costco, Target, manufacturer pages, review provider snippets, Reddit/forum discussions, and public Q&A pages for the exact product.
If Amazon blocks, continue with other public sites instead of returning empty evidence.

Rules:
- Do not invent review bodies.
- Do not bypass private/login/protected pages.
- Match the same exact product by title, brand, store/domain, image/listing context, model/bundle/size/color, price, rating, and review count where possible.
- If direct written review bodies are blocked, use exact-product public review intelligence from search-accessible snippets/summaries and label evidenceType as "open web review intelligence".
- Do not return empty just because the original marketplace blocks review text.
- Give concrete buyer signals, not generic product-description claims.
- Prefer many short, distinct exact-product buyer signals over a few long summaries.
- Return as many distinct reviewSnippets as you can safely verify, up to ${reliableSignalTarget}.
- Analyze the already collected written reviews above. They are real collector evidence and must not be ignored.
- commentsAnalyzed must count only exact-product snippets/signals you actually used, never the marketplace total.
- Product identity, rating, and review count alone are not review evidence. If recovery still finds zero exact-product review/comment/open-web review-intelligence signals, return evidenceStrength "none", score null, reviewAuthenticity.score null, and do not return BUY, CONSIDER, AVOID, or a Buy Score.
- productPros and productCons must be the strongest distinct buyer factors only. Merge duplicates, avoid repeated wording, and keep each bullet short enough for a shopper result card.

Return ONLY valid JSON with the same shape as the first pass:
{
  "sourcesChecked": [],
  "reviewsFound": 0,
  "marketplaceReviewCount": null,
  "commentsAnalyzed": 0,
  "evidenceStrength": "weak | limited | usable | strong",
  "aiPatternSignals": [],
  "buyerExperienceSignals": [],
  "productPros": [],
  "productCons": [],
  "overallImpact": "",
  "buyAssessment": "",
  "reviewSnippets": [
    {
      "source": "domain or source",
      "snippet": "specific exact-product buyer/review/Q&A/open-web review-intelligence signal",
      "sentiment": "positive | mixed | negative",
      "evidenceType": "marketplace review | buyer comment | forum discussion | third-party review | open web review intelligence"
    }
  ],
  "repeatedPraises": [],
  "repeatedComplaints": [],
  "sourceNotes": [],
  "sourceLinks": [],
  "reviewAuthenticity": {
    "score": 0,
    "label": "Low AI-like review risk",
    "suspiciousReviewRisk": "Low",
    "reasons": [],
    "suspiciousComments": []
  }
}
`.trim();

      try {
        const deepResponse = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_REVIEW_DEEP_SEARCH_MODEL || process.env.OPENAI_REVIEW_SEARCH_MODEL || "gpt-4.1",
            tools: [{ type: "web_search" }],
            input: deepPrompt,
            temperature: 0.1,
          }),
        });

        if (deepResponse.ok) {
          const deepData = await deepResponse.json();
          const deepOutputText =
            deepData.output_text ||
            deepData.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
              ?.map((content: { text?: string }) => content.text || "")
              ?.join("\n") ||
            "";

          if (deepOutputText.trim()) {
            const deepParsed = safeParseReviewEvidenceJson(deepOutputText);
            parsed = mergeParsedReviewEvidence(parsed, deepParsed);
            console.log("[ReviewIntel DEBUG deepReviewSearch]", {
              pass: deepSearchPass,
              targetSignals: reliableSignalTarget,
              beforeSignals: parsedEvidenceSignalCount(safeParseReviewEvidenceJson(outputText)),
              afterSignals: parsedEvidenceSignalCount(parsed),
              sourcesChecked: Array.isArray(parsed.sourcesChecked) ? parsed.sourcesChecked.length : 0,
            });
          }
        } else {
          console.warn(
            "[ReviewIntel DEBUG deepReviewSearchFailed]",
            deepResponse.status,
            (await deepResponse.text().catch(() => "")).slice(0, 180)
          );
        }
      } catch (error) {
        console.warn(
          "[ReviewIntel DEBUG deepReviewSearchFailed]",
          error instanceof Error ? error.message : "Unknown deep review search error"
        );
      }
    }

    const parsedScore =
      typeof parsed.reviewAuthenticity?.score === "number"
        ? Math.max(0, Math.min(100, Math.round(parsed.reviewAuthenticity.score)))
        : null;

    const suspiciousComments = Array.isArray(parsed.reviewAuthenticity?.suspiciousComments)
      ? parsed.reviewAuthenticity.suspiciousComments
          .filter((comment: { riskScore?: number }) => typeof comment.riskScore === "number" && comment.riskScore >= 60)
          .slice(0, 8)
      : [];

    const reasonText = Array.isArray(parsed.reviewAuthenticity?.reasons)
      ? parsed.reviewAuthenticity.reasons.join(" ").toLowerCase()
      : "";

    const saysNoSuspiciousSignals =
      reasonText.includes("no significant signs") ||
      reasonText.includes("no significant patterns") ||
      reasonText.includes("no signs of inauthentic") ||
      reasonText.includes("no significant signs of inauthentic") ||
      reasonText.includes("no significant patterns of suspicious") ||
      reasonText.includes("no suspicious") ||
      reasonText.includes("not suspicious") ||
      reasonText.includes("no ai-like") ||
      reasonText.includes("no patterns of suspicious") ||
      reasonText.includes("no evidence of suspicious");

    const positiveCredibilitySignals =
      reasonText.includes("reputable") ||
      reasonText.includes("established sources") ||
      reasonText.includes("high credibility") ||
      reasonText.includes("verified purchase") ||
      reasonText.includes("diverse sources") ||
      reasonText.includes("genuine user") ||
      reasonText.includes("authentic reviews");

    const hasHighRiskComments = suspiciousComments.some(
      (comment: { riskScore?: number }) =>
        typeof comment.riskScore === "number" && comment.riskScore >= 60
    );

    const parsedOpenWebSignalCount = Math.max(
      Array.isArray(parsed.reviewSnippets) ? parsed.reviewSnippets.length : 0,
      Array.isArray(parsed.repeatedPraises) ? parsed.repeatedPraises.length : 0,
      Array.isArray(parsed.repeatedComplaints) ? parsed.repeatedComplaints.length : 0,
      Array.isArray(parsed.productPros) ? parsed.productPros.length : 0,
      Array.isArray(parsed.productCons) ? parsed.productCons.length : 0,
      Array.isArray(parsed.buyerExperienceSignals) ? parsed.buyerExperienceSignals.length : 0,
      Array.isArray(parsed.aiPatternSignals) ? parsed.aiPatternSignals.length : 0
    );

    const normalizedListingEvidence = normalizeListingConfidence(
      listingDomainMatchesRequestedStore(
        listingMatchesRequestedSignals(
          normalizeListingEvidenceNumbers(listingEvidence),
          input
        ),
        input
      ),
      input
    );

    const displayListingEvidence = applyObservedScreenshotSignalsToListing(
      normalizedListingEvidence ?? null,
      input
    );

    const listingNotes = Array.isArray(normalizedListingEvidence?.notes)
      ? normalizedListingEvidence.notes.join(" ").toLowerCase()
      : "";

    const listingIsUnconfirmed =
      !normalizedListingEvidence?.exactListingUrl ||
      normalizedListingEvidence?.confidence === "low" ||
      listingNotes.includes("requested product appears") ||
      listingNotes.includes("similar listing") ||
      listingNotes.includes("downgraded");

    const exactListingConfirmed = Boolean(
      !listingIsUnconfirmed &&
        normalizedListingEvidence?.exactListingUrl &&
        (
          normalizedListingEvidence.confidence === "high" ||
          normalizedListingEvidence.confidence === "medium"
        )
    );


    const collectorReviewsCollected = Math.max(
      collectedWrittenReviews.reviewsCollected || 0,
      collectedWrittenReviews.reviews.length,
    );
    const collectorHasWrittenReviews =
      collectorReviewsCollected > 0 ||
      collectedWrittenReviews.collectorHasWrittenReviews ||
      collectedWrittenReviews.reviews.length > 0;

    const marketplaceReviewCount = firstPositiveNumber(
      normalizedListingEvidence?.reviewCount,
      displayListingEvidence?.reviewCount,
      parsed.marketplaceReviewCount,
      parsed.reviewCount,
      listingEvidence.reviewCount,
      input.reviewCount
    );

    const parsedReviewSnippets = Array.isArray(parsed.reviewSnippets)
      ? parsed.reviewSnippets
          .map((item: Record<string, unknown>) => ({
            source: String(item.source || "Unknown source").slice(0, 120),
            snippet: String(item.snippet || "").slice(0, 500),
            sentiment:
              item.sentiment === "positive" || item.sentiment === "negative" || item.sentiment === "mixed"
                ? item.sentiment
                : "mixed",
            evidenceType: item.evidenceType ? String(item.evidenceType).slice(0, 80) : undefined,
          }))
          .filter((item: { snippet: string }) => item.snippet.trim().length >= 12)
          .slice(0, 40)
      : [];

    const collectedReviewSnippets = collectedWrittenReviews.reviews
      .map((review) => ({
        source: review.source || collectedWrittenReviews.extractor || "Marketplace written review",
        snippet: review.body,
        sentiment:
          typeof review.rating === "number"
            ? review.rating >= 4
              ? "positive"
              : review.rating <= 2
                ? "negative"
                : "mixed"
            : "mixed",
        evidenceType: "marketplace review",
      }))
      .filter((item) => item.snippet.trim().length >= 12)
      .slice(0, 40);

    const reviewSnippetsBase = mergeUnknownArrays<Record<string, unknown>>(
      collectedReviewSnippets,
      parsedReviewSnippets,
      40
    );

    const repeatedPraises = Array.isArray(parsed.repeatedPraises)
      ? parsed.repeatedPraises
          .map((item: Record<string, unknown>) => ({
            theme: String(item.theme || "").slice(0, 140),
            evidenceCount: Number(item.evidenceCount || 0),
            supportingSnippets: Array.isArray(item.supportingSnippets)
              ? item.supportingSnippets.map(String).filter(Boolean).slice(0, 4)
              : [],
          }))
          .filter((item: { theme: string }) => item.theme.trim().length > 0)
          .slice(0, 16)
      : [];

    const repeatedComplaints = Array.isArray(parsed.repeatedComplaints)
      ? parsed.repeatedComplaints
          .map((item: Record<string, unknown>) => ({
            theme: String(item.theme || "").slice(0, 140),
            evidenceCount: Number(item.evidenceCount || 0),
            supportingSnippets: Array.isArray(item.supportingSnippets)
              ? item.supportingSnippets.map(String).filter(Boolean).slice(0, 4)
              : [],
          }))
          .filter((item: { theme: string }) => item.theme.trim().length > 0)
          .slice(0, 16)
      : [];

    const aiPatternSignals = Array.isArray(parsed.aiPatternSignals)
      ? parsed.aiPatternSignals.map(String).filter(Boolean).slice(0, 16)
      : [];

    const buyerExperienceSignals = Array.isArray(parsed.buyerExperienceSignals)
      ? parsed.buyerExperienceSignals.map(String).filter(Boolean).slice(0, 20)
      : [];

    const productPros = Array.isArray(parsed.productPros)
      ? parsed.productPros.map(String).filter(Boolean).slice(0, 20)
      : [];

    const productCons = Array.isArray(parsed.productCons)
      ? parsed.productCons.map(String).filter(Boolean).slice(0, 20)
      : [];

    const reviewIntelligenceSignals = Math.max(
      collectorReviewsCollected,
      reviewSnippetsBase.length,
      repeatedPraises.length + repeatedComplaints.length,
      productPros.length + productCons.length,
      buyerExperienceSignals.length,
      aiPatternSignals.length,
      parsedOpenWebSignalCount
    );

    const hasListingMetadataSignal = Boolean(
      displayListingEvidence?.exactListingUrl &&
        (marketplaceReviewCount || displayListingEvidence.rating || input.rating || displayListingEvidence.price || input.price)
    );

    const hasReviewIntelligenceEvidence = reviewIntelligenceSignals > 0;

    const synthesizedReviewSnippets =
      reviewSnippetsBase.length >= 3 || !hasReviewIntelligenceEvidence
        ? []
        : [
            ...productPros.slice(0, 2).map((snippet: string) => ({
              source: "OpenAI web review intelligence",
              snippet,
              sentiment: "positive" as const,
              evidenceType: "open web review intelligence",
            })),
            ...productCons.slice(0, 2).map((snippet: string) => ({
              source: "OpenAI web review intelligence",
              snippet,
              sentiment: "negative" as const,
              evidenceType: "open web review intelligence",
            })),
            ...buyerExperienceSignals.slice(0, 3).map((snippet: string) => ({
              source: "OpenAI web review intelligence",
              snippet,
              sentiment: "mixed" as const,
              evidenceType: "open web review intelligence",
            })),
          ]
            .filter((item) => item.snippet.trim().length >= 12)
            .slice(0, Math.max(0, 3 - reviewSnippetsBase.length));

    const reviewSnippets = [...reviewSnippetsBase, ...synthesizedReviewSnippets].slice(0, 40);

    const groundedCommentsAnalyzed = Math.max(
      collectorReviewsCollected,
      reviewSnippets.length,
      repeatedPraises.length + repeatedComplaints.length,
      productPros.length + productCons.length,
      buyerExperienceSignals.length,
      aiPatternSignals.length
    );

    const actualCommentsAnalyzed = Math.max(
      groundedCommentsAnalyzed,
      collectorReviewsCollected,
      reviewSnippetsBase.length,
      reviewSnippets.length,
      collectedWrittenReviews.reviews.length,
      collectedWrittenReviews.reviewsCollected || 0,
    );

    const rawEvidenceStrength =
      actualCommentsAnalyzed >= 30
        ? "strong"
        : actualCommentsAnalyzed >= 15
          ? "usable"
          : actualCommentsAnalyzed >= 5
            ? "limited"
            : actualCommentsAnalyzed > 0
              ? "weak"
              : "none";

    const cappedEvidenceStrength =
      !hasReviewIntelligenceEvidence
        ? "none"
        : listingIsUnconfirmed && rawEvidenceStrength === "strong"
          ? "usable"
          : listingIsUnconfirmed && rawEvidenceStrength === "usable"
            ? "limited"
            : rawEvidenceStrength;

    const score =
      actualCommentsAnalyzed > 0 && parsedScore !== null
        ? !hasHighRiskComments && (saysNoSuspiciousSignals || positiveCredibilitySignals)
          ? Math.min(parsedScore, 15)
          : !hasHighRiskComments && parsedScore >= 60
            ? 25
            : parsedScore
        : null;

    const reviewCoverageRatio =
      marketplaceReviewCount && marketplaceReviewCount > 0
        ? Math.round((actualCommentsAnalyzed / marketplaceReviewCount) * 10000) / 10000
        : actualCommentsAnalyzed > 0
          ? 1
          : 0;

    const overallImpact = parsed.overallImpact ? String(parsed.overallImpact).slice(0, 700) : "";
    const buyAssessment = parsed.buyAssessment ? String(parsed.buyAssessment).slice(0, 700) : "";

    const finalEvidence = cleanFinalReviewEvidence({
      locale: requestedLocale,
      outputLanguage,
      detectedProductKey: normalizeEvidenceProductKey(input),
      exactListingAccepted,
      exactListingRejectedReason,
      collectorSourceAccepted,
      collectorSourceRejectedReason,
      exactSearchAttemptCount: exactProductAgent.exactSearchAttemptCount,
      exactSearchElapsedMs: exactProductAgent.exactSearchElapsedMs,
      exactSearchTimedOut: exactProductAgent.exactSearchTimedOut,
      verifierRetryCount: exactProductAgent.verifierRetryCount,
      verifierStatus: exactProductAgent.verifierStatus,
      verifierReasons: exactProductAgent.verifierReasons,
      retrySearchQueries: exactProductAgent.retrySearchQueries,
      verifiedListingUrl: exactProductAgent.verifiedListingUrl,
      rejectedListingUrls: exactProductAgent.rejectedListingUrls,
      canCollectReviews: exactProductAgent.canCollectReviews,
      resultSource: "analyze",
      sourcesChecked: Array.isArray(parsed.sourcesChecked)
        ? Array.from(new Set([
            ...localAttemptedSources,
            ...listingEvidence.sourcesChecked,
            ...parsed.sourcesChecked.map(String),
          ].filter(Boolean)))
        : localAttemptedSources.length
          ? localAttemptedSources
          : listingEvidence.sourcesChecked,
      listingEvidence: displayListingEvidence,
      exactListingConfirmed,
      sourceLinks: normalizeSourceLinks([
        ...localSourceLinks,
        ...(Array.isArray(parsed.sourceLinks) ? parsed.sourceLinks : []),
        ...(Array.isArray(normalizedListingEvidence?.sourceLinks)
          ? normalizedListingEvidence.sourceLinks
          : []),
        ...(normalizedListingEvidence?.exactListingUrl
          ? [
              {
                label: normalizedListingEvidence.exactListingTitle || "Exact product listing",
                url: normalizedListingEvidence.exactListingUrl,
                domain: normalizedListingEvidence.store || "Walmart Canada",
              },
            ]
          : []),
      ]),
      reviewsFound: Number(
        marketplaceReviewCount ??
          parsed.reviewsFound ??
          actualCommentsAnalyzed ??
          0
      ),
      marketplaceReviewCount,
      reviewCollector: {
        attempted: collectedWrittenReviews.attempted,
        sourceUrl: collectedWrittenReviews.sourceUrl,
        extractor: collectedWrittenReviews.extractor,
        reviewsCollected: Math.max(collectorReviewsCollected, reviewSnippets.length),
        collectorHasWrittenReviews,
        collectorSourceAccepted,
        collectorSourceRejectedReason,
        coverageNote: collectedWrittenReviews.coverageNote,
        fallbackUrlsTried: collectedWrittenReviews.fallbackUrlsTried,
      },
      reviewsCollected: Math.max(collectorReviewsCollected, reviewSnippets.length),
      collectorHasWrittenReviews,
      reviewIntelligenceSignals,
      reviewIntelligenceMode: collectorHasWrittenReviews
        ? "written_reviews"
        : hasListingMetadataSignal && reviewIntelligenceSignals <= 1
          ? "listing_metadata"
          : "open_web_intelligence",
      reviewCoverageRatio,
      commentsAnalyzed: actualCommentsAnalyzed,
      evidenceStrength:
        collectorHasWrittenReviews && actualCommentsAnalyzed > 0 && (cappedEvidenceStrength === "none" || cappedEvidenceStrength === "weak")
          ? "limited"
          : cappedEvidenceStrength,
      reviewSnippets,
      repeatedPraises,
      repeatedComplaints,
      aiPatternSignals,
      buyerExperienceSignals,
      productPros,
      productCons,
      overallImpact,
      buyAssessment,
      sourceNotes: displayListingEvidence?.exactListingUrl
        ? [
            normalizedListingEvidence?.confidence === "high"
              ? "Exact product listing was found and matched the requested product signals."
              : "Exact product listing was found, but current public listing signals differ from the screenshot/requested signals.",
            normalizedListingEvidence?.reviewCount
              ? `Current public listing shows ${normalizedListingEvidence.reviewCount} reviews.`
              : displayListingEvidence?.reviewCount
                ? `Screenshot/request showed ${displayListingEvidence.reviewCount} reviews; Walmart.ca structured review count was not independently confirmed.`
                : "Current public listing review count was not fully confirmed from structured listing fields.",
            normalizedListingEvidence?.rating
              ? `Current public listing rating is ${normalizedListingEvidence.rating}.`
              : displayListingEvidence?.rating
                ? `Screenshot/request showed a ${displayListingEvidence.rating} rating; Walmart.ca structured rating was not independently confirmed.`
                : "Current public listing rating was not fully confirmed from structured listing fields.",
            collectedWrittenReviews.coverageNote,
            nativeRetrievalNote,
            firecrawlRecoveryNote,
            collectorHasWrittenReviews
              ? `ReviewIntel analyzed ${actualCommentsAnalyzed} written review bodies from the marketplace or a same-product fallback source.`
              : hasReviewIntelligenceEvidence
                ? `Direct written review bodies were limited, so ReviewIntel used OpenAI web-search review intelligence across exact-product public sources. Signals analyzed: ${actualCommentsAnalyzed}.`
                : "ReviewIntel did not calculate a product verdict because no product review intelligence was collected.",
          ]
        : Array.isArray(parsed.sourceNotes)
          ? [
              ...parsed.sourceNotes,
              collectedWrittenReviews.coverageNote,
              nativeRetrievalNote,
              firecrawlRecoveryNote,
            ]
          : [
              collectedWrittenReviews.coverageNote,
              nativeRetrievalNote,
              firecrawlRecoveryNote,
            ],
      reviewAuthenticity: {
        score: hasReviewIntelligenceEvidence ? score : null,
        label:
          actualCommentsAnalyzed > 0
            ? score === null
              ? "Review evidence analyzed"
              : score >= 76
                ? "Very high AI-like review risk"
                : score >= 51
                  ? "High AI-like review risk"
                  : score >= 26
                    ? "Moderate AI-like review risk"
                    : "Low AI-like review risk"
            : "Review scan not verified",
        suspiciousReviewRisk:
          actualCommentsAnalyzed === 0 || score === null
            ? "Not scored"
            : score >= 76
              ? "Very high"
              : score >= 51
                ? "High"
                : score >= 26
                  ? "Medium"
                  : "Low",
        reasons: Array.isArray(parsed.reviewAuthenticity?.reasons)
          ? [
              ...parsed.reviewAuthenticity.reasons,
              ...(actualCommentsAnalyzed === 0 ? [collectedWrittenReviews.coverageNote] : []),
            ]
          : actualCommentsAnalyzed === 0
            ? [collectedWrittenReviews.coverageNote]
            : [],
        suspiciousComments,
      },
    });

    const zeroWrittenReviewEvidence =
      actualCommentsAnalyzed <= 0 &&
      collectorReviewsCollected <= 0 &&
      !collectorHasWrittenReviews &&
      !hasReviewIntelligenceEvidence;

    if (zeroWrittenReviewEvidence) {
      const insufficientEvidence: ReviewEvidenceResult = {
        ...finalEvidence,
        finalDecisionSource: "reviewEvidenceRecoveryFailed",
        decisionStatus: "review_evidence_not_found",
        evidenceStrength: "none" as const,
        reviewIntelligenceMode: "listing_metadata" as const,
        reviewIntelligenceSignals: 0,
        commentsAnalyzed: hasCollectedWrittenReviewEvidence ? finalEvidence.commentsAnalyzed : 0,
        reviewsCollected: hasCollectedWrittenReviewEvidence ? finalEvidence.reviewsCollected : 0,
        sourcesChecked: finalEvidence.sourcesChecked.length
          ? finalEvidence.sourcesChecked
          : localAttemptedSources.length
            ? localAttemptedSources
            : [reviewSearchIdentity || product || "native review retrieval attempted"],
        sourceLinks: finalEvidence.sourceLinks,
        reviewCoverageRatio: 0,
        collectorHasWrittenReviews: false,
        overallImpact: "",
        buyAssessment: "",
        reviewSnippets: hasCollectedWrittenReviewEvidence ? finalEvidence.reviewSnippets : [],
        repeatedPraises: [],
        repeatedComplaints: [],
        aiPatternSignals: [],
        buyerExperienceSignals: [],
        productPros: [],
        productCons: [],
        sourceNotes: [
          hasCollectedWrittenReviewEvidence
          ? "Exact listing was not verified, so ReviewIntel used matched public review evidence instead."
          : "ReviewIntel could not access enough public review evidence for this product.",
          "Automatic evidence recovery tried exact-title, marketplace, open-web, and fallback retrieval paths before withholding the verdict.",
          "Product or listing metadata may have been identified, but rating/review count metadata is not written review evidence.",
        ],
        reviewAuthenticity: {
          ...(finalEvidence.reviewAuthenticity || {}),
          score: null,
          label: "Review evidence not found",
          suspiciousReviewRisk: "Not scored",
          reasons: [
            "No written review bodies were collected or analyzed.",
            "Marketplace rating/review count from a screenshot or listing is metadata only, not review evidence.",
          ],
          suspiciousComments: [],
        },
      };

      await saveReviewEvidenceToMemory(input, insufficientEvidence);

      return insufficientEvidence;
    }

    await saveReviewEvidenceToMemory(input, finalEvidence);

    return finalEvidence;
  } catch (error: unknown) {
    return recoveryEvidenceFromLocalRetrieval(
      `Review evidence scan failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
