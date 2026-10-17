/**
 * TRANSLATOR bot — brief dictionary resolver (2026-10-16, bot round).
 *
 * Junel's design: the bot finds every customer-facing string the scan
 * renders, and when a shopper toggles a language the brief renders through
 * the messages dictionaries. Server-safe, zero LLM, fully deterministic.
 *
 * Fallback law: per-string English fallback. A missing or empty translation
 * NEVER renders a raw dictionary key and NEVER renders a blank — English
 * wins, every slot, every locale.
 *
 * Source-language honesty: product names, numbers, star ratings, prices,
 * store names, and buyer-mined review vocabulary stay byte-exact in their
 * source language; only the RI frames/templates around them translate.
 */
import { normalizeLocale, type ReviewIntelLocale } from "@/lib/i18n";
import {
  AUTH_HIGH_BASE,
  AUTH_HONESTY,
  AUTH_LOW,
  AUTH_MODERATE_BASE,
  AUTH_SIGNAL_CLAUSES,
  pickFrame,
} from "@/lib/analysisCopy";
import type { AiPatternProfile } from "@/lib/aiPatternForensics";
import { sanitizeVerdictWord } from "@/lib/shopperVerdictWord";

import enMessages from "../messages/en.json";
import frMessages from "../messages/fr.json";
import esMessages from "../messages/es.json";
import deMessages from "../messages/de.json";
import hiMessages from "../messages/hi.json";
import zhMessages from "../messages/zh.json";

export type BriefVerdictDict = {
  buy: string;
  wait: string;
  skip: string;
  lowConfidence: string;
  tryAgain: string;
  leaningBuy: string;
  leaningSkip: string;
};
export type BriefFactTerms = {
  marketplaceRating: string;
  ratingsCounted: string;
  howSureWeAre: string;
  valueForMoney: string;
  reviewAuthenticity: string;
};
export type BriefConfidenceWords = { high: string; medium: string; low: string; unknown: string };
export type BriefValueWords = { good: string; fair: string; poor: string };
export type BriefDepthWords = { few: string; solid: string; deep: string };
export type BriefAuthRows = { low: string; moderate: string; high: string };
export type BriefComplaintNotes = { oneOff: string; repeated: string; isolated: string; none: string };
export type BriefStep = { label: string; detail: string };
export type BriefAnswerDict = {
  neutralBuy: string;
  neutralSkip: string;
  neutralWait: string;
  whyBuyBase: string;
  whyBuyDefaultLove: string;
  whyBuyComplaintTail: string;
  whySkipBase: string;
  whySkipDefaultComplaint: string;
  whySkipLoveTail: string;
  whyWaitBase: string;
  whyWaitDefaultLove: string;
  whyWaitComplaintTail: string;
  whyWaitCloser: string;
  whyNotEnoughListing: string;
  whyNotEnoughNoListing: string;
  trustBasedOn: string;
  trustLow: string;
  trustUnreadable: string;
  retryFree: string;
  retryLater: string;
  unreadableAmazon: string;
  unreadableListing: string;
  neutralProduct: string;
  evidenceStrength: { strong: string; moderate: string; low: string };
  steps: {
    retry: BriefStep;
    screenshots: BriefStep;
    amazonListing: BriefStep;
    reviewScreenshot: BriefStep;
    compare: BriefStep;
  };
};
export type BriefDict = {
  shouldYouBuy: string;
  buyingScore: string;
  verdict: BriefVerdictDict;
  factTerms: BriefFactTerms;
  confidence: BriefConfidenceWords;
  value: BriefValueWords;
  depth: BriefDepthWords;
  basisFrames: string[];
  basisParts: { marketplaceRating: string; writtenReviews: string };
  limitsFrames: string[];
  authRows: BriefAuthRows;
  authLow: string[];
  authModerateBase: string[];
  authHighBase: string[];
  signalClauses: Record<string, string>;
  honestyFrames: string[];
  scoreFeedsLine: string;
  independenceLine: string;
  whyBuyIt: string;
  whyMightNot: string;
  /** Honest note when the verdict leans on the rating summary because no
      written reviews could be read — never a bare heading over nothing. */
  whyBuyEmpty: string;
  /** Honest note when written reviews exist but yielded no stand-behind strengths. */
  whyBuyThin: string;
  /** Iteration 4: wait-line section heading (Wait verdicts only). */
  whyWait: string;
  howWeChecked: string;
  footerLine: string;
  complaintNotes: BriefComplaintNotes;
  answer: BriefAnswerDict;
};

