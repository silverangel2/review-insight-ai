import {
  acceptedRecords,
  cleanQuoteText,
  deriveShopperAnswer,
  isWrittenReviewBody,
} from "@/lib/shopperAnswer";
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
// a caveat clause, or a named suppressed theme. The "no complaints" empty
// state renders ONLY when hasNegatives is false.

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
export function mineScoreComplaints(input: unknown): MinedSignal[] {
  const result = obj(input);
  const card = scoreCardOf(result);
  if (!card) return [];
  const byKey = new Map<string, MinedSignal>();

  const add = (key: string, claim: string, count: number, texts: string[], fixedSummary: string | null) => {
    const prev = byKey.get(key);
    if (prev) {
      prev.count = Math.max(prev.count, count);
      prev.texts.push(...texts);
      if (!prev.fixedSummary && fixedSummary) prev.fixedSummary = fixedSummary;
      return;
    }
    byKey.set(key, { key, claim, count, texts: [...texts], fixedSummary });
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
    const count = tier === "single_safety" ? 1 : 2;
    add(key, claim || key, count, [], text);
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
  const title = depth?.title ?? sentenceCaseTheme(s.claim);
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
    return { title, summary: renderFrame(template, { detail }), basis, band, severity };
  }

  // One-off family: a single honest sentence.
  if (band === "single") {
    const template = pickFrame(ONE_OFF_LEADS, `${ctx.tallySig}|oneoff|${s.side}|${s.key}`, ctx.used);
    return { title, summary: `${renderFrame(template, { theme: lower })}.`, basis, band, severity };
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
  const lead = pickFrame(leadFamily, `${ctx.tallySig}|lead|${s.side}|${s.rank}|${s.key}`, ctx.used);

  // Specifics: only mined sub-aspects, woven in. Thin corpora skip this.
  let specifics = "";
  if (!ctx.thin && s.aspectHitIds.length > 0) {
    const phrases = s.aspectHitIds
      .map((id) => aspectPhrase(s.key, id, s.side, ctx.tallySig))
      .filter((p): p is string => Boolean(p));
    if (phrases.length > 0) specifics = `they ${joinList(phrases)}`;
  }
  let pairClause = "";
  if (!ctx.thin && s.side === "for" && s.rank === 0 && ctx.coPairForKey === s.key && ctx.coPairNoun && depth?.pairNoun) {
    const template = pickFrame(CO_PAIR_BRIDGES, `${ctx.tallySig}|copair|${s.key}`, ctx.used);
    pairClause = renderFrame(template, { a: depth.pairNoun, b: ctx.coPairNoun });
  }
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
  // unanimity. Threshold >= 1 (hard rule: never hide a negative signal).
  if (s.opposingCount >= 1) {
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
    map.set(key, { claim, count, sourceIds: [...sourceIds], sourceHashes: [...sourceHashes], extraTexts: [], fixedSummary: null });
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
    } else {
      againstAgg.set(key, {
        claim: m.claim || m.key,
        count: m.count,
        sourceIds: [],
        sourceHashes: [],
        extraTexts: [...m.texts],
        fixedSummary: m.fixedSummary,
      });
    }
  }

  // Hard rule: any negative signal anywhere?
  const hadNegatives = answer.complaints.some((p) => normalizeThemeKey(p.claim)) || mined.length > 0;

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
      suppressedThemes.push(depth?.title ?? sentenceCaseTheme(winner.claim));
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
    const depth = depthFor(key);
    signals.push({
      key,
      claim: cleanThemeLabel(winner.claim),
      count: side === "for" ? forCount : againstCount,
      opposingCount,
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
