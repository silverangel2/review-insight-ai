import {
  acceptedRecords,
  cleanQuoteText,
  deriveShopperAnswer,
  isWrittenReviewBody,
} from "@/lib/shopperAnswer";
import { RELIABILITY_FAILURES, SAFETY_HAZARDS } from "@/lib/buyingScore";
import { isQuoteEchoOfClaim } from "@/lib/evidenceConsistency";
import {
  AGAINST_CAVEATS,
  AGAINST_LEAD_OTHER,
  AGAINST_LEAD_TOP,
  CAVEATS,
  CLOSERS,
  CO_PAIR_BRIDGES,
  DIMENSION_ALIASES,
  DIMENSION_DEPTH,
  FOR_LEAD_REST,
  FOR_LEAD_SECOND,
  FOR_LEAD_STRONGEST,
  ONE_OFF_LEADS,
  RED_FLAG_FRAMES,
  RED_FLAG_PLURAL_FRAMES,
  STRENGTH_DOMINANT,
  STRENGTH_DOMINANT_FIRST,
  STRENGTH_FEW,
  STRENGTH_HALF,
  STRENGTH_REPEATED,
  VALUE_LEADS,
  depthFor,
  hashSignature,
  pickFrame,
  renderFrame,
  type AspectDef,
} from "@/lib/analysisCopy";

// The analysis layer for the decision-brief results page.
//
// Owner rule: the result page presents ANALYSIS, never pasted buyer quotes.
// Pipeline: group (the existing theme claims from the result) -> segregate
// (for / against by net direction) -> analyze as a whole (theme frequency
// across the corpus, sub-aspect mining, co-occurrence, opposing signals) ->
// summarize in ReviewIntel's own words.
//
// Everything here is DETERMINISTIC: summaries are composed from the copy deck
// (lib/analysisCopy.ts) with variant selection hashed from the product's
// tally signature — same corpus = same text every visit; different corpora
// land on different frames; no two factors on one page start with the same
// frame. no model calls, no LLM inference, no product-specific special-casing.
// Review QUOTE text is never rendered: sub-aspect mining reads keywords only,
// and summaries can never leak a verbatim buyer sentence by construction.
//
// HARD RULE (2026-10-15): never hide a negative. Any negative signal anywhere
// in the segregated corpus (grouped complaints, Phase-5 one-off sources, or
// net-direction losers) is SAID — as an against-factor, a red-flag sentence,
// a caveat clause, or a named suppressed theme — PROVIDED at least one
// accepted written review evidences it (R3, restored 2026-10-16: an
// unevidenced claim is suppressed, never printed as a bare meta-sentence).
// The "no complaints" empty state renders ONLY when hasNegatives is false.

export type FactorBand = "dominant" | "repeated" | "single";

export type AnalysisFactor = {
  /** Bold factor title, e.g. "Comfortable, lightweight fit". */
  title: string;
  /** Analyzed paragraph (2-3 sentences) in ReviewIntel's own words. Never a quote. */
  summary: string;
  /** Shopper-facing pattern strength, in the mockup's exact words. */
  basis: "Pattern across most reviews" | "Repeated across reviews" | "One buyer reported this";
  band: FactorBand;
  /** Red-flag severity: isolated-but-serious negatives sort first, never softened. */
  severity?: "red";
};

export type ReviewAnalysis = {
  forFactors: AnalysisFactor[];
  againstFactors: AnalysisFactor[];
  /** none = no complaints at all; one_off = only single-report concerns; recurring = at least one repeated pattern. */
  complaintsPattern: "none" | "one_off" | "recurring";
  reviewCount: number;
  /**
   * True when ANY negative signal exists in the segregated corpus. The
   * "No buyer complaints in the reviews we read." empty state may render
   * ONLY when this is false.
   */
  hasNegatives: boolean;
  /**
   * Net-direction loser titles, for the rare case where negatives exist but
   * no against-factor won a side. Named so the page still says them.
   */
  suppressedThemes: string[];
};

type Rec = Record<string, unknown>;
const obj = (value: unknown): Rec =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};

type ClaimPoint = { claim: string; count: number };

