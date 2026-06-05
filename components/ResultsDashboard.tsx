import Link from "next/link";
import { Badge } from "@/components/Badge";
import { InsightList } from "@/components/InsightList";
import { SellerIntelligenceTabs } from "@/components/SellerIntelligenceTabs";
import { SellerReportActions } from "@/components/SellerReportActions";
import { SponsorAnalytics } from "@/components/SponsorAnalytics";
import { SponsoredResources } from "@/components/SponsoredResources";
import {
  fakeRiskFromIndicators,
  formatPercent,
  riskLabel,
  sentimentToPercent
} from "@/lib/analysisScoring";
import { platformLabel } from "@/lib/platforms";
import type { AnalyzeResponse, CustomerRecommendation, SubscriptionPlan } from "@/lib/types";
import { SellerBusinessKpiDashboard } from "@/components/SellerBusinessKpiDashboard";

function formatResultPercent(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return `${fallback}%`;
  return `${Math.round(Math.max(0, Math.min(100, number)))}%`;
}

function formatResultNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(fallback);
  return String(Math.round(Math.max(0, Math.min(100, number))));
}


function displayPercent(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return `${fallback}%`;
  return `${Math.round(Math.max(0, Math.min(100, number)))}%`;
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

function bestFor(analysis: AnalyzeResponse["analysis"]) {
  const source = [...analysis.praised_features, ...analysis.positive_points, ...analysis.keywords].join(" ").toLowerCase();
  if (source.includes("student") || source.includes("school")) return "students";
  if (source.includes("office") || source.includes("work")) return "office use";
  if (source.includes("travel") || source.includes("portable")) return "travel";
  if (source.includes("daily") || source.includes("every day")) return "daily use";
  if (source.includes("gift")) return "gifting";
  return analysis.praised_features[0]?.split(/[,.]/)[0]?.slice(0, 42) || "careful shoppers";
}

function topComplaint(analysis: AnalyzeResponse["analysis"]) {
  return (
    analysis.common_complaints[0] ??
    analysis.negative_points[0] ??
    analysis.quality_concerns[0] ??
    "No repeated complaint stood out."
  );
}

function shortShopperPhrase(value: string | undefined, fallback: string, maxWords = 6) {
  const text = (value ?? fallback).replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim();
  const firstClause = text.split(/[.;:]/)[0]?.trim() || fallback;
  const words = firstClause.split(" ").filter(Boolean);

  if (words.length <= maxWords) return firstClause;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function cleanOneLine(value: string | undefined, fallback: string, maxChars = 44) {
  const text = (value ?? fallback).replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim();
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

function SellerDonutCard({
  items,
  title,
  subtitle
}: {
  items: Array<{ label: string; value: number; color: string; className: string }>;
  title: string;
  subtitle: string;
}) {
  const total = Math.max(1, items.reduce((sum, item) => sum + item.value, 0));
  let cursor = 0;
  const gradient = items
    .map((item) => {
      const start = cursor;
      cursor += (item.value / total) * 100;
      return `${item.color} ${start.toFixed(0)}% ${cursor.toFixed(0)}%`;
    })
    .join(", ");

  return (
    <article className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p>
      <div className="mt-6 grid gap-6 md:grid-cols-[180px_1fr] md:items-center">
        <div className="relative mx-auto grid size-44 place-items-center rounded-full shadow-[0_24px_70px_rgba(23,32,51,0.12)]" style={{ background: `conic-gradient(${gradient})` }}>
          <div className="grid size-24 place-items-center rounded-full bg-white text-center shadow-soft dark:bg-slate-950">
            <span className="text-2xl font-black break-words text-ink dark:text-white">{total}</span>
          </div>
        </div>
        <div className="grid gap-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 dark:border-white/10">
              <div className="flex items-center gap-3">
                <span className={`size-3 rounded-full ${item.className}`} />
                <span className="text-sm font-bold text-ink dark:text-white">{item.label}</span>
              </div>
              <span className="text-sm font-black text-slate-500 dark:text-slate-400">{Math.round((item.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

type TrustTone = "good" | "warn" | "bad" | "info";
type TrustVisual = "radar" | "curve" | "ring" | "bars";

type TrustCriterion = {
  id: string;
  title: string;
  subtitle: string;
  score: number;
  status: string;
  tone: TrustTone;
  visual: TrustVisual;
  summary: string;
  why: string;
  evidence: string[];
  worries: string[];
  trusted: string[];
  actions: string[];
  priority: string;
};

const TRUST_TONE_STYLE: Record<TrustTone, { text: string; bg: string; border: string; hex: string; soft: string }> = {
  good: { text: "text-teal", bg: "bg-teal", border: "border-teal/30", hex: "#0f9f9a", soft: "bg-teal/10" },
  warn: { text: "text-amber", bg: "bg-amber", border: "border-amber/30", hex: "#d68b1f", soft: "bg-amber/10" },
  bad: { text: "text-coral", bg: "bg-coral", border: "border-coral/30", hex: "#d95d5d", soft: "bg-coral/10" },
  info: { text: "text-ocean", bg: "bg-ocean", border: "border-ocean/30", hex: "#2356a3", soft: "bg-ocean/10" }
};

function trustStatus(score: number) {
  const value = clamp(score);
  if (value >= 80) return { status: "Strong", tone: "good" as const };
  if (value >= 65) return { status: "Watch", tone: "info" as const };
  if (value >= 45) return { status: "Weak", tone: "warn" as const };
  return { status: "Critical", tone: "bad" as const };
}

function uniqueSellerItems(items: Array<string | undefined>, fallback: string[] = [], limit = 4) {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const item of [...items, ...fallback]) {
    const text = item?.trim().replace(/\s+/g, " ");
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

function firstSpecific(items: Array<string | undefined>, fallback: string) {
  return uniqueSellerItems(items, [fallback], 1)[0] ?? fallback;
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
      evidence: uniqueSellerItems(
        [...analysis.praised_features, ...analysis.positive_points, ...analysis.fake_review_indicators],
        [
          `ReviewIntel found ${meta.review_count_estimate} valid reviews for this scan.`,
          "Look for verified purchase language, usage context, and specific product details in future scans."
        ]
      ),
      worries: uniqueSellerItems(
        [...analysis.fake_review_indicators, ...(analysis.consistency_warnings ?? [])],
        ["No strong fake-review weakness was detected, but keep monitoring repetition and overly polished language."]
      ),
      trusted: uniqueSellerItems(
        [...analysis.positive_points, ...analysis.praised_features],
        ["Customers trust the review set most when real use cases and mixed feedback are visible."]
      ),
      actions: uniqueSellerItems(
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
      summary: `${firstSpecific([...analysis.quality_concerns, ...analysis.durability_issues, ...analysis.common_complaints], "No major reliability risk dominated the supplied reviews.")}`,
      why: "The score compares praise about product performance against repeated quality, defect, durability, and description-match concerns.",
      evidence: uniqueSellerItems([...analysis.praised_features, ...analysis.positive_points], ["Positive proof is strongest when customers mention real-life performance after use."]),
      worries: uniqueSellerItems(
        [...analysis.durability_issues, ...analysis.quality_concerns, ...analysis.common_complaints],
        ["No repeated reliability defect was isolated from this review batch."]
      ),
      trusted: uniqueSellerItems([...analysis.praised_features, ...analysis.positive_points], ["Customers appear to trust product reliability when the product performs as described."]),
      actions: uniqueSellerItems(
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
      summary: analysis.value_for_money_opinion || "Value perception depends on whether customers connect price to quality and daily usefulness.",
      why: "The value score weighs price language, usefulness, material quality, expectation match, and overall sentiment.",
      evidence: uniqueSellerItems([...analysis.praised_features, ...analysis.positive_points], ["Value proof is strongest when customers say the product is worth the price."]),
      worries: uniqueSellerItems(
        [...analysis.negative_points, ...analysis.common_complaints].filter((item) => /price|value|cheap|expensive|worth|quality/i.test(item)),
        ["No repeated price objection stood out in the supplied reviews."]
      ),
      trusted: uniqueSellerItems([...analysis.praised_features, ...analysis.positive_points], ["Customers trust the value story when quality, utility, and expectations line up."]),
      actions: uniqueSellerItems(
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
      summary: `${firstSpecific([...analysis.support_issues, ...analysis.seller_insights.packaging_shipping_issues, ...analysis.seller_insights.refund_risk_issues], "No major customer-care complaint dominated this scan.")}`,
      why: "The score checks whether post-purchase issues are handled clearly: delivery, packaging, refunds, replacement, service, and recovery after problems.",
      evidence: uniqueSellerItems([...analysis.seller_insights.packaging_shipping_issues, ...analysis.support_issues], ["Customer-care evidence is limited unless reviews mention shipping, support, replacement, or returns."]),
      worries: uniqueSellerItems(
        [...analysis.support_issues, ...analysis.seller_insights.refund_risk_issues, ...analysis.seller_insights.packaging_shipping_issues],
        ["No repeated service or fulfillment complaint was isolated from this review batch."]
      ),
      trusted: uniqueSellerItems([...analysis.positive_points, ...analysis.praised_features], ["Customers trust the seller more when reviews show quick resolution and clean delivery."]),
      actions: uniqueSellerItems(
        [
          ...analysis.seller_insights.seller_recommendations,
          "Add visible support promises, replacement rules, packaging expectations, and return guidance where buyers decide."
        ],
        []
      )
    }
  ];

  const criteria: TrustCriterion[] = criteriaSeeds.map((item) => {
    const status = trustStatus(item.score);
    return {
      ...item,
      status: status.status,
      tone: status.tone,
      priority: item.score < 45 ? "Immediate fix" : item.score < 65 ? "High priority" : item.score < 80 ? "Monitor closely" : "Maintain"
    };
  });

  const overallTrustScore = clamp(criteria.reduce((sum, item) => sum + item.score, 0) / criteria.length);
  const biggestBlocker = [...criteria].sort((left, right) => left.score - right.score)[0];
  const biggestOpportunity = [...criteria].sort((left, right) => right.score - left.score)[0];
  const topActions = uniqueSellerItems(
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
  const listingRecommendations = uniqueSellerItems(
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
  const style = TRUST_TONE_STYLE[criterion.tone];

  return (
    <details className="group min-h-[520px] [perspective:1600px]">
      <summary className="block cursor-pointer list-none outline-none [&::-webkit-details-marker]:hidden">
        <div className="relative min-h-[520px] transition-transform duration-700 [transform-style:preserve-3d] group-open:[transform:rotateY(180deg)] overflow-y-auto">
          <article className={`absolute inset-0 overflow-hidden rounded-[1.75rem] border ${style.border} bg-white p-5 shadow-soft [backface-visibility:hidden] dark:bg-slate-950`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black break-words text-ink dark:text-white">{criterion.title}</p>
                <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{criterion.subtitle}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${style.soft} ${style.text}`}>{criterion.status}</span>
            </div>
            <TrustMetricVisual criterion={criterion} />
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className={`text-3xl font-black leading-none ${style.text}`}>{formatResultPercent(criterion.score)}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Trust score</p>
              </div>
              <span className={`rounded-full px-3 py-2 text-xs font-black ${style.bg} text-white`}>{criterion.priority}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{cleanOneLine(criterion.summary, criterion.status, 92)}</p>
            <p className="mt-4 inline-flex rounded-full border border-line px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-ocean dark:border-white/10 dark:text-cyan-300">See seller proof</p>
          </article>

          <article className={`absolute inset-0 overflow-y-auto rounded-[1.75rem] border ${style.border} bg-[linear-gradient(135deg,#ffffff,#f7fbff)] p-5 shadow-soft [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-y-auto dark:bg-slate-950 dark:bg-none`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-black uppercase tracking-[0.18em] ${style.text}`}>{criterion.title} proof</p>
                <h3 className="mt-2 text-xl font-black leading-tight text-ink dark:text-white">{criterion.why}</h3>
              </div>
              <span className="rounded-full border border-line px-3 py-2 text-xs font-black uppercase text-slate-500 dark:border-white/10 dark:text-slate-300">Back</span>
            </div>
            <div className="mt-4 grid gap-3">
              {[
                ["Evidence", criterion.evidence],
                ["Worries", criterion.worries],
                ["Trusted", criterion.trusted],
                ["Action", criterion.actions]
              ].map(([title, items]) => (
                <div key={title as string} className="rounded-2xl border border-line bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{title as string}</p>
                  <ul className="mt-2 grid gap-1">
                    {(items as string[]).slice(0, 2).map((item) => (
                      <li key={item} className="text-xs font-semibold leading-5 text-slate-700 dark:text-slate-300">{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>
        </div>
      </summary>
    </details>
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
              <p className={`text-3xl font-black leading-none ${overallStyle.text}`}>{diagnosis.overallTrustScore}</p>
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
            <h3 className="mt-3 text-3xl font-black break-words text-ink dark:text-white">Fix the weakest trust signal first.</h3>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Biggest trust blocker</p>
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
  const sellerPlanLabel = accountPlan === "seller_starter" ? "Seller Starter" : "Seller Premium";

  return (
    <section className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
        <div>
          <Badge tone="info">{sellerPlanLabel} trust snapshot</Badge>
          <h2 className="mt-4 text-3xl font-black leading-tight text-ink dark:text-white">Core seller trust read.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Starter and Premium accounts get the high-level trust diagnosis. Seller Pro unlocks expandable evidence, blockers, action sequencing, and full criteria detail.
          </p>
          <div className="mt-5 rounded-2xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Overall trust</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className={`text-3xl font-black leading-none ${overallStyle.text}`}>{diagnosis.overallTrustScore}</p>
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
                  <p className={`text-3xl font-black ${style.text}`}>{formatResultPercent(criterion.score)}</p>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white dark:bg-white/10">
                  <div className={`h-full rounded-full ${style.bg}`} style={{ width: `${formatResultPercent(criterion.score)}%` }} />
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{criterion.summary}</p>
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
  const firstComplaint = topComplaint(analysis);
  const firstFix = analysis.seller_insights.product_improvement_recommendations[0] ?? analysis.improvement_suggestions[0] ?? "Fix the most repeated complaint before scaling ads.";
  const firstCopy = analysis.seller_insights.listing_improvement_suggestions[0] ?? "Rewrite listing copy around the clearest customer expectation gap.";

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(125deg,#12091f,#2e1568_38%,#1168d8_68%,#10c6a3)] p-6 text-white shadow-[0_32px_110px_rgba(118,87,184,0.34)]">
      <div className="ri-scan-grid absolute inset-0 opacity-20" />
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

function ShopperVisual({ card }: { card: ShopperCard }) {
  const style = TRUST_TONE_STYLE[card.tone];
  const score = clamp(card.score);

  if (card.visual === "radar") {
    return (
      <div className="grid h-36 place-items-center">
        <div className="relative grid size-32 place-items-center rounded-full border border-slate-200 bg-[radial-gradient(circle,#ffffff_0%,#eef8ff_54%,#e8f6f4_100%)] shadow-inner dark:border-white/10 dark:bg-none">
          {[1, 0.72, 0.44].map((scale) => (
            <span key={scale} className="absolute rounded-full border border-ocean/20" style={{ width: `${scale * 100}%`, height: `${scale * 100}%` }} />
          ))}
          <span className="absolute h-px w-28 bg-ocean/20" />
          <span className="absolute h-28 w-px bg-ocean/20" />
          <span className="absolute h-1 w-14 origin-left rounded-full bg-gradient-to-r from-transparent to-teal" style={{ transform: `rotate(${score * 2.6}deg) translateX(8px)` }} />
          <span className={`grid size-16 place-items-center rounded-full ${style.bg} text-2xl font-black text-white shadow-[0_14px_38px_rgba(15,23,42,0.24)]`}>{card.icon}</span>
        </div>
      </div>
    );
  }

  if (card.visual === "slider") {
    return (
      <div className="grid h-36 place-items-center">
        <div className="w-full max-w-[260px]">
          <svg viewBox="0 0 280 94" className="h-24 w-full" role="img" aria-label={`${card.title} performance meter`}>
            <path d="M18 56 C72 20 118 82 170 38 C206 8 246 26 262 56" fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
            <path d="M18 56 C72 20 118 82 170 38 C206 8 246 26 262 56" fill="none" stroke={style.hex} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${score * 2.5} 320`} />
            <circle cx={Math.min(258, 24 + score * 2.35)} cy={score > 70 ? 38 : score > 45 ? 52 : 62} r="14" fill={style.hex} stroke="white" strokeWidth="7" />
          </svg>
          <div className="grid grid-cols-3 text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            <span>Weak</span>
            <span>Realistic</span>
            <span>Strong</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-36 place-items-center">
      <div className="w-full max-w-[250px] rounded-3xl border border-line bg-white/80 p-4 shadow-inner dark:border-white/10 dark:bg-white/[0.04]">
        {[0.35, 0.52, 0.7, 0.88, 1].map((scale, index) => (
          <div key={scale} className="mb-3 h-3 overflow-hidden rounded-full bg-slate-100 last:mb-0 dark:bg-white/10">
            <div className={`h-full rounded-full ${index < 2 ? "bg-amber" : style.bg}`} style={{ width: `${Math.max(18, score * scale)}%` }} />
          </div>
        ))}
        <div className="mt-4 flex items-center justify-between">
          <span className={`grid size-12 place-items-center rounded-2xl ${style.bg} text-xl font-black text-white`}>{card.icon}</span>
          <span className={`text-3xl font-black ${style.text}`}>{card.metric}</span>
        </div>
      </div>
    </div>
  );
}

function ShopperFlipCard({ card }: { card: ShopperCard }) {
  const style = TRUST_TONE_STYLE[card.tone];

  return (
    <details className="group min-h-[430px] [perspective:1600px]">
      <summary className="block cursor-pointer list-none outline-none [&::-webkit-details-marker]:hidden">
        <div className="relative min-h-[430px] transition-transform duration-700 [transform-style:preserve-3d] group-open:[transform:rotateY(180deg)] overflow-y-auto">
          <article className={`absolute inset-0 overflow-hidden rounded-[2rem] border ${style.border} bg-white p-6 shadow-soft [backface-visibility:hidden] dark:bg-slate-950`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{card.title}</p>
                <h2 className="mt-2 text-2xl font-black leading-tight text-ink dark:text-white">{card.question}</h2>
              </div>
              <span className={`rounded-full px-3 py-2 text-xs font-black uppercase ${style.soft} ${style.text}`}>See why</span>
            </div>
            <ShopperVisual card={card} />
            <div className="mt-1 flex items-end justify-between gap-4">
              <div>
                <p className={`text-3xl font-black leading-none ${style.text}`}>{card.metric}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{card.status}</p>
              </div>
              <span className={`grid size-14 place-items-center rounded-2xl ${style.bg} text-2xl font-black text-white shadow-soft`}>{card.icon}</span>
            </div>
            <div className="mt-5 grid gap-2">
              {card.frontLines.map((line) => (
                <p key={line} className="text-sm font-bold leading-6 text-slate-700 dark:text-slate-300">{line}</p>
              ))}
            </div>
          </article>

          <article className={`absolute inset-0 overflow-hidden rounded-[2rem] border ${style.border} bg-[linear-gradient(135deg,#ffffff,#f3fbff)] p-6 shadow-soft [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-y-auto dark:bg-slate-950 dark:bg-none`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-black uppercase tracking-[0.18em] ${style.text}`}>{card.title} details</p>
                <h3 className="mt-2 text-xl font-black break-words text-ink dark:text-white">{card.recommendation}</h3>
              </div>
              <span className="rounded-full border border-line px-3 py-2 text-xs font-black uppercase text-slate-500 dark:border-white/10 dark:text-slate-300">Back</span>
            </div>
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Evidence</p>
                <ul className="mt-2 grid gap-2">
                  {card.details.slice(0, 3).map((item) => (
                    <li key={item} className="text-sm leading-6 text-slate-700 dark:text-slate-300">{item}</li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Check before buying</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-700 dark:text-slate-300">{card.checks[0]}</p>
                </div>
                <div className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Avoid if</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-700 dark:text-slate-300">{card.avoid}</p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </summary>
    </details>
  );
}

function BuyerResults({ result }: { result: AnalyzeResponse }) {
  const { analysis, meta } = result;
  const recommendation = analysis.buyer_recommendation ?? analysis.customer_recommendation;
  const verdictTone = recommendationTone(recommendation.verdict);
  const fakeRisk = analysis.fake_review_risk_score ?? fakeRiskFromIndicators(analysis.fake_review_indicators);
  const sentimentPercentScore = analysis.sentiment_percentage ?? sentimentToPercent(analysis.sentiment_score);
  const complaintPressure = analysis.complaint_severity_score ?? clamp(analysis.common_complaints.length * 14 + analysis.negative_points.length * 8);
  const trustScore = clamp(analysis.product_score * 0.45 + (100 - fakeRisk) * 0.35 + analysis.confidence_score * 20);
  const valueScore = analysis.value_score ?? clamp(analysis.product_score * 0.7 + sentimentPercentScore * 0.3);
  const realityScore = clamp(analysis.product_score * 0.55 + sentimentPercentScore * 0.2 + Math.max(0, 100 - complaintPressure) * 0.25);
  const riskScore = clamp(fakeRisk * 0.35 + complaintPressure * 0.45 + (100 - analysis.product_score) * 0.2);
  const riskLevel = riskScore >= 65 ? "High" : riskScore >= 35 ? "Medium" : "Low";
  const buyerWorry = riskScore >= 65 ? "Yes" : riskScore >= 35 ? "Maybe" : "No";
  const fullComplaint = topComplaint(analysis);
  const fullStrength = analysis.praised_features[0] ?? analysis.positive_points[0] ?? "useful for the right buyer";
  const biggestComplaint = cleanOneLine(fullComplaint, "No repeated complaint", 44);
  const mainStrength = cleanOneLine(fullStrength, "Useful for the right buyer", 44);
  const bestForPhrase = shortShopperPhrase(bestFor(analysis), "Careful shoppers", 5);
  const valueVerdict = valueScore >= 72 ? "Great" : valueScore >= 48 ? "Fair" : "Poor";
  const fakeRiskShort = fakeRisk >= 65 ? "High" : fakeRisk >= 35 ? "Medium" : "Low";
  const verdictLabel = recommendation.verdict.toUpperCase();
  const score = Math.round(clamp(analysis.product_score));
  const trustScoreRounded = Math.round(trustScore);
  const realityScoreRounded = Math.round(realityScore);
  const safeRiskScore = Math.round(100 - riskScore);
  const verdictStyle = {
    good: "from-[#effffb] via-[#e9f6ff] to-[#fff7e7] text-teal",
    warn: "from-[#fff8e8] via-[#eff7ff] to-[#fff0f0] text-amber",
    bad: "from-[#fff0f0] via-[#eef5ff] to-[#f8fbff] text-coral"
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
      metric: `${trustScoreRounded}`,
      status: `${fakeRiskShort} fake risk`,
      frontLines: [`Fake risk: ${fakeRiskShort}`, fakeRisk >= 65 ? "Pattern signals need checking." : fakeRisk >= 35 ? "Some wording feels patterned." : "Reviews look natural."],
      details: uniqueSellerItems(
        [...analysis.fake_review_indicators, meta.confidence_detail, `${meta.review_count_estimate} valid reviews analyzed.`],
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
      score: realityScore,
      tone: realityScore >= 70 ? "good" as const : realityScore >= 45 ? "warn" as const : "bad" as const,
      visual: "slider",
      icon: "P",
      metric: `${realityScoreRounded}`,
      status: "Promise match",
      frontLines: [`Strength: ${mainStrength}`, `Complaint: ${biggestComplaint}`],
      details: uniqueSellerItems(
        [analysis.overall_summary, fullStrength, fullComplaint, ...analysis.praised_features, ...analysis.common_complaints],
        ["Reality score compares confirmed strengths against repeated complaints."],
        3
      ),
      checks: ["Confirm size, material, compatibility, and the exact version you will receive."],
      avoid: realityScore < 45 ? "The product promise does not match repeated customer reality." : "The top complaint is a dealbreaker for you.",
      recommendation: realityScore >= 70 ? "Product promise looks believable." : "Compare the promise against reviews."
    },
    {
      title: "Risk",
      question: "What could go wrong?",
      score: 100 - riskScore,
      tone: riskScore >= 65 ? "bad" as const : riskScore >= 35 ? "warn" as const : "good" as const,
      visual: "alert",
      icon: "!",
      metric: riskLevel,
      status: `${safeRiskScore} safety score`,
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
                <p className={`text-3xl font-black leading-none ${TRUST_TONE_STYLE[verdictTone].text}`}>{Math.round(Number(score) || 0)}</p>
                <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">/100</p>
              </div>
            </div>
            <div className="mt-8 h-4 overflow-hidden rounded-full bg-white shadow-inner dark:bg-white/10">
              <div className={`h-full rounded-full bg-gradient-to-r ${verdictAccent}`} style={{ width: `${displayPercent(score)}` }} />
            </div>
            <p className="mt-5 text-lg font-black leading-7 text-ink dark:text-white">{buyerRecommendationLine(recommendation.verdict, riskLevel)}</p>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Fake Review Risk", fakeRiskShort, fakeRisk >= 65 ? "text-coral" : fakeRisk >= 35 ? "text-amber" : "text-teal"],
                ["Value", valueVerdict, valueScore >= 72 ? "text-teal" : valueScore >= 48 ? "text-amber" : "text-coral"],
                ["Main Warning", biggestComplaint, "text-coral"],
                ["Best For", bestForPhrase, "text-ocean"]
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
  const sourceItems = [
    { label: "Complaints", value: Math.max(1, analysis.common_complaints.length + analysis.negative_points.length), color: "#d95d5d", className: "bg-coral" },
    { label: "Feature requests", value: Math.max(1, analysis.seller_insights.feature_requests.length), color: "#2356a3", className: "bg-ocean" },
    { label: "Packaging/support", value: Math.max(1, analysis.seller_insights.packaging_shipping_issues.length + analysis.support_issues.length), color: "#d68b1f", className: "bg-amber" },
    { label: "Praise/positioning", value: Math.max(1, analysis.praised_features.length + analysis.seller_insights.competitor_opportunity_insights.length), color: "#0f9f9a", className: "bg-teal" }
  ];

  return (
    <div className="space-y-8">
      <SponsorAnalytics placement="results_seller" />
      <SellerMagicMoment result={result} isSellerPro={isSellerPro} />
      {isSellerPro ? <SellerTrustCriteriaDashboard result={result} /> : <SellerTrustCriteriaSnapshot result={result} accountPlan={accountPlan} />}

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink text-white shadow-soft dark:bg-slate-950">
        <div className="ri-scan-grid absolute inset-0 opacity-20" />
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">Seller command center</Badge>
              <Badge tone={confidenceTone(confidenceLabel)}>{confidenceLabel} evidence</Badge>
              <Badge>{platformLabel(meta.platform ?? "other")}</Badge>
            </div>
            <h1 className="mt-6 max-w-4xl text-3xl font-black lg:text-3xl">Enterprise review intelligence.</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">{analysis.overall_summary}</p>
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

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Operational pressure map</p>
          <div className="mt-5 grid gap-5">
            <SellerSignalBar label="Complaint pressure" value={complaintPressure} tone={complaintPressure >= 65 ? "bad" : complaintPressure >= 35 ? "warn" : "good"} />
            <SellerSignalBar label="Refund risk" value={clamp(analysis.seller_insights.refund_risk_issues.length * 22 + analysis.quality_concerns.length * 10)} tone="bad" />
            <SellerSignalBar label="Packaging friction" value={clamp(analysis.seller_insights.packaging_shipping_issues.length * 24)} tone="warn" />
            <SellerSignalBar label="Feature demand" value={clamp(analysis.seller_insights.feature_requests.length * 20)} tone="info" />
            <SellerSignalBar label="Review evidence" value={evidenceScore} tone={confidenceTone(confidenceLabel)} />
          </div>
        </article>

        <article className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Executive action queue</p>
          <div className="mt-5 grid gap-3">
            {[...analysis.seller_insights.product_improvement_recommendations, ...analysis.seller_insights.listing_improvement_suggestions]
              .slice(0, 6)
              .map((item, index) => (
                <div key={`${item}-${index}`} className="grid gap-3 rounded-2xl border border-line p-4 dark:border-white/10 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <span className="grid size-9 place-items-center rounded-full bg-ink text-sm font-black text-white dark:bg-white dark:text-ink">{index + 1}</span>
                  <span className="text-sm leading-6 text-slate-700 dark:text-slate-300">{item}</span>
                  <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-black uppercase text-teal">Action</span>
                </div>
              ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <SellerDonutCard
          title="Where the comments are coming from"
          subtitle="Theme mix from complaints, requests, packaging/support, and positive positioning signals."
          items={sourceItems}
        />
        <article className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Subscription-worthy insight</p>
          <h3 className="mt-3 text-3xl font-black break-words text-ink dark:text-white">What to fix, what to advertise, what to stop promising.</h3>
          <div className="mt-5 grid gap-3">
            {[
              ["Fix", analysis.seller_insights.product_improvement_recommendations[0] ?? analysis.improvement_suggestions[0] ?? "Prioritize the top repeated product complaint."],
              ["Advertise", analysis.praised_features[0] ?? analysis.positive_points[0] ?? "Use the strongest repeated praise as ad copy only when the product reliably delivers it."],
              ["Clarify", analysis.seller_insights.listing_improvement_suggestions[0] ?? "Set expectations in photos, bullets, sizing, materials, and what's in the box."],
              ["Protect", analysis.seller_insights.refund_risk_issues[0] ?? "Watch refund-risk language before increasing paid traffic."]
            ].map(([label, text], index) => (
              <div key={label} className="grid gap-3 rounded-2xl border border-line p-4 dark:border-white/10 sm:grid-cols-[90px_1fr] sm:items-start">
                <span className={`rounded-full px-3 py-1 text-center text-xs font-black uppercase text-white ${["bg-coral", "bg-teal", "bg-ocean", "bg-amber"][index]}`}>{label}</span>
                <p className="text-sm font-semibold leading-6 text-slate-700 dark:text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge>{meta.mode === "openai" ? meta.model : "Local fallback"}</Badge>
              <Badge>Export-ready report</Badge>
              <Badge>Operational intelligence</Badge>
            </div>
            <h2 className="mt-5 max-w-4xl text-3xl font-black break-words text-ink dark:text-white">Strategic insight layers</h2>
            <p className="mt-4 max-w-4xl text-base leading-7 text-slate-600 dark:text-slate-300">The seller workspace converts review language into product, listing, support, and positioning actions.</p>
          </div>
          <SellerReportActions result={result} />
        </div>
      </section>

      <SellerIntelligenceTabs result={result} />

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <InsightList title="Customer pain points" items={analysis.seller_insights.main_customer_pain_points} tone="bad" />
        <InsightList title="Complaint clusters" items={analysis.seller_insights.complaint_clusters} tone="warn" />
        <InsightList title="Product improvements" items={analysis.seller_insights.product_improvement_recommendations} tone="good" />
        <InsightList title="Listing improvements" items={analysis.seller_insights.listing_improvement_suggestions} tone="info" />
        <InsightList title="Packaging and shipping" items={analysis.seller_insights.packaging_shipping_issues} tone="warn" />
        <InsightList title="Feature requests" items={analysis.seller_insights.feature_requests} tone="info" />
        <InsightList title="Support issues" items={analysis.support_issues} tone="warn" />
        <InsightList title="Refund risk" items={analysis.seller_insights.refund_risk_issues} tone="bad" />
        <InsightList title="Positioning intelligence" items={analysis.seller_insights.competitor_opportunity_insights} tone="good" />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <RatingBreakdown breakdown={meta.rating_breakdown} />
        <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Keyword intelligence</p>
          <div className="mt-5 grid gap-3">
            {analysis.keyword_analysis.slice(0, 10).map((item) => (
              <div key={item.keyword}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-ink dark:text-white">{item.keyword}</span>
                  <span className="text-slate-500 dark:text-slate-400">{item.mentions} mentions</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    className={`h-full rounded-full ${item.sentiment === "negative" ? "bg-coral" : item.sentiment === "positive" ? "bg-teal" : "bg-ocean"}`}
                    style={{ width: `${Math.min(100, Math.max(12, item.mentions * 14))}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.context}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      {(result as Record<string, unknown>)?.seller_insights ? (
        <SellerBusinessKpiDashboard analysis={analysis ?? result ?? {}} plan="seller" />
      ) : null}

      <SponsoredResources
        placement="results"
        compact
        eyebrow="Seller resources"
        title="Operational tools for the next fix"
        description="Optional partner resources stay below the intelligence report."
      />
    </div>
  );
}

export function ResultsDashboard({ result, accountPlan }: { result: AnalyzeResponse; accountPlan?: SubscriptionPlan | null }) {
  if (result.meta.audience === "seller" || result.meta.audience === "both") {
    return <SellerResults result={result} accountPlan={accountPlan} />;
  }

  return <BuyerResults result={result} />;
}
