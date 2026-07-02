import { enforceFinalVerdictConsistency } from "@/lib/finalVerdictConsistency";
import { governBuyerDecision } from "@/lib/decisionGovernor";
import { humanVerdictRules, explainVerdictChange } from "@/lib/reviewToolHelpers";
import { buildToolAudit } from "@/lib/toolAudit";
import { createClient } from "@supabase/supabase-js";
type JsonRecord = Record<string, unknown>;

type ReviewEvidenceLike = {
  exactListingConfirmed?: boolean | null;
  sourcesChecked?: unknown[];
  reviewsFound?: number;
  commentsAnalyzed?: number;
  evidenceStrength?: string;
  sourceNotes?: unknown[];
  listingEvidence?: {
    exactListingUrl?: string | null;
    exactListingTitle?: string | null;
    store?: string | null;
    price?: number | null;
    rating?: number | null;
    reviewCount?: number | null;
    confidence?: string | null;
    sourcesChecked?: unknown[];
    notes?: unknown[];
  } | null;
  reviewAuthenticity?: {
    score?: number | null;
    label?: string;
    suspiciousReviewRisk?: string;
    reasons?: string[];
    suspiciousComments?: unknown[];
  };
};

type ProductMemory = {
  productKey: string;
  store?: string;
  brand?: string;
  title?: string;
  normalizedTitle?: string;
  price?: number;
  rating?: number;
  reviewCount?: number;
  imageHint?: string;
  reviewEvidence?: ReviewEvidenceLike | null;
  verdict?: string;
  buyerConfidence?: number;
  buyScore?: number;
  valueForMoney?: string;
  bottomLine?: string;
  updatedAt: string;
};

const globalCache = globalThis as typeof globalThis & {
  __reviewIntelStableProducts?: Map<string, ProductMemory>;
};

const cache =
  globalCache.__reviewIntelStableProducts ||
  new Map<string, ProductMemory>();

globalCache.__reviewIntelStableProducts = cache;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function readString(source: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readNumber(source: JsonRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const parsed = parseNumber(source[key]);
    if (typeof parsed === "number") return parsed;
  }
  return undefined;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(with|and|for|the|a|an|set|bag|bags|suitcase|spinner|wheels|lock|lightweight|travel|women|men)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 8)
    .join(" ");
}

function normalizeStore(store: string): string {
  const lower = store.toLowerCase();
  if (lower.includes("walmart")) return "walmart";
  if (lower.includes("amazon")) return "amazon";
  if (lower.includes("bestbuy") || lower.includes("best buy")) return "bestbuy";
  return lower.replace(/[^a-z0-9]/g, "");
}

function collectFields(result: unknown, extra?: JsonRecord): JsonRecord {
  const record = asRecord(result);
  const identity = asRecord(record.productIdentity);
  const detected = asRecord(record.detectedProduct);
  const source = asRecord(record.source);
  const vision = asRecord(extra?.vision);

  return {
    ...record,
    ...identity,
    ...detected,
    ...source,
    ...vision,
  };
}

function extractIdentity(result: unknown, extra?: JsonRecord) {
  const fields = collectFields(result, extra);

  const store =
    readString(fields, ["store", "retailer", "merchant", "domain", "sourceStore", "site"]) ||
    "unknown";

  const brand =
    readString(fields, ["brand", "brandName", "manufacturer"]) ||
    "";

  const title =
    readString(fields, [
      "title",
      "productTitle",
      "productName",
      "product_name",
      "name",
      "detectedProductName",
      "normalizedSearchQuery",
      "itemName",
      "item",
    ]) ||
    "unknown product";

  const price = readNumber(fields, [
    "price",
    "salePrice",
    "currentPrice",
    "priceValue",
    "amount",
  ]);

  const rating = readNumber(fields, [
    "rating",
    "averageRating",
    "starRating",
    "reviewRating",
  ]);

  const reviewCount = readNumber(fields, [
    "reviewCount",
    "reviews",
    "reviewsCount",
    "numberOfReviews",
    "ratingCount",
    "review_count",
  ]);

  const normalizedTitle = normalizeTitle(title);
  const normalizedStore = normalizeStore(store);

  const priceKey = typeof price === "number" ? price.toFixed(2) : "noprice";
  const brandKey = brand ? brand.toLowerCase().replace(/[^a-z0-9]/g, "") : "unknownbrand";

  const keys = [
    `${normalizedStore}|${brandKey}|${normalizedTitle}|${priceKey}`,
    `${normalizedStore}|${normalizedTitle}|${priceKey}`,
    `${normalizedStore}|${normalizedTitle}`,
  ].filter((key) => key.length > 12);

  return {
    store: normalizedStore,
    brand,
    title,
    normalizedTitle,
    price,
    rating,
    reviewCount,
    productKey: keys[0],
    lookupKeys: keys,
  };
}

