import type { BuyerRecommendation, CustomerRecommendation, ReviewAnalysis, SellerInsights } from "@/lib/types";
import {
  cleanReviewInsightText,
  sellerFriendlyTheme
} from "@/lib/insightSanitizer";

export const NOT_ENOUGH_REVIEW_DATA = "Not enough review data.";

type ScoreBundle = {
  shopperScore: number;
  customerSatisfaction: number;
  sentimentPercent: number;
  complaintSeverity: number;
  fakeReviewRisk: number;
  valueScore: number;
  confidencePercent: number;
  productPerformanceScore: number;
  packagingDominant: boolean;
  dominantComplaint: string;
  warnings: string[];
  insufficientData: boolean;
};

type IssueProfile = {
  productIssueCount: number;
  packagingOnlyCount: number;
  seriousPackagingCount: number;
  severeProductCount: number;
  positiveProductCount: number;
  packagingDominant: boolean;
  dominantComplaint: string;
};

const WEAK_TEXT_PATTERNS = [
  "not enough",
  "no clear",
  "no strong",
  "limited",
  "generic",
  "placeholder",
  "local fallback",
  "needs multiple"
];

const SEVERE_COMPLAINT_WORDS = [
  "broken",
  "defect",
  "defective",
  "refund",
  "return",
  "stopped",
  "danger",
  "unsafe",
  "leak",
  "leaking",
  "missing",
  "damaged",
  "fake",
  "scam",
  "cheap",
  "warranty"
];

const PACKAGING_WORDS = [
  "package",
  "packaging",
  "box",
  "boxed",
  "plastic",
  "wrap",
  "wrapped",
  "bag",
  "shipping",
  "shipment",
  "dented",
  "crushed",
  "manual",
  "insert"
];

const PACKAGING_DAMAGE_WORDS = ["broken", "damaged", "missing", "return", "refund", "unsafe", "leak", "stopped", "defect", "crushed", "dented"];

const PRODUCT_STRENGTH_WORDS = [
  "fit",
  "fits",
  "works",
  "protect",
  "protection",
  "quality",
  "sturdy",
  "strong",
  "easy",
  "clean",
  "clear",
  "premium",
  "durable",
  "performance",
  "precise"
];

const REVIEW_QUALITY_WORDS = ["fake", "polished", "templated", "incentivized", "manipulation", "suspicious", "review pattern", "mini-guide"];

export function clampPercent(value: number | null | undefined, fallback = 0) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function formatPercent(value: number | null | undefined) {
  return `${clampPercent(value)}%`;
}

export function sentimentToPercent(score: number | null | undefined) {
  if (typeof score !== "number" || Number.isNaN(score)) return 50;
  if (score > 1 || score < -1) return clampPercent(score);
  return clampPercent((score + 1) * 50);
}

export function percentToSentiment(score: number | null | undefined) {
  return Number(((clampPercent(score, 50) / 50) - 1).toFixed(2));
}

export function fakeRiskFromIndicators(indicators: string[] | undefined) {
  const safeIndicators = indicators ?? [];
  const text = safeIndicators.join(" ").toLowerCase();
  if (
    !text ||
    text.includes("no clear") ||
    text.includes("no obvious") ||
    text.includes("appears varied") ||
    text.includes("low evidence") ||
    text.includes("cannot reliably") ||
    text.includes("not enough evidence") ||
    text.includes("insufficient evidence") ||
    text.includes("no evidence")
  ) {
    return 18;
  }
  if (text.includes("high") || text.includes("suspicious") || text.includes("templated") || text.includes("pattern")) return 68;
  return clampPercent(22 + safeIndicators.length * 9, 22);
}

export function riskLabel(value: number) {
  const score = clampPercent(value);
  if (score >= 65) return "High risk";
  if (score >= 35) return "Medium risk";
  return "Low risk";
}

export function sentimentLabelFromPercent(score: number) {
  const value = clampPercent(score);
  if (value >= 68) return "Positive";
  if (value <= 40) return "Negative";
  return "Mixed";
}