const RAW: Record<ReviewIntelLocale, unknown> = {
  en: (enMessages as { Brief?: unknown }).Brief,
  fr: (frMessages as { Brief?: unknown }).Brief,
  es: (esMessages as { Brief?: unknown }).Brief,
  de: (deMessages as { Brief?: unknown }).Brief,
  hi: (hiMessages as { Brief?: unknown }).Brief,
  zh: (zhMessages as { Brief?: unknown }).Brief,
};

const EN = RAW.en as BriefDict;

type Rec = Record<string, unknown>;
const asRec = (value: unknown): Rec =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};

function pickString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function pickFrames(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback.slice();
  return fallback.map((frame, index) => pickString(value[index], frame));
}

function pickStep(value: unknown, fallback: BriefStep): BriefStep {
  const rec = asRec(value);
  return { label: pickString(rec.label, fallback.label), detail: pickString(rec.detail, fallback.detail) };
}

/**
 * Resolve the full brief dictionary for a locale, per-string English
 * fallback. Pure and deterministic — safe to call at render time.
 */
export function resolveBriefDict(locale: string | undefined): BriefDict {
  const safe = normalizeLocale(locale);
  if (safe === "en") return EN;
  const rec = asRec(RAW[safe]);
  const verdict = asRec(rec.verdict);
  const factTerms = asRec(rec.factTerms);
  const confidence = asRec(rec.confidence);
  const value = asRec(rec.value);
  const depth = asRec(rec.depth);
  const basisParts = asRec(rec.basisParts);
  const authRows = asRec(rec.authRows);
  const signalClauses = asRec(rec.signalClauses);
  const complaintNotes = asRec(rec.complaintNotes);
  const answer = asRec(rec.answer);
  const answerSteps = asRec(answer.steps);
  const evidenceStrength = asRec(answer.evidenceStrength);
  const enAnswer = EN.answer;
  return {
    shouldYouBuy: pickString(rec.shouldYouBuy, EN.shouldYouBuy),
    buyingScore: pickString(rec.buyingScore, EN.buyingScore),
    verdict: {
      buy: pickString(verdict.buy, EN.verdict.buy),
      wait: pickString(verdict.wait, EN.verdict.wait),
      skip: pickString(verdict.skip, EN.verdict.skip),
      lowConfidence: pickString(verdict.lowConfidence, EN.verdict.lowConfidence),
      tryAgain: pickString(verdict.tryAgain, EN.verdict.tryAgain),
      leaningBuy: pickString(verdict.leaningBuy, EN.verdict.leaningBuy),
      leaningSkip: pickString(verdict.leaningSkip, EN.verdict.leaningSkip),
    },
    factTerms: {
      marketplaceRating: pickString(factTerms.marketplaceRating, EN.factTerms.marketplaceRating),
      ratingsCounted: pickString(factTerms.ratingsCounted, EN.factTerms.ratingsCounted),
      howSureWeAre: pickString(factTerms.howSureWeAre, EN.factTerms.howSureWeAre),
      valueForMoney: pickString(factTerms.valueForMoney, EN.factTerms.valueForMoney),
      reviewAuthenticity: pickString(factTerms.reviewAuthenticity, EN.factTerms.reviewAuthenticity),
    },
    confidence: {
      high: pickString(confidence.high, EN.confidence.high),
      medium: pickString(confidence.medium, EN.confidence.medium),
      low: pickString(confidence.low, EN.confidence.low),
      unknown: pickString(confidence.unknown, EN.confidence.unknown),
    },
    value: {
      good: pickString(value.good, EN.value.good),
      fair: pickString(value.fair, EN.value.fair),
      poor: pickString(value.poor, EN.value.poor),
    },
    depth: {
      few: pickString(depth.few, EN.depth.few),
      solid: pickString(depth.solid, EN.depth.solid),
      deep: pickString(depth.deep, EN.depth.deep),
    },
    basisFrames: pickFrames(rec.basisFrames, EN.basisFrames),
    basisParts: {
      marketplaceRating: pickString(basisParts.marketplaceRating, EN.basisParts.marketplaceRating),
      writtenReviews: pickString(basisParts.writtenReviews, EN.basisParts.writtenReviews),
    },
    limitsFrames: pickFrames(rec.limitsFrames, EN.limitsFrames),
    authRows: {
      low: pickString(authRows.low, EN.authRows.low),
      moderate: pickString(authRows.moderate, EN.authRows.moderate),
      high: pickString(authRows.high, EN.authRows.high),
    },
    authLow: pickFrames(rec.authLow, EN.authLow),
    authModerateBase: pickFrames(rec.authModerateBase, EN.authModerateBase),
    authHighBase: pickFrames(rec.authHighBase, EN.authHighBase),
    signalClauses: Object.fromEntries(
      Object.keys(EN.signalClauses).map((key) => [key, pickString(signalClauses[key], EN.signalClauses[key])])
    ),
    honestyFrames: pickFrames(rec.honestyFrames, EN.honestyFrames),
    scoreFeedsLine: pickString(rec.scoreFeedsLine, EN.scoreFeedsLine),
    independenceLine: pickString(rec.independenceLine, EN.independenceLine),
    whyBuyIt: pickString(rec.whyBuyIt, EN.whyBuyIt),
    whyMightNot: pickString(rec.whyMightNot, EN.whyMightNot),
    whyBuyEmpty: pickString(rec.whyBuyEmpty, EN.whyBuyEmpty),
    whyBuyThin: pickString(rec.whyBuyThin, EN.whyBuyThin),
    whyWait: pickString(rec.whyWait, EN.whyWait),
    howWeChecked: pickString(rec.howWeChecked, EN.howWeChecked),
    footerLine: pickString(rec.footerLine, EN.footerLine),
    complaintNotes: {
      oneOff: pickString(complaintNotes.oneOff, EN.complaintNotes.oneOff),
      repeated: pickString(complaintNotes.repeated, EN.complaintNotes.repeated),
      isolated: pickString(complaintNotes.isolated, EN.complaintNotes.isolated),
      none: pickString(complaintNotes.none, EN.complaintNotes.none),
    },
    answer: {
      neutralBuy: pickString(answer.neutralBuy, enAnswer.neutralBuy),
      neutralSkip: pickString(answer.neutralSkip, enAnswer.neutralSkip),
      neutralWait: pickString(answer.neutralWait, enAnswer.neutralWait),
      whyBuyBase: pickString(answer.whyBuyBase, enAnswer.whyBuyBase),
      whyBuyDefaultLove: pickString(answer.whyBuyDefaultLove, enAnswer.whyBuyDefaultLove),
      whyBuyComplaintTail: pickString(answer.whyBuyComplaintTail, enAnswer.whyBuyComplaintTail),
      whySkipBase: pickString(answer.whySkipBase, enAnswer.whySkipBase),
      whySkipDefaultComplaint: pickString(answer.whySkipDefaultComplaint, enAnswer.whySkipDefaultComplaint),
      whySkipLoveTail: pickString(answer.whySkipLoveTail, enAnswer.whySkipLoveTail),
      whyWaitBase: pickString(answer.whyWaitBase, enAnswer.whyWaitBase),
      whyWaitDefaultLove: pickString(answer.whyWaitDefaultLove, enAnswer.whyWaitDefaultLove),
      whyWaitComplaintTail: pickString(answer.whyWaitComplaintTail, enAnswer.whyWaitComplaintTail),
      whyWaitCloser: pickString(answer.whyWaitCloser, enAnswer.whyWaitCloser),
      whyNotEnoughListing: pickString(answer.whyNotEnoughListing, enAnswer.whyNotEnoughListing),
      whyNotEnoughNoListing: pickString(answer.whyNotEnoughNoListing, enAnswer.whyNotEnoughNoListing),
      trustBasedOn: pickString(answer.trustBasedOn, enAnswer.trustBasedOn),
      trustLow: pickString(answer.trustLow, enAnswer.trustLow),
      trustUnreadable: pickString(answer.trustUnreadable, enAnswer.trustUnreadable),
      retryFree: pickString(answer.retryFree, enAnswer.retryFree),
      retryLater: pickString(answer.retryLater, enAnswer.retryLater),
      unreadableAmazon: pickString(answer.unreadableAmazon, enAnswer.unreadableAmazon),
      unreadableListing: pickString(answer.unreadableListing, enAnswer.unreadableListing),
      neutralProduct: pickString(answer.neutralProduct, enAnswer.neutralProduct),
      evidenceStrength: {
        strong: pickString(evidenceStrength.strong, enAnswer.evidenceStrength.strong),
        moderate: pickString(evidenceStrength.moderate, enAnswer.evidenceStrength.moderate),
        low: pickString(evidenceStrength.low, enAnswer.evidenceStrength.low),
      },
      steps: {
        retry: pickStep(answerSteps.retry, enAnswer.steps.retry),
        screenshots: pickStep(answerSteps.screenshots, enAnswer.steps.screenshots),
        amazonListing: pickStep(answerSteps.amazonListing, enAnswer.steps.amazonListing),
        reviewScreenshot: pickStep(answerSteps.reviewScreenshot, enAnswer.steps.reviewScreenshot),
        compare: pickStep(answerSteps.compare, enAnswer.steps.compare),
      },
    },
  };
}

