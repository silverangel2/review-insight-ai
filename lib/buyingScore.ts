/**
 * ReviewIntel Buying Score v2 (docs/scoring-spec-v2.md, Owner-approved 2026-10-12).
 *
 * Pure and deterministic: no network, no OpenAI, no randomness. Every number
 * comes from real marketplace metadata or real written reviews. Nothing here
 * invents a review, a star rating or an opinion.
 */

// ---------------------------------------------------------------------------
// Documented constants (section 3). Fixed neutral prior. NOT calibrated from
// pre-v2 scan history; recalibrate only on ~90 days of clean v2 data.
// ---------------------------------------------------------------------------
export const BUYING_SCORE_VERSION = "buying-score-v2";
export const PRIOR_RATING_C = 4.0;
export const PRIOR_WEIGHT_M = 500;
export const ADJUSTMENT_MIN = -30;
export const ADJUSTMENT_MAX = 10;
export const EVIDENCE_HALF_WEIGHT = 10; // w = n / (n + 10)
export const BUY_THRESHOLD = 75;
export const WAIT_THRESHOLD = 50;
export const CAP_RECALL = 30;
export const CAP_REPEATED_SAFETY = 54;
export const CAP_SINGLE_SAFETY = 74;
export const CAP_REPEATED_RELIABILITY = 74;
export const CAP_TOO_NEW = 74;
export const DUPLICATE_SIMILARITY = 0.8;
export const DUPLICATE_DATE_WINDOW_DAYS = 3;

export type Verdict = "Buy" | "Wait" | "Skip";
export type Confidence = "Low" | "Medium" | "High";
export type OutputMode = "buying_score" | "provisional_marketplace" | "written_only" | "no_score";

export type StarHistogram = Partial<Record<1 | 2 | 3 | 4 | 5, number>>; // percentages (0-100) or counts

export type MarketplaceAggregate = {
  rating?: number | null;
  count?: number | null;
  histogram?: StarHistogram | null;
  /** false when the aggregate was proven to belong to a different model/variant. */
  matchesExactModel?: boolean | null;
};

/** An authoritative recall lookup. Not built in v2; when absent nothing about recalls is said. */
export type RecallCheck = {
  queried: boolean;
  succeeded: boolean;
  recalled: boolean;
  sourceName?: string | null;
  sourceUrl?: string | null;
};

/** Aggregated signals (section 2). Used directly by tests for the worked examples. */
export type BuyingScoreSignals = {
  rating: number | null; // R̄
  ratingCount: number | null; // N
  n: number;
  /** Classifiable reviews (text gives a sentiment or severity signal). Defaults to n. Drives w, EvidenceConf, discrepancy. */
  nEff?: number;
  meanSentiment: number; // s̄
  visibleMeanStars: number | null; // r̄
  visibleLowShare?: number | null; // share (0-1) of 1-2★ among visible reviews
  marketplaceLowShare?: number | null; // share (0-1) of 1-2★ in histogram
  rel: number;
  relSameTheme: number; // largest group of reliability reports sharing one failure theme
  relTheme?: string | null;
  saf: number;
  safSameHazard: number;
  safHazard?: string | null;
  min: number;
  themes: number; // T
  topThemeLabel?: string | null;
  topThemeCount?: number;
  secondStoreReviewCount?: number; // deduplicated reviews from a non-primary store
  variantResolved?: boolean;
  recall?: RecallCheck | null;
  quotes?: { safety: string[]; reliability: string[]; positive: string[]; negative: string[] };
};

export type BuyingScoreWarning = {
  tier: "official_recall" | "repeated_safety" | "single_safety" | "repeated_reliability" | "too_new" | "discrepancy";
  text: string;
  quotes: string[];
  sourceUrl?: string | null;
};

export type BuyingScoreResult = {
  version: typeof BUYING_SCORE_VERSION;
  mode: OutputMode;
  score: number | null; // rounded 0-100
  rawScore: number | null;
  verdict: Verdict | null; // null for provisional and no_score
  leaning: Verdict | null; // only for provisional
  label: string; // "Buying Score" | "Provisional Marketplace Score" | ...
  provisionalLabel: string | null;
  confidence: Confidence;
  confidenceReason: string;
  evidenceLine: string; // "8 written reviews read · 4.5★ from 2,143 ratings"
  warnings: BuyingScoreWarning[];
  notes: string[];
  primaryAction: string | null;
  recallStatement: string | null;
  audit: {
    N: number | null;
    Rbar: number | null;
    Rstar: number | null;
    B: number | null;
    n: number;
    nEff: number;
    sBar: number;
    rBar: number | null;
    w: number;
    Pos: number;
    Neg: number;
    A: number;
    Rel: number;
    Saf: number;
    Min: number;
    T: number;
    discrepancyFlag: boolean;
    capsApplied: string[];
    S: number | null;
    confidence: Confidence;
    marketConf: Confidence | null;
    evidenceConf: Confidence;
    openAiCalls: 0;
    prior: { C: number; m: number };
  };
};