function pickBetterNumber(a?: number, b?: number) {
  if (typeof a === "number" && typeof b === "number") return Math.max(a, b);
  return typeof a === "number" ? a : b;
}

function pickBetterRating(a?: number, b?: number) {
  if (typeof a === "number") return a;
  return b;
}

function mergeMemory(existing: ProductMemory | undefined, incoming: ProductMemory): ProductMemory {
  return {
    ...existing,
    ...incoming,
    brand: incoming.brand || existing?.brand,
    title:
      incoming.title && incoming.title.length > (existing?.title?.length || 0)
        ? incoming.title
        : existing?.title || incoming.title,
    normalizedTitle: incoming.normalizedTitle || existing?.normalizedTitle,
    price: typeof incoming.price === "number" ? incoming.price : existing?.price,
    rating: pickBetterRating(incoming.rating, existing?.rating),
    reviewCount: pickBetterNumber(incoming.reviewCount, existing?.reviewCount),
    reviewEvidence: incoming.reviewEvidence || existing?.reviewEvidence || null,
    updatedAt: new Date().toISOString(),
  };
}

function rememberProduct(memory: ProductMemory, lookupKeys: string[]) {
  let existing: ProductMemory | undefined;

  for (const key of lookupKeys) {
    const found = cache.get(key);
    if (found) {
      existing = found;
      break;
    }
  }

  const merged = mergeMemory(existing, memory);

  for (const key of lookupKeys) {
    cache.set(key, merged);
  }

  return merged;
}

function evidenceCounts(reviewEvidence: ReviewEvidenceLike | null | undefined) {
  return {
    commentsAnalyzed:
      typeof reviewEvidence?.commentsAnalyzed === "number"
        ? reviewEvidence.commentsAnalyzed
        : 0,
    reviewsFound:
      typeof reviewEvidence?.reviewsFound === "number"
        ? reviewEvidence.reviewsFound
        : 0,
    aiLikeScore:
      typeof reviewEvidence?.reviewAuthenticity?.score === "number"
        ? reviewEvidence.reviewAuthenticity.score
        : null,
  };
}

function hasSevereComplaintSignal(result: JsonRecord, reviewEvidence?: ReviewEvidenceLike | null) {
  const text = JSON.stringify({
    complaints: result.complaints,
    topComplaints: result.topComplaints,
    weaknesses: result.weaknesses,
    cons: result.cons,
    sourceNotes: reviewEvidence?.sourceNotes,
    reasons: reviewEvidence?.reviewAuthenticity?.reasons,
  }).toLowerCase();

  return [
    "broken",
    "dangerous",
    "unsafe",
    "fire",
    "injury",
    "refund denied",
    "many complaints",
    "defective",
    "does not work",
    "scam",
    "counterfeit",
  ].some((term) => text.includes(term));
}

