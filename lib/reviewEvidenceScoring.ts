export type ReviewEvidenceVerdict = "BUY" | "REVIEW FIRST" | "AVOID";

export type ReviewEvidenceScoreInput = {
  repeatedPraises?: unknown[];
  repeatedComplaints?: unknown[];
  productPros?: string[];
  productCons?: string[];
  buyerExperienceSignals?: string[];
  aiPatternSignals?: string[];
  commentsAnalyzed?: number;
  marketplaceReviewCount?: number;
  marketplaceRating?: unknown;
  evidenceStrength?: string;
};

export type ReviewEvidenceScoreResult = {
  buyScore: number;
  verdict: ReviewEvidenceVerdict;
  valueForMoney: string;
  positiveWeight: number;
  negativeWeight: number;
  seriousComplaintWeight: number;
  ratingScore: number | null;
  scoreBeforeRounding: number;
};

const seriousComplaintPattern =
  /broken|stopped|does not work|doesn't work|not working|defect|defective|unsafe|danger|fire|burn|leak|toxic|injury|refund|return denied|counterfeit|mold|explod/i;

const moderateComplaintPattern =
  /return|refund|late|delay|missing|poor quality|cheap|weak|scratch|crack|noise|smell|battery|fit|size|hard to use|difficult/i;

const strongPraisePattern =
  /excellent|reliable|durable|sturdy|love|perfect|high quality|great value|worth|easy|comfortable|fast|consistent|recommended/i;

const weakTextPattern = /packaging|box|color|style|preference|wish|minor|slight/i;

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").match(/\d+(\.\d+)?/)?.[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function textForSignal(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(
      record.theme ||
        record.summary ||
        record.text ||
        record.reason ||
        record.label ||
        ""
    );
  }
  return "";
}

function signalKey(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|and|with|from|that|this|for|but|very|really|product|item|users|buyers)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 7)
    .join(" ");
}

function readFrequency(value: unknown) {
  if (!value || typeof value !== "object") return 1;
  const record = value as Record<string, unknown>;
  const raw = [
    record.count,
    record.mentions,
    record.frequency,
    record.reviewCount,
    record.review_count,
    record.occurrences,
  ]
    .map(toFiniteNumber)
    .find((item): item is number => typeof item === "number" && item > 0);

  return clamp(Math.sqrt(raw || 1), 1, 8);
}

function repeatedThemeWeight(items: unknown[] = [], polarity: "positive" | "negative") {
  const seen = new Set<string>();
  let total = 0;

  for (const item of items) {
    const text = textForSignal(item);
    const key = signalKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const frequency = readFrequency(item);
    const multiplier =
      polarity === "negative"
        ? seriousComplaintPattern.test(text)
          ? 2.4
          : moderateComplaintPattern.test(text)
            ? 1.45
            : 1
        : strongPraisePattern.test(text)
          ? 1.25
          : 1;

    total += clamp(frequency * multiplier, 0.5, polarity === "negative" ? 10 : 8);
  }

  return total;
}

function qualitativeSignalWeight(items: string[] = [], polarity: "positive" | "negative") {
  const seen = new Set<string>();
  let total = 0;
  let accepted = 0;

  for (const item of items) {
    const text = String(item || "").trim();
    const key = signalKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const severity =
      polarity === "negative"
        ? seriousComplaintPattern.test(text)
          ? 2.3
          : moderateComplaintPattern.test(text)
            ? 1.35
            : weakTextPattern.test(text)
              ? 0.75
              : 1
        : strongPraisePattern.test(text)
          ? 1.2
          : weakTextPattern.test(text)
            ? 0.8
            : 1;

    const base = polarity === "negative" ? 0.55 : 0.45;
    const diminishing = 1 / (1 + accepted * 0.28);
    total += base * severity * diminishing;
    accepted += 1;
  }

  return clamp(total, 0, polarity === "negative" ? 5 : 4);
}

function seriousComplaintWeight(repeatedComplaints: unknown[] = [], productCons: string[] = [], buyerSignals: string[] = [], aiSignals: string[] = []) {
  let total = 0;

  for (const item of repeatedComplaints) {
    const text = textForSignal(item);
    if (seriousComplaintPattern.test(text)) total += readFrequency(item) * 2;
  }

  for (const text of [...productCons, ...buyerSignals, ...aiSignals]) {
    if (seriousComplaintPattern.test(String(text || ""))) total += 0.9;
  }

  return total;
}

