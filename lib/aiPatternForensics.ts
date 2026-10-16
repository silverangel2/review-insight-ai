// ============================================================================
// ReviewIntel AI-pattern forensics (2026-10-15, Phase 10).
//
// Deterministic corpus forensics over the accepted written reviews. Zero LLM,
// No model calls. Five measurable features:
//
//   1. repetition   — near-duplicate phrasing across different reviews
//                     (normalized trigram overlap between review pairs)
//   2. template     — reviews sharing the same opener shape (template skeletons)
//   3. specificity  — share of reviews with ZERO concrete sub-aspect hits
//                     (generic praise with no specifics is an AI/fake marker;
//                      aspects come from the Phase 9 dimension map)
//   4. uniformity   — unnatural sentiment clustering (nearly every review
//                     extreme-praise with no spread)
//   5. lexical      — type-token ratio (unusually low vocabulary richness)
//
// Each feature scores 0-2 points by strength; total 0-1 -> Low, 2-4 ->
// Moderate, 5+ -> High AI-like pattern. Every grade is explainable from its
// features (each records what fired and how strongly).
//
// HONESTY RULES:
//   - The grade describes PATTERNS IN TEXT ("AI-like signs/pattern"). It never
//     accuses a named reviewer of anything.
//   - Display/analysis ONLY. It does not touch the Buying Score, the verdict,
//     or confidence. (The pre-existing engine's fakeReviewRisk DOES feed score
//     math — see README "what existed vs what was added". That math is
//     untouched by this module.)
//   - Corpora under 4 reviews grade as insufficient-data, never faked.
// ============================================================================

import { acceptedRecords, cleanQuoteText, isWrittenReviewBody } from "@/lib/shopperAnswer";
import {
  DIMENSION_DEPTH,
  hashSignature,
  pickFrame,
  AUTH_LOW,
  AUTH_MODERATE_BASE,
  AUTH_HIGH_BASE,
  AUTH_HONESTY,
  AUTH_SIGNAL_CLAUSES,
} from "@/lib/analysisCopy";

export type AiPatternGrade = "low" | "moderate" | "high";
/** Corpus size below which the specificity feature cannot fire (2026-10-16). */
export const MIN_CORPUS_FOR_SPECIFICITY = 8;

export type AiFeatureKey = "repetition" | "template" | "specificity" | "uniformity" | "lexical";

export type AiFeature = {
  key: AiFeatureKey;
  /** 0 = not fired, 1 = fired, 2 = fired strongly. */
  points: 0 | 1 | 2;
  /** Plain-words explanation of what was measured. */
  detail: string;
};

export type AiPatternProfile = {
  reviewCount: number;
  /** True when the corpus is too small to grade honestly (< 4 reviews). */
  insufficient: boolean;
  grade: AiPatternGrade | null;
  points: number;
  features: AiFeature[];
};

type Rec = Record<string, unknown>;
const obj = (value: unknown): Rec =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};