function stableVerdict(memory: ProductMemory, result: JsonRecord) {
  const { commentsAnalyzed, aiLikeScore } = evidenceCounts(memory.reviewEvidence);
  const rating = memory.rating;
  const reviewCount = memory.reviewCount;
  const severeComplaints = hasSevereComplaintSignal(result, memory.reviewEvidence);

  const governedDecision = governBuyerDecision({
    rating,
    reviewCount,
    aiLikeRisk: aiLikeScore,
    commentsAnalyzed,
    severeComplaints,
    currentVerdict:
      typeof result.verdict === "string"
        ? result.verdict
        : typeof result.recommendation === "string"
          ? result.recommendation
          : null,
    bottomLine:
      typeof result.bottomLine === "string"
        ? result.bottomLine
        : typeof result.summary === "string"
          ? result.summary
          : null,
    productText: JSON.stringify({
      title: memory.title,
      brand: memory.brand,
      store: memory.store,
      price: memory.price,
      reviewEvidence: memory.reviewEvidence,
    }),
  });

  if (governedDecision) {
    return governedDecision;
  }

  const humanRule = humanVerdictRules({
    rating,
    reviewCount,
    aiLikeRisk: aiLikeScore,
    commentsAnalyzed,
    severeComplaints,
  });

  if (
    humanRule.reason.includes("Review evidence is not enough") ||
    (typeof rating === "number" && typeof reviewCount === "number" && reviewCount >= 100)
  ) {
    return {
      verdict: humanRule.verdict,
      buyerConfidence: humanRule.confidence,
      buyScore: humanRule.score,
      valueForMoney: humanRule.value,
      bottomLine: humanRule.reason,
    };
  }

  const hasReviewEvidence =
    commentsAnalyzed >= 5 ||
    (typeof rating === "number" && typeof reviewCount === "number" && reviewCount >= 10);

  if (!hasReviewEvidence) {
    return {
      verdict: "CONSIDER",
      buyerConfidence: 50,
      buyScore: 5,
      valueForMoney: "Needs review evidence",
      bottomLine: "Review evidence not enough. Do not downgrade to Avoid based only on a screenshot crop.",
    };
  }

  if (
    typeof rating === "number" &&
    rating >= 4.2 &&
    typeof reviewCount === "number" &&
    reviewCount >= 100 &&
    (!severeComplaints || rating >= 4.4) &&
    (aiLikeScore === null || aiLikeScore < 60)
  ) {
    return {
      verdict: "CONSIDER",
      buyerConfidence: 60,
      buyScore: 7,
      valueForMoney: "Good",
      bottomLine:
        "Cautious buy. The rating and review count are strong enough to avoid an Avoid verdict, but check durability complaints and return terms first.",
    };
  }

  if (
    typeof rating === "number" &&
    rating >= 4.5 &&
    typeof reviewCount === "number" &&
    reviewCount >= 200 &&
    !severeComplaints &&
    (aiLikeScore === null || aiLikeScore < 40)
  ) {
    return {
      verdict: "BUY",
      buyerConfidence: 78,
      buyScore: 8,
      valueForMoney: "Strong",
      bottomLine:
        "Good buy based on strong review volume, strong rating, and no major authenticity warning.",
    };
  }

  if (
    (typeof rating === "number" && rating < 3.6 && typeof reviewCount === "number" && reviewCount >= 20) ||
    (severeComplaints && typeof rating === "number" && rating < 4.0) ||
    (typeof aiLikeScore === "number" && aiLikeScore >= 75)
  ) {
    return {
      verdict: "AVOID",
      buyerConfidence: 35,
      buyScore: 3,
      valueForMoney: "Poor",
      bottomLine:
        "Avoid based on weak review evidence, severe complaint patterns, or high AI-like review risk.",
    };
  }

  return {
    verdict: "CONSIDER",
    buyerConfidence: 60,
    buyScore: 6,
    valueForMoney: "Fair",
    bottomLine:
      "Mixed signals. Check review complaints, alternatives, and return terms before buying.",
  };
}

