import { normalizeSourceLinks } from "@/lib/reviewToolHelpers";
import { createClient } from "@supabase/supabase-js";
import { findExactProductListing, type ExactProductSearchResult } from "@/lib/exactProductSearch";
type ReviewEvidenceInput = {
  productName: string;
  brand?: string;
  model?: string;
  forceRefresh?: boolean;
};

export type ReviewEvidenceResult = {
  sourcesChecked: string[];
  reviewsFound: number;
  commentsAnalyzed: number;
  evidenceStrength: "none" | "weak" | "limited" | "usable" | "strong";
  sourceNotes: string[];
  sourceLinks?: Array<{ label: string; url: string; domain?: string }>;
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

function cleanJsonText(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
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
    requestedRating: ratingMatch?.[1] ? Number(ratingMatch[1].replace(/,/g, "")) : null,
    requestedReviewCount: reviewMatch?.[1] ? Number(reviewMatch[1].replace(/,/g, "")) : null,
    requestedPrice: priceMatch?.[1] ? Number(priceMatch[1].replace(/,/g, "")) : null,
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

function safeParseReviewEvidenceJson(text: string) {
  const jsonText = extractJsonObjectText(text);

  try {
    return JSON.parse(jsonText);
  } catch {
    // Repair common bad control characters / trailing commas.
    const repaired = jsonText
      .replace(/[\u0000-\u001F]+/g, " ")
      .replace(/,\s*([}\]])/g, "$1");

    return JSON.parse(repaired);
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
  if (rememberedEvidence) {
    return rememberedEvidence;
  }

  const listingEvidence = await findExactProductListing({
    productName: product,
    brand: input.brand,
  });

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
  "commentsAnalyzed": 0,
  "evidenceStrength": "none | weak | limited | usable | strong",
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
- commentsAnalyzed = 0: score must be null, risk must be "Not scored"
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

    const parsed = JSON.parse(cleanJsonText(outputText));

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

    return {
      sourcesChecked: Array.isArray(parsed.sourcesChecked)
        ? Array.from(new Set([
            ...listingEvidence.sourcesChecked,
            ...parsed.sourcesChecked.map(String),
          ]))
        : listingEvidence.sourcesChecked,
      listingEvidence: normalizeListingConfidence(
        listingMatchesRequestedSignals(
          normalizeListingEvidenceNumbers(listingEvidence),
          input
        ),
        input
      ),
      sourceLinks: normalizeSourceLinks(parsed.sourceLinks),
      reviewsFound: Number(
        parsed.reviewsFound ||
          listingMatchesRequestedSignals(
            normalizeListingEvidenceNumbers(listingEvidence),
            input
          )?.reviewCount ||
          commentsAnalyzed ||
          0
      ),
      commentsAnalyzed,
      evidenceStrength:
        commentsAnalyzed >= 30
          ? "strong"
          : commentsAnalyzed >= 15
            ? "usable"
            : commentsAnalyzed >= 5
              ? "limited"
              : commentsAnalyzed > 0
                ? "weak"
                : "none",
      sourceNotes: Array.isArray(parsed.sourceNotes) ? parsed.sourceNotes : [],
      reviewAuthenticity: {
        score: commentsAnalyzed > 0 ? score : null,
        label:
          commentsAnalyzed > 0
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
          commentsAnalyzed === 0 || score === null
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
    };
  } catch (error: unknown) {
    return emptyEvidence(`Review evidence scan failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