/** Fill {placeholders} in a frame. Values are inserted verbatim (byte-exact). */
export function fillFrame(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

/**
 * Translate a picked English frame to the locale's frame at the SAME index.
 * Frame choice stays deterministic (the seed picks the English frame; the
 * locale mirrors it), so fr/es/de/hi/zh renders the same "page" as en.
 */
export function frameAtIndex(localeFrames: string[], enFrames: string[], enTemplate: string): string {
  const index = enFrames.indexOf(enTemplate);
  if (index < 0) return enTemplate;
  const translated = localeFrames[index];
  return translated && translated.trim() ? translated : enTemplate;
}

/** Locale-aware list joiner for signal clauses and basis parts. */
export function joinLocalized(locale: string | undefined, items: string[]): string {
  const safe = normalizeLocale(locale);
  if (items.length <= 1) return items.join("");
  if (items.length === 2) {
    if (safe === "fr") return `${items[0]} et ${items[1]}`;
    if (safe === "es") return `${items[0]} y ${items[1]}`;
    if (safe === "de") return `${items[0]} und ${items[1]}`;
    if (safe === "hi") return `${items[0]} \u0914\u0930 ${items[1]}`;
    if (safe === "zh") return `${items[0]}\u548c${items[1]}`;
    return `${items[0]} and ${items[1]}`;
  }
  if (safe === "zh") return `${items.slice(0, -1).join("\u3001")}\u548c${items[items.length - 1]}`;
  const tail = safe === "fr" ? "et" : safe === "es" ? "y" : safe === "de" ? "und" : safe === "hi" ? "\u0914\u0930" : "and";
  return `${items.slice(0, -1).join(", ")}, ${tail} ${items[items.length - 1]}`;
}

/**
 * The shopper-facing verdict word, localized. Any stored/legacy/internal
 * value passes through the sanitize guard FIRST, so the page can only ever
 * display Buy / Wait / Skip (in the shopper's language).
 */
export function localizedVerdictWord(locale: string | undefined, value: unknown): string {
  const word = sanitizeVerdictWord(value);
  const copy = resolveBriefDict(locale);
  return word === "Buy" ? copy.verdict.buy : word === "Skip" ? copy.verdict.skip : copy.verdict.wait;
}

/** Localized fact-row term by stable key (the display string is the value). */
export function factRowTerm(
  locale: string | undefined,
  key: keyof BriefFactTerms
): string {
  return resolveBriefDict(locale).factTerms[key];
}

export function confidenceWord(locale: string | undefined, word: "High" | "Medium" | "Low" | "Unknown"): string {
  const copy = resolveBriefDict(locale).confidence;
  return word === "High" ? copy.high : word === "Medium" ? copy.medium : word === "Low" ? copy.low : copy.unknown;
}

export function valueWord(locale: string | undefined, word: "Good" | "Fair" | "Poor"): string {
  const copy = resolveBriefDict(locale).value;
  return word === "Good" ? copy.good : word === "Fair" ? copy.fair : copy.poor;
}

export function depthWord(locale: string | undefined, depth: "a few" | "a solid set of" | "a deep set of"): string {
  const copy = resolveBriefDict(locale).depth;
  return depth === "a few" ? copy.few : depth === "a solid set of" ? copy.solid : copy.deep;
}

export function authRowWord(locale: string | undefined, grade: "low" | "moderate" | "high"): string {
  const copy = resolveBriefDict(locale).authRows;
  return grade === "low" ? copy.low : grade === "moderate" ? copy.moderate : copy.high;
}

/**
 * The How-we-checked authenticity sentence, localized. Mirrors
 * authSentenceFor's deterministic frame pick (same seed over the EN frames),
 * then takes the locale frame at the same index and fills {signals} with
 * the locale's signal clauses. Null when the corpus is too small to judge.
 */
export function authSentenceLocalized(profile: AiPatternProfile, locale: string | undefined): string | null {
  if (profile.insufficient || !profile.grade) return null;
  const copy = resolveBriefDict(locale);
  const seedBase = `auth|${profile.grade}|${profile.reviewCount}|${profile.features
    .map((f) => `${f.key}${f.points}`)
    .join(",")}`;
  if (profile.grade === "low") {
    // Same seed and same EN frame source as authSentenceFor, so the locale
    // mirrors the English pick exactly.
    const picked = pickFrame(AUTH_LOW, `${seedBase}|low`, new Set());
    return frameAtIndex(copy.authLow, AUTH_LOW, picked);
  }
  const enFrames = profile.grade === "high" ? AUTH_HIGH_BASE : AUTH_MODERATE_BASE;
  const localeFrames = profile.grade === "high" ? copy.authHighBase : copy.authModerateBase;
  const picked = pickFrame(enFrames, `${seedBase}|sent`, new Set());
  const localized = frameAtIndex(localeFrames, enFrames, picked);
  // If the frame itself fell back to English, the signal clauses and the
  // joiner stay English too — a half-translated sentence is worse than an
  // honest English one (untranslated-by-design).
  const fellBack = localized === picked;
  const clauseSource = fellBack ? AUTH_SIGNAL_CLAUSES : copy.signalClauses;
  const fired = profile.features
    .filter((f) => f.points > 0)
    .map((f) => clauseSource[f.key] || AUTH_SIGNAL_CLAUSES[f.key] || f.key);
  const signals = joinLocalized(fellBack ? "en" : locale, fired.length ? fired : ["show a mild pattern"]);
  return fillFrame(localized, { signals });
}

/** Localized honesty note (pattern check only). Null when the corpus is too small. */
export function authHonestyLocalized(profile: AiPatternProfile, locale: string | undefined): string | null {
  if (profile.insufficient || !profile.grade) return null;
  const copy = resolveBriefDict(locale);
  const picked = pickFrame(AUTH_HONESTY, `auth|honesty|${profile.grade}|${profile.reviewCount}`, new Set());
  return frameAtIndex(copy.honestyFrames, AUTH_HONESTY, picked);
}