export function stabilizeAnalysisResult<T extends JsonRecord>(
  result: T,
  extra?: JsonRecord
): T {
  const identity = extractIdentity(result, extra);
  const reviewEvidence =
    (result.reviewEvidence as ReviewEvidenceLike | null | undefined) ||
    (extra?.reviewEvidence as ReviewEvidenceLike | null | undefined) ||
    null;

  const incoming: ProductMemory = {
    productKey: identity.productKey,
    store: identity.store,
    brand: identity.brand,
    title: identity.title,
    normalizedTitle: identity.normalizedTitle,
    price: identity.price,
    rating: identity.rating,
    reviewCount: identity.reviewCount,
    reviewEvidence,
    updatedAt: new Date().toISOString(),
  };

  const memory = rememberProduct(incoming, identity.lookupKeys);
  const stable = stableVerdict(memory, result);

  const reviewAuthenticity = asRecord(result.reviewAuthenticity);
  const evidenceAuth = reviewEvidence?.reviewAuthenticity;

  return enforceFinalVerdictConsistency({
    ...result,
    productKey: memory.productKey,
    stableProductKey: memory.productKey,
    productIdentity: {
      store: memory.store,
      brand: memory.brand,
      title: memory.title,
      normalizedTitle: memory.normalizedTitle,
      price: memory.price,
      rating: memory.rating,
      reviewCount: memory.reviewCount,
    },
    reviewEvidence: memory.reviewEvidence || reviewEvidence || null,
    reviewAuthenticity: {
      ...reviewAuthenticity,
      ...(evidenceAuth || {}),
    },
    verdict: stable.verdict,
    recommendation: stable.verdict,
    finalVerdict: stable.verdict,
    stableVerdict: stable.verdict,
    decisionStatus:
      stable.verdict === "REVIEW EVIDENCE NOT ENOUGH"
        ? "not_enough_evidence"
        : "evidence_based",
    buyerConfidence: stable.buyerConfidence,
    confidence: stable.buyerConfidence,
    buyScore: stable.buyScore,
    score: stable.buyScore,
    rating: result.rating,
    reviewCount: result.reviewCount,
    reviewsFound: result.reviewCount,
    valueForMoney: stable.valueForMoney,
    value: stable.valueForMoney,
    bottomLine: stable.bottomLine,
    summary: stable.bottomLine,
    stableVerdictReason: stable.bottomLine,
    verdictChangeExplanation: explainVerdictChange(
      memory.verdict,
      stable.verdict,
      stable.bottomLine
    ),
  }) as T;
}


function getSupabaseAdminClient() {
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

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rowToMemory(row: Record<string, unknown>): ProductMemory {
  return {
    productKey: String(row.product_key || ""),
    store: stringOrNull(row.store) || undefined,
    brand: stringOrNull(row.brand) || undefined,
    title: stringOrNull(row.title) || undefined,
    normalizedTitle: stringOrNull(row.normalized_title) || undefined,
    price: numberOrNull(row.price) || undefined,
    rating: numberOrNull(row.rating) || undefined,
    reviewCount: numberOrNull(row.review_count) || undefined,
    reviewEvidence: (row.review_evidence as ReviewEvidenceLike | null) || null,
    verdict: stringOrNull(row.last_verdict) || undefined,
    buyerConfidence: numberOrNull(row.buyer_confidence) || undefined,
    buyScore: numberOrNull(row.last_score) || undefined,
    valueForMoney: stringOrNull(row.value_for_money) || undefined,
    bottomLine: stringOrNull(row.bottom_line) || undefined,
    updatedAt: stringOrNull(row.updated_at) || new Date().toISOString(),
  };
}

async function loadProductMemoryFromSupabase(lookupKeys: string[]) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || lookupKeys.length === 0) return null;

  const { data, error } = await supabase
    .from("reviewintel_product_memory")
    .select("*")
    .in("product_key", lookupKeys)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  return rowToMemory(data[0] as Record<string, unknown>);
}