export function verdictFromScore(score: number): CustomerRecommendation {
  const value = clampPercent(score);
  if (value >= 70) return "Buy";
  if (value < 45) return "Avoid";
  return "Maybe";
}

export function shopperVerdictCopy(verdict: CustomerRecommendation, score?: number) {
  if (verdict === "Buy") return clampPercent(score, 70) >= 85 ? "Highly recommended" : "Worth buying";
  if (verdict === "Avoid") return "Avoid";
  if (clampPercent(score, 50) >= 65) return "Good, check details";
  return "Compare first";
}

function usefulText(value: string | undefined) {
  const text = cleanReviewInsightText(value);
  if (!text) return "";
  if (text.length < 8) return "";
  return text;
}

function uniqueList(items: Array<string | undefined>, fallback: string[] = []) {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const item of [...items, ...fallback]) {
    const text = usefulText(item);
    if (!text) continue;
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(text);
  }

  return cleaned;
}

function isWeakText(text: string | undefined) {
  const value = text?.trim().toLowerCase() ?? "";
  if (!value) return true;
  if (value.length < 12) return true;
  return WEAK_TEXT_PATTERNS.some((pattern) => value.includes(pattern));
}

function firstUseful(items: Array<string | undefined>, fallback: string) {
  return uniqueList(items).find((item) => !isWeakText(item)) ?? fallback;
}

function textIncludesAny(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function isPackagingIssue(text: string | undefined) {
  return textIncludesAny(text ?? "", PACKAGING_WORDS);
}

function isPackagingOnlyIssue(text: string | undefined) {
  const value = text ?? "";
  return isPackagingIssue(value) && !textIncludesAny(value, PACKAGING_DAMAGE_WORDS.filter((word) => word !== "crushed" && word !== "dented"));
}

function isReviewQualityIssue(text: string | undefined) {
  return textIncludesAny(text ?? "", REVIEW_QUALITY_WORDS);
}

function canonicalTopic(text: string | undefined) {
  const value = (text ?? "").toLowerCase();
  if (!value.trim()) return "empty";
  if (value.includes("satisfaction")) return "customer_satisfaction";
  if (value.includes("plastic") || value.includes("wrap") || value.includes("bag")) return "excess_plastic_packaging";
  if (value.includes("package") || value.includes("box") || value.includes("shipping") || value.includes("dented") || value.includes("crushed")) return "packaging_presentation";
  if (value.includes("fit") || value.includes("size") || value.includes("model") || value.includes("compatible")) return "fit_compatibility";
  if (value.includes("support") || value.includes("reply") || value.includes("service")) return "support_response";
  if (value.includes("refund") || value.includes("return")) return "refund_risk";
  if (value.includes("leak") || value.includes("lid") || value.includes("seal")) return "leak_or_seal";
  if (value.includes("motor") || value.includes("stopped") || value.includes("flicker") || value.includes("durab") || value.includes("broken") || value.includes("defect")) return "durability_reliability";
  if (value.includes("price") || value.includes("value") || value.includes("expensive")) return "value_perception";
  return value.replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 5).join("_");
}

function cleanIssueLabel(text: string | undefined) {
  const value = sellerFriendlyTheme(text, usefulText(text));
  if (!value) return NOT_ENOUGH_REVIEW_DATA;
  const lower = value.toLowerCase();
  if (lower.includes("plastic") || lower.includes("wrap") || lower.includes("bag")) return "Excess plastic packaging";
  if (lower.includes("package") || lower.includes("box") || lower.includes("shipping") || lower.includes("dented") || lower.includes("crushed")) return "Packaging presentation";
  if (lower.includes("support") || lower.includes("reply") || lower.includes("service")) return "Support response delay";
  if (lower.includes("leak") || lower.includes("lid") || lower.includes("seal")) return "Lid or seal reliability";
  if (lower.includes("motor") || lower.includes("stopped") || lower.includes("flicker") || lower.includes("durab")) return "Durability reliability";
  if (lower.includes("fit") || lower.includes("size") || lower.includes("model") || lower.includes("compatible")) return "Fit or compatibility clarity";
  return value.replace(/\s+/g, " ").replace(/\.$/, "").slice(0, 92);
}

