import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { SellerBusinessKpiDashboard } from "@/components/SellerBusinessKpiDashboard";
import { SponsorAnalytics } from "@/components/SponsorAnalytics";
import {
  fakeRiskFromIndicators,
  formatPercent,
  riskLabel,
  sentimentToPercent
} from "@/lib/analysisScoring";
import {
  cleanReviewInsightText,
  sanitizeInsightList,
  sanitizeSellerInsightList,
  sellerFriendlyTheme
} from "@/lib/insightSanitizer";
import { platformLabel } from "@/lib/platforms";
import type { AnalyzeResponse, CustomerRecommendation, SubscriptionPlan } from "@/lib/types";
import { makeSellerAdvice, makeSellerAction, makeSellerHeadline } from "@/lib/sellerAdviceEngine";
import { AdSlot } from "@/components/advertising/AdSlot";


type TrustCriterion = {
  id: string;
  title: string;
  subtitle: string;
  visual: string;
  score: number;
  status: string;
  tone: TrustTone;
  priority: string;
  summary: string;
  why: string;
  evidence: string[];
  worries: string[];
  trusted: string[];
  actions: string[];
};


function trustStatus(score: number): { status: string; tone: TrustTone } {
  if (score >= 85) return { status: "Excellent", tone: "good" };
  if (score >= 70) return { status: "Strong", tone: "info" };
  if (score >= 55) return { status: "Watch", tone: "warn" };
  if (score >= 40) return { status: "Concern", tone: "bad" };
  return { status: "Critical", tone: "bad" };
}

function scoreNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Math.round(clamp(fallback));
  return Math.round(clamp(number));
}

function scorePercent(value: unknown, fallback = 0) {
  return `${scoreNumber(value, fallback)}%`;
}