async function saveProductMemoryToSupabase(memory: ProductMemory, result: JsonRecord) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const reviewEvidence = memory.reviewEvidence || null;
  const auth = reviewEvidence?.reviewAuthenticity;

  await supabase.from("reviewintel_product_memory").upsert(
    {
      product_key: memory.productKey,
      store: memory.store || null,
      brand: memory.brand || null,
      title: memory.title || null,
      normalized_title: memory.normalizedTitle || null,
      price: memory.price || null,
      rating: memory.rating || null,
      review_count: memory.reviewCount ? Math.round(memory.reviewCount) : null,
      last_verdict: memory.verdict || cleanStringFromResult(result, ["verdict", "recommendation"]) || null,
      last_score: memory.buyScore || parseNumber(result.score) || parseNumber(result.buyScore) || null,
      buyer_confidence: memory.buyerConfidence || parseNumber(result.buyerConfidence) || parseNumber(result.confidence) || null,
      value_for_money: memory.valueForMoney || cleanStringFromResult(result, ["valueForMoney", "value"]) || null,
      bottom_line: memory.bottomLine || cleanStringFromResult(result, ["bottomLine", "stableVerdictReason"]) || null,
      review_evidence: reviewEvidence,
      product_identity: {
        store: memory.store,
        brand: memory.brand,
        title: memory.title,
        normalizedTitle: memory.normalizedTitle,
        price: memory.price,
        rating: memory.rating,
        reviewCount: memory.reviewCount,
      },
      last_scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "product_key" }
  );

  if (reviewEvidence) {
    await supabase.from("reviewintel_review_authenticity_analysis").insert({
      product_key: memory.productKey,
      reviews_found: reviewEvidence.reviewsFound || 0,
      comments_analyzed: reviewEvidence.commentsAnalyzed || 0,
      evidence_strength: reviewEvidence.evidenceStrength || null,
      ai_like_risk_score: auth?.score ?? null,
      risk_label: auth?.suspiciousReviewRisk || auth?.label || null,
      reasons_json: auth?.reasons || [],
      suspicious_comments_json: auth?.suspiciousComments || [],
      sources_checked: reviewEvidence.sourcesChecked || [],
    });

    const sources = Array.isArray(reviewEvidence.sourcesChecked)
      ? reviewEvidence.sourcesChecked.slice(0, 12)
      : [];

    for (const source of sources) {
      const sourceName = typeof source === "string" ? source : JSON.stringify(source).slice(0, 200);
      await supabase.from("reviewintel_product_sources").insert({
        product_key: memory.productKey,
        source_name: sourceName,
        source_domain: sourceName,
        source_type: "review_evidence",
        evidence_status: "found",
      });
    }
  }
}