function uniqueByTopic(items: Array<string | undefined>, fallback: string[] = []) {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const item of [...items, ...fallback]) {
    const text = usefulText(item);
    if (!text) continue;
    const key = canonicalTopic(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(text);
  }

  return cleaned;
}

function normalizedComplaintLabels(items: string[] | undefined) {
  return uniqueByTopic(items ?? []).map(cleanIssueLabel).filter((item) => !isWeakText(item));
}

function buildIssueProfile(analysis: ReviewAnalysis): IssueProfile {
  const complaintText = uniqueByTopic([
    ...(analysis.common_complaints ?? []),
    ...(analysis.negative_points ?? []),
    ...(analysis.quality_concerns ?? []),
    ...(analysis.product_quality_concerns ?? []),
    ...(analysis.durability_issues ?? []),
    ...(analysis.support_issues ?? []),
    ...(analysis.seller_insights?.refund_risk_issues ?? [])
  ]).filter((item) => !isWeakText(item));
  const positives = uniqueByTopic([...(analysis.positive_points ?? []), ...(analysis.praised_features ?? [])]).filter((item) => !isWeakText(item));
  const packagingOnly = complaintText.filter(isPackagingOnlyIssue);
  const seriousPackaging = complaintText.filter((item) => isPackagingIssue(item) && !isPackagingOnlyIssue(item));
  const productIssues = complaintText.filter((item) => !isPackagingIssue(item) && !isReviewQualityIssue(item));
  const severeProductCount = productIssues.filter((item) => textIncludesAny(item, SEVERE_COMPLAINT_WORDS)).length;
  const positiveProductCount = positives.filter((item) => textIncludesAny(item, PRODUCT_STRENGTH_WORDS)).length || positives.length;
  const dominantComplaint = complaintText[0] ?? analysis.common_complaints?.[0] ?? analysis.negative_points?.[0] ?? NOT_ENOUGH_REVIEW_DATA;
  const packagingIssueCount = packagingOnly.length + seriousPackaging.length;
  const packagingDominant = packagingIssueCount > 0 && productIssues.length <= Math.max(1, packagingIssueCount);

  return {
    productIssueCount: productIssues.length,
    packagingOnlyCount: packagingOnly.length,
    seriousPackagingCount: seriousPackaging.length,
    severeProductCount,
    positiveProductCount,
    packagingDominant,
    dominantComplaint
  };
}

function complaintSeverityFromAnalysis(analysis: ReviewAnalysis, sentimentPercent: number) {
  const profile = buildIssueProfile(analysis);
  const sentimentPenalty = Math.max(0, 55 - sentimentPercent) * 0.7;
  const productPressure = profile.productIssueCount * 9 + profile.severeProductCount * 14;
  const packagingPressure = profile.packagingOnlyCount * 4 + profile.seriousPackagingCount * 9;
  let severity = clampPercent(productPressure + packagingPressure + sentimentPenalty);

  if (profile.packagingDominant && profile.severeProductCount === 0 && sentimentPercent >= 62) {
    severity = Math.min(severity, 42);
  }

  return severity;
}

function productPerformanceFromAnalysis(
  analysis: ReviewAnalysis,
  sentimentPercent: number,
  fakeReviewRisk: number,
  confidencePercent: number,
  profile: IssueProfile
) {
  const praiseBoost = Math.min(18, profile.positiveProductCount * 4);
  const issuePenalty = profile.productIssueCount * 7 + profile.severeProductCount * 10;
  const packagingPenalty = profile.packagingDominant ? Math.min(8, profile.packagingOnlyCount * 2) : Math.min(14, profile.packagingOnlyCount * 4);
  let score = sentimentPercent * 0.58 + confidencePercent * 0.1 + praiseBoost + 28 - issuePenalty - packagingPenalty - fakeReviewRisk * 0.05;
  if (profile.packagingDominant && profile.positiveProductCount >= 2 && profile.severeProductCount === 0) {
    score = Math.max(score, 72 - packagingPenalty - fakeReviewRisk * 0.06);
  }
  return clampPercent(score, sentimentPercent);
}