const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const LEVELS: Confidence[] = ["Low", "Medium", "High"];
const minConf = (a: Confidence, b: Confidence) => LEVELS[Math.min(LEVELS.indexOf(a), LEVELS.indexOf(b))];
const downgrade = (c: Confidence) => LEVELS[Math.max(0, LEVELS.indexOf(c) - 1)];

export function verdictFromScore(score: number): Verdict {
  if (score >= BUY_THRESHOLD) return "Buy";
  if (score >= WAIT_THRESHOLD) return "Wait";
  return "Skip";
}

function validRating(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}
function validCount(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function bayesianBaseline(rating: number, count: number) {
  const rStar = (count * rating + PRIOR_WEIGHT_M * PRIOR_RATING_C) / (count + PRIOR_WEIGHT_M);
  return { rStar, B: (100 * (rStar - 1)) / 4 };
}

export function marketConfidence(count: number | null): Confidence | null {
  if (count === null) return null;
  if (count >= 1000) return "High";
  if (count >= 100) return "Medium";
  return "Low";
}

export function evidenceConfidence(n: number, secondStoreReviewCount = 0): Confidence {
  if (n >= 10 || (n > 0 && secondStoreReviewCount >= 3)) return "High";
  if (n >= 3) return "Medium";
  return "Low";
}

export function discrepancyFlag(s: Pick<BuyingScoreSignals, "n" | "rating" | "visibleMeanStars" | "visibleLowShare" | "marketplaceLowShare">): boolean {
  if (s.n < 3 || s.rating === null) return false;
  if (s.visibleMeanStars !== null && s.rating - s.visibleMeanStars >= 1.0 - 1e-9) return true;
  if (typeof s.visibleLowShare === "number" && typeof s.marketplaceLowShare === "number") {
    const market = Math.max(0, s.marketplaceLowShare);
    if (s.visibleLowShare >= 0.4 - 1e-9 && s.visibleLowShare >= 2 * market - 1e-9) return true;
  }
  return false;
}

function formatStars(r: number) {
  return `${Number.isInteger(r) ? r.toFixed(1) : String(round1(r))}★`;
}
export function evidenceLine(writtenCount: number, rating: number | null, count: number | null) {
  void writtenCount;
  if (rating === null) return count ? `${count.toLocaleString("en-US")} ratings (no average shown)` : "No marketplace rating found";
  return `${formatStars(rating)} from ${count ? count.toLocaleString("en-US") : "an unknown number of"} rating${count === 1 ? "" : "s"}`;
}

/** Recall wording rule (section 8, example 5). Says nothing unless a source was actually queried this scan. */
export function recallStatement(recall: RecallCheck | null | undefined): string | null {
  if (!recall || !recall.queried || !recall.succeeded) return null;
  if (recall.recalled) return `Official recall${recall.sourceName ? ` (${recall.sourceName})` : ""}`;
  return "No official recall found";
}

export function computeBuyingScore(s: BuyingScoreSignals): BuyingScoreResult {
  const rating = s.rating !== null && (s.ratingCount ?? 0) > 0 ? validRating(s.rating) : validRating(s.rating);
  const count = validCount(s.ratingCount);
  const hasRating = rating !== null && count !== null;
  const n = Math.max(0, Math.floor(s.n));
  const quotes = s.quotes || { safety: [], reliability: [], positive: [], negative: [] };
  const nEff = Math.min(n, Math.max(0, Math.floor(s.nEff ?? n)));
  const w = nEff / (nEff + EVIDENCE_HALF_WEIGHT);
  const sBar = nEff > 0 ? clamp(s.meanSentiment, -1, 1) : 0;
  const flag = hasRating ? discrepancyFlag({ ...s, n: nEff, rating }) : false;
  const minCapped = Math.min(Math.max(0, s.min), 3);
  let neg = 6 * s.rel + 10 * s.saf + 4 * s.themes + 3 * minCapped;
  if (flag) neg *= 1.5;
  const pos = 10 * sBar * w;
  const A = clamp(pos - neg, ADJUSTMENT_MIN, ADJUSTMENT_MAX);
  const marketConf = hasRating ? marketConfidence(count) : null;
  const evidenceConf = evidenceConfidence(nEff, s.secondStoreReviewCount || 0);
  const line = evidenceLine(n, rating, count);
  const recallText = recallStatement(s.recall);
  const warnings: BuyingScoreWarning[] = [];
  const notes: string[] = [];
  const capsApplied: string[] = [];
  const base = hasRating ? bayesianBaseline(rating!, count!) : null;

  const audit = (S: number | null, confidence: Confidence) => ({
    N: count, Rbar: rating, Rstar: base ? Math.round(base.rStar * 1000) / 1000 : null, B: base ? round1(base.B) : null,
    n, nEff, sBar, rBar: s.visibleMeanStars, w: Math.round(w * 1000) / 1000, Pos: round1(pos), Neg: round1(neg), A: round1(A),
    Rel: s.rel, Saf: s.saf, Min: minCapped, T: s.themes, discrepancyFlag: flag, capsApplied, S, confidence,
    marketConf, evidenceConf, openAiCalls: 0 as const, prior: { C: PRIOR_RATING_C, m: PRIOR_WEIGHT_M },
  });

  // ---- n = 0 ----------------------------------------------------------------
  if (n === 0) {
    if (hasRating) {
      // Too-new cap also applies to the provisional score (Owner, 2026-10-12): N < 50 -> cap 74.
      let raw = base!.B;
      const provWarnings: BuyingScoreWarning[] = [];
      if (count! < 50) {
        provWarnings.push({ tier: "too_new", text: `Few ratings so far (only ${count} rating${count === 1 ? "" : "s"}).`, quotes: [] });
        if (raw > CAP_TOO_NEW) { raw = CAP_TOO_NEW; capsApplied.push("too_new"); }
      }
      const score = Math.round(raw);
      return {
        version: BUYING_SCORE_VERSION, mode: "provisional_marketplace", score, rawScore: round1(raw), verdict: null,
        leaning: verdictFromScore(score), label: "Provisional Marketplace Score",
        provisionalLabel: "Provisional · based on marketplace rating only",
        confidence: "Low", confidenceReason: `Low · ${line}`, evidenceLine: line, warnings: provWarnings,
        notes: ["Based on the marketplace rating only. We couldn't read any written reviews yet. Paste the exact product link for a full Buying Score."],
        primaryAction: "Paste the exact product link for a full Buying Score", recallStatement: recallText,
        audit: audit(score, "Low"),
      };
    }
    return {
      version: BUYING_SCORE_VERSION, mode: "no_score", score: null, rawScore: null, verdict: null, leaning: null,
      label: "Add the exact product link", provisionalLabel: null, confidence: "Low", confidenceReason: `Low · ${line}`,
      evidenceLine: line, warnings: [],
      notes: ["We couldn't find a marketplace rating or any written reviews for this exact product yet. Paste the exact product link or add a review screenshot."],
      primaryAction: "Paste the exact product link or add a review screenshot", recallStatement: recallText,
      audit: audit(null, "Low"),
    };
  }

  // ---- n >= 1 ----------------------------------------------------------------
  let S = hasRating ? clamp(base!.B + A, 0, 100) : clamp(50 + 40 * sBar * w - neg, 0, 100);
  const caps: Array<{ cap: number; key: string; warning?: BuyingScoreWarning }> = [];
  if (s.recall?.queried && s.recall.succeeded && s.recall.recalled) {
    caps.push({ cap: CAP_RECALL, key: "official_recall", warning: { tier: "official_recall", text: "Official recall", quotes: [], sourceUrl: s.recall.sourceUrl || null } });
  }
  const hazard = s.safHazard || "a safety hazard";
  if (s.safSameHazard >= 2) {
    caps.push({ cap: CAP_REPEATED_SAFETY, key: "repeated_safety", warning: { tier: "repeated_safety", text: `Several customers independently report ${hazard}.`, quotes: quotes.safety.slice(0, 3) } });
  } else if (s.saf >= 1) {
    caps.push({ cap: CAP_SINGLE_SAFETY, key: "single_safety", warning: { tier: "single_safety", text: `One customer reported ${hazard} (single unverified report).`, quotes: quotes.safety.slice(0, 1) } });
  }
  if (s.relSameTheme >= 2) {
    caps.push({ cap: CAP_REPEATED_RELIABILITY, key: "repeated_reliability", warning: { tier: "repeated_reliability", text: `Repeated reports of ${s.relTheme || "the product failing"}.`, quotes: quotes.reliability.slice(0, 3) } });
  }
  if ((count ?? 0) < 50 && n < 10) {
    caps.push({ cap: CAP_TOO_NEW, key: "too_new", warning: { tier: "too_new", text: hasRating
      ? (sBar > 0.3 ? `Early reviews are positive, but there are only ${count} rating${count === 1 ? "" : "s"} so far.` : `Few ratings so far (only ${count} rating${count === 1 ? "" : "s"}).`)
      : "Few ratings so far.", quotes: [] } });
  }
  for (const c of caps) {
    if (c.warning) warnings.push(c.warning);
    if (S > c.cap) { S = c.cap; capsApplied.push(c.key); }
  }
  if (flag) {
    warnings.push({ tier: "discrepancy", text: `The reviews we could read are noticeably worse than the ${formatStars(rating!)} overall rating.`, quotes: [] });
  }
  if (s.topThemeLabel && (s.topThemeCount || 0) >= 2 && !s.relSameTheme) {
    notes.push(`${Math.abs(sBar) < 0.15 ? "Buyers are split. " : ""}The most common complaint is ${s.topThemeLabel}.`);
  }

  const score = Math.round(S);
  let confidence: Confidence;
  if (!hasRating) {
    confidence = "Low";
  } else {
    confidence = minConf(marketConf!, evidenceConf);
    if (flag) confidence = downgrade(confidence);
    if (s.variantResolved === false) confidence = downgrade(confidence);
  }
  if (s.variantResolved === false) notes.push("The exact variant could not be fully confirmed.");

  return {
    version: BUYING_SCORE_VERSION, mode: hasRating ? "buying_score" : "written_only", score, rawScore: round1(S),
    verdict: verdictFromScore(score), leaning: null, label: "Buying Score", provisionalLabel: null,
    confidence, confidenceReason: nEff === 0 && n > 0
      ? `${confidence} · ${line}; written reviews were not detailed enough to analyze`
      : `${confidence} · ${line}`, evidenceLine: line, warnings, notes,
    primaryAction: n < 3 ? "Paste the exact product link to read more reviews" : null, recallStatement: recallText,
    audit: audit(score, confidence),
  };
}

// ===========================================================================
// Review-level processing: exact-model filter, cross-store dedup, rule-based
// classification. Produces BuyingScoreSignals from real reviews.
// ===========================================================================
export type WrittenReview = {
  body: string;
  title?: string | null;
  rating?: number | null;
  source?: string | null; // store/domain
  sourceUrl?: string | null;
  reviewer?: string | null;
  date?: string | null;
  reviewedModel?: string | null;
  reviewedVariant?: string | null;
};

const STUB_TEXT = /^(?:read more|see more|show more|translate(?: review)?(?: to english)?|review (?:text )?(?:unavailable|not available|hidden|removed)|this review (?:is|has been) (?:not available|removed|hidden)|no (?:review )?text|n\/?a|helpful|report|verified purchase|[0-9.]+ out of 5 stars?)$/i;

/**
 * A review counts as "read" only if real text was retrieved. Count-only
 * entries, empty bodies, punctuation and UI stubs ("Read more", "Translate
 * review") are excluded entirely: they never count as written reviews read,
 * toward n_eff or toward confidence (they are part of the marketplace total only).
 */
export function hasReadableText(r: { body?: unknown } | null | undefined) {
  const text = String(r?.body ?? "").replace(/\s+/g, " ").trim();
  if (!/[\p{L}\p{N}]/u.test(text)) return false;
  const stripped = text.replace(/[.…:!\-–—()\[\]]+/g, " ").replace(/\s+/g, " ").trim();
  return stripped.length > 0 && !STUB_TEXT.test(stripped) && !STUB_TEXT.test(text.replace(/[…!]+$/g, "").trim());
}

export function normalizeReviewText(text: string) {
  return String(text || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * Normalized text similarity in [0, 1]: the mean of Sørensen–Dice on word
 * unigrams and on word bigrams (unigrams only when a text has < 3 words).
 * Tolerant of punctuation, casing and small edits ("second" vs "2nd") that
 * syndicated copies often carry.
 */
export function textSimilarity(a: string, b: string) {
  const ta = normalizeReviewText(a).split(" ").filter(Boolean);
  const tb = normalizeReviewText(b).split(" ").filter(Boolean);
  if (!ta.length || !tb.length) return 0;
  if (ta.join(" ") === tb.join(" ")) return 1;
  const dice = (k: number) => {
    const grams = (t: string[]) => { const out = new Map<string, number>(); for (let i = 0; i + k <= t.length; i++) { const g = t.slice(i, i + k).join(" "); out.set(g, (out.get(g) || 0) + 1); } return out; };
    const ga = grams(ta), gb = grams(tb);
    let inter = 0, sa = 0, sb = 0;
    for (const v of ga.values()) sa += v;
    for (const v of gb.values()) sb += v;
    for (const [g, v] of ga) inter += Math.min(v, gb.get(g) || 0);
    return sa + sb ? (2 * inter) / (sa + sb) : 0;
  };
  return ta.length < 3 || tb.length < 3 ? dice(1) : (dice(1) + dice(2)) / 2;
}

function dayNumber(date: string | null | undefined) {
  if (!date) return null;
  const t = Date.parse(String(date).replace(/^Reviewed in .*? on /i, ""));
  return Number.isFinite(t) ? Math.floor(t / 86400000) : null;
}
const reviewerKey = (r: WrittenReview) => normalizeReviewText(r.reviewer || "");

export function isSameReview(a: WrittenReview, b: WrittenReview) {
  if (textSimilarity(`${a.title || ""} ${a.body}`, `${b.title || ""} ${b.body}`) >= DUPLICATE_SIMILARITY
    || textSimilarity(a.body, b.body) >= DUPLICATE_SIMILARITY) return true;
  const ra = reviewerKey(a), rb = reviewerKey(b);
  if (ra && ra === rb) {
    const da = dayNumber(a.date), db = dayNumber(b.date);
    const sameStars = typeof a.rating === "number" && a.rating === b.rating;
    if (da !== null && db !== null && Math.abs(da - db) <= DUPLICATE_DATE_WINDOW_DAYS && sameStars) return true;
  }
  return false;
}

/** Cross-store dedup over ALL sources combined. Keeps the longest copy; records every store it appeared in. */
export function dedupeAcrossStores<T extends WrittenReview>(reviews: T[]): Array<T & { alsoSeenAt: string[] }> {
  const ordered = [...reviews].sort((a, b) => (b.body || "").length - (a.body || "").length);
  const kept: Array<T & { alsoSeenAt: string[] }> = [];
  for (const r of ordered) {
    if (!r || !hasReadableText(r)) continue;
    const dup = kept.find((k) => isSameReview(k, r));
    if (dup) { const s = storeOf(r); if (s && !dup.alsoSeenAt.includes(s)) dup.alsoSeenAt.push(s); continue; }
    kept.push({ ...r, alsoSeenAt: [] });
  }
  return kept;
}

export function storeOf(r: WrittenReview) {
  if (r.sourceUrl) { try { return new URL(r.sourceUrl).hostname.replace(/^www\./, "").replace(/^(?:m|smile)\./, ""); } catch { /* fallthrough */ } }
  return normalizeReviewText(r.source || "") || "unknown";
}

// ---- Exact model / variant matching ---------------------------------------
const MODEL_TOKEN = /\b(?=[a-z0-9-]*\d)(?=[a-z0-9-]*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*\b/gi;
export function normalizeModel(m: string | null | undefined) {
  return String(m || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function modelFamily(m: string) {
  const match = normalizeModel(m).match(/^([a-z]+)\d/);
  return match ? match[1] : null;
}
/** Model-like tokens (letters + digits, ≥4 chars) that belong to the same family as the requested model. */
function siblingModelsMentioned(text: string, requested: string) {
  const req = normalizeModel(requested);
  const fam = modelFamily(req);
  if (!req || !fam) return [] as string[];
  const tokens = (String(text || "").match(MODEL_TOKEN) || []).map(normalizeModel).filter((t) => t.length >= 4);
  return Array.from(new Set(tokens.filter((t) => t !== req && modelFamily(t) === fam && !req.startsWith(t) && !t.startsWith(req + ""))));
}
function mentionsModel(text: string, requested: string) {
  const req = normalizeModel(requested);
  return Boolean(req) && (String(text || "").match(MODEL_TOKEN) || []).map(normalizeModel).includes(req);
}

/**
 * Exact-model gate for a written review. A quote that names a sibling model
 * (e.g. AF100C when AF101C was requested) without also naming the requested
 * model is dropped.
 */
export function reviewMatchesExactModel(r: WrittenReview, requestedModel: string | null | undefined, requestedVariant?: string | null): { ok: boolean; reason: string | null } {
  if (requestedModel) {
    if (r.reviewedModel && normalizeModel(r.reviewedModel) !== normalizeModel(requestedModel)) return { ok: false, reason: "review is for a different model" };
    const text = `${r.title || ""} ${r.body || ""} ${r.reviewedVariant || ""}`;
    if (siblingModelsMentioned(text, requestedModel).length && !mentionsModel(text, requestedModel)) return { ok: false, reason: "review names a different model in the same family" };
  }
  if (requestedVariant && r.reviewedVariant) {
    const a = normalizeModel(requestedVariant), b = normalizeModel(r.reviewedVariant);
    if (a && b && !b.includes(a) && !a.includes(b)) return { ok: false, reason: "review is for a different variant" };
  }
  return { ok: true, reason: null };
}

// ---- Rule-based classification ----------------------------------------------
const NEGATORS = /\b(?:no|not|never|without|zero|nothing|didn't|didnt|doesn't|doesnt|hasn't|hasnt|haven't|havent|wasn't|wasnt|isn't|isnt|won't|wont)\b(?:\W+\w+){0,3}\W*$/i;

function hit(text: string, pattern: RegExp) {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 40), m.index);
    if (!NEGATORS.test(before)) return true;
  }
  return false;
}

export const SAFETY_HAZARDS: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: "heat", label: "overheating", pattern: /\b(?:overheat(?:ed|ing|s)?|melt(?:ed|ing|s)?|too hot to touch|scorch(?:ed)?)\b/i },
  { key: "fire", label: "fire or smoke", pattern: /\b(?:caught (?:on )?fire|on fire|flames?|fire hazard|smok(?:e|ed|ing) (?:came|coming|poured)|started smoking|burst into flames|sparks?(?:ed|ing)?)\b/i },
  { key: "burn", label: "burns", pattern: /\b(?:burn(?:ed|t)? (?:my|me|his|her|our|their)|gave (?:me|him|her) (?:a )?burns?|got burned)\b/i },
  { key: "shock", label: "an electric shock", pattern: /\b(?:electric(?:al)? shock|shocked me|electrocut\w*|got shocked)\b/i },
  { key: "injury", label: "an injury", pattern: /\b(?:injur(?:y|ed|ies)|cut (?:my|his|her) (?:finger|hand)|sent (?:me|him|her) to the (?:er|hospital))\b/i },
  { key: "choking", label: "a choking hazard", pattern: /\b(?:chok(?:e|ed|ing)(?: hazard)?)\b/i },
  { key: "toxic", label: "a toxic or chemical hazard", pattern: /\b(?:toxic|poison(?:ous|ed)?|chemical (?:smell|burn)|carbon monoxide|fumes made)\b/i },
];

export const RELIABILITY_FAILURES: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: "stopped", label: "the product stopping working", pattern: /\b(?:stopped working|quit working|stopped charging|died|dead after|no longer works|won'?t turn on|will not turn on|doesn'?t turn on anymore|stopped (?:after|within))\b/i },
  { key: "doa", label: "units arriving defective", pattern: /\b(?:dead on arrival|doa|arrived (?:broken|damaged|defective|dead)|defective|faulty|didn'?t work (?:out of the box|at all)|never worked)\b/i },
  { key: "broke", label: "the product breaking", pattern: /\b(?:broke(?:n)?|cracked|snapped|fell apart|came apart)\b/i },
  { key: "returned", label: "returns for defects", pattern: /\b(?:returned (?:it )?(?:for|because)(?: a| of)? (?:defect|it (?:stopped|broke|died))|sent it back (?:because|as) it (?:broke|stopped|died))\b/i },
];

export const MINOR_THEMES: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: "noise", label: "noise", pattern: /\b(?:noisy|too loud|very loud|so loud|loud (?:noise|fan|motor|beep)|rattl\w+|squeak\w*|whin(?:e|ing))\b/i },
  { key: "cord", label: "cord length", pattern: /\b(?:short (?:power )?cord|cord is (?:too )?short|cable is (?:too )?short|short cable)\b/i },
  { key: "size", label: "size or fit", pattern: /\b(?:too (?:small|big|large|bulky)|runs (?:small|large)|doesn'?t fit|bulky)\b/i },
  { key: "instructions", label: "unclear instructions", pattern: /\b(?:instructions? (?:are|were|was) (?:unclear|confusing|useless|poor)|confusing (?:setup|instructions?)|no instructions)\b/i },
  { key: "battery", label: "battery life", pattern: /\b(?:battery (?:life )?(?:is |was )?(?:short|poor|bad|weak|terrible|drains?)|battery dies (?:fast|quickly)|poor battery)\b/i },
  { key: "smell", label: "a smell", pattern: /\b(?:plastic smell|smells? (?:bad|weird|strong)|strong odou?r)\b/i },
  { key: "build", label: "build quality", pattern: /\b(?:flimsy|cheap(?:ly)? (?:made|feel|feeling|plastic)|feels cheap)\b/i },
  { key: "price", label: "price", pattern: /\b(?:overpriced|too expensive|not worth the (?:price|money))\b/i },
  { key: "app", label: "the app", pattern: /\b(?:app (?:is|was) (?:buggy|terrible|bad|useless)|app (?:keeps )?crash\w*|won'?t connect|connection (?:drops|issues?))\b/i },
  { key: "cleaning", label: "cleaning", pattern: /\b(?:hard to clean|difficult to clean|pain to clean)\b/i },
];

const POSITIVE_WORDS = /\b(?:love|loved|great|excellent|amazing|perfect|works (?:great|well|perfectly)|recommend|happy|fantastic|reliable|sturdy|easy|best|awesome|impressed|worth it|good)\b/gi;
const NEGATIVE_WORDS = /\b(?:hate|terrible|awful|worst|disappoint\w*|useless|junk|garbage|waste|poor|bad|broke|broken|defective|return(?:ed|ing)?|refund|problem|issue|stopped|cheap|flimsy|unhappy)\b/gi;

function countUnnegated(text: string, re: RegExp) {
  let c = 0; let m: RegExpExecArray | null; const g = new RegExp(re.source, "gi");
  while ((m = g.exec(text))) { if (!NEGATORS.test(text.slice(Math.max(0, m.index - 30), m.index))) c++; }
  return c;
}

export type ClassifiedReview = {
  sentiment: number;
  safety: string | null; // hazard key
  reliability: string | null; // failure key
  minor: string[];
  /** false when the text gives no sentiment or severity signal (non-English, too terse). */
  classifiable: boolean;
};

export function classifyReview(r: WrittenReview): ClassifiedReview {
  const text = `${r.title || ""}. ${r.body || ""}`;
  const pos = countUnnegated(text, POSITIVE_WORDS);
  const neg = countUnnegated(text, NEGATIVE_WORDS);
  const lex = pos + neg > 0 ? (pos - neg) / (pos + neg) : 0;
  const stars = validRating(r.rating);
  const sentiment = clamp(stars !== null ? 0.6 * ((stars - 3) / 2) + 0.4 * lex : lex, -1, 1);
  const safety = SAFETY_HAZARDS.find((h) => hit(text, h.pattern))?.key || null;
  const reliability = RELIABILITY_FAILURES.find((f) => hit(text, f.pattern))?.key || null;
  const minor = MINOR_THEMES.filter((t) => hit(text, t.pattern)).map((t) => t.key);
  const classifiable = pos + neg > 0 || Boolean(safety || reliability) || minor.length > 0;
  return { sentiment: Math.round(sentiment * 1000) / 1000, safety, reliability, minor, classifiable };
}

function shortQuote(r: WrittenReview, max = 220) {
  const t = String(r.body || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Histogram (percent or counts) -> share (0-1) of 1-2★. */
export function lowShareFromHistogram(h: StarHistogram | null | undefined): number | null {
  if (!h) return null;
  const vals = [1, 2, 3, 4, 5].map((k) => Number(h[k as 1]) || 0);
  const total = vals.reduce((a, b) => a + b, 0);
  return total > 0 ? (vals[0] + vals[1]) / total : null;
}

export type BuyingScoreFromReviewsInput = {
  marketplace: MarketplaceAggregate;
  reviews: WrittenReview[];
  requestedModel?: string | null;
  requestedVariant?: string | null;
  variantResolved?: boolean;
  primaryStore?: string | null;
  recall?: RecallCheck | null;
};

export function signalsFromReviews(input: BuyingScoreFromReviewsInput) {
  const dropped: Array<{ reason: string; body: string }> = [];
  const matched = (input.reviews || []).filter((r) => {
    if (!r || !hasReadableText(r)) return false;
    const m = reviewMatchesExactModel(r, input.requestedModel, input.requestedVariant);
    if (!m.ok) dropped.push({ reason: m.reason!, body: shortQuote(r, 80) });
    return m.ok;
  });
  const deduped = dedupeAcrossStores(matched);
  const n = deduped.length;
  const classified = deduped.map((r) => ({ r, c: classifyReview(r) }));

  // Independent reports: one per reviewer (when names are known).
  const independent = (key: (c: ClassifiedReview) => string | null) => {
    const groups = new Map<string, Set<string>>();
    const quotes = new Map<string, string[]>();
    classified.forEach(({ r, c }, i) => {
      const k = key(c); if (!k) return;
      const who = reviewerKey(r) || `anon-${i}`;
      if (!groups.has(k)) { groups.set(k, new Set()); quotes.set(k, []); }
      if (!groups.get(k)!.has(who)) { groups.get(k)!.add(who); quotes.get(k)!.push(shortQuote(r)); }
    });
    let topKey: string | null = null; let top = 0; let total = 0;
    for (const [k, set] of groups) { total += set.size; if (set.size > top) { top = set.size; topKey = k; } }
    return { total, top, topKey, quotes: topKey ? quotes.get(topKey)! : [], allQuotes: Array.from(quotes.values()).flat() };
  };
  const saf = independent((c) => c.safety);
  const rel = independent((c) => c.reliability);
  const reliabilityCount = classified.filter(({ c }) => c.reliability && !c.safety).length;
  const relIndependent = independent((c) => (c.safety ? null : c.reliability));

  const minorCount = classified.filter(({ c }) => c.minor.length > 0 && !c.reliability && !c.safety).length;
  const themeCounts = new Map<string, number>();
  for (const { c } of classified) {
    const keys = new Set<string>([...c.minor.map((k) => `minor:${k}`), ...(c.reliability ? [`rel:${c.reliability}`] : []), ...(c.safety ? [`saf:${c.safety}`] : [])]);
    for (const k of keys) themeCounts.set(k, (themeCounts.get(k) || 0) + 1);
  }
  const recurring = Array.from(themeCounts.entries()).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]);
  const labelFor = (k: string) => {
    const [kind, key] = k.split(":");
    const list = kind === "minor" ? MINOR_THEMES : kind === "rel" ? RELIABILITY_FAILURES : SAFETY_HAZARDS;
    return list.find((x) => x.key === key)?.label || key;
  };

  const starred = deduped.map((r) => validRating(r.rating)).filter((v): v is number => v !== null);
  const visibleMeanStars = starred.length >= 3 ? starred.reduce((a, b) => a + b, 0) / starred.length : null;
  const visibleLowShare = starred.length >= 3 ? starred.filter((v) => v <= 2).length / starred.length : null;

  const stores = new Map<string, number>();
  for (const r of deduped) stores.set(storeOf(r), (stores.get(storeOf(r)) || 0) + 1);
  const classifiableStores = new Map<string, number>();
  for (const { r, c } of classified) if (c.classifiable) classifiableStores.set(storeOf(r), (classifiableStores.get(storeOf(r)) || 0) + 1);
  const usable = classified.filter(({ c }) => c.classifiable);
  const primary = input.primaryStore ? input.primaryStore.replace(/^www\./, "") : Array.from(stores.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const secondStoreReviewCount = Math.max(0, ...Array.from(classifiableStores.entries()).filter(([s]) => s !== primary).map(([, v]) => v));

  const marketOk = input.marketplace?.matchesExactModel !== false;
  const signals: BuyingScoreSignals = {
    rating: marketOk ? validRating(input.marketplace?.rating) : null,
    ratingCount: marketOk ? validCount(input.marketplace?.count) : null,
    n,
    nEff: usable.length,
    meanSentiment: usable.length ? usable.reduce((a, { c }) => a + c.sentiment, 0) / usable.length : 0,
    visibleMeanStars,
    visibleLowShare,
    marketplaceLowShare: marketOk ? lowShareFromHistogram(input.marketplace?.histogram) : null,
    rel: reliabilityCount,
    relSameTheme: relIndependent.top,
    relTheme: relIndependent.topKey ? RELIABILITY_FAILURES.find((f) => f.key === relIndependent.topKey)?.label : null,
    saf: saf.total,
    safSameHazard: saf.top,
    safHazard: saf.topKey ? SAFETY_HAZARDS.find((h) => h.key === saf.topKey)?.label : null,
    min: minorCount,
    themes: recurring.length,
    topThemeLabel: recurring[0] ? labelFor(recurring[0][0]) : null,
    topThemeCount: recurring[0]?.[1] || 0,
    secondStoreReviewCount,
    variantResolved: input.variantResolved,
    recall: input.recall || null,
    quotes: {
      safety: saf.quotes,
      reliability: rel.quotes,
      positive: classified.filter(({ c }) => c.sentiment > 0.3).map(({ r }) => shortQuote(r)).slice(0, 4),
      negative: classified.filter(({ c }) => c.sentiment < -0.2).map(({ r }) => shortQuote(r)).slice(0, 4),
    },
  };
  return { signals, deduped, dropped, duplicatesRemoved: matched.length - n, stores: Object.fromEntries(stores) };
}

export function buyingScoreFromReviews(input: BuyingScoreFromReviewsInput) {
  const { signals, dropped, duplicatesRemoved, stores } = signalsFromReviews(input);
  const result = computeBuyingScore(signals);
  return { ...result, quotes: signals.quotes!, droppedForModelMismatch: dropped.length, duplicatesRemoved, stores };
}

/**
 * Page aggregate when the listing was read. Screenshot OCR stars and review
 * count (including "4.7" / "200,809" strings) are the marketplace aggregate
 * when that page did not yield a rating, and also when the listing was not accepted.
 */
export function marketplaceAggregateForScore(input: {
  exactListingAccepted: boolean;
  pageRating?: unknown;
  pageCount?: unknown;
  screenshotRating?: unknown;
  screenshotCount?: unknown;
}): { rating: number | null; count: number | null; source: "page" | "screenshot" | "none" } {
  if (!input.exactListingAccepted) {
    const rating = validRating(input.screenshotRating);
    const count = validCount(input.screenshotCount);
    return rating !== null ? { rating, count, source: "screenshot" } : { rating: null, count: null, source: "none" };
  }
  const pageRating = validRating(input.pageRating);
  if (pageRating !== null) return { rating: pageRating, count: validCount(input.pageCount), source: "page" };
  const screenshotRating = validRating(input.screenshotRating);
  if (screenshotRating !== null) return { rating: screenshotRating, count: validCount(input.screenshotCount), source: "screenshot" };
  return { rating: null, count: null, source: "none" };
}

/**
 * Zero analyzed written reviews never keep a review-evidence Buy or a 0–10 score.
 * The customer-facing result is the v2 card: Provisional Marketplace Score when a
 * marketplace rating is known.
 */
export function customerFacingDecision(input: {
  analyzedReviews: number;
  buyingScore: ReturnType<typeof buyingScoreFromReviews>;
}): { verdict: "BUY" | "REVIEW FIRST" | "AVOID"; buyScore: number | null; finalDecisionSource: "buyingScoreV2"; buyingScore: ReturnType<typeof buyingScoreFromReviews> } {
  const analyzed = Math.max(0, Math.floor(input.analyzedReviews || 0));
  const card = analyzed > 0 || input.buyingScore.audit.n === 0
    ? input.buyingScore
    : buyingScoreFromReviews({
        marketplace: { rating: input.buyingScore.audit.Rbar, count: input.buyingScore.audit.N, matchesExactModel: true },
        reviews: [],
      });
  const label = card.verdict || card.leaning;
  const verdict = label === "Buy" ? "BUY" : label === "Skip" ? "AVOID" : "REVIEW FIRST";
  return { verdict, buyScore: card.score, finalDecisionSource: "buyingScoreV2", buyingScore: card };
}

/** One structured log line per scan (section 10). */
export function buyingScoreLogFields(r: BuyingScoreResult) {
  const a = r.audit;
  return {
    version: r.version, mode: r.mode, N: a.N, Rbar: a.Rbar, Rstar: a.Rstar, n: a.n, sBar: Math.round(a.sBar * 1000) / 1000,
    Rel: a.Rel, Saf: a.Saf, Min: a.Min, T: a.T, discrepancyFlag: a.discrepancyFlag, capsApplied: a.capsApplied,
    S: a.S, confidence: r.confidence, openAiCalls: 0,
  };
}
