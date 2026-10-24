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
  acceptedRecords,
  deriveShopperAnswer,
  marketplaceAggregateNumbers,
} from "@/lib/shopperAnswer";
import { analyzeAiPatterns } from "@/lib/aiPatternForensics";
import {
  BASIS_FRAMES,
  LIMITS_MULTI_SOURCE_FRAMES,
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
  // Shoppers never see a review or ratings count. The number stays available
  // to scoring; it is not an answer-card row.
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
 * single plain sentence. The star rating may appear on the answer card.
 * Review counts are not shown to shoppers, and this sentence never restates
 * a number. Written-corpus depth in words when present. Null when neither
 * can be stated.
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

/** Host of a review's source page, lowercased and www-stripped. */
function sourceHostOf(url: unknown): string | null {
  try {
    return new URL(String(url)).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Store families RI reads, keyed by host prefix. A host outside this list
 * is its own family and is named by its host — never renamed, never hidden. */
const STORE_FAMILY_BY_HOST_PREFIX: Array<[string, string]> = [
  ["amazon.", "amazon"],
  ["walmart.", "walmart"],
  ["bestbuy.", "bestbuy"],
  ["target.", "target"],
  ["homedepot.", "homedepot"],
];

const STORE_FAMILY_NAMES: Record<string, string> = {
  amazon: "Amazon",
  walmart: "Walmart",
  bestbuy: "Best Buy",
  target: "Target",
  homedepot: "Home Depot",
};

type AcceptedStoreSource = { family: string; name: string; count: number };

/**
 * The stores whose written reviews actually fed this verdict, derived from
 * the adjudication's accepted records — never from the scanned listing.
 * A record names its store by its own source page (sourceUrl; the stamped
 * source marketplace is the fallback — it is itself the source host).
 * Fresh, library-stored, and second-search records all pass through the
 * same adjudication, so this describes every route a review can take in.
 *
 * Null when no coverage sentence can be stated truthfully:
 * - no accepted written reviews (the honest zero-read state speaks
 *   elsewhere on the page; the fold adds nothing), or
 * - any accepted record whose store cannot be named — a partial list
 *   could understate where the reviews came from, so the fold stays
 *   silent rather than guess.
 * The store that contributed the most reviews leads the list; ties keep
 * corpus order, so the same evidence always names the same stores in the
 * same order.
 */
function acceptedReviewSources(input: unknown): AcceptedStoreSource[] | null {
  const records = acceptedRecords(obj(input)) as unknown as Rec[];
  if (records.length === 0) return null;
  // The scanned listing's own store label, used for CASING ONLY: when the
  // listing's store is the very store a family's reviews came from, the
  // label's exact form ("Amazon.ca") is the name's display form. It never
  // names a store the accepted records didn't come from.
  const record = obj(input);
  const listingStore = String(obj(record.product).store || record.store || "").trim();
  const byFamily = new Map<string, { hosts: Set<string>; count: number }>();
  for (const record of records) {
    const stamped = String(record.sourceMarketplace || "").trim().toLowerCase().replace(/^www\./, "");
    const host =
      sourceHostOf(record.sourceUrl) ||
      (/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(stamped) ? stamped : null);
    if (!host) return null;
    const family =
      STORE_FAMILY_BY_HOST_PREFIX.find(([prefix]) => host.startsWith(prefix))?.[1] || host;
    const entry = byFamily.get(family) || { hosts: new Set<string>(), count: 0 };
    entry.hosts.add(host);
    entry.count += 1;
    byFamily.set(family, entry);
  }
  const sources: AcceptedStoreSource[] = [];
  for (const [family, entry] of byFamily) {
    // Store names are data, never re-cased or translated: a family that
    // speaks through one host is named by that host, byte-exact (the
    // listing label's casing when it is the same store). Only a family
    // spanning several hosts takes the family name.
    let name: string;
    if (entry.hosts.size === 1) {
      const host = [...entry.hosts][0];
      name = listingStore && listingStore.toLowerCase() === host ? listingStore : host;
    } else {
      name = STORE_FAMILY_NAMES[family] || family;
    }
    sources.push({ family, name, count: entry.count });
  }
  sources.sort((a, b) => b.count - a.count);
  return sources;
}

/**
 * The fold's one limits sentence: which stores' written reviews fed this
 * check, in plain words. Stated as plain information — never as the page
 * arguing with its own verdict.
 *
 * The stores are read from the accepted records themselves (see
 * acceptedReviewSources), NEVER from the scanned listing: a scan whose
 * accepted reviews all came from a second store names that store, and a
 * scan fed by several stores names them all. The pre-hunt version of this
 * line filled the listing's store into a single-source frame — a claim
 * that turns false the moment accepted reviews come from anywhere else.
 * Null when no truthful coverage sentence exists.
 */
export function foldLimitsLine(input: unknown, locale: string = "en"): string | null {
  const sources = acceptedReviewSources(input);
  if (!sources) return null;
  const copy = resolveBriefDict(locale);
  if (sources.length === 1) {
    const store = sources[0].name;
    const template = pickFrame(LIMITS_SINGLE_SOURCE_FRAMES, `limits|${store}`, new Set());
    // Store names stay byte-exact; only the frame translates.
    return fillFrame(frameAtIndex(copy.limitsFrames, LIMITS_SINGLE_SOURCE_FRAMES, template), { store });
  }
  const names = sources.map((source) => source.name);
  const template = pickFrame(LIMITS_MULTI_SOURCE_FRAMES, `limits-multi|${names.join("+")}`, new Set());
  const localized = frameAtIndex(copy.limitsMultiFrames, LIMITS_MULTI_SOURCE_FRAMES, template);
  // A frame that fell back to English keeps the English joiner — never a
  // half-translated store list (the basis sentence's rule).
  const stores = joinLocalized(localized === template ? "en" : locale, names);
  return fillFrame(localized, { stores });
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