function valueScoreFromOpinion(analysis: ReviewAnalysis, shopperScore: number, sentimentPercent: number, complaintSeverity: number) {
  const valueText = (analysis.value_for_money_opinion ?? "").toLowerCase();
  let signal = shopperScore * 0.45 + sentimentPercent * 0.3 + (100 - complaintSeverity) * 0.25;
  if (valueText.includes("great") || valueText.includes("strong") || valueText.includes("good value")) signal += 8;
  if (valueText.includes("weak") || valueText.includes("questionable") || valueText.includes("overpriced")) signal -= 12;
  if (valueText.includes("mixed")) signal -= 4;
  return clampPercent(signal);
}

function recommendationFor(score: number, warnings: string[], insufficientData: boolean, scores: Pick<ScoreBundle, "packagingDominant" | "productPerformanceScore" | "dominantComplaint">): BuyerRecommendation {
  if (insufficientData) {
    return {
      verdict: "Maybe",
      rationale: "Not enough review data to make a confident recommendation. Add more real reviews before trusting the score."
    };
  }

  const verdict = verdictFromScore(score);
  if (verdict === "Buy") {
    return {
      verdict,
      rationale:
        scores.packagingDominant
          ? "Good product signal, but packaging concerns reduce confidence slightly. Check the packaging complaint before buying."
          : score >= 85
          ? "Strong positive review evidence, healthy satisfaction, and manageable risk signals support a confident purchase."
          : "The shared analysis is positive overall, but shoppers should still check the top complaint before buying."
    };
  }

  if (verdict === "Avoid") {
    return {
      verdict,
      rationale:
        "The shared analysis shows weak satisfaction, heavy complaint pressure, or risk signals that make this product hard to recommend."
    };
  }

  return {
    verdict,
    rationale:
      scores.packagingDominant && (scores.productPerformanceScore >= 64 || score >= 65)
        ? "Product performance looks good, but repeated packaging comments lower buying confidence. Compare first if packaging matters to you."
        : warnings.length > 0
        ? "The analysis was recalculated because the original scores conflicted. Compare the top complaints before buying."
        : "The product has mixed evidence, so compare alternatives and read the top complaints before buying."
  };
}

function dedupeInsightList(items: Array<string | undefined>, fallback: string[] = [], limit = 6) {
  const seenText = new Set<string>();
  const seenTopics = new Map<string, number>();
  const cleaned: string[] = [];

  for (const item of [...items, ...fallback]) {
    const fullText = cleanReviewInsightText(item, "");
    const themeText = sellerFriendlyTheme(item, "");
    const text = fullText && !isWeakText(fullText) && fullText.split(/\s+/).length > 4 ? fullText : themeText;
    if (!text || isWeakText(text)) continue;
    const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const topic = canonicalTopic(text);
    const topicCount = seenTopics.get(topic) ?? 0;
    if (seenText.has(normalized)) continue;
    if (topicCount >= 1) continue;
    seenText.add(normalized);
    seenTopics.set(topic, topicCount + 1);
    cleaned.push(text);
    if (cleaned.length >= limit) break;
  }

  return cleaned.length ? cleaned : [NOT_ENOUGH_REVIEW_DATA];
}

