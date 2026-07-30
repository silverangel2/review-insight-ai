export type ReviewEvidenceVerdict =
  | "BUY"
  | "CONSIDER"
  | "AVOID"
  | "REVIEW EVIDENCE NOT ENOUGH";

export type ReviewEvidenceScoreInput = {
  rating?: number | null;
  marketplaceReviewCount?: number | null;
  commentsAnalyzed?: number | null;
  evidenceStrength?: string | null;
  reviewSnippets?: unknown[];
  repeatedPraises?: unknown[];
  repeatedComplaints?: unknown[];
  productPros?: unknown[];
  productCons?: unknown[];
  buyerExperienceSignals?: unknown[];
  aiPatternSignals?: unknown[];
  reviewAuthenticityScore?: number | null;
  suspiciousReviewRisk?: string | null;
};

export type ReviewEvidenceScoreResult = {
  verdict: ReviewEvidenceVerdict;
  buyScore: number | null;
  valueForMoney: string;
  bottomLine: string;
  audit: {
    writtenEvidenceCount: number;
    positiveSignal: number;
    negativeSignal: number;
    severeRepeatedComplaintPressure: number;
    severeProductComplaintPressure: number;
    criticalRepeatedComplaintPressure: number;
    writtenScore: number | null;
    marketplaceScore: number | null;
    marketplaceWeight: number;
    positiveSnippetShare: number | null;
    negativeSnippetShare: number | null;
  };
};

const CRITICAL_COMPLAINT_TERMS = [
  "unsafe",
  "danger",
  "dangerous",
  "fire",
  "smoke",
  "exploded",
  "explosion",
  "injury",
  "injured",
  "toxic",
  "burn",
  "overheat",
  "overheated",
  "counterfeit",
  "scam",
  "fraud",
  "mold",
];

const SEVERE_COMPLAINT_TERMS = [
  "broken",
  "defect",
  "defective",
  "stopped working",
  "does not work",
  "doesn't work",
  "not working",
  "failed",
  "failure",
  "malfunction",
  "leak",
  "leaking",
  "dead",
  "cracked",
  "crack",
  "refund",
  "return",
  "warranty",
  "damaged",
  "missing",
  "battery",
  "zipper",
  "wheel",
  "freezing",
  "freeze",
  "dropout",
  "dropouts",
  "reset",
  "resets",
  "degrade",
  "degradation",
];

const MODERATE_COMPLAINT_TERMS = [
  "cheap",
  "flimsy",
  "poor quality",
  "durability",
  "unreliable",
  "inconsistent",
  "weak",
  "loose",
  "hard to",
  "difficult",
  "noisy",
  "lag",
  "laggy",
  "latency",
  "stutter",
  "unstable",
  "syncing",
  "accuracy",
  "bug",
  "bugs",
  "scratch",
  "fit",
  "sizing",
  "small",
  "large",
];

const MINOR_COMPLAINT_TERMS = [
  "packaging",
  "package",
  "box",
  "shipping",
  "delivery",
  "instructions",
  "manual",
  "color",
  "smell",
  "odor",
  "cosmetic",
];