function evidenceStrengthFactor(value: unknown) {
  const strength = String(value || "").toLowerCase();
  if (strength === "strong") return 1;
  if (strength === "usable") return 0.94;
  if (strength === "limited") return 0.86;
  if (strength === "weak") return 0.72;
  return 0.8;
}

function marketplaceRatingScore(value: unknown) {
  const rating = toFiniteNumber(value);
  if (rating === null || rating <= 0 || rating > 5) return null;
  return clamp(1 + ((rating - 1) / 4) * 8, 1, 10);
}

function marketplaceRatingWeight(ratingScore: number | null, marketplaceReviewCount: number, commentsAnalyzed: number) {
  if (ratingScore === null || commentsAnalyzed < 5) return 0;
  if (marketplaceReviewCount >= 1000) return 0.24;
  if (marketplaceReviewCount >= 100) return 0.18;
  if (marketplaceReviewCount > 0) return 0.12;
  return 0.08;
}

function valueForScore(score: number) {
  if (score >= 9) return "Excellent";
  if (score >= 7) return "Good";
  if (score <= 4) return "Risky";
  return "Fair";
}

export function scoreReviewEvidenceSignals(input: ReviewEvidenceScoreInput): ReviewEvidenceScoreResult {
  const repeatedPraises = Array.isArray(input.repeatedPraises) ? input.repeatedPraises : [];
  const repeatedComplaints = Array.isArray(input.repeatedComplaints) ? input.repeatedComplaints : [];
  const productPros = Array.isArray(input.productPros) ? input.productPros.map(String) : [];
  const productCons = Array.isArray(input.productCons) ? input.productCons.map(String) : [];
  const buyerExperienceSignals = Array.isArray(input.buyerExperienceSignals)
    ? input.buyerExperienceSignals.map(String)
    : [];
  const aiPatternSignals = Array.isArray(input.aiPatternSignals)
    ? input.aiPatternSignals.map(String)
    : [];
  const commentsAnalyzed = Math.max(0, Math.floor(toFiniteNumber(input.commentsAnalyzed) || 0));
  const marketplaceReviewCount = Math.max(0, Math.floor(toFiniteNumber(input.marketplaceReviewCount) || 0));

  const positiveWeight =
    repeatedThemeWeight(repeatedPraises, "positive") +
    qualitativeSignalWeight(productPros, "positive");
  const negativeWeight =
    repeatedThemeWeight(repeatedComplaints, "negative") +
    qualitativeSignalWeight([...productCons, ...aiPatternSignals], "negative");
  const severeWeight = seriousComplaintWeight(
    repeatedComplaints,
    productCons,
    buyerExperienceSignals,
    aiPatternSignals
  );

  const totalSignalWeight = positiveWeight + negativeWeight;
  const evidenceScore =
    totalSignalWeight > 0
      ? 1 + (positiveWeight / totalSignalWeight) * 9
      : 6;
  const ratingScore = marketplaceRatingScore(input.marketplaceRating);
  const ratingWeight = marketplaceRatingWeight(ratingScore, marketplaceReviewCount, commentsAnalyzed);

  let score =
    ratingScore === null
      ? evidenceScore
      : evidenceScore * (1 - ratingWeight) + ratingScore * ratingWeight;

  if (severeWeight >= 5) score -= 2.4;
  else if (severeWeight >= 3) score -= 1.6;
  else if (severeWeight > 0) score -= Math.min(1.2, severeWeight * 0.35);

  const strengthFactor = evidenceStrengthFactor(input.evidenceStrength);
  score = 6 + (score - 6) * strengthFactor;

  if (commentsAnalyzed < 5) score = Math.min(score, 6);
  else if (commentsAnalyzed < 15) score = Math.min(score, 8);

  const buyScore = Math.round(clamp(score, 1, 10));

  let verdict: ReviewEvidenceVerdict = "REVIEW FIRST";
  if (
    buyScore <= 4 ||
    severeWeight >= 5 ||
    (negativeWeight >= positiveWeight * 1.65 && buyScore <= 5)
  ) {
    verdict = "AVOID";
  } else if (
    buyScore >= 7 &&
    positiveWeight >= negativeWeight * 1.15 &&
    severeWeight < 3
  ) {
    verdict = "BUY";
  }

  return {
    buyScore,
    verdict,
    valueForMoney: valueForScore(buyScore),
    positiveWeight: Math.round(positiveWeight * 1000) / 1000,
    negativeWeight: Math.round(negativeWeight * 1000) / 1000,
    seriousComplaintWeight: Math.round(severeWeight * 1000) / 1000,
    ratingScore,
    scoreBeforeRounding: Math.round(score * 1000) / 1000,
  };
}