function buildSectionSpecificSellerInsights(
  analysis: ReviewAnalysis,
  scores: ScoreBundle,
  baseSellerInsights: SellerInsights
): SellerInsights {
  const topComplaint = firstUseful(
    [...(analysis.common_complaints ?? []), ...(analysis.negative_points ?? []), ...(analysis.quality_concerns ?? [])],
    NOT_ENOUGH_REVIEW_DATA
  );
  const complaintLabel = cleanIssueLabel(topComplaint);
  const topPraise = sellerFriendlyTheme(firstUseful([...(analysis.praised_features ?? []), ...(analysis.positive_points ?? [])], "the strongest real customer benefit"), "the strongest real customer benefit");
  const praiseProof = topPraise === "the strongest real customer benefit" ? "the strongest real customer benefit" : topPraise;
  const topFeatureRequest = sellerFriendlyTheme(firstUseful([...(analysis.feature_requests ?? []), ...(baseSellerInsights.feature_requests ?? [])], NOT_ENOUGH_REVIEW_DATA), NOT_ENOUGH_REVIEW_DATA);
  const topSupport = sellerFriendlyTheme(firstUseful([...(analysis.support_issues ?? []), ...(baseSellerInsights.refund_risk_issues ?? [])], NOT_ENOUGH_REVIEW_DATA), NOT_ENOUGH_REVIEW_DATA);
  const sentimentLabel = sentimentLabelFromPercent(scores.sentimentPercent).toLowerCase();
  const productVsPackaging = scores.packagingDominant && scores.complaintSeverity <= 50;

  const customerSatisfaction =
    scores.customerSatisfaction >= 75
      ? [`${formatPercent(scores.customerSatisfaction)} satisfaction: customers are generally happy with the product experience, led by ${topPraise}.`]
      : scores.customerSatisfaction >= 50
        ? [`${formatPercent(scores.customerSatisfaction)} satisfaction: demand exists, but the leading complaint theme is limiting confidence.`]
        : [`${formatPercent(scores.customerSatisfaction)} satisfaction: shoppers are not consistently happy. Resolve the leading complaint before scaling.`];

  const complaintClusters = dedupeInsightList(
    [
      productVsPackaging ? "Packaging waste is the main recurring negative theme." : `Main recurring complaint theme: ${complaintLabel}.`,
      ...normalizedComplaintLabels(analysis.common_complaints)
    ],
    baseSellerInsights.complaint_clusters,
    5
  );
  const painPoints = dedupeInsightList([
    productVsPackaging
      ? "Shoppers like the product itself, but excess packaging creates post-purchase friction."
      : "The clearest pain point is reducing trust before purchase and after delivery.",
    topSupport,
    ...(analysis.durability_issues ?? []),
    ...(analysis.packaging_issues ?? [])
  ], baseSellerInsights.main_customer_pain_points, 5);
  const improvementRecommendations = dedupeInsightList([
    productVsPackaging
      ? "Reduce plastic wrap or switch to paper-based inserts while keeping the product protected."
      : "Fix first: remove or reduce the root cause behind the leading complaint.",
    `Use satisfaction at ${formatPercent(scores.customerSatisfaction)} as the operating benchmark for the next product revision.`,
    scores.complaintSeverity >= 60
      ? "Reduce the highest-severity complaint before increasing traffic."
      : "Protect the product strengths while monitoring low-frequency complaints."
  ], baseSellerInsights.product_improvement_recommendations, 6);
  const listingSuggestions = dedupeInsightList([
    productVsPackaging
      ? "Advertise fit and protection, but avoid eco-friendly claims until packaging is improved."
      : "Clarify the main limitation before checkout so shoppers are not surprised.",
    praiseProof === "the strongest real customer benefit"
      ? "Move the strongest real customer benefit higher in the listing once enough clean review evidence is available."
      : `Move customer proof about ${praiseProof} higher in the listing with photos, benefit bullets, and clear expectation language.`,
    "Show product scale, contents, limitations, and support policy before checkout."
  ], baseSellerInsights.listing_improvement_suggestions, 6);
  const packagingIssues = dedupeInsightList([
    productVsPackaging ? "Overpackaging concern: customers dislike excess plastic even when product quality is acceptable." : undefined,
    ...normalizedComplaintLabels(analysis.packaging_issues)
  ], baseSellerInsights.packaging_shipping_issues, 4);
  const shippingIssues = dedupeInsightList([
    productVsPackaging ? "Packaging is a presentation and sustainability issue unless damage or missing parts appears." : undefined,
    ...packagingIssues
  ], baseSellerInsights.shipping_complaint_detection, 4);
  const refundRisks = dedupeInsightList([
    productVsPackaging
      ? "Packaging complaints may lower ratings over time, but they are not a direct return risk unless items arrive damaged or missing."
      : `${complaintLabel} could become a return driver if it keeps appearing in new reviews.`,
    ...(analysis.durability_issues ?? []),
    ...(analysis.support_issues ?? [])
  ], baseSellerInsights.refund_risk_issues, 5);
  const featureRequests = dedupeInsightList([
    topFeatureRequest,
    ...(analysis.feature_requests ?? [])
  ], baseSellerInsights.feature_requests, 5);
  const positioning = dedupeInsightList([
    productVsPackaging
      ? `Position around ${praiseProof}; treat sustainability as an improvement path, not a current promise.`
      : scores.valueScore >= 70
        ? `Position around value and ${praiseProof}, while directly answering the main concern.`
        : "Avoid overclaiming value until the leading complaint is handled.",
    `Customers currently perceive the product through a ${sentimentLabel} sentiment lens.`
  ], baseSellerInsights.competitor_opportunity_insights, 5);
  const sellerRecommendations = dedupeInsightList([
    productVsPackaging
      ? "Today: keep the product story positive, then reduce unnecessary plastic before asking for more reviews."
      : "Today: fix or explain the leading complaint in the listing and product experience.",
    `This week: turn ${praiseProof} into a proof-led listing section with one clear claim, one photo cue, and one buyer expectation note.`,
    `Track satisfaction weekly and keep Shopper score and Seller score within the same evidence model.`
  ], baseSellerInsights.seller_recommendations, 5);

  return {
    ...baseSellerInsights,
    main_customer_pain_points: scores.insufficientData ? [NOT_ENOUGH_REVIEW_DATA] : dedupeInsightList([...customerSatisfaction, ...painPoints], [], 5),
    complaint_clusters: scores.insufficientData ? [NOT_ENOUGH_REVIEW_DATA] : complaintClusters.slice(0, 6),
    product_improvement_recommendations: scores.insufficientData ? [NOT_ENOUGH_REVIEW_DATA] : improvementRecommendations.slice(0, 6),
    listing_improvement_suggestions: scores.insufficientData ? [NOT_ENOUGH_REVIEW_DATA] : listingSuggestions.slice(0, 6),
    packaging_shipping_issues: packagingIssues.length ? packagingIssues.slice(0, 5) : [NOT_ENOUGH_REVIEW_DATA],
    shipping_complaint_detection: shippingIssues.length ? shippingIssues.slice(0, 5) : [NOT_ENOUGH_REVIEW_DATA],
    sentiment_trends: scores.insufficientData
      ? [NOT_ENOUGH_REVIEW_DATA]
      : [
          `${formatPercent(scores.sentimentPercent)} sentiment: review emotion is ${sentimentLabelFromPercent(scores.sentimentPercent).toLowerCase()}.`,
          scores.complaintSeverity >= 60
            ? `Complaint severity is ${formatPercent(scores.complaintSeverity)}, so negative themes need operational follow-up.`
            : `Complaint severity is ${formatPercent(scores.complaintSeverity)}, so issues are manageable but worth monitoring.`
        ],
    refund_risk_issues: scores.insufficientData ? [NOT_ENOUGH_REVIEW_DATA] : refundRisks.slice(0, 5),
    feature_requests: featureRequests.length ? featureRequests.slice(0, 5) : [NOT_ENOUGH_REVIEW_DATA],
    competitor_opportunity_insights: scores.insufficientData ? [NOT_ENOUGH_REVIEW_DATA] : positioning.slice(0, 5),
    seller_recommendations: scores.insufficientData ? [NOT_ENOUGH_REVIEW_DATA] : sellerRecommendations.slice(0, 5),
    seller_action_cards: analysis.seller_insights?.seller_action_cards ?? [],
    customer_satisfaction_score: scores.customerSatisfaction
  };
}