const POSITIVE_TERMS = [
  "good quality",
  "great quality",
  "great value",
  "worth it",
  "sturdy",
  "durable",
  "reliable",
  "works well",
  "works great",
  "easy to use",
  "easy",
  "comfortable",
  "love",
  "recommended",
  "recommend",
  "fast",
  "solid",
  "accurate",
  "quiet",
  "lightweight",
  "effective",
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizedText(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function uniqueTexts(items: unknown[], limit: number) {
  const seen = new Set<string>();
  const clean: string[] = [];

  for (const item of items) {
    const text = normalizedText(item);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    clean.push(text);
    if (clean.length >= limit) break;
  }

  return clean;
}

function signalKey(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\b(the|and|with|from|that|this|for|but|very|really|product|item|unit|units|buyer|buyers|user|users|some|may|can|also|over|time)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 6)
    .join(" ");
}

function uniqueThemeTexts(items: unknown[], limit: number) {
  const seen = new Set<string>();
  const clean: string[] = [];

  for (const item of uniqueTexts(items, limit * 2)) {
    const key = signalKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    clean.push(item);
    if (clean.length >= limit) break;
  }

  return clean;
}

function themeText(item: unknown) {
  if (typeof item === "string") return normalizedText(item);

  const record = asRecord(item);
  const supporting = Array.isArray(record.supportingSnippets)
    ? record.supportingSnippets.map(normalizedText).filter(Boolean).join(" ")
    : "";

  return normalizedText(
    [
      record.theme,
      record.summary,
      record.text,
      record.snippet,
      supporting,
    ]
      .map(normalizedText)
      .filter(Boolean)
      .join(" ")
  );
}

function evidenceCount(item: unknown) {
  const record = asRecord(item);
  const direct = [
    record.evidenceCount,
    record.count,
    record.mentions,
    record.frequency,
    record.reviewCount,
    record.review_count,
    record.occurrences,
  ]
    .map(finiteNumber)
    .find((value): value is number => value !== null && value > 0);

  if (direct !== undefined) return clamp(direct, 1, 24);

  if (Array.isArray(record.supportingSnippets) && record.supportingSnippets.length > 0) {
    return clamp(record.supportingSnippets.length, 1, 12);
  }

  return 1;
}

function repetitionWeight(item: unknown) {
  return 1 + Math.log2(evidenceCount(item));
}

function complaintSeverityLevel(text: string) {
  const lower = text.toLowerCase();
  const packagingOnly =
    includesAny(lower, MINOR_COMPLAINT_TERMS) &&
    !includesAny(lower, ["product damaged", "item damaged", "broken", "missing", "leak", "unsafe", "refund", "return"]);

  if (packagingOnly) return 0.6;
  if (includesAny(lower, CRITICAL_COMPLAINT_TERMS)) return 4;
  if (includesAny(lower, SEVERE_COMPLAINT_TERMS)) return 3;
  if (includesAny(lower, MODERATE_COMPLAINT_TERMS)) return 2;
  if (includesAny(lower, MINOR_COMPLAINT_TERMS)) return 1;
  return 1.4;
}

function complaintPressure(text: string, repeatedWeight: number) {
  const severity = complaintSeverityLevel(text);

  if (severity >= 4) return repeatedWeight * 2.45;
  if (severity >= 3) return repeatedWeight * 1.75;
  if (severity >= 2) return repeatedWeight * 1.15;
  if (severity >= 1) return repeatedWeight * 0.7;
  return repeatedWeight * 0.35;
}

function positiveStrength(text: string, repeatedWeight: number) {
  return repeatedWeight * (includesAny(text, POSITIVE_TERMS) ? 1.35 : 1.05);
}

function qualitativePositiveSignal(items: string[]) {
  let total = 0;

  items.forEach((text, index) => {
    const diminishing = 1 / (1 + index * 0.22);
    total += 0.9 * (includesAny(text, POSITIVE_TERMS) ? 1.35 : 1.05) * diminishing;
  });

  return Math.min(6, total);
}

function qualitativeComplaintSignal(items: string[]) {
  let total = 0;

  items.forEach((text, index) => {
    const severity = complaintSeverityLevel(text);
    const multiplier =
      severity >= 4 ? 2.25 :
      severity >= 3 ? 1.7 :
      severity >= 2 ? 1.15 :
      severity >= 1 ? 0.78 :
      0.42;
    const diminishing = 1 / (1 + index * 0.2);
    total += 0.72 * multiplier * diminishing;
  });

  return Math.min(8, total);
}

function snippetSentimentCounts(snippets: unknown[]) {
  let positive = 0;
  let mixed = 0;
  let negative = 0;

  for (const item of snippets) {
    const record = asRecord(item);
    const sentiment = String(record.sentiment || "").toLowerCase();
    const text = themeText(item);

    if (sentiment === "positive") {
      positive += 1;
    } else if (sentiment === "negative") {
      negative += 1;
    } else if (sentiment === "mixed") {
      mixed += 1;
    } else if (includesAny(text, CRITICAL_COMPLAINT_TERMS) || includesAny(text, SEVERE_COMPLAINT_TERMS)) {
      negative += 1;
    } else if (includesAny(text, POSITIVE_TERMS)) {
      positive += 1;
    } else if (text) {
      mixed += 1;
    }
  }

  return { positive, mixed, negative };
}

function marketplaceWeight(reviewCount: number | null) {
  if (reviewCount === null || reviewCount < 25) return 0;
  if (reviewCount >= 1000) return 0.38;
  if (reviewCount >= 500) return 0.34;
  if (reviewCount >= 300) return 0.3;
  if (reviewCount >= 100) return 0.25;
  if (reviewCount >= 50) return 0.18;
  return 0.12;
}

function marketplaceScore(rating: number | null) {
  if (rating === null || rating <= 0 || rating > 5) return null;
  return clamp(1 + ((rating - 1) / 4) * 9, 1, 10);
}

function riskPenalty(input: ReviewEvidenceScoreInput) {
  const risk = String(input.suspiciousReviewRisk || "").toLowerCase();
  const score = finiteNumber(input.reviewAuthenticityScore);
  const suspiciousAiSignalCount = (input.aiPatternSignals || []).filter((item) => {
    const text = normalizedText(item).toLowerCase();
    if (!text) return false;
    if (/no suspicious|no signs|reduce suspicion|reducing suspicion|low suspicion/.test(text)) return false;
    return /suspicious|repetitive|generic praise|templated|coordinated|bot|incentivized|manipulat|rating mismatch/.test(text);
  }).length;
  const aiSignalPressure = Math.min(1.2, suspiciousAiSignalCount * 0.25);

  if (risk.includes("very high") || (score !== null && score >= 85)) return 2.7 + aiSignalPressure;
  if (risk.includes("high") || (score !== null && score >= 75)) return 1.8 + aiSignalPressure;
  if (risk.includes("medium") || (score !== null && score >= 50)) return 0.55 + aiSignalPressure;
  return aiSignalPressure;
}

export function scoreReviewEvidenceDecision(input: ReviewEvidenceScoreInput): ReviewEvidenceScoreResult {
  const rating = finiteNumber(input.rating);
  const reviewCount = finiteNumber(input.marketplaceReviewCount);
  const commentsAnalyzed = Math.max(0, Math.round(finiteNumber(input.commentsAnalyzed) || 0));
  const evidenceStrength = String(input.evidenceStrength || "").toLowerCase();
  const reviewSnippets = input.reviewSnippets || [];
  const repeatedPraises = input.repeatedPraises || [];
  const repeatedComplaints = input.repeatedComplaints || [];
  const productPros = uniqueThemeTexts(input.productPros || [], 8);
  const productCons = uniqueThemeTexts(input.productCons || [], 8);
  const buyerSignals = uniqueTexts(input.buyerExperienceSignals || [], 10);

  const writtenEvidenceCount = Math.max(
    commentsAnalyzed,
    reviewSnippets.length,
    repeatedPraises.length + repeatedComplaints.length,
    productPros.length + productCons.length,
    buyerSignals.length
  );

  const notEnough =
    writtenEvidenceCount < 3 ||
    evidenceStrength === "none" ||
    (
      reviewSnippets.length === 0 &&
      repeatedPraises.length === 0 &&
      repeatedComplaints.length === 0 &&
      productPros.length === 0 &&
      productCons.length === 0 &&
      buyerSignals.length === 0
    );

  if (notEnough) {
    return {
      verdict: "REVIEW EVIDENCE NOT ENOUGH",
      buyScore: null,
      valueForMoney: "Unknown",
      bottomLine:
        "ReviewIntel did not find enough written-review evidence to calculate a trustworthy Buy Score.",
      audit: {
        writtenEvidenceCount,
        positiveSignal: 0,
        negativeSignal: 0,
        severeRepeatedComplaintPressure: 0,
        severeProductComplaintPressure: 0,
        criticalRepeatedComplaintPressure: 0,
        writtenScore: null,
        marketplaceScore: marketplaceScore(rating),
        marketplaceWeight: 0,
        positiveSnippetShare: null,
        negativeSnippetShare: null,
      },
    };
  }

  const snippets = snippetSentimentCounts(reviewSnippets);
  const snippetTotal = snippets.positive + snippets.mixed + snippets.negative;
  const positiveSnippetShare =
    snippetTotal > 0 ? snippets.positive / snippetTotal : null;
  const negativeSnippetShare =
    snippetTotal > 0 ? snippets.negative / snippetTotal : null;

  const repeatedPraiseSignal = repeatedPraises.reduce<number>(
    (total, item) => total + positiveStrength(themeText(item), repetitionWeight(item)),
    0
  );
  const productProsSignal = qualitativePositiveSignal(productPros);
  const buyerPositiveSignal = buyerSignals.reduce<number>(
    (total, text) => total + (includesAny(text, POSITIVE_TERMS) ? 0.65 : 0),
    0
  );

  const repeatedComplaintPressure = repeatedComplaints.reduce<number>(
    (total, item) => total + complaintPressure(themeText(item), repetitionWeight(item)),
    0
  );
  const productConsPressure = qualitativeComplaintSignal(productCons);
  const buyerNegativePressure = buyerSignals.reduce<number>(
    (total, text) =>
      total +
      (includesAny(text, CRITICAL_COMPLAINT_TERMS) ||
      includesAny(text, SEVERE_COMPLAINT_TERMS) ||
      includesAny(text, MODERATE_COMPLAINT_TERMS)
        ? complaintPressure(text, 0.45)
        : 0),
    0
  );

  const polarizedSnippetCount = snippets.positive + snippets.negative;
  const neutralSnippetPositiveSignal = polarizedSnippetCount > 0 ? snippets.mixed * 0.12 : 0;
  const neutralSnippetNegativeSignal = polarizedSnippetCount > 0 ? snippets.mixed * 0.15 : 0;

  const positiveSignal =
    repeatedPraiseSignal +
    productProsSignal +
    buyerPositiveSignal +
    snippets.positive * 0.55 +
    neutralSnippetPositiveSignal;

  const negativeSignal =
    repeatedComplaintPressure +
    productConsPressure +
    buyerNegativePressure +
    snippets.negative * 0.65 +
    neutralSnippetNegativeSignal;

  const severeRepeatedComplaintPressure = repeatedComplaints.reduce<number>((total, item) => {
    const text = themeText(item);
    return complaintSeverityLevel(text) >= 3
      ? total + complaintPressure(text, repetitionWeight(item))
      : total;
  }, 0);
  const severeProductComplaintPressure = productCons.reduce<number>((total, text) => {
    return complaintSeverityLevel(text) >= 3
      ? total + complaintPressure(text, 0.7)
      : total;
  }, 0);
  const criticalRepeatedComplaintPressure = repeatedComplaints.reduce<number>((total, item) => {
    const text = themeText(item);
    return complaintSeverityLevel(text) >= 4
      ? total + complaintPressure(text, repetitionWeight(item))
      : total;
  }, 0);

  const signalTotal = positiveSignal + negativeSignal;
  const balanceScore = signalTotal > 0
    ? 1 + (positiveSignal / signalTotal) * 9
    : 5;
  const snippetScore = snippetTotal > 0
    ? polarizedSnippetCount > 0
      ? 1 + ((snippets.positive + snippets.mixed * 0.48) / snippetTotal) * 9
      : balanceScore
    : balanceScore;
  const snippetInfluence = polarizedSnippetCount > 0 ? 0.25 : 0;
  let writtenScore = balanceScore * (1 - snippetInfluence) + snippetScore * snippetInfluence;

  if (
    positiveSignal >= negativeSignal * 1.75 &&
    (positiveSnippetShare === null || positiveSnippetShare >= 0.62)
  ) {
    writtenScore += 0.45;
  }

  if (
    negativeSignal >= positiveSignal * 1.45 &&
    (negativeSnippetShare === null || negativeSnippetShare >= 0.45)
  ) {
    writtenScore -= 0.55;
  }

  const ratingScore = marketplaceScore(rating);
  const ratingWeight = ratingScore === null ? 0 : marketplaceWeight(reviewCount);
  let buyScore = writtenScore * (1 - ratingWeight) + (ratingScore || 0) * ratingWeight;

  buyScore -= riskPenalty(input);

  const unsupportedSevereNegative =
    severeProductComplaintPressure >= 2.4 &&
    negativeSignal >= positiveSignal * 1.05 &&
    (rating === null || rating < 4.2);

  if (rating !== null && reviewCount !== null && reviewCount >= 100) {
    if (rating <= 3.4) {
      buyScore = Math.min(buyScore, 3.2);
    } else if (rating <= 3.7 && severeProductComplaintPressure >= 3.5) {
      buyScore = Math.min(buyScore, 3.2);
    } else if (rating <= 3.8 && negativeSignal >= positiveSignal * 0.8) {
      buyScore = Math.min(buyScore, 5.8);
    }
  }

  if (criticalRepeatedComplaintPressure >= 3.5 || severeRepeatedComplaintPressure >= 7) {
    buyScore = Math.min(buyScore, 3);
  } else if (severeRepeatedComplaintPressure >= 4.5 || severeProductComplaintPressure >= 5.5) {
    buyScore = Math.min(buyScore, 4.4);
  }

  if (unsupportedSevereNegative) {
    buyScore = Math.min(buyScore, 3.4);
  }

  if (negativeSignal >= positiveSignal * 1.6 && negativeSignal >= 5) {
    buyScore = Math.min(buyScore, 4.2);
  }

  buyScore = roundTenth(clamp(buyScore, 1, 10));

  const highAuthenticityRisk =
    String(input.suspiciousReviewRisk || "").toLowerCase().includes("high") ||
    (typeof input.reviewAuthenticityScore === "number" && input.reviewAuthenticityScore >= 75);
  const severeComplaintOverride =
    criticalRepeatedComplaintPressure >= 3.5 ||
    severeRepeatedComplaintPressure >= 7 ||
    (
      severeProductComplaintPressure >= 5.5 &&
      negativeSignal >= positiveSignal * 0.75
    );
  const positiveClearlyLeads =
    positiveSignal >= Math.max(2.4, negativeSignal * 1.15);
  const negativeClearlyLeads =
    negativeSignal >= Math.max(3.5, positiveSignal * 1.2);
  const marketplaceSupportedPositive =
    rating !== null &&
    rating >= 4.5 &&
    reviewCount !== null &&
    reviewCount >= 300 &&
    buyScore >= 6.8 &&
    !negativeClearlyLeads;
  const lowRiskModeratelyPositive =
    buyScore >= 6.8 &&
    positiveClearlyLeads &&
    severeRepeatedComplaintPressure < 1 &&
    severeProductComplaintPressure < 1 &&
    (rating === null || rating >= 4.0);

  let verdict: ReviewEvidenceVerdict = "CONSIDER";

  if (
    buyScore <= 3.5 ||
    (
      buyScore <= 4.2 &&
      (
        severeProductComplaintPressure >= 3.5 ||
        (rating !== null && reviewCount !== null && reviewCount >= 100 && rating <= 3.7)
      )
    ) ||
    (
      severeProductComplaintPressure >= 2.4 &&
      negativeSignal >= positiveSignal * 1.05 &&
      (rating === null || rating < 4.2)
    ) ||
    severeComplaintOverride ||
    (negativeClearlyLeads && buyScore < 5)
  ) {
    verdict = "AVOID";
  } else if (
    (buyScore >= 7 && positiveClearlyLeads) ||
    marketplaceSupportedPositive ||
    lowRiskModeratelyPositive
  ) {
    if (
      !highAuthenticityRisk &&
      severeRepeatedComplaintPressure < 4.5
    ) {
      verdict = "BUY";
    }
  }

  const valueForMoney =
    verdict === "BUY"
      ? buyScore >= 8.6 ? "Excellent" : "Good"
      : verdict === "AVOID"
        ? "Poor"
        : "Fair";

  const bottomLine =
    verdict === "BUY"
      ? "ReviewIntel found consistent positive written-review evidence, with marketplace rating support where the public review count is substantial."
      : verdict === "AVOID"
        ? "ReviewIntel found repeated or severe complaint evidence that outweighs the positive buying signals."
        : "ReviewIntel found genuinely mixed, uncertain, or conflicting written-review evidence, so the product should be reviewed before buying.";

  return {
    verdict,
    buyScore,
    valueForMoney,
    bottomLine,
    audit: {
      writtenEvidenceCount,
      positiveSignal: roundTenth(positiveSignal),
      negativeSignal: roundTenth(negativeSignal),
      severeRepeatedComplaintPressure: roundTenth(severeRepeatedComplaintPressure),
      severeProductComplaintPressure: roundTenth(severeProductComplaintPressure),
      criticalRepeatedComplaintPressure: roundTenth(criticalRepeatedComplaintPressure),
      writtenScore: roundTenth(writtenScore),
      marketplaceScore: ratingScore === null ? null : roundTenth(ratingScore),
      marketplaceWeight: ratingWeight,
      positiveSnippetShare:
        positiveSnippetShare === null ? null : roundTenth(positiveSnippetShare),
      negativeSnippetShare:
        negativeSnippetShare === null ? null : roundTenth(negativeSnippetShare),
    },
  };
}
