/**
 * RI result-page satisfaction pass (2026-10-16): customer-side narration for
 * the decision brief. Pure derivation — no scoring, no evidence, no math.
 *
 * Owner rules this module obeys:
 * - Any fact row whose value cannot be computed is OMITTED (never a dash,
 *   never "Unknown", never blank).
 * - The How-we-checked fold tells ONE story in plain words: what backs the
 *   verdict + what limits it. No second confidence verdict, no self-arguing.
 * - No counts of reviews read — depth is expressed in words only. The
 *   marketplace aggregate is stated once, on the answer-card fact rows;
 *   the basis sentence never restates its numbers.
 * - No internal labels, no backstage vocabulary in any returned string.
 */
import {
  deriveShopperAnswer,
  marketplaceAggregateNumbers,
} from "@/lib/shopperAnswer";
import { analyzeAiPatterns } from "@/lib/aiPatternForensics";
import {
  BASIS_FRAMES,
  LIMITS_SINGLE_SOURCE_FRAMES,
  pickFrame,
} from "@/lib/analysisCopy";
import {
  authHonestyLocalized,
  authRowWord,
  authSentenceLocalized,
  confidenceWord,
  depthWord,
  factRowTerm,
  fillFrame,
  frameAtIndex,
  joinLocalized,
  resolveBriefDict,
  valueWord,
} from "@/lib/briefI18n";

type Rec = Record<string, unknown>;
const obj = (value: unknown): Rec =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};

export type BriefFactRowKey =
  | "marketplaceRating"
  | "ratingsCounted"
  | "howSureWeAre"
  | "valueForMoney"
  | "reviewAuthenticity";

export type BriefFactRow =
  | { key: "marketplaceRating"; term: string; rating: number }
  | { key: "ratingsCounted"; term: string; count: number }
  | { key: "howSureWeAre" | "valueForMoney" | "reviewAuthenticity"; term: string; text: string };

/**
 * Answer-card fact rows, already filtered: rows with no computable value are
 * absent. Order is fixed (rating, counts, confidence, value, authenticity).
 * The stable `key` identifies the row across locales; `term` is the display
 * label in the shopper's language. Numbers stay byte-exact.
 */
export function briefFactRows(input: unknown, locale: string = "en"): BriefFactRow[] {
  const answer = deriveShopperAnswer(input);
  const agg = marketplaceAggregateNumbers(input);
  const profile = analyzeAiPatterns(input);
  const rows: BriefFactRow[] = [];
  if (agg.rating !== null)
    rows.push({ key: "marketplaceRating", term: factRowTerm(locale, "marketplaceRating"), rating: agg.rating });
  if (agg.count !== null)
    rows.push({ key: "ratingsCounted", term: factRowTerm(locale, "ratingsCounted"), count: agg.count });
  if (answer.confidenceWords !== "Unknown")
    rows.push({ key: "howSureWeAre", term: factRowTerm(locale, "howSureWeAre"), text: confidenceWord(locale, answer.confidenceWords) });
  if (answer.value !== "Unknown" && (answer.value === "Good" || answer.value === "Fair" || answer.value === "Poor"))
    rows.push({ key: "valueForMoney", term: factRowTerm(locale, "valueForMoney"), text: valueWord(locale, answer.value) });
  if (!profile.insufficient && profile.grade)
    rows.push({ key: "reviewAuthenticity", term: factRowTerm(locale, "reviewAuthenticity"), text: authRowWord(locale, profile.grade) });
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

/**
 * The fold's one basis sentence: what actually backs this verdict, in a
 * single plain sentence. The marketplace aggregate lives on the answer card
 * ("Marketplace rating" / "Ratings counted" rows) — it is NEVER restated
 * here, so the numbers appear exactly once per page. Written-corpus depth in
 * words when present. Null when neither can be stated.
 */
export function foldBasisLine(input: unknown, locale: string = "en"): string | null {
  const agg = marketplaceAggregateNumbers(input);
  const depth = writtenDepthWord(input);
  const copy = resolveBriefDict(locale);
  const parts: string[] = [];
  // Round 3: no numbers in the basis sentence — the aggregate is stated once,
  // on the answer card. Restating it here was defect 3 (aggregate twice).
  if (agg.rating !== null) parts.push(copy.basisParts.marketplaceRating);
  if (depth) parts.push(fillFrame(copy.basisParts.writtenReviews, { depth: depthWord(locale, depth) }));
  if (parts.length === 0) return null;
  const template = pickFrame(
    BASIS_FRAMES,
    `basis|${agg.rating ?? "none"}|${agg.count ?? "none"}|${depth ?? "none"}`,
    new Set()
  );
  const localized = frameAtIndex(copy.basisFrames, BASIS_FRAMES, template);
  // A frame that fell back to English keeps the English joiner — never a
  // half-translated sentence (untranslated-by-design).
  const basis = joinLocalized(localized === template ? "en" : locale, parts);
  return fillFrame(localized, { basis });
}

/**
 * The fold's one limits sentence: the written reviews come from one store's
 * pages, so other stores' reviews aren't in this check. Stated as plain
 * information — never as the page arguing with its own verdict.
 * Null unless the corpus is single-source with a known store.
 */
export function foldLimitsLine(input: unknown, locale: string = "en"): string | null {
  const answer = deriveShopperAnswer(input);
  const record = obj(input);
  const store = String(obj(record.product).store || record.store || "").trim();
  if (answer.sources.length !== 1 || !store) return null;
  const copy = resolveBriefDict(locale);
  const template = pickFrame(LIMITS_SINGLE_SOURCE_FRAMES, `limits|${store}`, new Set());
  // Store names stay byte-exact; only the frame translates.
  return fillFrame(frameAtIndex(copy.limitsFrames, LIMITS_SINGLE_SOURCE_FRAMES, template), { store });
}

/**
 * The fold's authenticity line: fired-signal sentence + the plain honesty
 * note (pattern check only — cannot prove who wrote a review). Null when
 * the corpus is too small to judge.
 */
export function foldAuthLines(input: unknown, locale: string = "en"): string[] {
  const profile = analyzeAiPatterns(input);
  const sentence = authSentenceLocalized(profile, locale);
  if (!sentence) return [];
  const honesty = authHonestyLocalized(profile, locale);
  return honesty ? [sentence, honesty] : [sentence];
}

/** The full How-we-checked fold content, in order. */
export function foldNarration(input: unknown, locale: string = "en"): string[] {
  const lines: string[] = [];
  const basis = foldBasisLine(input, locale);
  if (basis) lines.push(basis);
  const limits = foldLimitsLine(input, locale);
  if (limits) lines.push(limits);
  lines.push(...foldAuthLines(input, locale));
  lines.push(resolveBriefDict(locale).scoreFeedsLine);
  return lines;
}
