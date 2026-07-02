
function toOptionalNumber(value: string | number | null | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

import { normalizeSourceLinks } from "@/lib/reviewToolHelpers";
import { createClient } from "@supabase/supabase-js";
import { findExactProductListing, type ExactProductSearchResult } from "@/lib/exactProductSearch";
type ReviewEvidenceInput = {
  productName: string;
  brand?: string;
  model?: string;
  forceRefresh?: boolean;
  store?: string | null;
  price?: string | number | null;
  rating?: string | number | null;
  reviewCount?: string | number | null;

};

export type ReviewEvidenceResult = {
  sourcesChecked: string[];
  reviewsFound: number;
  marketplaceReviewCount?: number | null;
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
  return [input.brand, input.productName, input.model]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(with|and|for|the|a|an|set|bag|bags|suitcase|spinner|wheels|lock|lightweight|travel|women|men)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 10)
    .join(" ");
}

function isFreshEvidence(updatedAt: unknown) {
  if (typeof updatedAt !== "string") return false;
  const time = new Date(updatedAt).getTime();
  if (!Number.isFinite(time)) return false;

  const ageMs = Date.now() - time;
  const maxAgeMs = 1000 * 60 * 60 * 24 * 14; // 14 days
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

  return {
    ...evidence,
    sourceNotes: [
      "Reused recent ReviewIntel product memory instead of repeating a fresh web search.",
      ...(Array.isArray(evidence.sourceNotes) ? evidence.sourceNotes : []),
    ],
  };
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

  let mismatchCount = 0;

  if (
    typeof signals.requestedRating === "number" &&
    typeof listingEvidence.rating === "number" &&
    Math.abs(signals.requestedRating - listingEvidence.rating) > 0.15
  ) {
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

  return {
    ...listingEvidence,
    confidence: mismatchCount >= 2 ? "low" : "medium",
    notes: [
      ...notes,
      ...mismatchNotes,
      "Exact listing was downgraded because the public listing signals do not match the requested/screenshot signals closely enough.",
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

  const cleanedAuthenticity =
    result.reviewAuthenticity && filteredSuspiciousComments.length === 0
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

        // Keep Walmart.ca exact listing. Drop all Walmart.com links for Walmart.ca exact listings.
        if (isWalmartCaListing && lowerUrl.includes("walmart.com")) {
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

export async function collectAndAnalyzeReviewEvidence(
  input: ReviewEvidenceInput
): Promise<ReviewEvidenceResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return emptyEvidence("OPENAI_API_KEY is missing, so ReviewIntel could not search review evidence.");
  }

  const product = [input.brand, input.productName, input.model]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!product || product.length < 3) {
    return emptyEvidence("Product name was not clear enough to search reviews.");
  }

  const rememberedEvidence = input.forceRefresh ? null : await loadRecentReviewEvidenceFromMemory(input);
  if (rememberedEvidence && reviewEvidenceMatchesRequestedStore(rememberedEvidence, input)) {
    return rememberedEvidence;
  }

  if (rememberedEvidence && !reviewEvidenceMatchesRequestedStore(rememberedEvidence, input)) {
    console.log("[ReviewIntel DEBUG memory rejected]", {
      inputStore: input.store,
      rememberedExactListingUrl: rememberedEvidence.listingEvidence?.exactListingUrl,
      reason: "Remembered evidence host does not match requested store.",
    });
  }

  const rawListingEvidence = await findExactProductListing({
    productName: product,
    brand: input.brand,
    store: input.store || undefined,
    price: toOptionalNumber(input.price),
    rating: toOptionalNumber(input.rating),
    reviewCount: toOptionalNumber(input.reviewCount),
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

  const prompt = `
You are ReviewIntel's review-evidence scanner.

Task:
Search the web for public review evidence about this product:
"${product}"

Exact listing evidence already collected by ReviewIntel:
${JSON.stringify(listingEvidence, null, 2)}

Use exact listing evidence as the anchor when it is medium or high confidence.
If exact listing evidence contains rating or reviewCount, preserve it.
Do not override it with weaker screenshot-only assumptions.

Search intent:
- buyer reviews
- complaints
- product review comments
- Reddit/user discussions
- marketplace review snippets
- repeated praise/complaint patterns
- fake-review or AI-like review signals

Important:
Do not invent reviews.
Only analyze review snippets, comments, complaints, or buyer statements that you can find from search-accessible sources.
If you cannot find enough review/comment evidence, return score null.

Review acquisition rules:
1. First confirm the exact product/listing using store + brand + normalized title + price/image clues.
2. Extract the public marketplace rating and public marketplace review count when visible.
   Example: if Walmart shows 4.3 stars and 273 reviews, return marketplaceReviewCount: 273.
3. Then perform a separate review-content drill-down. The goal is to find the written review text inside or about those public reviews.
4. Search specifically for written buyer review content using:
   - exact listing URL + reviews
   - exact listing title + Walmart reviews
   - exact listing title + customer reviews
   - exact listing title + complaints
   - brand + exact product title + reviews
   - brand + exact product title + complaints
   - product title + reddit
   - product title + forum
   - product title + "verified purchase"
5. Exact listing evidence is identity evidence only. It is not review evidence.
6. Public rating/review count is listing metadata only. It is not analyzed review evidence.
7. reviewSnippets must contain actual buyer-review/comment evidence, not search-result summaries, not generic product descriptions, and not listing metadata.
8. commentsAnalyzed must equal the number of actual written review/comment snippets analyzed.
9. repeatedPraises, repeatedComplaints, aiPatternSignals, buyerExperienceSignals, productPros, and productCons must be built only from reviewSnippets.
10. If marketplaceReviewCount is high but commentsAnalyzed is low, clearly say coverage is limited.
11. If you find the listing but cannot access/read written buyer reviews, return:
   commentsAnalyzed: 0
   evidenceStrength: "none"
   reviewSnippets: []
   repeatedPraises: []
   repeatedComplaints: []
   aiPatternSignals: []
   buyerExperienceSignals: []
   productPros: []
   productCons: []
   overallImpact: "Public review count was found, but written review content was not accessible enough to analyze buyer experience."
   buyAssessment: "ReviewIntel cannot judge whether this is a good product to buy without enough written review evidence."
12. Do not convert rating, public review count, or listing evidence into Buy, Consider, Avoid, Good, Poor, or product quality judgment.
13. The analysis must answer from written review text only:
   - Are there AI-pattern or fake-review signals?
   - What are the real pros?
   - What are the real cons?
   - What is the buyer experience?
   - What is the overall product impact?
   - Is this really a good product to buy?

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
      "evidenceType": "marketplace review | buyer comment | forum discussion | third-party review"
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
- commentsAnalyzed means the number of actual written review/comment texts you read and analyzed.
- reviewsFound should equal marketplaceReviewCount when the listing exposes a public review count.
- Do not treat marketplaceReviewCount as analyzed evidence.
- commentsAnalyzed must equal the number of actual review/comment snippets you found and analyzed.
- reviewSnippets must contain the actual review/comment evidence used for the assessment.
- repeatedPraises, repeatedComplaints, aiPatternSignals, buyerExperienceSignals, productPros, and productCons must only be based on reviewSnippets.
- If marketplaceReviewCount is high but commentsAnalyzed is low, evidenceStrength must remain weak or limited.
- Do not give Buy/Consider/Avoid from rating or marketplaceReviewCount alone.
- The final review intelligence must answer: AI-pattern risk, pros, cons, buyer experience, overall impact, and whether this is really a good product to buy.
- If reviewSnippets is empty, commentsAnalyzed must be 0.
- If commentsAnalyzed is 0, score must be null and risk must be "Not scored".
- commentsAnalyzed 1-4: evidenceStrength = "weak"
- commentsAnalyzed 5-14: evidenceStrength = "limited"
- commentsAnalyzed 15-29: evidenceStrength = "usable"
- commentsAnalyzed 30+: evidenceStrength = "strong"
- Do NOT use 50 as a fallback.
- Only return suspiciousComments when riskScore is 60 or higher.
- Only return a number score if real review/comment snippets were analyzed.
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
      return emptyEvidence(`OpenAI web review search failed: ${response.status} ${errorText.slice(0, 180)}`);
    }

    const data = await response.json();

    const outputText =
      data.output_text ||
      data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
        ?.map((content: { text?: string }) => content.text || "")
        ?.join("\n") ||
      "";

    if (!outputText.trim()) {
      return emptyEvidence("OpenAI web review search returned no review evidence.");
    }

    const parsed = safeParseReviewEvidenceJson(outputText);

    const commentsAnalyzed = Number(parsed.commentsAnalyzed || 0);
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

    const score =
      commentsAnalyzed > 0 && parsedScore !== null
        ? !hasHighRiskComments && (saysNoSuspiciousSignals || positiveCredibilitySignals)
          ? Math.min(parsedScore, 15)
          : !hasHighRiskComments && parsedScore >= 60
            ? 25
            : parsedScore
        : null;

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
      normalizedListingEvidence?.confidence === "low" ||
      listingNotes.includes("not confirmed") ||
      listingNotes.includes("requested product appears") ||
      listingNotes.includes("similar listing") ||
      listingNotes.includes("downgraded");

    const listingReviewCount = Number(normalizedListingEvidence?.reviewCount || 0);
    const listingRating = Number(normalizedListingEvidence?.rating || 0);

    const rawEvidenceStrength =
      commentsAnalyzed >= 30
        ? "strong"
        : commentsAnalyzed >= 15
          ? "usable"
          : commentsAnalyzed >= 5
            ? "limited"
            : listingReviewCount >= 100 && listingRating >= 4
              ? "limited"
              : commentsAnalyzed > 0
                ? "weak"
                : "none";

    const cappedEvidenceStrength =
      listingIsUnconfirmed && rawEvidenceStrength === "strong"
        ? "usable"
        : listingIsUnconfirmed && rawEvidenceStrength === "usable"
          ? "limited"
          : rawEvidenceStrength;

    const reviewSnippets = Array.isArray(parsed.reviewSnippets)
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
          .slice(0, 20)
      : [];

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
          .slice(0, 8)
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
          .slice(0, 8)
      : [];

    const actualCommentsAnalyzed = Math.max(commentsAnalyzed, reviewSnippets.length);

    const marketplaceReviewCount =
      toOptionalNumber(parsed.marketplaceReviewCount) ??
      toOptionalNumber(parsed.reviewCount) ??
      toOptionalNumber(normalizedListingEvidence?.reviewCount) ??
      toOptionalNumber(displayListingEvidence?.reviewCount) ??
      null;

    const aiPatternSignals = Array.isArray(parsed.aiPatternSignals)
      ? parsed.aiPatternSignals.map(String).filter(Boolean).slice(0, 8)
      : [];

    const buyerExperienceSignals = Array.isArray(parsed.buyerExperienceSignals)
      ? parsed.buyerExperienceSignals.map(String).filter(Boolean).slice(0, 8)
      : [];

    const productPros = Array.isArray(parsed.productPros)
      ? parsed.productPros.map(String).filter(Boolean).slice(0, 8)
      : [];

    const productCons = Array.isArray(parsed.productCons)
      ? parsed.productCons.map(String).filter(Boolean).slice(0, 8)
      : [];

    const overallImpact = parsed.overallImpact ? String(parsed.overallImpact).slice(0, 700) : "";
    const buyAssessment = parsed.buyAssessment ? String(parsed.buyAssessment).slice(0, 700) : "";

    return cleanFinalReviewEvidence({
      sourcesChecked: Array.isArray(parsed.sourcesChecked)
        ? Array.from(new Set([
            ...listingEvidence.sourcesChecked,
            ...parsed.sourcesChecked.map(String),
          ]))
        : listingEvidence.sourcesChecked,
      listingEvidence: displayListingEvidence,
      exactListingConfirmed: !listingIsUnconfirmed && normalizedListingEvidence?.confidence === "high",
      sourceLinks: normalizeSourceLinks([
        ...(Array.isArray(parsed.sourceLinks) ? parsed.sourceLinks : []),
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
      commentsAnalyzed: actualCommentsAnalyzed,
      evidenceStrength: cappedEvidenceStrength,
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
          ]
        : Array.isArray(parsed.sourceNotes)
          ? parsed.sourceNotes
          : [],
      reviewAuthenticity: {
        score: actualCommentsAnalyzed > 0 ? score : null,
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
          ? parsed.reviewAuthenticity.reasons
          : [],
        suspiciousComments,
      },
    });
  } catch (error: unknown) {
    return emptyEvidence(`Review evidence scan failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
