/**
 * RI result-page satisfaction pass (2026-10-16): customer-side narration for
 * the decision brief. Pure derivation — no scoring, no evidence, no math.
 *
 * Owner rules this module obeys:
 * - Any fact row whose value cannot be computed is OMITTED (never a dash,
 *   never "Unknown", never blank).
 * - The How-we-checked fold tells ONE story in plain words: what backs the
 *   verdict + what limits it. No second confidence verdict, no self-arguing.
 * - No counts of reviews read — depth is expressed in words only. Marketplace
 *   aggregate counts are fine (Junel's rule).
 * - No internal labels, no backstage vocabulary in any returned string.
 */
import {
  deriveShopperAnswer,
  marketplaceAggregateNumbers,
} from "@/lib/shopperAnswer";
import {
  analyzeAiPatterns,
  authHonestyLine,
  authRowFor,
  authSentenceFor,
} from "@/lib/aiPatternForensics";
import {
  BASIS_FRAMES,
  LIMITS_SINGLE_SOURCE_FRAMES,
  pickFrame,
} from "@/lib/analysisCopy";

type Rec = Record<string, unknown>;
const obj = (value: unknown): Rec =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};

export type BriefFactRow =
  | { term: "Marketplace rating"; rating: number }
  | { term: "Ratings counted"; count: number }
  | { term: "How sure we are" | "Value for money" | "Review authenticity"; text: string };

/**
 * Answer-card fact rows, already filtered: rows with no computable value are
 * absent. Order is fixed (rating, counts, confidence, value, authenticity).
 */
export function briefFactRows(input: unknown): BriefFactRow[] {
  const answer = deriveShopperAnswer(input);
  const agg = marketplaceAggregateNumbers(input);
  const profile = analyzeAiPatterns(input);
  const rows: BriefFactRow[] = [];
  if (agg.rating !== null) rows.push({ term: "Marketplace rating", rating: agg.rating });
  if (agg.count !== null) rows.push({ term: "Ratings counted", count: agg.count });
  if (answer.confidenceWords !== "Unknown") rows.push({ term: "How sure we are", text: answer.confidenceWords });
  if (answer.value !== "Unknown") rows.push({ term: "Value for money", text: answer.value });
  const authRow = authRowFor(profile);
  if (authRow !== "—") rows.push({ term: "Review authenticity", text: authRow });
  return rows;
}

type DepthWord = "a few" | "a solid set of" | "a deep set of";

/**
 * Written-corpus depth in shopper words only. Never a count.
 * Fewer than 4 accepted written reviews = too few to describe (null).
 */
export function writtenDepthWord(input: unknown): DepthWord | null {
  const n = analyzeAiPatterns(input).reviewCount;
  if (n < 4) return null;
  if (n < 8) return "a few";
  if (n < 25) return "a solid set of";
  return "a deep set of";
}

function ratingText(rating: number): string {
  const rounded = Math.round(rating * 10) / 10;
  return String(rounded);
}

/**
 * The fold's one basis sentence: what actually backs this verdict, in a
 * single plain sentence. Aggregate numbers when present, written-corpus
 * depth in words when present. Null when neither can be stated.
 */
export function foldBasisLine(input: unknown): string | null {
  const agg = marketplaceAggregateNumbers(input);
  const depth = writtenDepthWord(input);
  const parts: string[] = [];
  if (agg.rating !== null) {
    parts.push(
      agg.count !== null
        ? `a ${ratingText(agg.rating)}-star marketplace rating from ${agg.count.toLocaleString("en-US")} ratings`
        : `a ${ratingText(agg.rating)}-star marketplace rating`
    );
  }
  if (depth) parts.push(`${depth} written reviews we read`);
  if (parts.length === 0) return null;
  const basis = parts.length === 1 ? parts[0] : `${parts[0]} and ${parts[1]}`;
  const template = pickFrame(
    BASIS_FRAMES,
    `basis|${agg.rating ?? "none"}|${agg.count ?? "none"}|${depth ?? "none"}`,
    new Set()
  );
  return template.replace("{basis}", basis);
}

/**
 * The fold's one limits sentence: the written reviews come from one store's
 * pages, so other stores' reviews aren't in this check. Stated as plain
 * information — never as the page arguing with its own verdict.
 * Null unless the corpus is single-source with a known store.
 */
export function foldLimitsLine(input: unknown): string | null {
  const answer = deriveShopperAnswer(input);
  const record = obj(input);
  const store = String(obj(record.product).store || record.store || "").trim();
  if (answer.sources.length !== 1 || !store) return null;
  const template = pickFrame(LIMITS_SINGLE_SOURCE_FRAMES, `limits|${store}`, new Set());
  return template.replace("{store}", store);
}

/**
 * The fold's authenticity line: fired-signal sentence + the plain honesty
 * note (pattern check only — cannot prove who wrote a review). Null when
 * the corpus is too small to judge.
 */
export function foldAuthLines(input: unknown): string[] {
  const profile = analyzeAiPatterns(input);
  const sentence = authSentenceFor(profile);
  if (!sentence) return [];
  const honesty = authHonestyLine(profile);
  return honesty ? [sentence, honesty] : [sentence];
}

/** The full How-we-checked fold content, in order. */
export function foldNarration(input: unknown): string[] {
  const lines: string[] = [];
  const basis = foldBasisLine(input);
  if (basis) lines.push(basis);
  const limits = foldLimitsLine(input);
  if (limits) lines.push(limits);
  lines.push(...foldAuthLines(input));
  lines.push("Only real written reviews and the marketplace rating feed the score.");
  return lines;
}