export function reconcileAnalysisScores(analysis: ReviewAnalysis, reviewCountEstimate = 0): ReviewAnalysis {
  const warnings: string[] = [];
  const rawProductScore = typeof analysis.product_score === "number" ? clampPercent(analysis.product_score) : null;
  const rawSatisfaction =
    typeof analysis.seller_insights?.customer_satisfaction_score === "number"
      ? clampPercent(analysis.seller_insights.customer_satisfaction_score)
      : null;
  const sentimentPercent = sentimentToPercent(analysis.sentiment_score);
  const fakeReviewRisk = fakeRiskFromIndicators(analysis.fake_review_indicators);
  const issueProfile = buildIssueProfile(analysis);
  const complaintSeverity = complaintSeverityFromAnalysis(analysis, sentimentPercent);
  const confidencePercent = clampPercent((analysis.confidence_score ?? 0) * 100);
  const productPerformanceScore = productPerformanceFromAnalysis(analysis, sentimentPercent, fakeReviewRisk, confidencePercent, issueProfile);
  const firstPassScore = clampPercent(
    productPerformanceScore * 0.48 +
      (rawProductScore ?? rawSatisfaction ?? sentimentPercent) * 0.18 +
      sentimentPercent * 0.14 +
      (100 - complaintSeverity) * 0.12 +
      (100 - fakeReviewRisk) * 0.05 +
      confidencePercent * 0.03
  );
  const valueScore = valueScoreFromOpinion(analysis, firstPassScore, sentimentPercent, complaintSeverity);
  const evidenceScore = clampPercent(
    productPerformanceScore * 0.44 +
      valueScore * 0.2 +
      sentimentPercent * 0.16 +
      (100 - complaintSeverity) * 0.12 +
      (100 - fakeReviewRisk) * 0.05 +
      confidencePercent * 0.03
  );

  let shopperScore = evidenceScore;
  if (rawProductScore !== null && rawSatisfaction !== null) {
    const gap = Math.abs(rawProductScore - rawSatisfaction);
    if (gap >= 25) {
      warnings.push(`Score conflict corrected: Shopper ${formatPercent(rawProductScore)} and Seller satisfaction ${formatPercent(rawSatisfaction)} did not agree.`);
      const rawAverage = (rawProductScore + rawSatisfaction) / 2;
      shopperScore = clampPercent(evidenceScore * 0.7 + rawAverage * 0.3);
      if ((rawProductScore >= 75 && rawSatisfaction <= 35) || (rawSatisfaction >= 75 && rawProductScore <= 35)) {
        shopperScore = clampPercent(Math.min(evidenceScore, Math.max(35, Math.round((rawProductScore + rawSatisfaction + evidenceScore) / 3))));
      }
    } else {
      shopperScore = clampPercent(rawProductScore * 0.55 + rawSatisfaction * 0.25 + evidenceScore * 0.2);
    }
  } else if (rawProductScore !== null) {
    shopperScore = clampPercent(rawProductScore * 0.65 + evidenceScore * 0.35);
  } else if (rawSatisfaction !== null) {
    shopperScore = clampPercent(rawSatisfaction * 0.65 + evidenceScore * 0.35);
  }

  if (issueProfile.packagingDominant && productPerformanceScore >= 68 && fakeReviewRisk < 65 && (rawSatisfaction === null || rawSatisfaction >= 45)) {
    shopperScore = Math.max(shopperScore, clampPercent(productPerformanceScore - Math.min(14, issueProfile.packagingOnlyCount * 3 + 5)));
  }

  if (fakeReviewRisk >= 75) shopperScore = Math.min(shopperScore, 58);
  if (complaintSeverity >= 75 && !issueProfile.packagingDominant) shopperScore = Math.min(shopperScore, 55);
  if (sentimentPercent <= 30) shopperScore = Math.min(shopperScore, 48);

  const insufficientData =
    reviewCountEstimate > 0
      ? reviewCountEstimate < 3
      : uniqueList([...(analysis.positive_points ?? []), ...(analysis.negative_points ?? []), ...(analysis.common_complaints ?? [])]).length < 3;
  if (insufficientData) {
    warnings.push("Review sample is too small for a confident score.");
    shopperScore = clampPercent(Math.min(shopperScore, 60));
  }

  let customerSatisfaction = clampPercent(productPerformanceScore * 0.48 + sentimentPercent * 0.22 + shopperScore * 0.22 + (100 - complaintSeverity) * 0.08);
  if (issueProfile.packagingDominant && issueProfile.severeProductCount === 0) {
    customerSatisfaction = Math.max(customerSatisfaction, Math.min(78, shopperScore + 8));
  }
  const maxScoreGap = issueProfile.packagingDominant && issueProfile.severeProductCount === 0 ? 14 : 12;
  if (Math.abs(customerSatisfaction - shopperScore) > maxScoreGap) {
    customerSatisfaction = clampPercent(shopperScore + Math.sign(customerSatisfaction - shopperScore) * maxScoreGap);
  }
  const alignmentNote =
    customerSatisfaction > shopperScore + 10
      ? "Customers appear happier with the product after use than the Shopper score suggests; buying confidence is lower because risk, packaging, or evidence quality still matters."
      : shopperScore > customerSatisfaction + 10
        ? "The Shopper score is stronger than satisfaction because value and buying intent are positive, but post-purchase issues still need seller attention."
        : "Shopper score and Seller satisfaction are aligned from the same ReviewIntel evidence model.";
  const recommendation = recommendationFor(shopperScore, warnings, insufficientData, {
    packagingDominant: issueProfile.packagingDominant,
    productPerformanceScore,
    dominantComplaint: issueProfile.dominantComplaint
  });
  const baseSellerInsights = {
    main_customer_pain_points: analysis.seller_insights?.main_customer_pain_points ?? [],
    complaint_clusters: analysis.seller_insights?.complaint_clusters ?? analysis.common_complaints ?? [],
    product_improvement_recommendations: analysis.seller_insights?.product_improvement_recommendations ?? analysis.improvement_suggestions ?? [],
    listing_improvement_suggestions: analysis.seller_insights?.listing_improvement_suggestions ?? [],
    packaging_shipping_issues: analysis.seller_insights?.packaging_shipping_issues ?? analysis.packaging_issues ?? [],
    shipping_complaint_detection: analysis.seller_insights?.shipping_complaint_detection ?? [],
    sentiment_trends: analysis.seller_insights?.sentiment_trends ?? [],
    refund_risk_issues: analysis.seller_insights?.refund_risk_issues ?? [],
    feature_requests: analysis.seller_insights?.feature_requests ?? analysis.feature_requests ?? [],
    competitor_opportunity_insights: analysis.seller_insights?.competitor_opportunity_insights ?? [],
    seller_recommendations: analysis.seller_insights?.seller_recommendations ?? analysis.improvement_suggestions ?? [],
    seller_action_cards: analysis.seller_insights?.seller_action_cards ?? [],
    customer_satisfaction_score: customerSatisfaction
  };
  const scores: ScoreBundle = {
    shopperScore,
    customerSatisfaction,
    sentimentPercent,
    complaintSeverity,
    fakeReviewRisk,
    valueScore,
    confidencePercent,
    productPerformanceScore,
    packagingDominant: issueProfile.packagingDominant,
    dominantComplaint: issueProfile.dominantComplaint,
    warnings,
    insufficientData
  };
  const normalizedComplaints = normalizedComplaintLabels(analysis.common_complaints);

  return {
    ...analysis,
    common_complaints: normalizedComplaints.length ? normalizedComplaints : analysis.common_complaints,
    product_score: shopperScore,
    buyer_recommendation: recommendation,
    customer_recommendation: recommendation,
    sentiment_score: percentToSentiment(sentimentPercent),
    fake_review_risk_score: fakeReviewRisk,
    value_score: valueScore,
    complaint_severity_score: complaintSeverity,
    sentiment_percentage: sentimentPercent,
    consistency_warnings: warnings,
    insufficient_data: insufficientData,
    score_alignment_note: alignmentNote,
    score_basis: warnings.length
      ? "Scores were reconciled from the shared ReviewIntel evidence model."
      : "Scores come from the shared ReviewIntel evidence model.",
    seller_insights: buildSectionSpecificSellerInsights(analysis, scores, baseSellerInsights)
  };
}