function widthPercent(value: unknown, fallback = 0) {
  return `${scoreNumber(value, fallback)}%`;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function recommendationTone(verdict: CustomerRecommendation) {
  if (verdict === "Buy") return "good";
  if (verdict === "Avoid") return "bad";
  return "warn";
}

function confidenceTone(label: string | undefined): "good" | "warn" | "bad" {
  if (label === "High") return "good";
  if (label === "Medium") return "warn";
  return "bad";
}

function ratingTotal(breakdown: AnalyzeResponse["meta"]["rating_breakdown"]) {
  if (!breakdown) return 0;
  return Object.values(breakdown).reduce((sum, value) => sum + value, 0);
}

function buyingNotes(analysis: AnalyzeResponse["analysis"]) {
  const scanBasedNotes = sanitizeInsightList(
    [
      analysis.common_complaints[0],
      analysis.quality_concerns[0],
      analysis.durability_issues[0],
      analysis.support_issues[0],
      analysis.fake_review_indicators[0],
      analysis.value_for_money_opinion,
      analysis.overall_summary
    ],
    [],
    1
  );

  return cleanReviewInsightText(
    scanBasedNotes[0],
    "No major buying concern stood out in this scan."
  ).split(/[.!?]/)[0]?.slice(0, 64) || "No major buying concern stood out in this scan";
}

function topComplaint(analysis: AnalyzeResponse["analysis"]) {
  return cleanReviewInsightText(
    analysis.common_complaints[0] ??
      analysis.negative_points[0] ??
      analysis.quality_concerns[0] ??
      "No repeated complaint stood out.",
    "No repeated complaint stood out."
  );
}

function shortShopperPhrase(value: string | undefined, fallback: string, maxWords = 6) {
  const text = cleanReviewInsightText(value, fallback).replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim();
  const firstClause = text.split(/[.;:]/)[0]?.trim() || fallback;
  const words = firstClause.split(" ").filter(Boolean);

  if (words.length <= maxWords) return firstClause;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function cleanOneLine(value: string | undefined, fallback: string, maxChars = 44) {
  const text = cleanReviewInsightText(value, fallback).replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim();
  if (!text) return fallback;
  if (text.toLowerCase().includes("no strong repeated complaint")) return "No repeated complaint";
  if (text.toLowerCase().includes("no repeated complaint")) return "No repeated complaint";
  if (text.length <= maxChars) return text;

  const cut = text.slice(0, maxChars).replace(/\s+\S*$/, "").replace(/[,;:]+$/, "").trim();
  return cut || fallback;
}

function buyerRecommendationLine(verdict: CustomerRecommendation, riskLevel: string) {
  if (verdict === "Buy") return riskLevel === "High" ? "Buy only after checking the warning." : "Worth it for the right buyer.";
  if (verdict === "Maybe") return "Compare first before buying.";
  return "Skip unless the issue is fixed.";
}

function RatingBreakdown({ breakdown }: { breakdown: AnalyzeResponse["meta"]["rating_breakdown"] }) {
  const total = ratingTotal(breakdown);

  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Rating breakdown</p>
      <div className="mt-4 grid gap-3">
        {(["5", "4", "3", "2", "1"] as const).map((rating) => {
          const count = breakdown?.[rating] ?? 0;
          const width = total ? Math.max(4, (count / total) * 100) : 4;
          return (
            <div key={rating} className="grid grid-cols-[32px_minmax(0,1fr)_36px] items-center gap-3 text-sm">
              <span className="font-black break-words text-ink dark:text-white">{rating}</span>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div className="h-full rounded-full bg-amber" style={{ width: `${width}%` }} />
              </div>
              <span className="text-right text-slate-500 dark:text-slate-400">{count}</span>
            </div>
          );
        })}
      </div>
      {!total ? <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No rating metadata detected in the pasted sample.</p> : null}
    </article>
  );
}

function SellerKpi({
  label,
  value,
  detail,
  tone
}: {
  label: string;
  value: string;
  detail: string;
  tone: "good" | "warn" | "bad" | "info";
}) {
  const border = {
    good: "border-teal/30",
    warn: "border-amber/30",
    bad: "border-coral/30",
    info: "border-ocean/30"
  }[tone];

  return (
    <article className={`rounded-2xl border ${border} bg-white p-5 shadow-soft dark:bg-white/[0.04]`}>
      <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-4 break-words text-2xl font-black leading-tight text-ink dark:text-white xl:text-3xl">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail}</p>
    </article>
  );
}

function SellerSignalBar({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" | "bad" | "info" }) {
  const color = {
    good: "bg-teal",
    warn: "bg-amber",
    bad: "bg-coral",
    info: "bg-ocean"
  }[tone];

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-ink dark:text-white">{label}</span>
        <span className="font-black text-slate-500 dark:text-slate-400">{formatPercent(value)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${clamp(value)}%` }} />
      </div>
    </div>
  );
}


function uniqueSellerItems(items: Array<string | undefined>, fallback: string[] = [], limit = 4) {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const item of sanitizeSellerInsightList(items, fallback, limit * 3)) {
    const fullText = cleanReviewInsightText(item, "")?.trim().replace(/\s+/g, " ");
    const themeText = sellerFriendlyTheme(item, "")?.trim().replace(/\s+/g, " ");
    const text = fullText && fullText.split(/\s+/).length > 4 ? fullText : themeText;
    if (!text || text.length < 8) continue;
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(text.replace(/\.$/, ""));
    if (cleaned.length >= limit) break;
  }

  return cleaned.length ? cleaned : ["Not enough review data for a confident read."];
}

function countTextSignals(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.reduce((count, word) => count + (lower.includes(word) ? 1 : 0), 0);
}

type SellerLane = "authenticity" | "reliability" | "value" | "care";

function normalizeTopicKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function laneInsight(lane: SellerLane, value: string | undefined, fallback: string) {
  const clean = cleanReviewInsightText(value, "");
  const theme = sellerFriendlyTheme(clean || value, "");
  const text = `${clean} ${theme}`.toLowerCase();

  if (!text.trim()) return fallback;

  if (lane === "authenticity") {
    if (/fake|generic|template|polished|repeat|suspicious|incentiv/i.test(text)) {
      return "Review wording needs authenticity checking before sellers use it as proof.";
    }
    if (/verified|photo|image|video|specific|detail|usage|use case|balanced/i.test(text)) {
      return "Specific usage details make the review set easier for buyers to trust.";
    }
    if (/confidence|valid review|evidence|sample|review count/i.test(text)) {
      return "Evidence quality depends on review volume, specific use cases, and balanced pros and cons.";
    }
    return fallback;
  }

  if (lane === "reliability") {
    if (/fit|size|model|compatible|compatibility|macbook|case|cutout/i.test(text)) {
      return "Reliability risk is expectation match: buyers need exact model, size, and compatibility proof.";
    }
    if (/durab|broken|defect|stopped|weak|scratch|leak|seal|lid|motor/i.test(text)) {
      return "Long-term reliability should be proven with durability, defect, and after-use evidence.";
    }
    if (/quality|material|shell|finish|premium|cheap|performance|works/i.test(text)) {
      return "Buyers need stronger proof that the product performs well after delivery, not just in the listing photos.";
    }
    return fallback;
  }

  if (lane === "value") {
    if (/price|value|worth|budget|affordable|expensive|cost|quality/i.test(text)) {
      return makeSellerAdvice({ category: "value", score: 62, complaint: text });
    }
    if (/included|bundle|accessor|keyboard|adapter|template/i.test(text)) {
      return "Bundle clarity affects value because shoppers judge whether everything expected is included.";
    }
    if (/positive|praise|benefit|daily|useful|protect|easy/i.test(text)) {
      return "Use clean customer proof to show the practical payoff buyers get for the price.";
    }
    return fallback;
  }

  if (/packag|plastic|wrap|box|unboxing/i.test(text)) {
    return "Packaging and unboxing expectations need clear control before checkout.";
  }
  if (/shipping|delivery|arrived|late|carrier/i.test(text)) {
    return "Delivery reliability can affect trust even when the product itself is liked.";
  }
  if (/support|service|refund|return|replacement|warranty|seller/i.test(text)) {
    return "Support, returns, replacement, and warranty promises should be visible before checkout.";
  }
  return fallback;
}

function laneItems(lane: SellerLane, items: Array<string | undefined>, fallback: string[], limit = 3) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of [...items, ...fallback]) {
    const text = laneInsight(lane, item, fallback[0] ?? "Not enough clean evidence yet.");
    const key = normalizeTopicKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }

  return output.length ? output : fallback.slice(0, limit);
}

function actionForTheme(value: string | undefined) {
  const theme = sellerFriendlyTheme(value, "").toLowerCase();

  if (/fit|compat|model|size|cutout/.test(theme)) {
    return makeSellerAction("compatibility", 48);
  }
  if (/price|value|quality/.test(theme)) {
    return makeSellerAction("value", 56);
  }
  if (/durability|reliability|defect|leak|seal|lid|motor/.test(theme)) {
    return "Show real-use durability proof and be honest about what the product is not designed to handle.";
  }
  if (/packaging|unboxing|shipping|delivery/.test(theme)) {
    return "Reduce packaging friction and explain what arrives in the box before checkout.";
  }
  if (/support|returns|warranty|refund|replacement/.test(theme)) {
    return "Add a short support promise near the buy button: returns, warranty, replacement, and how customers get help.";
  }
  if (/instruction|setup|install/.test(theme)) {
    return "Add setup photos, steps, and common mistakes so customers can use the product correctly.";
  }

  return makeSellerAction("opportunity", 68);
}

function sellerActionItems(items: Array<string | undefined>, fallback: string[], limit = 4) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of [...items, ...fallback]) {
    const text = actionForTheme(item);
    const key = normalizeTopicKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }

  return output.length ? output : fallback.slice(0, limit);
}


function buildTrustCriteria(result: AnalyzeResponse) {
  const { analysis, meta } = result;
  const fakeRisk = analysis.fake_review_risk_score ?? fakeRiskFromIndicators(analysis.fake_review_indicators);
  const confidencePercent = analysis.confidence_score * 100;
  const sentimentPercentScore = analysis.sentiment_percentage ?? sentimentToPercent(analysis.sentiment_score);
  const valueScore = analysis.value_score ?? clamp(analysis.product_score * 0.65 + sentimentPercentScore * 0.35);
  const complaintPressure = analysis.complaint_severity_score ?? clamp(analysis.common_complaints.length * 14 + analysis.negative_points.length * 8);
  const reviewConfidenceLabel = meta.confidence_label ?? (meta.review_count_estimate >= 50 ? "High" : meta.review_count_estimate >= 10 ? "Medium" : "Low");
  const allEvidenceText = [
    analysis.overall_summary,
    analysis.value_for_money_opinion,
    ...analysis.positive_points,
    ...analysis.negative_points,
    ...analysis.common_complaints,
    ...analysis.praised_features,
    ...analysis.quality_concerns,
    ...analysis.fake_review_indicators,
    ...analysis.improvement_suggestions,
    ...analysis.packaging_issues,
    ...analysis.durability_issues,
    ...analysis.support_issues,
    ...analysis.seller_insights.main_customer_pain_points,
    ...analysis.seller_insights.product_improvement_recommendations,
    ...analysis.seller_insights.listing_improvement_suggestions,
    ...analysis.seller_insights.packaging_shipping_issues,
    ...analysis.seller_insights.refund_risk_issues,
    ...analysis.seller_insights.feature_requests,
    ...analysis.seller_insights.competitor_opportunity_insights,
    ...analysis.keyword_analysis.map((item) => `${item.keyword} ${item.context}`)
  ].join(" ");
  const hasPositiveAndNegative = analysis.positive_points.length > 0 && (analysis.common_complaints.length > 0 || analysis.negative_points.length > 0);
  const detailSignals = countTextSignals(allEvidenceText, ["verified", "specific", "photo", "image", "video", "use", "daily", "fit", "size", "installed", "after", "month"]);
  const fakeSignals = countTextSignals(allEvidenceText, ["fake", "generic", "templated", "incentivized", "suspicious", "repetition", "polished"]);
  const reliabilityRisks = countTextSignals(allEvidenceText, ["broken", "defect", "defective", "stopped", "failed", "durability", "scratch", "crack", "does not work", "poor quality"]);
  const reliabilityProof = countTextSignals(allEvidenceText, ["works", "durable", "sturdy", "strong", "quality", "protect", "protection", "fits", "easy", "consistent"]);
  const valueObjections = countTextSignals(allEvidenceText, ["expensive", "overpriced", "cheap", "price", "not worth", "waste", "cost"]);
  const valueProof = countTextSignals(allEvidenceText, ["worth", "value", "price", "affordable", "budget", "quality-price", "good quality", "daily"]);
  const careRisks = countTextSignals(allEvidenceText, ["shipping", "delivery", "late", "return", "refund", "support", "service", "replacement", "damaged", "missing", "packaging"]);
  const careProof = countTextSignals(allEvidenceText, ["replacement", "refund", "support", "service", "quick", "responsive", "seller", "packaged well"]);
  const reviewVolumeBonus = meta.review_count_estimate >= 50 ? 10 : meta.review_count_estimate >= 10 ? 5 : -5;

  const authenticityRaw = clamp(
    (100 - fakeRisk) * 0.42 +
      confidencePercent * 0.3 +
      (hasPositiveAndNegative ? 82 : 58) * 0.13 +
      Math.min(100, 45 + detailSignals * 8) * 0.15 +
      reviewVolumeBonus -
      fakeSignals * 5
  );
  const reliabilityRaw = clamp(
    analysis.product_score * 0.38 +
      sentimentPercentScore * 0.2 +
      Math.min(100, 55 + reliabilityProof * 7) * 0.18 +
      Math.max(0, 100 - complaintPressure) * 0.14 -
      reliabilityRisks * 5 -
      analysis.durability_issues.length * 5 -
      analysis.quality_concerns.length * 3
  );
  const valueRaw = clamp(
    valueScore * 0.52 +
      sentimentPercentScore * 0.18 +
      Math.min(100, 55 + valueProof * 9) * 0.18 +
      Math.max(0, 100 - valueObjections * 12) * 0.12
  );
  const careRaw = clamp(
    analysis.seller_insights.customer_satisfaction_score * 0.34 +
      Math.max(0, 100 - careRisks * 9) * 0.25 +
      Math.max(0, 100 - analysis.support_issues.length * 14 - analysis.seller_insights.refund_risk_issues.length * 10) * 0.22 +
      Math.min(100, 42 + careProof * 10) * 0.19
  );

  const criteriaSeeds = [
    {
      id: "authenticity",
      title: "Authenticity",
      subtitle: "Verification and real-review confidence",
      score: authenticityRaw,
      visual: "radar" as const,
      summary: `${riskLabel(fakeRisk)} with ${reviewConfidenceLabel.toLowerCase()} evidence confidence.`,
      why: hasPositiveAndNegative
        ? "The score rewards balanced positive and negative language, review detail, and lower fake-review pressure."
        : "The score is limited because the review pattern does not show enough balanced positive and negative evidence.",
      evidence: laneItems(
        "authenticity",
        [...analysis.praised_features, ...analysis.positive_points, ...analysis.fake_review_indicators],
        [
          `${meta.review_count_estimate} valid reviews were available for this scan.`,
          "Look for verified purchase language, usage context, and specific product details in future scans."
        ]
      ),
      worries: laneItems(
        "authenticity",
        [...analysis.fake_review_indicators, ...(analysis.consistency_warnings ?? [])],
        ["No strong fake-review weakness was detected, but repetition and overly polished language should still be monitored."]
      ),
      trusted: laneItems(
        "authenticity",
        [...analysis.positive_points, ...analysis.praised_features],
        ["Customers trust the review set most when real use cases and mixed feedback are visible."]
      ),
      actions: sellerActionItems(
        [
          analysis.seller_insights.listing_improvement_suggestions[0],
          "Encourage buyers to mention use case, model/size, photos, and verified purchase context in review follow-ups.",
          "Do not over-filter negative reviews; balanced feedback increases trust."
        ],
        []
      )
    },
    {
      id: "reliability",
      title: "Reliability",
      subtitle: "Performance, durability, and product promise",
      score: reliabilityRaw,
      visual: "curve" as const,
      summary: laneItems(
        "reliability",
        [...analysis.quality_concerns, ...analysis.durability_issues, ...analysis.common_complaints],
        ["No major reliability risk dominated the supplied reviews."],
        1
      )[0],
      why: "The score compares praise about product performance against repeated quality, defect, durability, and description-match concerns.",
      evidence: laneItems("reliability", [...analysis.praised_features, ...analysis.positive_points], ["Positive proof is strongest when customers mention real-life performance after use."]),
      worries: laneItems(
        "reliability",
        [...analysis.durability_issues, ...analysis.quality_concerns, ...analysis.common_complaints],
        ["No repeated reliability defect was isolated from this review batch."]
      ),
      trusted: laneItems("reliability", [...analysis.praised_features, ...analysis.positive_points], ["Customers appear to trust product reliability when the product performs as described."]),
      actions: sellerActionItems(
        [
          ...analysis.seller_insights.product_improvement_recommendations,
          "Add product photos, sizing notes, materials, and durability proof that directly answer the top reliability worry."
        ],
        []
      )
    },
    {
      id: "value",
      title: "Value",
      subtitle: "Price fairness and buyer payoff",
      score: valueRaw,
      visual: "ring" as const,
      summary: laneItems("value", [analysis.value_for_money_opinion, ...analysis.praised_features, ...analysis.positive_points], ["Value perception depends on whether customers connect price to quality and daily usefulness."], 1)[0],
      why: "The value score weighs price language, usefulness, material quality, expectation match, and overall sentiment.",
      evidence: laneItems("value", [...analysis.praised_features, ...analysis.positive_points], ["Value proof is strongest when customers say the product is worth the price."]),
      worries: laneItems(
        "value",
        [...analysis.negative_points, ...analysis.common_complaints].filter((item) => /price|value|cheap|expensive|worth|quality/i.test(item)),
        ["No repeated price objection stood out in the supplied reviews."]
      ),
      trusted: laneItems("value", [...analysis.praised_features, ...analysis.positive_points], ["Customers trust the value story when quality, utility, and expectations line up."]),
      actions: sellerActionItems(
        [
          analysis.seller_insights.listing_improvement_suggestions[0],
          "Clarify what the buyer gets for the price: materials, fit, use case, included items, and expected lifespan.",
          "Use the strongest value proof in bullets, comparison tables, and ad copy."
        ],
        []
      )
    },
    {
      id: "customer-care",
      title: "Customer Care",
      subtitle: "Shipping, support, refunds, and recovery trust",
      score: careRaw,
      visual: "bars" as const,
      summary: laneItems("care", [...analysis.support_issues, ...analysis.seller_insights.packaging_shipping_issues, ...analysis.seller_insights.refund_risk_issues], ["No major customer-care complaint dominated this scan."], 1)[0],
      why: "The score checks whether post-purchase issues are handled clearly: delivery, packaging, refunds, replacement, service, and recovery after problems.",
      evidence: laneItems("care", [...analysis.seller_insights.packaging_shipping_issues, ...analysis.support_issues], ["Customer-care evidence is limited unless reviews mention shipping, support, replacement, or returns."]),
      worries: laneItems(
        "care",
        [...analysis.support_issues, ...analysis.seller_insights.refund_risk_issues, ...analysis.seller_insights.packaging_shipping_issues],
        ["No repeated service or fulfillment complaint was isolated from this review batch."]
      ),
      trusted: laneItems("care", [...analysis.positive_points, ...analysis.praised_features], ["Customers trust the seller more when reviews show quick resolution and clean delivery."]),
      actions: sellerActionItems(
        [
          ...analysis.seller_insights.seller_recommendations,
          "Add visible support promises, replacement rules, packaging expectations, and return guidance where buyers decide."
        ],
        []
      )
    }
  ];

  const criteria: TrustCriterion[] = criteriaSeeds.map((item) => {
    const roundedScore = scoreNumber(item.score);
    const status = trustStatus(roundedScore);
    return {
      ...item,
      score: roundedScore,
      status: status.status,
      tone: status.tone,
      priority: roundedScore < 45 ? "Immediate fix" : roundedScore < 65 ? "High priority" : roundedScore < 80 ? "Monitor closely" : "Maintain"
    };
  });

  const overallTrustScore = scoreNumber(criteria.reduce((sum, item) => sum + item.score, 0) / criteria.length);
  const biggestBlocker = [...criteria].sort((left, right) => left.score - right.score)[0];
  const biggestOpportunity = [...criteria].sort((left, right) => right.score - left.score)[0];
  const topActions = sellerActionItems(
    [
      biggestBlocker.actions[0],
      ...analysis.seller_insights.product_improvement_recommendations,
      ...analysis.seller_insights.listing_improvement_suggestions,
      ...analysis.seller_insights.seller_recommendations
    ],
    [
      "Fix the weakest trust criterion before scaling traffic.",
      "Turn the strongest proof point into clearer listing copy.",
      "Ask future reviewers to mention real use cases and post-purchase experience."
    ],
    3
  );
  const listingRecommendations = sellerActionItems(
    analysis.seller_insights.listing_improvement_suggestions,
    [
      "Update listing bullets to answer the biggest buyer worry before checkout.",
      "Add proof for the top trusted feature using photos, sizing, material detail, or warranty language."
    ],
    3
  );

  return {
    criteria,
    overallTrustScore,
    biggestBlocker,
    biggestOpportunity,
    topActions,
    buyerConfidenceSummary:
      overallTrustScore >= 80
        ? "Buyer trust is strong. Protect it by keeping review quality natural and support promises visible."
        : overallTrustScore >= 65
          ? "Buyer trust is workable, but one trust criterion needs clearer proof before the product feels fully safe."
          : overallTrustScore >= 45
            ? "Buyer trust is fragile. The seller should fix the weakest proof gap before pushing more traffic."
            : "Buyer trust is at risk. The reviews do not yet prove enough authenticity, reliability, value, or care.",
    listingRecommendations
  };
}


type TrustTone = "good" | "info" | "warn" | "bad";

const TRUST_TONE_STYLE: Record<TrustTone, {
  ring: string;
  fill: string;
  bg: string;
  text: string;
  hex: string;
  soft: string;
  border: string;
  shell: string;
  badge: string;
  bar: string;
}> = {
  good: {
    ring: "border-emerald-200 dark:border-emerald-400/30",
    fill: "bg-emerald-500",
    bg: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    hex: "#10b981",
    soft: "bg-emerald-100/80 dark:bg-emerald-500/15",
    border: "border-emerald-200 dark:border-emerald-400/30",
    shell: "from-emerald-50 via-white to-teal-50 dark:from-emerald-950/30 dark:via-slate-950 dark:to-teal-950/20",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
    bar: "from-emerald-400 to-teal-500",
  },
  info: {
    ring: "border-sky-200 dark:border-sky-400/30",
    fill: "bg-sky-500",
    bg: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    hex: "#0ea5e9",
    soft: "bg-sky-100/80 dark:bg-sky-500/15",
    border: "border-sky-200 dark:border-sky-400/30",
    shell: "from-sky-50 via-white to-cyan-50 dark:from-sky-950/30 dark:via-slate-950 dark:to-cyan-950/20",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
    bar: "from-sky-400 to-cyan-500",
  },
  warn: {
    ring: "border-amber-200 dark:border-amber-400/30",
    fill: "bg-amber-500",
    bg: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    hex: "#f59e0b",
    soft: "bg-amber-100/80 dark:bg-amber-500/15",
    border: "border-amber-200 dark:border-amber-400/30",
    shell: "from-amber-50 via-white to-orange-50 dark:from-amber-950/30 dark:via-slate-950 dark:to-orange-950/20",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
    bar: "from-amber-400 to-orange-500",
  },
  bad: {
    ring: "border-rose-200 dark:border-rose-400/30",
    fill: "bg-rose-500",
    bg: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
    hex: "#f43f5e",
    soft: "bg-rose-100/80 dark:bg-rose-500/15",
    border: "border-rose-200 dark:border-rose-400/30",
    shell: "from-rose-50 via-white to-red-50 dark:from-rose-950/30 dark:via-slate-950 dark:to-red-950/20",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200",
    bar: "from-rose-400 to-red-500",
  },
};

function TrustMetricVisual({ criterion }: { criterion: TrustCriterion }) {
  const style = TRUST_TONE_STYLE[criterion.tone];
  const score = clamp(criterion.score);

  if (criterion.visual === "bars") {
    return (
      <div className="flex h-32 items-end justify-center gap-3">
        {[0.55, 0.7, 0.86, 1, 0.78, 0.64].map((scale, index) => (
          <span key={index} className="w-5 rounded-full bg-slate-200 dark:bg-white/10">
            <span className={`block rounded-full ${style.bg}`} style={{ height: `${Math.max(24, score * scale)}px` }} />
          </span>
        ))}
      </div>
    );
  }

  if (criterion.visual === "curve") {
    return (
      <div className="grid h-32 place-items-center">
        <svg viewBox="0 0 260 120" className="h-full w-full max-w-[260px]" role="img" aria-label={`${criterion.title} indicator`}>
          <path d="M20 86 C72 14 122 108 178 34 C204 8 232 26 242 54" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
          <path d="M20 86 C72 14 122 108 178 34 C204 8 232 26 242 54" fill="none" stroke={style.hex} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${score * 3} 340`} />
          <circle cx={Math.min(232, 28 + score * 2.05)} cy={score >= 70 ? 42 : score >= 45 ? 68 : 86} r="13" fill={style.hex} stroke="white" strokeWidth="6" />
        </svg>
      </div>
    );
  }

  if (criterion.visual === "radar") {
    return (
      <div className="grid h-32 place-items-center">
        <div className="relative grid size-32 place-items-center rounded-full border border-slate-200 bg-white shadow-inner dark:border-white/10 dark:bg-white/[0.04]">
          <span className="absolute h-px w-24 bg-slate-200 dark:bg-white/10" />
          <span className="absolute h-24 w-px bg-slate-200 dark:bg-white/10" />
          <span className={`grid size-20 place-items-center rounded-full ${style.soft}`}>
            <span className={`size-10 rounded-full ${style.bg} shadow-[0_12px_35px_rgba(15,23,42,0.2)]`} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-32 place-items-center">
      <div
        className="grid size-32 place-items-center rounded-full p-3 shadow-inner"
        style={{ background: `conic-gradient(${style.hex} ${score * 3.6}deg, #e2e8f0 0deg)` }}
      >
        <div className="grid size-24 place-items-center rounded-full bg-white dark:bg-slate-950">
          <span className={`text-3xl font-black ${style.text}`}>{Math.round(Number(score) || 0)}</span>
        </div>
      </div>
    </div>
  );
}

function TrustCriterionCard({ criterion }: { criterion: TrustCriterion }) {
  const [open, setOpen] = useState(false);
  const style = TRUST_TONE_STYLE[criterion.tone];

  return (
    <article className={`min-h-[520px] rounded-[1.75rem] border ${style.border} bg-white p-5 shadow-soft dark:bg-slate-950`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-black leading-tight text-ink dark:text-white">{criterion.title}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-slate-500 dark:text-slate-400">{criterion.subtitle}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black uppercase ${style.soft} ${style.text}`}>{criterion.status}</span>
      </div>

      <TrustMetricVisual criterion={criterion} />

      <div className="mt-3 grid gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className={`text-4xl font-black leading-none ${style.text}`}>{scorePercent(criterion.score)}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Trust score</p>
          </div>
          <span className={`rounded-full px-3 py-2 text-xs font-black ${style.bg} text-white`}>{criterion.priority}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div className={`h-full rounded-full ${style.bg}`} style={{ width: widthPercent(criterion.score) }} />
        </div>
      </div>

      <p className="mt-4 min-h-[72px] text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
        {criterion.summary}
      </p>

      {open ? (
        <div className="mt-4 max-h-[380px] overflow-y-auto rounded-[1.4rem] border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className={`text-xs font-black uppercase tracking-[0.18em] ${style.text}`}>{criterion.title} proof</p>
          <p className="mt-2 text-sm font-black leading-6 text-ink dark:text-white">{criterion.why}</p>
          <div className="mt-4 grid gap-3">
            {[
              ["Evidence", criterion.evidence],
              ["Worry", criterion.worries],
              ["Action", criterion.actions]
            ].map(([title, items]) => (
              <div key={title as string} className="rounded-2xl bg-white p-3 dark:bg-slate-950">
                <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{title as string}</p>
                <ul className="mt-2 grid gap-2">
                  {(items as string[]).slice(0, 3).map((item, index) => (
                    <li key={`${item}-${index}`} className="text-xs font-semibold leading-5 text-slate-700 dark:text-slate-300">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-4 rounded-2xl border border-line px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-ocean transition hover:border-ocean hover:bg-ocean hover:text-white dark:border-white/10 dark:text-cyan-300"
      >
        {open ? "Hide proof" : "See seller proof"}
      </button>
    </article>
  );
}

function SellerTrustCriteriaDashboard({ result }: { result: AnalyzeResponse }) {
  const diagnosis = buildTrustCriteria(result);
  const overallTone = trustStatus(diagnosis.overallTrustScore).tone;
  const overallStyle = TRUST_TONE_STYLE[overallTone];

  return (
    <section className="space-y-5">
      <div className="rounded-[2rem] border border-line bg-[linear-gradient(135deg,#f8fbff,#eef7ff_42%,#fff7eb)] p-5 shadow-soft dark:border-white/10 dark:bg-slate-950 dark:bg-none">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Badge tone="info">Seller Pro Trust Criteria</Badge>
            <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-ink dark:text-white">Do these reviews prove buyers can trust this product?</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              ReviewIntel grades the scan across authenticity, reliability, value, and customer care so sellers can see the exact trust blocker before spending more on traffic.
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Overall Trust Score</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <p className={`text-4xl font-black leading-none ${overallStyle.text}`}>{scorePercent(diagnosis.overallTrustScore)}</p>
              <span className={`rounded-full px-4 py-2 text-xs font-black uppercase ${overallStyle.bg} text-white`}>{trustStatus(diagnosis.overallTrustScore).status}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-300">{diagnosis.buyerConfidenceSummary}</p>
          </div>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        {diagnosis.criteria.map((criterion) => (
          <TrustCriterionCard key={criterion.id} criterion={criterion} />
        ))}
      </section>

      <article className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-ocean dark:text-cyan-300">Seller Trust Diagnosis</p>
            <h3 className="mt-3 text-3xl font-black break-words text-ink dark:text-white">Here is what is stopping more buyers from trusting this product.</h3>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{makeSellerHeadline("trust", 42)}</p>
                <p className="mt-2 text-lg font-black break-words text-ink dark:text-white">{diagnosis.biggestBlocker.title}: {diagnosis.biggestBlocker.status}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{diagnosis.biggestBlocker.summary}</p>
              </div>
              <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Biggest conversion opportunity</p>
                <p className="mt-2 text-lg font-black break-words text-ink dark:text-white">{diagnosis.biggestOpportunity.title}: {diagnosis.biggestOpportunity.status}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{diagnosis.biggestOpportunity.trusted[0]}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-line p-5 dark:border-white/10">
              <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Top 3 actions next</p>
              <ol className="mt-4 grid gap-3">
                {diagnosis.topActions.map((item, index) => (
                  <li key={item} className="grid grid-cols-[32px_1fr] gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    <span className="grid size-8 place-items-center rounded-full bg-ink text-xs font-black text-white dark:bg-white dark:text-ink">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-line p-5 dark:border-white/10">
              <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Listing improvements</p>
              <ul className="mt-4 grid gap-3">
                {diagnosis.listingRecommendations.map((item) => (
                  <li key={item} className="text-sm leading-6 text-slate-700 dark:text-slate-300">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

function SellerTrustCriteriaSnapshot({ result, accountPlan }: { result: AnalyzeResponse; accountPlan?: SubscriptionPlan | null }) {
  const diagnosis = buildTrustCriteria(result);
  const overallTone = trustStatus(diagnosis.overallTrustScore).tone;
  const overallStyle = TRUST_TONE_STYLE[overallTone];
  const sellerPlanLabel = accountPlan === "seller_pro" ? "Seller Pro" : accountPlan === "seller_starter" ? "Seller Premium" : "Seller Premium";

  return (
    <section className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
        <div>
          <Badge tone="info">{sellerPlanLabel} trust snapshot</Badge>
          <h2 className="mt-4 text-3xl font-black leading-tight text-ink dark:text-white">Core seller trust read.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Seller Premium gets the growth diagnosis and buyer confidence summary. Seller Pro unlocks deeper evidence, blockers, action sequencing, command tools, and full criteria detail.
          </p>
          <div className="mt-5 rounded-2xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Overall trust</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className={`text-4xl font-black leading-none ${overallStyle.text}`}>{scorePercent(diagnosis.overallTrustScore)}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${overallStyle.bg} text-white`}>{trustStatus(diagnosis.overallTrustScore).status}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{diagnosis.buyerConfidenceSummary}</p>
          </div>
          <Link href="/pricing" className="mt-5 inline-flex rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ocean dark:bg-white dark:text-ink">
            Upgrade to Seller Pro
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {diagnosis.criteria.map((criterion) => {
            const status = trustStatus(criterion.score);
            const style = TRUST_TONE_STYLE[status.tone];

            return (
              <article key={criterion.id} className="rounded-3xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{criterion.title}</p>
                    <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">{status.status}</p>
                  </div>
                  <p className={`text-3xl font-black ${style.text}`}>{scorePercent(criterion.score)}</p>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white dark:bg-white/10">
                  <div className={`h-full rounded-full ${style.bg}`} style={{ width: widthPercent(criterion.score) }} />
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-300">{criterion.summary}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SellerMagicMoment({ result, isSellerPro }: { result: AnalyzeResponse; isSellerPro: boolean }) {
  const { analysis, meta } = result;
  const firstComplaint = sellerFriendlyTheme(topComplaint(analysis), "the leading buyer objection needs clearer evidence");
  const firstFix = sellerFriendlyTheme(
    analysis.seller_insights.product_improvement_recommendations[0] ?? analysis.improvement_suggestions[0],
    "Fix the most repeated complaint before scaling ads."
  );
  const firstCopy = sellerFriendlyTheme(
    analysis.seller_insights.listing_improvement_suggestions[0],
    "Rewrite listing copy around the clearest customer expectation gap."
  );

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(125deg,#12091f,#2e1568_38%,#1168d8_68%,#10c6a3)] p-6 text-white shadow-[0_32px_110px_rgba(118,87,184,0.34)]">
      <div className="ri-scan-grid relative opacity-20" />
      <div className="ri-result-firework absolute right-12 top-8 hidden md:block" />
      <div className="relative grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <Badge tone={isSellerPro ? "warn" : "info"}>{isSellerPro ? "Seller Pro magic moment" : "Seller Premium insight"}</Badge>
          <h2 className="mt-5 text-3xl font-black leading-tight lg:text-3xl">Turn review pain into product revenue moves.</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
            This report is not a shopper verdict. It is a {isSellerPro ? "seller operating map" : "seller review snapshot"} built from {meta.review_count_estimate} valid reviews.
          </p>
        </div>
        <div className="grid gap-3">
          {[
            ["Most expensive complaint", firstComplaint, "Fix first"],
            ["Product move", firstFix, "Operations"],
            ["Listing move", firstCopy, "Conversion"]
          ].map(([label, value, tag]) => (
            <div key={label} className="rounded-3xl border border-white/15 bg-white/[0.12] p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">{label}</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black break-words text-ink">{tag}</span>
              </div>
              <p className="mt-3 text-lg font-black leading-7">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type ShopperCard = {
  title: string;
  question: string;
  score: number;
  metric: string;
  status: string;
  tone: TrustTone;
  visual: "radar" | "slider" | "alert";
  icon: string;
  frontLines: string[];
  details: string[];
  checks: string[];
  avoid: string;
  recommendation: string;
};

function ShopperFlipCard({ card }: { card: ShopperCard }) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const style =
    card.tone === "good"
      ? {
          shell: "from-teal/10 via-white to-cyan-100/70",
          badge: "bg-teal/12 text-teal",
          bar: "from-teal to-ocean",
          border: "border-teal/20"
        }
      : card.tone === "warn"
        ? {
            shell: "from-amber/15 via-white to-orange-100/80",
            badge: "bg-amber/15 text-amber",
            bar: "from-amber to-orange-400",
            border: "border-amber/25"
          }
        : {
            shell: "from-coral/12 via-white to-rose-100/80",
            badge: "bg-coral/12 text-coral",
            bar: "from-coral to-rose-500",
            border: "border-coral/25"
          };

  const numericScore = Math.max(0, Math.min(100, Math.round(Number(card.score) || 0)));
  const displayMetric = card.metric || `${numericScore}%`;

  return (
    <article className={`min-h-[460px] overflow-hidden rounded-[2rem] border ${style.border} bg-gradient-to-br ${style.shell} p-5 shadow-soft dark:border-white/10 dark:bg-slate-950`}>
      <div className="flex h-full min-h-[420px] flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{card.title}</p>
            <h3 className="mt-2 text-2xl font-black leading-tight text-ink dark:text-white">{card.question}</h3>
          </div>
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${style.badge} text-xl font-black shadow-inner`}>
            {card.icon}
          </div>
        </div>

        {!detailsOpen ? (
          <>
            <div className="mt-6 rounded-[1.5rem] border border-white/70 bg-white/75 p-4 shadow-inner dark:border-white/10 dark:bg-white/[0.04]">
              {card.visual === "radar" ? (
                <div className="grid place-items-center">
                  <div className="relative grid h-28 w-28 place-items-center rounded-full border border-slate-200 bg-[radial-gradient(circle,rgba(255,255,255,0.95),rgba(226,247,247,0.55))]">
                    <div className="absolute h-20 w-20 rounded-full border border-slate-300" />
                    <div className="absolute h-12 w-12 rounded-full border border-slate-300" />
                    <div className={`absolute h-1 w-20 rounded-full bg-gradient-to-r ${style.bar}`} />
                    <div className={`absolute h-20 w-1 rounded-full bg-gradient-to-b ${style.bar}`} />
                    <span className="relative rounded-full bg-white px-3 py-2 text-lg font-black text-ink shadow-sm">{displayMetric}</span>
                  </div>
                </div>
              ) : card.visual === "slider" ? (
                <div>
                  <div className="flex items-end justify-between gap-4">
                    <span className="text-4xl font-black leading-none text-ink dark:text-white">{displayMetric}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${style.badge}`}>{card.status}</span>
                  </div>
                  <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <div className={`h-full rounded-full bg-gradient-to-r ${style.bar}`} style={{ width: `${numericScore}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    <span>Weak</span><span>Watch</span><span>Strong</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Risk level</p>
                      <p className="mt-2 text-4xl font-black leading-none text-ink dark:text-white">{displayMetric}</p>
                    </div>
                    <div className={`rounded-2xl px-4 py-3 text-sm font-black uppercase ${style.badge}`}>{card.status}</div>
                  </div>
                  <div className="mt-5 grid grid-cols-5 gap-2">
                    {[35, 48, 62, 78, 92].map((height, index) => (
                      <span
                        key={index}
                        className={`rounded-full bg-gradient-to-t ${style.bar}`}
                        style={{ height: `${height}px`, opacity: 0.45 + index * 0.1 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {card.frontLines.slice(0, 2).map((line) => (
                <p key={line} className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm font-bold leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                  {line}
                </p>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-[1.5rem] border border-white/70 bg-white/85 p-4 shadow-inner dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean">Why this score</p>
            <p className="mt-3 text-lg font-black leading-7 text-ink dark:text-white">{card.recommendation}</p>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {card.details.slice(0, 3).map((detail) => (
                <p key={detail} className="rounded-xl bg-mist px-3 py-2 dark:bg-slate-950">{detail}</p>
              ))}
              <p><span className="font-black text-ink dark:text-white">Check before buying: </span>{card.checks[0]}</p>
              <p><span className="font-black text-ink dark:text-white">Avoid if: </span>{card.avoid}</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setDetailsOpen((value) => !value)}
          className="mt-auto rounded-2xl bg-ink px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
        >
          {detailsOpen ? "Back" : "See why"}
        </button>
      </div>
    </article>
  );
}

function BuyerResults({ result }: { result: AnalyzeResponse }) {
  const { analysis, meta } = result;
  const recommendation = analysis.buyer_recommendation ?? analysis.customer_recommendation ?? { verdict: "Maybe" as CustomerRecommendation, rationale: "Compare the strongest praise against the main warning before buying." };
  const verdictTone = recommendationTone(recommendation.verdict);
  const fakeRisk = scoreNumber(analysis.fake_review_risk_score ?? fakeRiskFromIndicators(analysis.fake_review_indicators));
  const sentimentPercentScore = analysis.sentiment_percentage ?? sentimentToPercent(analysis.sentiment_score);
  const complaintPressure = analysis.complaint_severity_score ?? clamp(analysis.common_complaints.length * 14 + analysis.negative_points.length * 8);
  const score = scoreNumber(analysis.product_score);
  const trustScore = scoreNumber(analysis.product_score * 0.42 + (100 - fakeRisk) * 0.36 + analysis.confidence_score * 22);
  const valueScore = scoreNumber(analysis.value_score ?? clamp(analysis.product_score * 0.68 + sentimentPercentScore * 0.32));
  const productRealityScore = scoreNumber(analysis.product_score * 0.55 + sentimentPercentScore * 0.2 + Math.max(0, 100 - complaintPressure) * 0.25);
  const riskScore = scoreNumber(fakeRisk * 0.35 + complaintPressure * 0.45 + (100 - analysis.product_score) * 0.2);
  const fakeRiskShort = fakeRisk >= 65 ? "High" : fakeRisk >= 35 ? "Medium" : "Low";
  const safeRiskScore = scoreNumber(100 - riskScore);
  const riskLevel = safeRiskScore >= 75 ? "Low" : safeRiskScore >= 45 ? "Medium" : "High";
  const valueVerdict = valueScore >= 72 ? "Great" : valueScore >= 48 ? "Fair" : "Poor";
  const verdictLabel = recommendation.verdict.toUpperCase();
  const fullStrength = cleanReviewInsightText(
    analysis.praised_features[0] ?? analysis.positive_points[0],
    "Most buyers liked the product."
  );
  const fullComplaint = topComplaint(analysis);
  const mainStrength = cleanOneLine(fullStrength, "Most buyers liked it", 64);
  const biggestComplaint = cleanOneLine(fullComplaint, "No repeated complaint", 64);
  const buyingNotesPhrase = shortShopperPhrase(buyingNotes(analysis), "No major buying concern", 7);
  const buyerWorry = riskLevel === "Low" ? "No" : riskLevel === "Medium" ? "Maybe" : "Yes";
  const signalBase = Math.max(analysis.common_complaints.length + analysis.negative_points.length + analysis.praised_features.length + analysis.positive_points.length, 1);
  const complaintRatio = Math.round(((analysis.common_complaints.length + analysis.negative_points.length) / signalBase) * 10);
  const shopperRiskPhrase =
    meta.review_count_estimate < 10
      ? "Small sample: check more reviews."
      : complaintRatio > 0
        ? `Roughly ${Math.max(1, complaintRatio)} out of 10 signals mention a concern.`
        : "Most buyers liked the product.";
  const verdictStyle = {
    good: "from-[#effffb] via-[#e9f6ff] to-[#fff7e7]",
    warn: "from-[#fff8e8] via-[#eff7ff] to-[#fff0f0]",
    bad: "from-[#fff0f0] via-[#eef5ff] to-[#f8fbff]"
  }[verdictTone];
  const verdictAccent = {
    good: "from-teal via-ocean to-cyan-400",
    warn: "from-amber via-orange-400 to-coral",
    bad: "from-coral via-rose-500 to-slate-900"
  }[verdictTone];

  const quickCards: ShopperCard[] = [
    {
      title: "Trust",
      question: "Can I trust these reviews?",
      score: trustScore,
      tone: fakeRisk >= 65 ? "bad" as const : fakeRisk >= 35 ? "warn" as const : "good" as const,
      visual: "radar",
      icon: "S",
      metric: scorePercent(trustScore),
      status: `${fakeRiskShort} fake risk`,
      frontLines: [`Fake risk: ${fakeRiskShort}`, fakeRisk >= 65 ? "Pattern signals need checking." : fakeRisk >= 35 ? "Some wording feels patterned." : "Reviews look natural."],
      details: uniqueSellerItems(
        [
          ...analysis.fake_review_indicators,
          meta.confidence_detail,
          `${meta.review_count_estimate} valid reviews analyzed.`
        ],
        ["Trust is based on fake-review pressure, review volume, and evidence quality."],
        3
      ),
      checks: ["Look for verified use, photos, dates, and balanced praise/complaints."],
      avoid: fakeRisk >= 65 ? "You see repeated generic wording or suspicious review timing." : "You need very high proof before buying.",
      recommendation: fakeRisk >= 65 ? "Check review authenticity first." : "Review signal is usable."
    },
    {
      title: "Product Reality",
      question: "Does it match the promise?",
      score: productRealityScore,
      tone: productRealityScore >= 70 ? "good" as const : productRealityScore >= 45 ? "warn" as const : "bad" as const,
      visual: "slider",
      icon: "P",
      metric: scorePercent(productRealityScore),
      status: "Promise match",
      frontLines: [`Strength: ${mainStrength}`, `Complaint: ${biggestComplaint}`],
      details: uniqueSellerItems(
        [analysis.overall_summary, fullStrength, fullComplaint, ...analysis.praised_features, ...analysis.common_complaints],
        ["Reality score compares confirmed strengths against repeated complaints."],
        3
      ),
      checks: ["Confirm size, material, compatibility, and the exact version you will receive."],
      avoid: productRealityScore < 45 ? "The product promise does not match repeated customer reality." : "The top complaint is a dealbreaker for you.",
      recommendation: productRealityScore >= 70 ? "Product promise looks believable." : "Compare the promise against reviews."
    },
    {
      title: "Risk",
      question: "What could go wrong?",
      score: 100 - riskScore,
      tone: riskScore >= 65 ? "bad" as const : riskScore >= 35 ? "warn" as const : "good" as const,
      visual: "alert",
      icon: "!",
      metric: riskLevel,
      status: `${safeRiskScore}% safety`,
      frontLines: [`Biggest issue: ${biggestComplaint}`, `Should buyer worry? ${buyerWorry}`],
      details: uniqueSellerItems(
        [fullComplaint, ...analysis.quality_concerns, ...analysis.durability_issues, ...analysis.support_issues, ...analysis.negative_points],
        ["Risk combines complaints, product concerns, support issues, and fake-review pressure."],
        3
      ),
      checks: ["Check returns, warranty, seller support, shipping, and the repeated complaint."],
      avoid: riskScore >= 65 ? "The warning affects your main reason for buying." : "You cannot return it easily.",
      recommendation: buyerRecommendationLine(recommendation.verdict, riskLevel)
    }
  ];

  return (
    <div className="space-y-6">
      <section className={`ri-reveal-pop relative overflow-hidden rounded-[2.25rem] border border-white/70 bg-gradient-to-br ${verdictStyle} p-5 shadow-[0_34px_110px_rgba(35,86,163,0.18)] lg:p-7`}>
        <div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${verdictAccent}`} />
        <div className="absolute -right-20 -top-24 size-72 rounded-full bg-white/55 blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-stretch">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
            <div className={`absolute -right-16 -top-16 size-44 rounded-full bg-gradient-to-br ${verdictAccent} opacity-25 blur-2xl`} />
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">Buyer verdict</p>
            <div className="mt-8 flex items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black leading-none text-ink dark:text-white lg:text-3xl">{verdictLabel}</h1>
                <p className="mt-3 text-sm font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">Buyer confidence</p>
              </div>
              <div className="text-right">
                <p className={`text-4xl font-black leading-none ${TRUST_TONE_STYLE[verdictTone].text}`}>{score}</p>
                <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">/100</p>
              </div>
            </div>
            <div className="mt-8 h-4 overflow-hidden rounded-full bg-white shadow-inner dark:bg-white/10">
              <div className={`h-full rounded-full bg-gradient-to-r ${verdictAccent}`} style={{ width: widthPercent(score) }} />
            </div>
            <p className="mt-5 text-lg font-black leading-7 text-ink dark:text-white">{buyerRecommendationLine(recommendation.verdict, riskLevel)}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{shopperRiskPhrase}</p>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Fake Review Risk", fakeRiskShort, fakeRisk >= 65 ? "text-coral" : fakeRisk >= 35 ? "text-amber" : "text-teal"],
                ["Value", valueVerdict, valueScore >= 72 ? "text-teal" : valueScore >= 48 ? "text-amber" : "text-coral"],
                ["Main Warning", biggestComplaint, "text-coral"],
                ["Buying Notes", buyingNotesPhrase, "text-ocean"]
              ].map(([label, value, color]) => (
                <div key={label} className="min-h-28 rounded-[1.4rem] border border-line bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
                  <p className={`mt-3 text-2xl font-black leading-tight ${color}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/analyze" className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ocean">
                Test another product
              </Link>
              <Link href="/compare" className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-black break-words text-ink transition hover:-translate-y-0.5 hover:border-ocean dark:border-white/10 dark:bg-slate-950 dark:text-white">
                Compare products
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-ocean">Before you buy</p>
        <h3 className="mt-2 text-2xl font-black text-ink dark:text-white">What to check before checkout</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {buildBuyerChecklist(analysis as unknown as Record<string, unknown>).map((item) => (
            <div key={item} className="rounded-2xl border border-line bg-slate-50 p-4 text-sm font-bold leading-6 text-ink dark:border-white/10 dark:bg-white/5 dark:text-white">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {quickCards.map((card) => <ShopperFlipCard key={card.title} card={card} />)}
      </section>
    </div>
  );
}

function SellerResults({ result, accountPlan }: { result: AnalyzeResponse; accountPlan?: SubscriptionPlan | null }) {
  const { analysis, meta } = result;
  const isSellerPro = accountPlan === "seller_pro";
  const confidenceLabel = meta.confidence_label ?? (meta.review_count_estimate >= 50 ? "High" : meta.review_count_estimate >= 10 ? "Medium" : "Low");
  const complaintPressure = analysis.complaint_severity_score ?? clamp(analysis.common_complaints.length * 14 + analysis.negative_points.length * 8);
  const opportunityScore = clamp(analysis.feature_requests.length * 18 + analysis.improvement_suggestions.length * 10);
  const evidenceScore = analysis.confidence_score * 100;
  const satisfactionGap = analysis.seller_insights.customer_satisfaction_score - analysis.product_score;
  const satisfactionDetail =
    satisfactionGap >= 10
      ? "Customers like the product after use, while buying confidence is moderated by risk, packaging, or evidence quality."
      : satisfactionGap <= -10
        ? "Buying appeal is stronger than post-purchase satisfaction, so seller fixes still matter."
        : "Aligned with the Shopper score from the same evidence model.";

  return (
    <div className="space-y-8">
      <SponsorAnalytics placement="results_seller" />
      <SellerMagicMoment result={result} isSellerPro={isSellerPro} />
      <SellerBusinessKpiDashboard analysis={analysis} plan={accountPlan ?? undefined} />
      {isSellerPro ? <SellerTrustCriteriaDashboard result={result} /> : <SellerTrustCriteriaSnapshot result={result} accountPlan={accountPlan} />}

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink text-white shadow-soft dark:bg-slate-950">
        <div className="ri-scan-grid relative opacity-20" />
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">Seller growth diagnosis</Badge>
              <Badge tone={confidenceTone(confidenceLabel)}>{confidenceLabel} evidence</Badge>
              <Badge>{platformLabel(meta.platform ?? "other")}</Badge>
            </div>
            <h1 className="mt-6 max-w-4xl text-3xl font-black lg:text-3xl">Turn buyer feedback into the next product, listing, and trust move.</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
              {cleanReviewInsightText(analysis.overall_summary, "ReviewIntel found patterns that can guide what to fix, what to advertise, and what buyers need to trust before checkout.")}
            </p>
            {analysis.score_alignment_note ? <p className="mt-4 max-w-3xl rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold leading-6 text-cyan-100">{analysis.score_alignment_note}</p> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/pricing" className="rounded-xl bg-white px-5 py-3 text-sm font-black break-words text-ink transition hover:bg-cyan-100">
                Unlock exports
              </Link>
              <Link href="/compare" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-black text-white transition hover:border-teal">
                Compare competitors
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black uppercase text-slate-400">Reviews mined</p>
              <p className="mt-4 text-3xl font-black">{meta.review_count_estimate}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black uppercase text-slate-400">Satisfaction</p>
              <p className="mt-4 text-3xl font-black">{formatPercent(analysis.seller_insights.customer_satisfaction_score)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black uppercase text-slate-400">Complaint pressure</p>
              <p className="mt-4 text-3xl font-black">{formatPercent(complaintPressure)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black uppercase text-slate-400">Opportunity</p>
              <p className="mt-4 text-3xl font-black">{formatPercent(opportunityScore)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <SellerKpi label="Customer satisfaction" value={formatPercent(analysis.seller_insights.customer_satisfaction_score)} detail={satisfactionDetail} tone={analysis.seller_insights.customer_satisfaction_score >= 72 ? "good" : analysis.seller_insights.customer_satisfaction_score >= 48 ? "warn" : "bad"} />
        <SellerKpi label="Complaint load" value={formatPercent(complaintPressure)} detail="Repeated negatives that can hurt conversion." tone={complaintPressure >= 65 ? "bad" : complaintPressure >= 35 ? "warn" : "good"} />
        <SellerKpi label="Improvement upside" value={formatPercent(opportunityScore)} detail="Visible product, listing, and feature opportunities." tone="info" />
        <SellerKpi label="Evidence quality" value={formatPercent(evidenceScore)} detail={meta.confidence_detail ?? "Evidence confidence from valid reviews."} tone={confidenceTone(confidenceLabel)} />
      </section>
      <section className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-teal">Seller growth moves</p>
        <h3 className="mt-2 text-2xl font-black text-ink dark:text-white">Fix first, advertise better, and stop overpromising.</h3>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-coral/20 bg-coral/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-coral">Fix first</p>
            <p className="mt-3 text-sm font-bold leading-6 text-ink dark:text-white">
              {buildSellerGrowthMoves(analysis).fixFirst}
            </p>
          </article>

          <article className="rounded-2xl border border-teal/20 bg-teal/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal">Advertise this</p>
            <p className="mt-3 text-sm font-bold leading-6 text-ink dark:text-white">
              {buildSellerGrowthMoves(analysis).advertiseThis}
            </p>
          </article>

          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-400/20 dark:bg-amber-500/10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Stop promising this</p>
            <p className="mt-3 text-sm font-bold leading-6 text-ink dark:text-white">
              {buildSellerGrowthMoves(analysis).stopPromising}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-[2.5rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950 lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Seller intelligence map</p>
            <h3 className="mt-3 max-w-4xl text-3xl font-black leading-tight text-ink dark:text-white">
              One clear view of what moves buyers closer to checkout — or pushes them away.
            </h3>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              This view turns scattered buyer comments into one clear map: what creates confidence, what causes hesitation, and what should be fixed first.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-slate-50 px-6 py-4 text-center dark:border-white/10 dark:bg-white/5">
            <p className="text-4xl font-black text-ink dark:text-white">{meta.review_count_estimate}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">reviews scanned</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-line bg-slate-50 p-5 dark:border-white/10 dark:bg-black/20">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Buyer confidence graph</p>
                <h4 className="mt-2 text-xl font-black text-ink dark:text-white">See the strongest risks and growth signals in one place</h4>
              </div>
              <span className="rounded-full bg-ocean/10 px-4 py-2 text-xs font-black uppercase text-ocean">
                Pro summary
              </span>
            </div>

            <div className="mt-6 space-y-5">
              <SellerSignalBar
                label="Complaint pressure"
                value={complaintPressure}
                tone={complaintPressure >= 65 ? "bad" : complaintPressure >= 35 ? "warn" : "good"}
              />
              <SellerSignalBar
                label="Refund safety"
                value={clamp(100 - (analysis.seller_insights.refund_risk_issues.length * 22 + analysis.quality_concerns.length * 10))}
                tone="bad"
              />
              <SellerSignalBar
                label="Packaging confidence"
                value={clamp(100 - analysis.seller_insights.packaging_shipping_issues.length * 24)}
                tone="warn"
              />
              <SellerSignalBar
                label="Support confidence"
                value={clamp(100 - analysis.support_issues.length * 22)}
                tone="warn"
              />
              <SellerSignalBar
                label="Feature demand"
                value={clamp(analysis.seller_insights.feature_requests.length * 20)}
                tone="info"
              />
              <SellerSignalBar
                label="Positive positioning"
                value={clamp(analysis.praised_features.length * 16 + analysis.positive_points.length * 10)}
                tone="good"
              />
              <SellerSignalBar
                label="Review evidence quality"
                value={evidenceScore}
                tone={confidenceTone(confidenceLabel)}
              />
            </div>
          </div>

          <div className="grid gap-5">
            <article className="rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">What this means</p>
              <h4 className="mt-4 text-2xl font-black leading-tight text-ink dark:text-white">
                {analysis.seller_insights.refund_risk_issues.length || analysis.support_issues.length
                  ? "Make the offer feel safer before sending more people to it."
                  : complaintPressure >= 55
                    ? "Correct the concern buyers may remember most."
                    : analysis.praised_features.length
                      ? "Lead with the strength customers already believe."
                      : "Make the promise specific enough that buyers do not need to guess."}
              </h4>
              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
                {analysis.seller_insights.refund_risk_issues.length || analysis.support_issues.length
                  ? "Interest is not enough if the buyer still feels risk. Put warranty, replacement, return, and support details where shoppers can see them before they hesitate."
                  : complaintPressure >= 55
                    ? "The feedback is showing one concern that can slow sales. Answer it directly with clearer listing copy, better proof, or a visible support promise."
                    : analysis.praised_features.length
                      ? "Customers are telling you what matters. Bring that proof higher on the page so a new shopper understands the value in seconds."
                      : "The scan found useful direction, but the offer needs sharper proof. Clarify expectations, show honest limits, and use benefits that came from real customer language."}
              </p>
            </article>

            <article className="rounded-[2rem] border border-line bg-slate-50 p-5 dark:border-white/10 dark:bg-black/20">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Fix first</p>
              <p className="mt-3 text-base font-bold leading-7 text-ink dark:text-white">
                {analysis.seller_insights.refund_risk_issues.length
                  ? "Fix refund-risk language first. Buyers need to know what happens if the product fails, arrives wrong, or does not meet expectations."
                  : analysis.support_issues.length
                    ? "Clarify warranty, replacement, returns, and support response expectations before checkout."
                    : complaintPressure >= 55
                      ? "Address the strongest repeated complaint with one visible listing change and one practical product or support action."
                      : "Move the strongest positive customer proof higher on the page and make it visually obvious."}
              </p>
            </article>

            <article className="rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Words buyers keep using</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {analysis.keyword_analysis.slice(0, 8).map((item) => (
                  <span key={item.keyword} className="rounded-full border border-line bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                    {item.keyword} · {item.mentions}
                  </span>
                ))}
                {!analysis.keyword_analysis.length ? (
                  <span className="rounded-full border border-line bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                    No strong keyword cluster detected
                  </span>
                ) : null}
              </div>
            </article>
          </div>
        </div>

        <div className="mt-6 rounded-[2rem] border border-line bg-slate-50 p-5 dark:border-white/10 dark:bg-black/20">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Rating background</p>
          <div className="mt-4">
            <RatingBreakdown breakdown={meta.rating_breakdown} />
          </div>
        </div>
      </section>

      <AdSlot
        placement="results_below_verdict"
        compact
        className="mt-6"
      />
    </div>
  );
}




function cleanFirst(items: Array<string | undefined | null>, fallback: string) {
  const found = items.find((item) => typeof item === "string" && item.trim().length > 0);
  return found?.trim() || fallback;
}

function textField(source: Record<string, unknown>, key: string) {
  const value = source[key];

  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  return "";
}

function firstFromArray(source: Record<string, unknown>, key: string) {
  const value = source[key];

  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim());
    return typeof first === "string" ? first.trim() : "";
  }

  return "";
}

function objectField(source: Record<string, unknown>, key: string) {
  const value = source[key];

  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildBuyerChecklist(analysis: Record<string, unknown>) {
  const complaint = cleanFirst(
    [
      textField(analysis, "biggest_complaint"),
      textField(analysis, "mainComplaint"),
      firstFromArray(analysis, "common_complaints"),
      firstFromArray(analysis, "complaints"),
      firstFromArray(analysis, "quality_concerns"),
    ],
    "Check the most recent low-star reviews before buying."
  );

  const fakeRisk = cleanFirst(
    [
      textField(analysis, "fake_review_risk_level"),
      textField(analysis, "fakeReviewRisk"),
      textField(analysis, "risk_level"),
    ],
    "Review the wording pattern and avoid relying only on perfect 5-star reviews."
  );

  const value = cleanFirst(
    [
      textField(analysis, "value_summary"),
      textField(analysis, "price_value_summary"),
      textField(analysis, "valueScore") ? `Value score: ${textField(analysis, "valueScore")}` : "",
    ],
    "Compare the price against similar products before checkout."
  );

  return [
    `Confirm this concern is acceptable: ${complaint}`,
    `Check fake-review risk: ${fakeRisk}`,
    value,
    "Confirm return policy, warranty, size, compatibility, and included items before buying.",
  ];
}

function buildSellerGrowthMoves(analysis: Record<string, unknown>) {
  const sellerInsights = objectField(analysis, "seller_insights");

  const complaint = cleanFirst(
    [
      firstFromArray(sellerInsights, "refund_risk_issues"),
      firstFromArray(analysis, "support_issues"),
      firstFromArray(analysis, "quality_concerns"),
      firstFromArray(analysis, "common_complaints"),
      firstFromArray(analysis, "complaints"),
    ],
    "Find the repeated buyer concern and make it visible in the listing or product improvement plan."
  );

  const praise = cleanFirst(
    [
      firstFromArray(analysis, "praised_features"),
      firstFromArray(analysis, "positive_points"),
      firstFromArray(sellerInsights, "positioning_intelligence"),
    ],
    "Use the strongest positive buyer signal as proof in the headline, images, or first bullet."
  );

  const overpromise = cleanFirst(
    [
      firstFromArray(sellerInsights, "listing_improvement_suggestions"),
      firstFromArray(analysis, "improvement_suggestions"),
      firstFromArray(sellerInsights, "refund_risk_issues"),
    ],
    "Avoid making claims that the reviews do not strongly support."
  );

  return {
    fixFirst: complaint,
    advertiseThis: praise,
    stopPromising: overpromise,
  };
}


export function ResultsDashboard({ result, accountPlan }: { result: AnalyzeResponse; accountPlan?: SubscriptionPlan | null }) {
  if (result.meta.audience === "seller" || result.meta.audience === "both") {
    return <SellerResults result={result} accountPlan={accountPlan} />;
  }

  return <BuyerResults result={result} />;
}