function wordsOf(text: string): string[] {
  return cleanQuoteText(text)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function trigrams(words: string[]): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i + 2 < words.length; i++) set.add(words.slice(i, i + 3).join(" "));
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** All concrete-aspect keywords from the Phase 9 dimension map. */
let aspectWordsCache: string[] | null = null;
function aspectWords(): string[] {
  if (!aspectWordsCache) {
    const out = new Set<string>();
    for (const depth of Object.values(DIMENSION_DEPTH)) {
      for (const aspect of [...(depth.aspects ?? []), ...(depth.againstAspects ?? [])]) {
        for (const w of aspect.words) out.add(w.toLowerCase());
      }
    }
    aspectWordsCache = [...out];
  }
  return aspectWordsCache;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function hitsSpecific(text: string): boolean {
  const t = ` ${text.toLowerCase()} `;
  return aspectWords().some((w) => new RegExp(`\\b${escapeRegExp(w)}\\b`).test(t));
}

const POS_WORDS = [
  "love", "loves", "loved", "amazing", "excellent", "perfect", "great", "awesome",
  "fantastic", "wonderful", "best", "recommend", "happy", "pleased", "impressed",
  "outstanding", "superb", "brilliant", "incredible",
];
const NEG_WORDS = [
  "hate", "terrible", "awful", "worst", "broken", "defective", "disappointed",
  "disappointing", "poor", "bad", "waste", "horrible", "useless", "uncomfortable",
];

function extremePraiseShare(texts: string[]): number {
  if (!texts.length) return 0;
  let extreme = 0;
  for (const text of texts) {
    const t = ` ${text.toLowerCase()} `;
    let pos = 0;
    for (const w of POS_WORDS) if (new RegExp(`\\b${escapeRegExp(w)}\\b`).test(t)) pos++;
    let neg = 0;
    for (const w of NEG_WORDS) if (new RegExp(`\\b${escapeRegExp(w)}\\b`).test(t)) neg++;
    if (pos - neg >= 3) extreme++;
  }
  return extreme / texts.length;
}

function lexicalDiversity(texts: string[]): number {
  const all: string[] = [];
  for (const text of texts) {
    for (const w of wordsOf(text)) if (/^[a-z]{3,}$/.test(w)) all.push(w);
  }
  if (!all.length) return 1;
  return new Set(all).size / all.length;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function analyzeAiPatterns(input: unknown): AiPatternProfile {
  const records = acceptedRecords(obj(input));
  const texts = records
    .map((r) => cleanQuoteText(String(r.body || "")))
    .filter((t) => isWrittenReviewBody(t));
  const n = texts.length;

  if (n < 4) {
    return { reviewCount: n, insufficient: true, grade: null, points: 0, features: [] };
  }

  const features: AiFeature[] = [];

  // 1. Repetition: near-duplicate phrasing across different reviews.
  const triSets = texts.map((t) => trigrams(wordsOf(t)));
  let dupPairs = 0;
  let maxJ = 0;
  let totalPairs = 0;
  for (let i = 0; i < triSets.length; i++) {
    for (let j = i + 1; j < triSets.length; j++) {
      totalPairs++;
      const sim = jaccard(triSets[i], triSets[j]);
      if (sim > maxJ) maxJ = sim;
      if (sim >= 0.5) dupPairs++;
    }
  }
  const dupShare = totalPairs ? dupPairs / totalPairs : 0;
  const repPoints: 0 | 1 | 2 = dupShare >= 0.3 || maxJ >= 0.8 ? 2 : dupShare >= 0.12 ? 1 : 0;
  features.push({
    key: "repetition",
    points: repPoints,
    detail:
      repPoints === 0
        ? "no meaningful phrasing overlap between reviews"
        : `${dupPairs} of ${totalPairs} review pairs share most of their phrasing`,
  });

  // 2. Template skeletons: same opener shape across reviews.
  const openers = texts.map((t) => wordsOf(t).slice(0, 5).join(" "));
  const openerGroups = new Map<string, number>();
  for (const o of openers) openerGroups.set(o, (openerGroups.get(o) ?? 0) + 1);
  const openerShare = Math.max(...openerGroups.values()) / n;
  const tmplPoints: 0 | 1 | 2 = openerShare >= 0.6 ? 2 : openerShare >= 0.4 ? 1 : 0;
  features.push({
    key: "template",
    points: tmplPoints,
    detail:
      tmplPoints === 0
        ? "reviews open in their own ways"
        : `${Math.round(openerShare * 100)}% of reviews open with the same phrasing`,
  });

  // 3. Specificity density: generic praise with no concrete detail.
  // Satisfaction-pass guard: the share of detail-less reviews is not a
  // stable signal on small corpora (a few short genuine reviews would all
  // count as "generic"), so the feature cannot fire below MIN_CORPUS.
  const generic = texts.filter((t) => !hitsSpecific(t)).length;
  const genericShare = generic / n;
  const specPoints: 0 | 1 | 2 =
    n < MIN_CORPUS_FOR_SPECIFICITY
      ? 0
      : genericShare >= 0.8
        ? 2
        : genericShare >= 0.55
          ? 1
          : 0;
  features.push({
    key: "specificity",
    points: specPoints,
    detail:
      n < MIN_CORPUS_FOR_SPECIFICITY
        ? "corpus too small to judge detail density"
        : specPoints === 0
          ? "reviews mention concrete details"
          : `${Math.round(genericShare * 100)}% of reviews mention no concrete detail`,
  });

  // 4. Sentiment uniformity: unnatural extreme-praise clustering.
  const uniformShare = extremePraiseShare(texts);
  const uniPoints: 0 | 1 | 2 =
    n >= 6 && uniformShare >= 0.95 ? 2 : n >= 6 && uniformShare >= 0.85 ? 1 : 0;
  features.push({
    key: "uniformity",
    points: uniPoints,
    detail:
      uniPoints === 0
        ? "enthusiasm varies naturally across reviews"
        : `${Math.round(uniformShare * 100)}% of reviews read as extreme praise`,
  });

  // 5. Lexical diversity: type-token ratio across the corpus.
  const ttr = lexicalDiversity(texts);
  const lexPoints: 0 | 1 | 2 = ttr < 0.32 ? 2 : ttr < 0.42 ? 1 : 0;
  features.push({
    key: "lexical",
    points: lexPoints,
    detail:
      lexPoints === 0
        ? `varied vocabulary (richness ${ttr.toFixed(2)})`
        : `unusually small vocabulary for ${n} reviews (richness ${ttr.toFixed(2)})`,
  });

  const points = features.reduce((sum, f) => sum + f.points, 0);
  const grade: AiPatternGrade = points >= 5 ? "high" : points >= 2 ? "moderate" : "low";
  return { reviewCount: n, insufficient: false, grade, points, features };
}

/** Answer-card fact-row value, in plain words. Never a bare internal metric. */
export function authRowFor(profile: AiPatternProfile): string {
  if (profile.insufficient || !profile.grade) return "—";
  if (profile.grade === "low") return "Few AI-like signs";
  if (profile.grade === "moderate") return "Some AI-like signs";
  return "Strong AI-like pattern";
}

/**
 * The How-we-checked analysis sentence. Names the fired signals in plain
 * words; deterministic per corpus. Null when the corpus is too small to
 * judge (no faked sentence).
 */
export function authSentenceFor(profile: AiPatternProfile): string | null {
  if (profile.insufficient || !profile.grade) return null;
  const seedBase = `auth|${profile.grade}|${profile.reviewCount}|${profile.features
    .map((f) => `${f.key}${f.points}`)
    .join(",")}`;
  if (profile.grade === "low") {
    return pickFrame(AUTH_LOW, `${seedBase}|low`, new Set());
  }
  const fired = profile.features.filter((f) => f.points > 0).map((f) => AUTH_SIGNAL_CLAUSES[f.key]);
  const signals = joinList(fired.length ? fired : ["show a mild pattern"]);
  const frames = profile.grade === "high" ? AUTH_HIGH_BASE : AUTH_MODERATE_BASE;
  const template = pickFrame(frames, `${seedBase}|sent`, new Set());
  return template.replace("{signals}", signals);
}

/** Plain honesty note for the How-we-checked fold: pattern check only, never an authorship verdict. Null when the corpus is too small to judge (no faked line). */
export function authHonestyLine(profile: AiPatternProfile): string | null {
  if (profile.insufficient || !profile.grade) return null;
  return pickFrame(AUTH_HONESTY, `auth|honesty|${profile.grade}|${profile.reviewCount}`, new Set());
}

/** Deterministic seed helper (exported for tests). */
export function authSeedFor(profile: AiPatternProfile): string {
  return `${hashSignature(
    `auth|${profile.grade}|${profile.reviewCount}|${profile.features.map((f) => `${f.key}${f.points}`).join(",")}`
  )}`;
}
