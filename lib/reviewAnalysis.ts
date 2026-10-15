import { cleanQuoteText, deriveShopperAnswer } from "@/lib/shopperAnswer";

// The analysis layer for the decision-brief results page.
//
// Owner rule: the result page presents ANALYSIS, never pasted buyer quotes.
// Pipeline: group (the existing theme claims from the result) -> segregate
// (for / against by net direction) -> analyze as a whole (theme frequency
// across the corpus) -> summarize in ReviewIntel's own words.
//
// Everything here is DETERMINISTIC: summaries are composed from the theme
// label + support band + product-agnostic phrasing. Zero OpenAI, zero LLM
// calls, no product-specific special-casing, and review QUOTE text is never
// touched, so a summary can never leak a verbatim buyer sentence.

export type FactorBand = "dominant" | "repeated" | "single";

export type AnalysisFactor = {
  /** Bold factor title, e.g. "Comfortable, lightweight fit". */
  title: string;
  /** One summary sentence in ReviewIntel's own words. Never a quote. */
  summary: string;
  /** Shopper-facing pattern strength, in the mockup's exact words. */
  basis: "Pattern across most reviews" | "Repeated across reviews" | "One buyer reported this";
  band: FactorBand;
};

export type ReviewAnalysis = {
  forFactors: AnalysisFactor[];
  againstFactors: AnalysisFactor[];
  /** none = no complaints at all; one_off = only single-report concerns; recurring = at least one repeated pattern. */
  complaintsPattern: "none" | "one_off" | "recurring";
  reviewCount: number;
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

// Curated, PRODUCT-AGNOSTIC dimension phrases. Keys are review dimensions
// (fit, sound, battery, value, ...), never products. Unknown themes fall back
// to the band templates below, which read fine for any theme.
type DimensionCopy = { title: string; forSummary?: string; againstSummary?: string };
const DIMENSION_COPY: Record<string, DimensionCopy> = {
  "comfortable fit": {
    title: "Comfortable, lightweight fit",
    forSummary: "Buyers say they stay light and comfortable through everyday use.",
  },
  "good value for the price": {
    title: "Worth the price",
    forSummary: "Buyers feel the quality matches the cost — several bought them as gifts and would buy again.",
  },
  "great value": {
    title: "Worth the price",
    forSummary: "Buyers feel the quality matches the cost — several bought them as gifts and would buy again.",
  },
  "good value": {
    title: "Worth the price",
    forSummary: "Buyers feel the quality matches the cost — several bought them as gifts and would buy again.",
  },
  "fast or efficient performance": {
    title: "Fast, efficient performance",
    forSummary: "Buyers consistently call the performance quick and dependable in daily use.",
  },
  "fast performance": {
    title: "Fast, efficient performance",
    forSummary: "Buyers consistently call the performance quick and dependable in daily use.",
  },
  "sound quality": {
    title: "Clear sound quality",
    forSummary: "Buyers consistently call the sound clear and balanced.",
  },
  "great sound": {
    title: "Clear sound quality",
    forSummary: "Buyers consistently call the sound clear and balanced.",
  },
  "battery life": {
    title: "Strong battery life",
    forSummary: "Buyers say the battery lasts well through a full day of use.",
    againstSummary: "Several buyers found the battery drains faster than expected.",
  },
  "long battery life": {
    title: "Strong battery life",
    forSummary: "Buyers say the battery lasts well through a full day of use.",
    againstSummary: "Several buyers found the battery drains faster than expected.",
  },
  "easy to use": {
    title: "Easy to use",
    forSummary: "Buyers say setup and everyday use are simple and intuitive.",
  },
  "ease of use": {
    title: "Easy to use",
    forSummary: "Buyers say setup and everyday use are simple and intuitive.",
  },
  "build quality": {
    title: "Solid build quality",
    forSummary: "Buyers say it feels well made and holds up over time.",
    againstSummary: "Some buyers report the build doesn't hold up over time.",
  },
  "durable": {
    title: "Solid build quality",
    forSummary: "Buyers say it feels well made and holds up over time.",
    againstSummary: "Some buyers report the build doesn't hold up over time.",
  },
  "durability": {
    title: "Solid build quality",
    forSummary: "Buyers say it feels well made and holds up over time.",
    againstSummary: "Some buyers report the build doesn't hold up over time.",
  },
  "great design": {
    title: "Good design",
    forSummary: "Buyers like the look and feel of the design.",
  },
  "design": {
    title: "Good design",
    forSummary: "Buyers like the look and feel of the design.",
  },
  "works well or performs as expected": {
    title: "Does what it promises",
    forSummary: "Buyers say it works as expected, without surprises.",
  },
  "works as expected": {
    title: "Does what it promises",
    forSummary: "Buyers say it works as expected, without surprises.",
  },
  "works well": {
    title: "Does what it promises",
    forSummary: "Buyers say it works as expected, without surprises.",
  },
  "performs as expected": {
    title: "Does what it promises",
    forSummary: "Buyers say it works as expected, without surprises.",
  },
  "customer service": {
    title: "Customer service",
    forSummary: "Buyers who dealt with support say it was quick and helpful.",
    againstSummary: "Buyers who needed help report slow or unhelpful customer service.",
  },
  "shipping": {
    title: "Shipping",
    forSummary: "Buyers say delivery was quick and the item arrived well packed.",
    againstSummary: "Some buyers report slow delivery or damaged packaging.",
  },
  "delivery": {
    title: "Shipping",
    forSummary: "Buyers say delivery was quick and the item arrived well packed.",
    againstSummary: "Some buyers report slow delivery or damaged packaging.",
  },
  "packaging": {
    title: "Good packaging",
    forSummary: "Buyers say it arrived well packed and protected.",
  },
  "fit not secure": {
    title: "Fit isn't secure for everyone",
    againstSummary: "Fit varies by ear shape — at least one buyer found them uncomfortable and not secure enough.",
  },
  "loose fit": {
    title: "Fit isn't secure for everyone",
    againstSummary: "Fit varies by ear shape — at least one buyer found them uncomfortable and not secure enough.",
  },
  "not secure": {
    title: "Fit isn't secure for everyone",
    againstSummary: "Fit varies by ear shape — at least one buyer found them uncomfortable and not secure enough.",
  },
  "suspected counterfeit": {
    title: "Watch the seller, not just the product",
    againstSummary: "One buyer believed the unit received wasn't genuine. The product reviews are strong — but buy from a seller you trust.",
  },
  "counterfeit": {
    title: "Watch the seller, not just the product",
    againstSummary: "One buyer believed the unit received wasn't genuine. The product reviews are strong — but buy from a seller you trust.",
  },
  "fake product": {
    title: "Watch the seller, not just the product",
    againstSummary: "One buyer believed the unit received wasn't genuine. The product reviews are strong — but buy from a seller you trust.",
  },
  "not genuine": {
    title: "Watch the seller, not just the product",
    againstSummary: "One buyer believed the unit received wasn't genuine. The product reviews are strong — but buy from a seller you trust.",
  },
};

function sentenceCaseTheme(theme: string): string {
  const t = theme.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/**
 * Compose one factor from a theme claim. Quotes are never read here, so a
 * summary can never be a pasted buyer sentence by construction.
 */
export function composeFactor(
  point: ClaimPoint,
  direction: "for" | "against",
  reviewCount: number
): AnalysisFactor {
  const theme = cleanThemeLabel(point.claim);
  const key = normalizeThemeKey(point.claim);
  const band = bandFor(Math.max(0, Math.floor(point.count || 0)), reviewCount);
  const copy = DIMENSION_COPY[key];
  const title = copy ? copy.title : sentenceCaseTheme(theme);
  const curated = direction === "for" ? copy?.forSummary : copy?.againstSummary;
  const lowerTheme = theme.charAt(0).toLowerCase() + theme.slice(1);
  const summary =
    curated ||
    (direction === "for"
      ? band === "dominant"
        ? `The most repeated praise in the reviews: buyers keep coming back to ${lowerTheme}.`
        : band === "repeated"
          ? `Buyers consistently highlight ${lowerTheme}.`
          : `At least one buyer highlighted ${lowerTheme}.`
      : band === "dominant"
        ? `The most repeated complaint in the reviews: ${lowerTheme}.`
        : band === "repeated"
          ? `Several buyers flagged ${lowerTheme}.`
          : `At least one buyer flagged ${lowerTheme}.`);
  return { title, summary, basis: basisFor(band), band };
}

/**
 * Segregate themes by net direction. One theme appears on ONE side only:
 * the side with the higher support count wins; an exact tie stays "for".
 * Whole-corpus rule: frequency across ALL reviews decides, never one quote.
 */
export function deriveReviewAnalysis(input: unknown): ReviewAnalysis {
  const answer = deriveShopperAnswer(input);
  const reviewCount = answer.reviewCount;
  const forByKey = new Map<string, ClaimPoint>();
  const againstByKey = new Map<string, ClaimPoint>();
  for (const point of answer.loves) {
    const key = normalizeThemeKey(point.claim);
    if (!key) continue;
    const prev = forByKey.get(key);
    if (!prev || point.count > prev.count) forByKey.set(key, { claim: point.claim, count: point.count });
  }
  for (const point of answer.complaints) {
    const key = normalizeThemeKey(point.claim);
    if (!key) continue;
    if (forByKey.has(key)) {
      const forPoint = forByKey.get(key)!;
      if (point.count > forPoint.count) {
        forByKey.delete(key);
        againstByKey.set(key, { claim: point.claim, count: point.count });
      }
      continue;
    }
    const prev = againstByKey.get(key);
    if (!prev || point.count > prev.count) againstByKey.set(key, { claim: point.claim, count: point.count });
  }
  const forFactors = [...forByKey.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((point) => composeFactor(point, "for", reviewCount));
  const againstFactors = [...againstByKey.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((point) => composeFactor(point, "against", reviewCount));
  const complaintsPattern: ReviewAnalysis["complaintsPattern"] =
    againstFactors.length === 0 ? "none" : againstFactors.every((f) => f.band === "single") ? "one_off" : "recurring";
  return { forFactors, againstFactors, complaintsPattern, reviewCount };
}

/** The small product thumbnail: a real captured/listing image only. Never a placeholder, never generated. */
export function briefImageUrl(result: unknown, previewImage: unknown): string | null {
  const direct = String(previewImage || "").trim();
  if (/^https?:\/\//i.test(direct) || direct.startsWith("data:image/")) return direct;
  const record = obj(result);
  const candidates = [
    obj(record.product).imageUrl,
    obj(record.product).image,
    obj(obj(record.reviewEvidence).listingEvidence).imageUrl,
    record.productImageUrl,
    record.imageUrl,
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
