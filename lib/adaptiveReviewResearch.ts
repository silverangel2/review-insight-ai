/**
 * Adaptive bounded OpenAI web research for ReviewIntel evidence collection.
 *
 * This module owns the "research adaptively until sufficient or stagnant"
 * loop that was removed by the July 2026 speed/cost optimization and later
 * restored. It is deliberately dependency-light (only lib/openAiWebSearch)
 * so the orchestration can be tested behaviorally with a mocked fetch.
 *
 * Cost-control contract (never weaken without owner approval):
 * - Cheap/native evidence is always tried first by the caller.
 * - This loop runs only when collected evidence is below target.
 * - Absolute hard maximum: 5 web-search calls per scan (enforced by the
 *   shared OpenAiWebSearchContext, which also covers the URL-discovery call).
 * - Stop immediately when the signal target is reached.
 * - Stop after TWO consecutive stagnant passes (no new signals).
 * - Firecrawl is NOT used here; it remains a separate fallback-only path.
 */

import {
  callOpenAiWebSearchResponse,
  getOpenAiWebSearchDiagnostics,
  isOpenAiWebSearchEnabled,
  type OpenAiWebSearchContext,
} from "@/lib/openAiWebSearch";

export function stripJsonCodeFence(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export function extractJsonObjectText(text: string) {
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

export function recoverPartialReviewEvidenceFromText(text: string) {
  const urls = Array.from(
    new Set(
      (text.match(/https?:\/\/[^\s"'<>]+/g) || []).map((url) =>
        url.replace(/[),.]+$/, "")
      )
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

export function safeParseReviewEvidenceJson(text: string) {
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

export function parsedEvidenceSignalCount(value: unknown) {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const lengths = [
    "reviewSnippets",
    "repeatedPraises",
    "repeatedComplaints",
    "productPros",
    "productCons",
    "buyerExperienceSignals",
    "aiPatternSignals",
  ].map((key) => (Array.isArray(record[key]) ? record[key].length : 0));
  return Math.max(
    ...lengths,
    typeof record.reviewIntelligenceSignals === "number"
      ? record.reviewIntelligenceSignals
      : 0
  );
}

export function mergeParsedReviewEvidence(
  primary: Record<string, unknown>,
  secondary: Record<string, unknown>
) {
  const merged: Record<string, unknown> = { ...primary, ...secondary };
  const arrayKeys = [
    "sourcesChecked",
    "reviewSnippets",
    "repeatedPraises",
    "repeatedComplaints",
    "productPros",
    "productCons",
    "buyerExperienceSignals",
    "aiPatternSignals",
    "sourceNotes",
    "sourceLinks",
  ];

  for (const key of arrayKeys) {
    const values = [
      ...(Array.isArray(primary[key]) ? primary[key] : []),
      ...(Array.isArray(secondary[key]) ? secondary[key] : []),
    ];
    const seen = new Set<string>();
    merged[key] = values.filter((item) => {
      const identity = JSON.stringify(item);
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }

  return merged;
}

export type AdaptiveResearchStopReason =
  | "sufficient"
  | "stagnant"
  | "max_passes"
  | "web_search_disabled"
  | "call_limit";

export type AdaptiveResearchResult = {
  aggregate: Record<string, unknown>;
  evidence: Record<string, unknown>[];
  passesExecuted: number;
  stopReason: AdaptiveResearchStopReason;
  webSearchCalls: number;
  webSearchEnabled: boolean;
};

export type AdaptiveResearchInput = {
  store?: string | null;
  brand?: string | null;
  productName?: string | null;
  model?: string | null;
  price?: string | number | null;
  rating?: string | number | null;
  reviewCount?: string | number | null;
  product: string;
  reviewSearchIdentity: string;
  outputLanguage: string;
  checkedListingUrl: string;
  checkedListingTitle: string;
  collectedWrittenReviewsPrompt: string;
  reliableSignalTarget: number;
  adaptiveMaxPasses: number;
  openAiWebSearchContext: OpenAiWebSearchContext;
  /** Current cheap/native collected written-review count; loop stops when at target. */
  collectedWrittenReviewCount: () => number;
};

const ADAPTIVE_STRATEGIES = [
  {
    label: "exact-product-reviews",
    instruction:
      "Search the exact product name with buyer reviews and review-page sources.",
  },
  {
    label: "exact-product-problems",
    instruction:
      "Search the exact product name with complaints, problems, failures, and customer experiences.",
  },
  {
    label: "exact-product-user-discussion",
    instruction:
      "Search the exact product name with Reddit, forums, Q&A, and independent review discussions.",
  },
];

/**
 * Mandatory query ladder restored from the pre-optimization deep-search pass.
 * The model must work through these before giving up on a product.
 */
const QUERY_LADDER =
  'exact product title; exact product title + reviews; exact product title + Amazon.ca; exact product title + Walmart; exact product title + Reddit; exact product title + YouTube review; exact product title + complaints; exact product title + "worth it"; exact product title + "problems"; exact product title + Q&A; exact product title + review blog';

export async function runAdaptiveReviewResearch(
  args: AdaptiveResearchInput
): Promise<AdaptiveResearchResult> {
  const {
    product,
    reviewSearchIdentity,
    reliableSignalTarget,
    adaptiveMaxPasses,
    openAiWebSearchContext,
  } = args;

  const webSearchEnabled = isOpenAiWebSearchEnabled();
  const diagnostics = () =>
    getOpenAiWebSearchDiagnostics(openAiWebSearchContext);

  const aggregate: Record<string, unknown> = {};
  const evidence: Record<string, unknown>[] = [];
  let passesExecuted = 0;
  let consecutiveStagnantPasses = 0;
  let stopReason: AdaptiveResearchStopReason = "max_passes";

  const signalCount = () => parsedEvidenceSignalCount(aggregate);
  const satisfied = () =>
    args.collectedWrittenReviewCount() >= reliableSignalTarget ||
    signalCount() >= reliableSignalTarget;

  for (
    let pass = 1;
    pass <= adaptiveMaxPasses && !satisfied();
    pass += 1
  ) {
    passesExecuted = pass;
    const beforeSignals = signalCount();
    const strategy = ADAPTIVE_STRATEGIES[(pass - 1) % ADAPTIVE_STRATEGIES.length];

    const adaptivePrompt = `
You are ReviewIntel's bounded adaptive public-review research pass.

Find additional exact-product written buyer-review, Q&A, forum, or open-web review-intelligence signals for:
${reviewSearchIdentity || product}

This is pass ${pass} of ${adaptiveMaxPasses}. The current collected evidence is below the quality target of ${reliableSignalTarget} distinct signals.
Research strategy for this pass: ${strategy.label}
${strategy.instruction}

Exact product identity:
${JSON.stringify(
  {
    store: args.store || null,
    brand: args.brand || null,
    title: args.productName || null,
    model: args.model || null,
    price: args.price ?? null,
    rating: args.rating ?? null,
    reviewCount: args.reviewCount ?? null,
    exactListingUrl: args.checkedListingUrl || null,
    exactListingTitle: args.checkedListingTitle || null,
  },
  null,
  2
)}

Already collected marketplace evidence:
${args.collectedWrittenReviewsPrompt}

Previous adaptive evidence:
${JSON.stringify(aggregate, null, 2)}

Search harder. Before giving up, work through this mandatory query ladder:
${QUERY_LADDER}

Also try: exact listing URL searches, exact item/product ID searches, exact phrase searches, quoted shorter-title searches, store-specific review searches, low-star review searches, manufacturer pages, other marketplaces with the same exact product, syndicated review providers, and public snippets.
If the exact marketplace blocks written reviews, continue with other public sites instead of returning empty evidence.
Prefer many short, distinct exact-product buyer signals over a few long summaries.

Rules:
- Use web search only for the same exact product; do not use similar products.
- Do not invent review bodies, URLs, ratings, or verdicts.
- Prefer concrete buyer signals, complaints, praise, Q&A, forum comments, or public review snippets.
- Return only JSON in the existing review-evidence shape.
- Product identity and aggregate marketplace rating/review count are metadata, not written-review evidence.
- Return additional distinct signals if available; return empty arrays if no useful incremental evidence remains.
`.trim();

    const adaptiveResponse = await callOpenAiWebSearchResponse<{
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    }>({
      model:
        process.env.OPENAI_REVIEW_DEEP_SEARCH_MODEL ||
        process.env.OPENAI_REVIEW_SEARCH_MODEL,
      searchContextSize: "low",
      input: adaptivePrompt,
      temperature: 0.1,
      context: openAiWebSearchContext,
      purpose: "adaptive-review-evidence-research",
      dedupeKey: `adaptive-review-evidence-research:${reviewSearchIdentity || product}:${strategy.label}:pass-${pass}`,
      evidenceSatisfied: () => signalCount() >= reliableSignalTarget,
    });

    const adaptiveOutput = adaptiveResponse.outputText || "";
    if (!adaptiveResponse.ok || !adaptiveOutput.trim()) {
      consecutiveStagnantPasses += 1;
      const reason = adaptiveResponse.skipped
        ? adaptiveResponse.skipReason === "disabled"
          ? "web_search_disabled"
          : adaptiveResponse.skipReason === "limit_reached"
            ? "call_limit"
            : "research_not_executed"
        : "research_returned_no_output";
      console.log("[ReviewIntel DEBUG adaptiveReviewResearchStop]", {
        pass,
        strategy: strategy.label,
        reason,
        skipReason: adaptiveResponse.skipReason || null,
        webSearchEnabled,
        consecutiveStagnantPasses,
      });
      if (!webSearchEnabled) {
        stopReason = "web_search_disabled";
        break;
      }
      if (adaptiveResponse.skipReason === "limit_reached") {
        stopReason = "call_limit";
        break;
      }
      if (consecutiveStagnantPasses >= 2) {
        stopReason = "stagnant";
        break;
      }
      continue;
    }

    const parsedAdaptive = safeParseReviewEvidenceJson(adaptiveOutput);
    const parsedAdaptiveRecord =
      parsedAdaptive && typeof parsedAdaptive === "object"
        ? (parsedAdaptive as Record<string, unknown>)
        : {};
    const merged = mergeParsedReviewEvidence(aggregate, parsedAdaptiveRecord);
    Object.keys(merged).forEach((key) => {
      aggregate[key] = merged[key];
    });
    evidence.push(parsedAdaptiveRecord);

    const afterSignals = signalCount();
    if (afterSignals > beforeSignals) {
      consecutiveStagnantPasses = 0;
    } else {
      consecutiveStagnantPasses += 1;
    }
    console.log("[ReviewIntel DEBUG adaptiveReviewResearch]", {
      pass,
      strategy: strategy.label,
      targetSignals: reliableSignalTarget,
      beforeSignals,
      afterSignals,
      usefulIncrement: afterSignals > beforeSignals,
      webSearchCalls: diagnostics().calls,
      consecutiveStagnantPasses,
    });

    if (satisfied()) {
      stopReason = "sufficient";
      break;
    }
    if (consecutiveStagnantPasses >= 2) {
      console.log("[ReviewIntel DEBUG adaptiveReviewResearchStop]", {
        pass,
        strategy: strategy.label,
        reason: "stagnant_research_passes",
        consecutiveStagnantPasses,
      });
      stopReason = "stagnant";
      break;
    }
  }

  if (passesExecuted === 0) {
    stopReason = satisfied() ? "sufficient" : "max_passes";
  }

  return {
    aggregate,
    evidence,
    passesExecuted,
    stopReason,
    webSearchCalls: diagnostics().calls,
    webSearchEnabled,
  };
}