/** Strip display artifacts and the "(one-off report)" suffix live data carries. */
function cleanThemeLabel(claim: string): string {
  return cleanQuoteText(claim)
    .replace(/\s*\((?:one-off report|one-off)\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Canonical identity for a theme: identical theme = identical key, across for and against. */
export function normalizeThemeKey(claim: string): string {
  return cleanThemeLabel(claim).toLowerCase().replace(/\s+/g, " ").trim();
}

function bandFor(supportCount: number, reviewCount: number): FactorBand {
  const dominantAt = Math.max(2, Math.ceil(reviewCount / 3));
  if (supportCount >= dominantAt && supportCount >= 3) return "dominant";
  if (supportCount >= 2) return "repeated";
  return "single";
}

function basisFor(band: FactorBand): AnalysisFactor["basis"] {
  if (band === "dominant") return "Pattern across most reviews";
  if (band === "repeated") return "Repeated across reviews";
  return "One buyer reported this";
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function sentenceCaseTheme(theme: string): string {
  const t = theme.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function lowerTheme(theme: string): string {
  const t = theme.trim();
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * Round 4: guard the one-off {theme} frame fill. The fill must be a short
 * theme label — never the review quote itself. When the scorer yields no
 * grouped themes, quoteOnlyPoints (shopperAnswer) sets claim = quote text, and
 * that used to flow straight into frames like "One buyer reported {theme}" —
 * printing the same quote the ✓ title already shows, lowercased.
 *
 * Returns null when the only available fill is quote-length or echoes one of
 * the signal's backing reviews (case-insensitive, ≥65% token overlap via the
 * canonical isQuoteEchoOfClaim — note the guard is deliberately asymmetric:
 * it measures the fraction of the REVIEW BODY's tokens, so a genuine short
 * label against a long body is never rejected). The caller then renders the
 * bare basis label ("One buyer reported this.") with no quote text appended:
 * analysis, not copy-paste.
 */
const ONE_OFF_MAX_LABEL_WORDS = 10;
export function oneOffThemeFill(lower: string, texts: string[]): string | null {
  const label = String(lower || "").trim();
  if (!label) return null;
  if (label.split(/\s+/).length > ONE_OFF_MAX_LABEL_WORDS) return null;
  for (const text of texts) {
    if (isQuoteEchoOfClaim(text, label)) return null;
  }
  return label;
}

// ---------------------------------------------------------------------------
// Phase 5: widen the analysis input. One-off complaint signals live outside
// deriveShopperAnswer's grouped complaints — in the score card's warnings[]
// (deterministic analysis language, never buyer quotes) and in
// quotes.negative[] (sentiment-classified excerpts; keyword-mined only).
// ---------------------------------------------------------------------------

type MinedSignal = {
  key: string;
  claim: string;
  count: number;
  texts: string[];
  /** Warning text is authoritative analysis language — rendered verbatim. */
  fixedSummary: string | null;
  /** Score-card warning tier, when this signal came from a warning. */
  tier: string | null;
};

/** The canonical score card, same precedence the shopper answer uses. */
function scoreCardOf(result: Rec): Rec | null {
  const card = obj(result.buyingScoreV2);
  if (String(result.finalDecisionSource || "") === "buyingScoreV2") return card;
  if (card.version === "buying-score-v2" || card.mode) return card;
  return null;
}

const MINED_WARNING_TIERS = new Set(["official_recall", "repeated_safety", "single_safety", "repeated_reliability"]);

/**
 * Map stray text (a warning sentence or a sentiment excerpt) to a dimension
 * key: direct key hit, then alias hit, then loose signal keywords.
 */
function matchDimension(text: string): string | null {
  const t = ` ${text.toLowerCase()} `;
  const hit = (phrase: string) => new RegExp(`\\b${escapeRegExp(phrase.trim())}\\b`, "i").test(t);
  for (const key of Object.keys(DIMENSION_DEPTH)) {
    if (key.startsWith("__")) continue;
    if (hit(key)) return key;
  }
  for (const alias of Object.keys(DIMENSION_ALIASES)) {
    if (hit(alias)) return DIMENSION_ALIASES[alias];
  }
  for (const key of Object.keys(DIMENSION_DEPTH)) {
    const depth = DIMENSION_DEPTH[key];
    for (const signal of depth.signals ?? []) {
      if (hit(signal)) return key;
    }
  }
  return null;
}

/**
 * Mine one-off complaint signals from the broader result corpus.
 * Deterministic, no model calls. Quote excerpts are keyword-mined only —
 * their text is never rendered.
 */
const WARNING_NOISE_WORDS = new Set(
  "the,a,an,and,or,of,to,in,on,for,with,is,it,this,that,from,are,was,were,be,been,as,at,by,several,customers,customer,one,single,unverified,report,reports,reported,independently,repeated,official,recall".split(",")
);

/**
 * Round 2 defect 3: a mined warning must be backed by the accepted corpus. The
 * warning text names the scorer's hazard label (e.g. "overheating"); the check
 * runs the SAME hazard pattern the scorer used against the accepted
 * written-review bodies — a paraphrase ("too hot to touch") still counts as
 * backing, because the scorer counted it. If no hazard label matches the text,
 * falls back to significant-word overlap. Zero backing bodies -> the warning is
 * dropped at the source: an unbacked claim never prints (brief or Safety
 * Report sections). Returns the number of backing bodies.
 */
function warningCorpusBacking(result: Rec, text: string): number {
  const lower = text.toLowerCase();
  const bodies: string[] = [];
  for (const record of acceptedRecords(result)) {
    const body = cleanQuoteText(String((record as unknown as Rec).body || "")).toLowerCase();
    if (isWrittenReviewBody(body)) bodies.push(body);
  }
  if (!bodies.length) return 0;
  const hazard = [...SAFETY_HAZARDS, ...RELIABILITY_FAILURES].find((h) =>
    lower.includes(h.label.toLowerCase())
  );
  if (hazard) return bodies.filter((b) => hazard.pattern.test(b)).length;
  const words = lower.split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !WARNING_NOISE_WORDS.has(w));
  if (!words.length) return 0;
  const need = Math.min(2, words.length);
  return bodies.filter((b) => words.filter((w) => b.includes(w)).length >= need).length;
}

export function mineScoreComplaints(input: unknown): MinedSignal[] {
  const result = obj(input);
  const card = scoreCardOf(result);
  if (!card) return [];
  const byKey = new Map<string, MinedSignal>();

  const add = (key: string, claim: string, count: number, texts: string[], fixedSummary: string | null, tier: string | null = null) => {
    const prev = byKey.get(key);
    if (prev) {
      prev.count = Math.max(prev.count, count);
      prev.texts.push(...texts);
      if (!prev.fixedSummary && fixedSummary) prev.fixedSummary = fixedSummary;
      if (!prev.tier && tier) prev.tier = tier;
      return;
    }
    byKey.set(key, { key, claim, count, texts: [...texts], fixedSummary, tier });
  };

  // 1. Warnings: deterministic analysis language (never buyer quotes).
  const warnings = Array.isArray(card.warnings) ? (card.warnings as Rec[]) : [];
  warnings.forEach((warning, index) => {
    const tier = String(warning.tier || "");
    if (!MINED_WARNING_TIERS.has(tier)) return; // too_new / discrepancy are not product complaints
    const text = cleanQuoteText(String(warning.text || ""));
    if (!text) return;
    let key = matchDimension(text);
    let claim = key ?? "";
    if (!key) {
      // Extract the hazard phrase from the deterministic templates:
      // "Several customers independently report X." / "One customer reported X (single unverified report)."
      const extracted = text.match(/report(?:s|ed)?\s+(.+?)(?:\s*\(single|\s*\.\s*$)/i)?.[1]?.trim();
      claim = extracted || "safety report";
      key = `__warning_${index}`;
    }
    // Round 2 defect 3: the warning prints only when the accepted corpus backs
    // it. Official recalls are backed by the recall source itself, not reviews.
    const backing = tier === "official_recall" ? 2 : warningCorpusBacking(result, text);
    if (!backing) return;
    const count = tier === "single_safety" ? 1 : Math.max(1, Math.min(2, backing));
    add(key, claim || key, count, [], text, tier);
  });

  // 2. Sentiment-classified negative excerpts: keyword-mined, never rendered.
  const quotes = obj(card.quotes);
  const negatives = Array.isArray(quotes.negative) ? quotes.negative : [];
  const perKey = new Map<string, string[]>();
  for (const excerpt of negatives) {
    const text = cleanQuoteText(String(excerpt || ""));
    if (text.length < 8) continue;
    const key = matchDimension(text) ?? "__generic_concern";
    const list = perKey.get(key) ?? [];
    list.push(text);
    perKey.set(key, list);
  }
  for (const [key, texts] of perKey) {
    add(key, key.startsWith("__") ? key : key, texts.length, texts, null);
  }

  return [...byKey.values()];
}

// ---------------------------------------------------------------------------
// Phase 9: depth composition.
// ---------------------------------------------------------------------------

type ThemeSignal = {
  key: string;
  claim: string;
  count: number;
  opposingCount: number;
  /** R3: whether the opposing side's signal was evidenced by a written
   *  review. The caveat clause voices the loser — it may only render when
   *  the loser was evidenced. */
  opposingEvident: boolean;
  side: "for" | "against";
  rank: number;
  texts: string[];
  recordKeys: string[];
  severityRed: boolean;
  fixedSummary: string | null;
  aspectHitIds: string[];
};

function aspectHit(text: string, def: AspectDef): boolean {
  const t = ` ${text.toLowerCase()} `;
  return def.words.some((w) => new RegExp(`\\b${escapeRegExp(w.trim())}\\b`, "i").test(t));
}

/**
 * Sub-aspect mining: a sub-aspect may be NAMED only when >= 2 reviews hit its
 * keywords — or >= 25% of the theme's reviews for small corpora (<= 6).
 * Otherwise it does not exist in the copy. No invented specifics, ever.
 */
function mineAspectIds(
  key: string,
  texts: string[],
  themeSize: number,
  side: "for" | "against"
): string[] {
  const depth = depthFor(key);
  const aspects = side === "for" ? depth?.aspects ?? [] : depth?.againstAspects ?? [];
  if (!aspects.length || !texts.length) return [];
  const required = themeSize <= 6 ? Math.max(1, Math.ceil(themeSize * 0.25)) : 2;
  return aspects
    .map((def) => ({ id: def.id, n: texts.filter((t) => aspectHit(t, def)).length }))
    .filter((h) => h.n >= required)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .map((h) => h.id);
}

function aspectPhrase(key: string, aspectId: string, side: "for" | "against", tallySig: string): string | null {
  const depth = depthFor(key);
  const aspects = side === "for" ? depth?.aspects ?? [] : depth?.againstAspects ?? [];
  const def = aspects.find((a) => a.id === aspectId);
  if (!def || !def.phrases.length) return null;
  return def.phrases[hashSignature(`${tallySig}|aspect|${key}|${aspectId}`) % def.phrases.length];
}

/** Co-occurrence: two for-themes frequently mentioned together in the same reviews. */
function findCoPair(lead: ThemeSignal, others: ThemeSignal[]): string | null {
  const depth = depthFor(lead.key);
  if (!depth?.pairNoun) return null;
  const leadSet = new Set(lead.recordKeys);
  if (!leadSet.size) return null;
  const required = lead.count <= 6 ? Math.max(1, Math.ceil(lead.count * 0.25)) : 2;
  let best: { noun: string; shared: number } | null = null;
  for (const other of others) {
    if (other.key === lead.key) continue;
    const otherDepth = depthFor(other.key);
    if (!otherDepth?.pairNoun) continue;
    let shared = 0;
    for (const k of other.recordKeys) if (leadSet.has(k)) shared++;
    if (shared >= required && (!best || shared > best.shared)) {
      best = { noun: otherDepth.pairNoun, shared };
    }
  }
  return best ? best.noun : null;
}

type ComposeCtx = {
  reviewCount: number;
  thin: boolean;
  tallySig: string;
  used: Set<string>;
  coPairNoun: string | null;
  coPairForKey: string | null;
};

function composeSignal(s: ThemeSignal, ctx: ComposeCtx): AnalysisFactor {
  const band = bandFor(s.count, ctx.reviewCount);
  const basis = basisFor(band);
  const depth = depthFor(s.key);
  const title = depth?.bandTitles?.[band] ?? depth?.title ?? sentenceCaseTheme(s.claim);
  const severity = s.severityRed ? ("red" as const) : undefined;

  // Phase-5 warnings: authoritative deterministic analysis language, verbatim.
  if (s.fixedSummary) {
    return { title, summary: s.fixedSummary, basis, band, severity };
  }

  const lower = lowerTheme(s.claim);

  // Red-flag framing for serious negatives — even at count 1, never softened.
  if (s.severityRed && s.side === "against" && depth?.redDetail) {
    const single = s.count < 2;
    const frames = single ? RED_FLAG_FRAMES : RED_FLAG_PLURAL_FRAMES;
    const detail = single ? depth.redDetail.single : depth.redDetail.plural;
    const template = pickFrame(frames, `${ctx.tallySig}|redflag|${s.key}|${s.count}`, ctx.used);
    const core = renderFrame(template, { detail }).replace(/\.\s*$/, "");
    // Hotfix 2 2026-10-16: the wordsmith enrichment is switched OFF at the
    // compose seam — the miner produced ungrammatical n-gram fragments live.
    // The red-flag sentence is the sentence-library core, unchanged.
    return { title, summary: `${core}.`, basis, band, severity };
  }

  // One-off family: a single honest sentence.
  if (band === "single") {
    const template = pickFrame(ONE_OFF_LEADS, `${ctx.tallySig}|oneoff|${s.side}|${s.key}`, ctx.used);
    const fill = oneOffThemeFill(lower, s.texts);
    if (!fill) {
      // The only available fill is the quote itself (or nothing): never
      // print an echo of the displayed review — fall back to the bare basis
      // label. This covers both the FOR-side and AGAINST-side one-off frames
      // (they share the ONE_OFF_LEADS family, incl. "A single report
      // describes {theme}" and "One buyer's experience included {theme}").
      return { title, summary: `${basis}.`, basis, band, severity };
    }
    // Hotfix 2 2026-10-16: the wordsmith enrichment is switched OFF at the
    // compose seam. The one-off sentence is the sentence-library frame,
    // unchanged.
    return { title, summary: `${renderFrame(template, { theme: fill })}.`, basis, band, severity };
  }

  // Lead: collective judgment + how buyers land on it.
  const leadFamily =
    depth?.leadFamily === "value"
      ? VALUE_LEADS
      : s.side === "for"
        ? s.rank === 0
          ? FOR_LEAD_STRONGEST
          : s.rank === 1
            ? FOR_LEAD_SECOND
            : FOR_LEAD_REST
        : s.rank === 0
          ? AGAINST_LEAD_TOP
          : AGAINST_LEAD_OTHER;
  // Specifics: only mined sub-aspects, woven in. Thin corpora skip this.
  let specifics = "";
  if (!ctx.thin && s.aspectHitIds.length > 0) {
    const phrases = s.aspectHitIds
      .map((id) => aspectPhrase(s.key, id, s.side, ctx.tallySig))
      .filter((p): p is string => Boolean(p));
    if (phrases.length > 0) {
      specifics = `they ${joinList(phrases)}`;
    }
  }
  let pairClause = "";
  if (!ctx.thin && s.side === "for" && s.rank === 0 && ctx.coPairForKey === s.key && ctx.coPairNoun && depth?.pairNoun) {
    const template = pickFrame(CO_PAIR_BRIDGES, `${ctx.tallySig}|copair|${s.key}`, ctx.used);
    pairClause = renderFrame(template, { a: depth.pairNoun, b: ctx.coPairNoun });
  }

  // Hotfix 2 2026-10-16: the wordsmith enrichment is switched OFF at the
  // compose seam — the miner produced ungrammatical n-gram fragments live
  // (scan_41a15295: "anyone looking and build quality — that's what buyers
  // keep naming." / "What buyers name, again and again: doesn't require a
  // separate and interior unlike most electric."). lib/wordsmith.ts stays in
  // the repo, dormant, for the future rebuild; no production path calls it
  // anymore. The composition below is the plain sentence-library basis that
  // predates the Wordsmith — the style that passed Junel's checks on the
  // Shark / Keurig / Sony live proofs.

  const lead = pickFrame(leadFamily, `${ctx.tallySig}|lead|${s.side}|${s.rank}|${s.key}`, ctx.used);
  const sentence1 =
    specifics && pairClause
      ? `${lead}: ${specifics}${pairClause}.`
      : specifics
        ? `${lead}: ${specifics}.`
        : pairClause
          ? `${lead}${pairClause}.`
          : `${lead}.`;

  // Strength in plain words, from real tallies.
  const share = ctx.reviewCount > 0 ? s.count / ctx.reviewCount : 0;
  const strengthFamily =
    band === "dominant"
      ? s.rank === 0
        ? STRENGTH_DOMINANT_FIRST
        : STRENGTH_DOMINANT
      : share >= 0.4
        ? STRENGTH_HALF
        : share >= 0.15
          ? STRENGTH_REPEATED
          : STRENGTH_FEW;
  let sentence2 = pickFrame(
    strengthFamily,
    `${ctx.tallySig}|strength|${band}|${s.side}|${s.rank}|${s.key}`,
    ctx.used
  );

  // Caveat: the same theme has signals on the other side — never pretend
  // unanimity. R3: the caveat voices the loser, so it renders only when the
  // loser was evidenced by a written review (hard rule: never hide an
  // EVIDENCED negative signal; never print an unevidenced one).
  if (s.opposingCount >= 1 && s.opposingEvident) {
    const base = sentence2.replace(/\.\s*$/, "");
    if (s.side === "for") {
      const note = depth?.againstNote ?? "some buyers had the opposite experience";
      const template = pickFrame(CAVEATS, `${ctx.tallySig}|caveat|${s.key}`, ctx.used);
      sentence2 = `${base}${renderFrame(template, { note })}.`;
    } else {
      const template = pickFrame(AGAINST_CAVEATS, `${ctx.tallySig}|caveat|${s.key}`, ctx.used);
      sentence2 = `${base}${template}`;
    }
  }

  // Closer: earned only by dominant-band factors, never on thin corpora.
  const closer =
    !ctx.thin && band === "dominant"
      ? pickFrame(CLOSERS, `${ctx.tallySig}|closer|${s.side}|${s.key}`, ctx.used)
      : "";

  // Today's honest composition — lead + strength (+ closer).
  const summary = closer ? `${sentence1} ${sentence2} ${closer}` : `${sentence1} ${sentence2}`;
  return { title, summary, basis, band, severity };
}

/**
 * Segregate themes by net direction, then analyze each as a whole.
 * One theme appears on ONE side only: the side with the higher support count
 * wins; an exact tie stays "for". Losers are never hidden — they become a
 * caveat clause on the winner (threshold >= 1) and are named in
 * suppressedThemes for the rare case where no against-factor wins a side.
 */
export function deriveReviewAnalysis(input: unknown): ReviewAnalysis {
  const result = obj(input);
  const answer = deriveShopperAnswer(input);
  const reviewCount = answer.reviewCount;

  type Agg = {
    claim: string;
    count: number;
    sourceIds: string[];
    sourceHashes: string[];
    extraTexts: string[];
    fixedSummary: string | null;
    /** Score-card warning tier (official_recall is an external fact, not a review claim). */
    tier: string | null;
  };
  const forAgg = new Map<string, Agg>();
  const againstAgg = new Map<string, Agg>();

  const put = (map: Map<string, Agg>, key: string, claim: string, count: number, sourceIds: string[], sourceHashes: string[]) => {
    const prev = map.get(key);
    if (prev) {
      if (count > prev.count) {
        prev.count = count;
        prev.claim = claim;
      }
      prev.sourceIds.push(...sourceIds);
      prev.sourceHashes.push(...sourceHashes);
      return;
    }
    map.set(key, { claim, count, sourceIds: [...sourceIds], sourceHashes: [...sourceHashes], extraTexts: [], fixedSummary: null, tier: null });
  };

  for (const point of answer.loves) {
    const key = normalizeThemeKey(point.claim);
    if (!key) continue;
    put(forAgg, key, point.claim, Math.max(0, Math.floor(point.count || 0)), point.sourceIds ?? [], point.sourceHashes ?? []);
  }
  for (const point of answer.complaints) {
    const key = normalizeThemeKey(point.claim);
    if (!key) continue;
    put(againstAgg, key, point.claim, Math.max(0, Math.floor(point.count || 0)), point.sourceIds ?? [], point.sourceHashes ?? []);
  }

  // Phase 5: mine one-off complaint signals from the broader corpus.
  const mined = mineScoreComplaints(input);
  for (const m of mined) {
    const key = m.key.startsWith("__") ? m.key : normalizeThemeKey(m.claim || m.key);
    const prev = againstAgg.get(key);
    if (prev) {
      prev.count = Math.max(prev.count, m.count);
      prev.extraTexts.push(...m.texts);
      if (!prev.fixedSummary && m.fixedSummary) prev.fixedSummary = m.fixedSummary;
      if (!prev.tier && m.tier) prev.tier = m.tier;
    } else {
      againstAgg.set(key, {
        claim: m.claim || m.key,
        count: m.count,
        sourceIds: [],
        sourceHashes: [],
        extraTexts: [...m.texts],
        fixedSummary: m.fixedSummary,
        tier: m.tier,
      });
    }
  }

  // Hard rule: any negative signal anywhere? (Recomputed after the R3
  // evidence gate below: unevidenced warnings no longer count, so an
  // aggregate-only scan honestly reports "no buyer complaints in the reviews
  // we read" instead of printing warnings with no buyer behind them.)
  let hadNegatives = answer.complaints.some((p) => normalizeThemeKey(p.claim)) || mined.length > 0;

  // Resolve sides by net direction.
  const signals: ThemeSignal[] = [];
  const suppressedThemes: string[] = [];
  const records = acceptedRecords(result);
  const bodyByKey = new Map<string, string>();
  for (const record of records) {
    const body = cleanQuoteText(String(record.body || ""));
    if (!isWrittenReviewBody(body)) continue;
    if (record.id) bodyByKey.set(String(record.id), body);
    if (record.stableEvidenceHash) bodyByKey.set(String(record.stableEvidenceHash), body);
  }

  const allKeys = new Set([...forAgg.keys(), ...againstAgg.keys()]);
  // R3: tracks whether any evidenced negative was voiced only as a suppressed
  // theme / caveat (no standalone against-factor won its side). Also tracks
  // dropped signals that still had real excerpt evidence (__generic_concern
  // rows carry no analyzable content, but their excerpts prove buyers raised
  // concerns — hadNegatives stays honest).
  let evidencedSuppressedNegatives = false;
  let droppedEvidentNegatives = false;
  for (const key of allKeys) {
    const f = forAgg.get(key);
    const a = againstAgg.get(key);
    const forCount = f?.count ?? 0;
    const againstCount = a?.count ?? 0;
    const side: "for" | "against" = againstCount > forCount ? "against" : "for";
    const winner = side === "for" ? f! : a!;
    const opposingCount = side === "for" ? againstCount : forCount;
    if (side === "for" && opposingCount >= 1) {
      const depth = depthFor(key);
      // R3: a suppressed (net-direction loser) theme is only NAMED when the
      // losing complaint was evidenced by a written review — an unevidenced
      // loser is dropped silently, never printed as a claim. (Evidence is
      // computed below as opposingEvident; mirror the rule here.)
      const loserAgg = a;
      const loserAggTexts = loserAgg
        ? [...(loserAgg.sourceIds ?? []), ...(loserAgg.sourceHashes ?? [])]
            .map((rk) => bodyByKey.get(String(rk)))
            .filter((b): b is string => Boolean(b))
        : [];
      const loserEvident = loserAgg
        ? loserAggTexts.length > 0 || (loserAgg.extraTexts ?? []).length > 0
        : false;
      if (loserEvident) {
        suppressedThemes.push(depth?.title ?? sentenceCaseTheme(winner.claim));
        evidencedSuppressedNegatives = true;
      }
    }
    const recordKeys = [...(winner.sourceIds ?? []), ...(winner.sourceHashes ?? [])].map(String);
    const seen = new Set<string>();
    const texts: string[] = [];
    for (const rk of recordKeys) {
      const body = bodyByKey.get(rk);
      if (body && !seen.has(body)) {
        seen.add(body);
        texts.push(body);
      }
    }
    for (const extra of winner.extraTexts ?? []) {
      if (!seen.has(extra)) {
        seen.add(extra);
        texts.push(extra);
      }
    }
    // R3 (round 2, restored): a warning/complaint claim may only render when
    // at least one accepted written review actually evidences it. Unevidenced
    // negatives (e.g. grouped complaints whose provenance no longer resolves
    // to accepted bodies, or score-card warnings on aggregate-only scans) are
    // suppressed entirely — printing a concern with no buyer behind it is not
    // honest analysis. An official recall is an external fact, not a review
    // claim, so it is exempt from this gate. Round 3: __generic_concern rows
    // carry no analyzable content (the actual claim was discarded for a
    // generic bandTitle), so they are dropped as rows too — but their real
    // excerpts still count as evidence that buyers raised concerns.
    const isOfficialRecall = winner.tier === "official_recall";
    const isVacuousGeneric = key === "__generic_concern";
    if (side === "against" && (texts.length === 0 || isVacuousGeneric) && !isOfficialRecall) {
      if (texts.length > 0) droppedEvidentNegatives = true;
      continue;
    }
    const depth = depthFor(key);
    // R3: the caveat voices the LOSER — compute whether the loser was
    // evidenced (same evidence rule as the gate above).
    const loser = side === "for" ? a : f;
    const loserTexts = loser
      ? [...(loser.sourceIds ?? []), ...(loser.sourceHashes ?? [])]
          .map((rk) => bodyByKey.get(String(rk)))
          .filter((b): b is string => Boolean(b))
      : [];
    const opposingEvident = loser
      ? loserTexts.length > 0 || (loser.extraTexts ?? []).length > 0 || loser.tier === "official_recall"
      : false;
    signals.push({
      key,
      claim: cleanThemeLabel(winner.claim),
      count: side === "for" ? forCount : againstCount,
      opposingCount,
      opposingEvident,
      side,
      rank: 0,
      texts: texts.slice(0, 12),
      recordKeys,
      severityRed: depth?.severity === "red",
      fixedSummary: winner.fixedSummary,
      aspectHitIds: [],
    });
  }

  const forSignals = signals
    .filter((s) => s.side === "for")
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  // Against-side ordering: red flags first, then recurring complaints, then ordinary one-offs.
  const bandRank = (s: ThemeSignal) => {
    const band = bandFor(s.count, reviewCount);
    return band === "dominant" ? 0 : band === "repeated" ? 1 : 2;
  };
  const againstSignals = signals
    .filter((s) => s.side === "against")
    .sort(
      (a, b) =>
        (a.severityRed ? 0 : 1) - (b.severityRed ? 0 : 1) ||
        bandRank(a) - bandRank(b) ||
        b.count - a.count
    )
    .slice(0, 3);
  forSignals.forEach((s, i) => (s.rank = i));
  againstSignals.forEach((s, i) => (s.rank = i));

  const thin = reviewCount < 8;

  // Sub-aspect mining (skipped for thin corpora and verbatim warning factors).
  if (!thin) {
    for (const s of [...forSignals, ...againstSignals]) {
      if (s.fixedSummary) continue;
      if (bandFor(s.count, reviewCount) === "single") continue;
      s.aspectHitIds = mineAspectIds(s.key, s.texts, s.count, s.side);
    }
  }

  // Tally signature: theme set + bands + sub-aspect hits + review count.
  // Variant selection is hashed from this — same corpus, same text, forever.
  const sigParts = [`rc=${reviewCount}`];
  const ordered = [...forSignals, ...againstSignals].sort(
    (a, b) => a.side.localeCompare(b.side) || a.key.localeCompare(b.key)
  );
  for (const s of ordered) {
    sigParts.push(
      `${s.side}:${s.key}:${s.count}:${bandFor(s.count, reviewCount)}:${s.aspectHitIds.join("+")}:${s.severityRed ? "red" : ""}`
    );
  }
  const tallySig = sigParts.join("|");

  // Co-occurrence for the lead for-factor.
  let coPairNoun: string | null = null;
  let coPairForKey: string | null = null;
  const leadFor = forSignals[0];
  if (leadFor && !thin && !leadFor.fixedSummary && bandFor(leadFor.count, reviewCount) !== "single") {
    coPairNoun = findCoPair(leadFor, forSignals);
    coPairForKey = coPairNoun ? leadFor.key : null;
  }

  const used = new Set<string>();
  const ctx: ComposeCtx = { reviewCount, thin, tallySig, used, coPairNoun, coPairForKey };
  const forFactors = forSignals.map((s) => composeSignal(s, ctx));
  const againstFactors = againstSignals.map((s) => composeSignal(s, ctx));

  const complaintsPattern: ReviewAnalysis["complaintsPattern"] =
    againstFactors.length === 0 ? "none" : againstFactors.every((f) => f.band === "single") ? "one_off" : "recurring";

  // R3: hadNegatives follows the evidence gate — surviving (evidenced)
  // against-factors, an official recall, an evidenced negative voiced as a
  // caveat/suppressed theme, or dropped rows that still had real excerpt
  // evidence. Unevidenced warnings never count, so the "no buyer complaints"
  // empty state stays honest.
  hadNegatives = againstFactors.length > 0 || evidencedSuppressedNegatives || droppedEvidentNegatives;
  return { forFactors, againstFactors, complaintsPattern, reviewCount, hasNegatives: hadNegatives, suppressedThemes };
}

/** The small product thumbnail: a real captured/listing image only. Never a placeholder, never generated. */
export function briefImageUrl(result: unknown, previewImage: unknown): string | null {
  const direct = String(previewImage || "").trim();
  if (/^https?:\/\//i.test(direct) || direct.startsWith("data:image/")) return direct;
  const record = obj(result);
  const product = obj(record.product);
  const listing = obj(obj(record.reviewEvidence).listingEvidence);
  const candidates = [
    product.imageUrl,
    product.image,
    product.thumbnail,
    product.thumbnailUrl,
    listing.imageUrl,
    listing.image,
    listing.thumbnail,
    record.productImageUrl,
    record.productImage,
    record.imageUrl,
    record.thumbnailUrl,
    record.thumbnail,
  ];
  for (const value of candidates) {
    const url = String(value || "").trim();
    if (/^https?:\/\//i.test(url)) return url;
  }
  return null;
}

/** AI-like review signs for the "How we checked" fold, when the result carries the score. Null when absent. */
export function aiLikeSignsFor(result: unknown): string | null {
  const record = obj(result);
  const paths: unknown[] = [
    obj(obj(record.reviewEvidence).reviewAuthenticity).score,
    obj(obj(record.reviewEvidence).reviewAuthenticity).fakeReviewScore,
    obj(record.analysis).fake_review_risk_score,
    record.fakeReviewPercent,
  ];
  for (const value of paths) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) {
      const risk = value >= 40 ? "Moderate" : "Low";
      return `${Math.round(value)}% signs · ${risk}`;
    }
  }
  return null;
}