function cleanStringFromResult(result: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = result[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export async function stabilizeAnalysisResultWithMemory<T extends JsonRecord>(
  result: T,
  extra?: JsonRecord
): Promise<T> {
  const identity = extractIdentity(result, extra);
  const reviewEvidence =
    (result.reviewEvidence as ReviewEvidenceLike | null | undefined) ||
    (extra?.reviewEvidence as ReviewEvidenceLike | null | undefined) ||
    null;

  const existingFromSupabase = await loadProductMemoryFromSupabase(identity.lookupKeys);

  const incoming: ProductMemory = {
    productKey: identity.productKey,
    store: identity.store,
    brand: identity.brand,
    title: identity.title,
    normalizedTitle: identity.normalizedTitle,
    price: identity.price,
    rating: identity.rating,
    reviewCount: identity.reviewCount,
    reviewEvidence,
    updatedAt: new Date().toISOString(),
  };

  const merged = mergeMemory(existingFromSupabase || undefined, incoming);
  const remembered = rememberProduct(merged, identity.lookupKeys);
  const stable = stableVerdict(remembered, result);

  const finalMemory: ProductMemory = {
    ...remembered,
    verdict: stable.verdict,
    buyerConfidence: stable.buyerConfidence,
    buyScore: stable.buyScore,
    valueForMoney: stable.valueForMoney,
    bottomLine: stable.bottomLine,
    updatedAt: new Date().toISOString(),
  };

  await saveProductMemoryToSupabase(finalMemory, result);

  const reviewAuthenticity = asRecord(result.reviewAuthenticity);
  const evidenceAuth = remembered.reviewEvidence?.reviewAuthenticity;

  const currentReviewEvidence = reviewEvidence || null;
  const rememberedReviewEvidence = finalMemory.reviewEvidence || null;

  const currentListing = currentReviewEvidence?.listingEvidence || null;
  const rememberedListing = rememberedReviewEvidence?.listingEvidence || null;

  const currentExactListingConfirmed =
    Boolean(currentReviewEvidence?.exactListingConfirmed) ||
    currentListing?.confidence === "high";

  const rememberedExactListingConfirmed =
    Boolean(rememberedReviewEvidence?.exactListingConfirmed) ||
    rememberedListing?.confidence === "high";

  const currentReviewCount = Number(currentListing?.reviewCount || 0);
  const rememberedReviewCount = Number(rememberedListing?.reviewCount || 0);

  const finalReviewEvidence =
    currentExactListingConfirmed
      ? currentReviewEvidence
      : rememberedExactListingConfirmed
        ? rememberedReviewEvidence
        : currentReviewCount > rememberedReviewCount
          ? currentReviewEvidence
          : rememberedReviewEvidence || currentReviewEvidence || null;

  const exactListing = finalReviewEvidence?.listingEvidence || null;
  const exactListingConfirmed =
    Boolean(finalReviewEvidence?.exactListingConfirmed) ||
    exactListing?.confidence === "high";

  const promotedRating =
    exactListingConfirmed && typeof exactListing?.rating === "number" && exactListing.rating > 0
      ? exactListing.rating
      : finalMemory.rating;

  const promotedReviewCount =
    exactListingConfirmed &&
    typeof exactListing?.reviewCount === "number" &&
    exactListing.reviewCount > 0
      ? exactListing.reviewCount
      : finalMemory.reviewCount;

  // Exact listing/rating/review count confirms product identity only.
  // It must not promote verdict, confidence, score, value, or bottom line.
  const promotedVerdict = stable.verdict;
  const promotedBuyerConfidence = stable.buyerConfidence;
  const promotedBuyScore = stable.buyScore;
  const promotedValueForMoney = stable.valueForMoney;
  const promotedBottomLine = stable.bottomLine;

  const toolAudit = buildToolAudit({
    hasVision: Boolean(extra?.vision),
    hasExactListing: Boolean(finalReviewEvidence?.listingEvidence),
    hasReviewEvidence: Boolean(finalReviewEvidence),
    hasMemory: Boolean(existingFromSupabase),
    hasStableVerdict: true,
    commentsAnalyzed: finalReviewEvidence?.commentsAnalyzed ?? null,
    sourcesChecked: Array.isArray(finalReviewEvidence?.sourcesChecked)
      ? finalReviewEvidence.sourcesChecked.length
      : null,
    exactListingConfidence: finalReviewEvidence?.listingEvidence?.confidence ?? null,
  });

  const evidenceRecord = (finalReviewEvidence || {}) as Record<string, unknown>;

  const readableComments =
    typeof finalReviewEvidence?.commentsAnalyzed === "number"
      ? finalReviewEvidence.commentsAnalyzed
      : typeof evidenceRecord.commentsRead === "number"
        ? evidenceRecord.commentsRead
        : typeof evidenceRecord.reviewsFound === "number"
          ? evidenceRecord.reviewsFound
          : 0;

  const reviewSnippets = Array.isArray(evidenceRecord.reviewSnippets)
    ? evidenceRecord.reviewSnippets
    : Array.isArray(evidenceRecord.snippets)
      ? evidenceRecord.snippets
      : [];

  const repeatedComplaints = Array.isArray(evidenceRecord.repeatedComplaints)
    ? evidenceRecord.repeatedComplaints
    : Array.isArray(evidenceRecord.complaints)
      ? evidenceRecord.complaints
      : [];

  const repeatedPraises = Array.isArray(evidenceRecord.repeatedPraises)
    ? evidenceRecord.repeatedPraises
    : Array.isArray(evidenceRecord.praises)
      ? evidenceRecord.praises
      : [];

  const evidenceReviewCount =
    typeof evidenceRecord.reviewCount === "number"
      ? evidenceRecord.reviewCount
      : typeof evidenceRecord.reviewsCount === "number"
        ? evidenceRecord.reviewsCount
        : null;

  const evidenceRating =
    typeof evidenceRecord.rating === "number" ? evidenceRecord.rating : null;

  const hasActualReviewEvidence =
    readableComments >= 10 ||
    reviewSnippets.length >= 3 ||
    repeatedComplaints.length + repeatedPraises.length >= 3 ||
    (typeof evidenceRating === "number" &&
      typeof evidenceReviewCount === "number" &&
      evidenceReviewCount >= 10);

  const hasWeakReviewEvidence =
    readableComments > 0 ||
    reviewSnippets.length > 0 ||
    repeatedComplaints.length + repeatedPraises.length > 0 ||
    typeof evidenceRating === "number" ||
    typeof evidenceReviewCount === "number";

  const finalReviewDecisionVerdict = hasActualReviewEvidence
    ? promotedVerdict
    : hasWeakReviewEvidence
      ? "LIMITED REVIEW EVIDENCE"
      : "REVIEW EVIDENCE NOT ENOUGH";

  const finalReviewDecisionStatus = hasActualReviewEvidence
    ? "evidence_based"
    : hasWeakReviewEvidence
      ? "limited_review_evidence"
      : "not_enough_evidence";

  const finalReviewDecisionConfidence = hasActualReviewEvidence
    ? promotedBuyerConfidence
    : null;

  const finalReviewDecisionScore = hasActualReviewEvidence ? promotedBuyScore : null;

  const finalReviewDecisionValue = hasActualReviewEvidence
    ? promotedValueForMoney
    : "Unknown";

  const finalReviewDecisionBottomLine = hasActualReviewEvidence
    ? promotedBottomLine
    : hasWeakReviewEvidence
      ? "ReviewIntel found the exact product listing and weak review evidence, but not enough readable review evidence to make a confident product judgment. This is limited evidence, not a Buy or Avoid verdict."
      : "Exact product identity may be found, but ReviewIntel could not access enough readable review evidence to assess this product. This is not a product judgment.";

  return enforceFinalVerdictConsistency({
    ...result,
    toolAudit,
    toolsUsed: toolAudit.toolsUsed,
    decisionBasis: hasActualReviewEvidence
      ? toolAudit.decisionBasis
      : "Review evidence not enough. Screenshot and exact listing were treated as product identity only.",
    productKey: finalMemory.productKey,
    stableProductKey: finalMemory.productKey,
    productIdentity: {
      store: finalMemory.store,
      brand: finalMemory.brand,
      title: finalMemory.title,
      normalizedTitle: finalMemory.normalizedTitle,
      price: finalMemory.price,
      rating: promotedRating,
      reviewCount: promotedReviewCount,
    },
    reviewEvidence: finalReviewEvidence,
    reviewAuthenticity: {
      ...reviewAuthenticity,
      ...(evidenceAuth || {}),
    },
    reviewIntelTrace: {
      screenshotIdentity: {
        store: finalMemory.store,
        brand: finalMemory.brand,
        title: finalMemory.title,
        price: finalMemory.price,
        rating: promotedRating,
        reviewCount: promotedReviewCount,
      },
      exactListingEvidence: finalReviewEvidence?.listingEvidence || null,
      reviewEvidence: {
        readableComments,
        reviewSnippets: reviewSnippets.length,
        repeatedComplaints: repeatedComplaints.length,
        repeatedPraises: repeatedPraises.length,
        evidenceRating,
        evidenceReviewCount,
        hasActualReviewEvidence,
      },
      finalDecisionSource: hasActualReviewEvidence
        ? "reviewEvidence"
        : hasWeakReviewEvidence
          ? "limitedReviewEvidence"
          : "reviewEvidenceNotEnough",
    },
    verdict: finalReviewDecisionVerdict,
    recommendation: finalReviewDecisionVerdict,
    finalVerdict: finalReviewDecisionVerdict,
    stableVerdict: finalReviewDecisionVerdict,
    decisionStatus: finalReviewDecisionStatus,
    buyerConfidence: finalReviewDecisionConfidence,
    confidence: finalReviewDecisionConfidence,
    buyScore: finalReviewDecisionScore,
    score: finalReviewDecisionScore,
    productScore: finalReviewDecisionScore,
    rating: promotedRating,
    reviewCount: promotedReviewCount,
    reviewsFound: hasActualReviewEvidence ? promotedReviewCount : readableComments,
    valueForMoney: finalReviewDecisionValue,
    value: finalReviewDecisionValue,
    bottomLine: finalReviewDecisionBottomLine,
    summary: finalReviewDecisionBottomLine,
    stableVerdictReason: finalReviewDecisionBottomLine,
    verdictChangeExplanation: explainVerdictChange(
      existingFromSupabase?.verdict || finalMemory.verdict,
      finalReviewDecisionVerdict,
      finalReviewDecisionBottomLine
    ),
  }) as T;
}
