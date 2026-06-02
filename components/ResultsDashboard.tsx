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
  sentimentLabelFromPercent,
  sentimentToPercent,
  shopperVerdictCopy
} from "@/lib/analysisScoring";
import { platformLabel } from "@/lib/platforms";
import type { AnalyzeResponse, CustomerRecommendation } from "@/lib/types";

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

function bestForList(analysis: AnalyzeResponse["analysis"]) {
  const source = [...analysis.praised_features, ...analysis.positive_points, ...analysis.keywords].join(" ").toLowerCase();
  const picks: string[] = [];
  if (source.includes("student") || source.includes("school") || source.includes("study")) picks.push("Students");
  if (source.includes("office") || source.includes("work") || source.includes("desk")) picks.push("Office work");
  if (source.includes("travel") || source.includes("portable") || source.includes("compact")) picks.push("Travel");
  if (source.includes("daily") || source.includes("every day") || source.includes("morning")) picks.push("Daily use");
  if (source.includes("gift")) picks.push("Gifting");

  for (const feature of analysis.praised_features) {
    const label = feature.split(/[,.]/)[0]?.trim();
    if (label && label.length <= 26 && !picks.some((item) => item.toLowerCase() === label.toLowerCase())) picks.push(label);
    if (picks.length >= 4) break;
  }

  return (picks.length ? picks : ["Careful shoppers", "Quick comparison", "Value hunters"]).slice(0, 4);
}

function topComplaint(analysis: AnalyzeResponse["analysis"]) {
  return (
    analysis.common_complaints[0] ??
    analysis.negative_points[0] ??
    analysis.quality_concerns[0] ??
    "No repeated complaint stood out."
  );
}

function valueLabel(valueScore: number) {
  if (valueScore >= 72) return "Great value";
  if (valueScore >= 48) return "Fair value";
  return "Weak value";
}

function scoreMeaning(value: number) {
  if (value >= 80) return "Strong / highly positive";
  if (value >= 65) return "Good, check details";
  if (value >= 50) return "Mixed / compare first";
  if (value >= 35) return "Risky";
  return "Avoid / major concern";
}

function ScoreGuide({ activeScore }: { activeScore: number }) {
  const bands = [
    ["80-100%", "Strong", "bg-teal"],
    ["65-79%", "Good", "bg-ocean"],
    ["50-64%", "Mixed", "bg-amber"],
    ["35-49%", "Risky", "bg-coral"],
    ["0-34%", "Avoid", "bg-slate-500"]
  ];

  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Score meaning</p>
          <p className="mt-1 text-lg font-black text-ink dark:text-white">{formatPercent(activeScore)} = {scoreMeaning(activeScore)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bands.map(([range, label, color]) => (
            <span key={range} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-[11px] font-black uppercase text-slate-600 dark:border-white/10 dark:text-slate-300">
              <span className={`size-2 rounded-full ${color}`} />
              {range} {label}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function QuickCard({
  eyebrow,
  value,
  detail,
  tone = "info"
}: {
  eyebrow: string;
  value: string;
  detail: string;
  tone?: "info" | "good" | "warn" | "bad";
}) {
  const style = {
    info: "border-ocean/20 bg-ocean/10 text-ocean dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-300",
    good: "border-teal/20 bg-teal/10 text-teal",
    warn: "border-amber/25 bg-amber/10 text-amber",
    bad: "border-coral/25 bg-coral/10 text-coral"
  }[tone];

  return (
    <article className={`rounded-2xl border p-5 shadow-soft ${style}`}>
      <p className="text-xs font-black uppercase">{eyebrow}</p>
      <p className="mt-4 break-words text-2xl font-black leading-tight text-ink dark:text-white xl:text-3xl">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{detail}</p>
    </article>
  );
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
              <span className="font-black text-ink dark:text-white">{rating}</span>
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

function BuyerMeterCard({
  label,
  value,
  detail,
  tone
}: {
  label: string;
  value: number;
  detail: string;
  tone: "good" | "warn" | "bad" | "info";
}) {
  const color = {
    good: "bg-teal",
    warn: "bg-amber",
    bad: "bg-coral",
    info: "bg-ocean"
  }[tone];

  return (
    <article className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-black uppercase text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-3xl font-black text-ink dark:text-white">{formatPercent(value)}</p>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${clamp(value)}%` }} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail}</p>
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
      return `${item.color} ${start.toFixed(1)}% ${cursor.toFixed(1)}%`;
    })
    .join(", ");

  return (
    <article className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p>
      <div className="mt-6 grid gap-6 md:grid-cols-[180px_1fr] md:items-center">
        <div className="relative mx-auto grid size-44 place-items-center rounded-full shadow-[0_24px_70px_rgba(23,32,51,0.12)]" style={{ background: `conic-gradient(${gradient})` }}>
          <div className="grid size-24 place-items-center rounded-full bg-white text-center shadow-soft dark:bg-slate-950">
            <span className="text-2xl font-black text-ink dark:text-white">{total}</span>
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

function SellerMagicMoment({ result }: { result: AnalyzeResponse }) {
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
          <Badge tone="warn">Seller Pro magic moment</Badge>
          <h2 className="mt-5 text-4xl font-black leading-tight lg:text-6xl">Turn review pain into product revenue moves.</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
            This report is not a shopper verdict. It is a seller operating map built from {meta.review_count_estimate} valid reviews.
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
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-ink">{tag}</span>
              </div>
              <p className="mt-3 text-lg font-black leading-7">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BuyerResults({ result }: { result: AnalyzeResponse }) {
  const { analysis, meta } = result;
  const recommendation = analysis.buyer_recommendation ?? analysis.customer_recommendation;
  const verdictTone = recommendationTone(recommendation.verdict);
  const confidenceLabel = meta.confidence_label ?? (meta.review_count_estimate >= 50 ? "High" : meta.review_count_estimate >= 10 ? "Medium" : "Low");
  const fakeRisk = analysis.fake_review_risk_score ?? fakeRiskFromIndicators(analysis.fake_review_indicators);
  const sentimentPercentScore = analysis.sentiment_percentage ?? sentimentToPercent(analysis.sentiment_score);
  const trustScore = clamp(analysis.product_score * 0.65 + analysis.confidence_score * 35 - fakeRisk * 0.12);
  const valueScore = analysis.value_score ?? clamp(analysis.product_score * 0.7 + sentimentPercentScore * 0.3);
  const bestForItems = bestForList(analysis);
  const biggestComplaint = topComplaint(analysis);
  const valueVerdict = valueLabel(valueScore);
  const shopperVerdict = shopperVerdictCopy(recommendation.verdict, analysis.product_score);

  return (
    <div className="space-y-8">
      <SponsorAnalytics placement="results_buyer" />

      <section className="ri-reveal-pop relative overflow-hidden rounded-[2rem] border border-white/15 bg-[linear-gradient(125deg,#07111f_0%,#113f67_28%,#08b7a8_55%,#ffb238_78%,#ff5d8f_100%)] text-white shadow-[0_34px_120px_rgba(35,86,163,0.35)]">
        <div className="ri-scan-grid absolute inset-0 opacity-25" />
        <div className="ri-result-firework absolute right-10 top-8 hidden md:block" />
        <div className="relative grid gap-6 p-5 lg:grid-cols-[0.78fr_1.22fr] lg:p-7">
          <div className="rounded-[1.6rem] border border-white/15 bg-slate-950/55 p-5 shadow-[0_20px_90px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Instant answer</p>
            <div className="mt-5 grid place-items-center">
              <div className="ri-score-orbit grid size-44 place-items-center rounded-full border border-white/20 bg-white/10 text-center">
                <div>
                  <p className="text-7xl font-black leading-none">{formatPercent(analysis.product_score)}</p>
                  <p className="mt-1 text-sm font-black uppercase text-cyan-100">Shopper score</p>
                </div>
              </div>
            </div>
            <h1 className="mt-5 text-center text-4xl font-black">{shopperVerdict}</h1>
            <p className="mt-2 text-center text-sm font-black uppercase tracking-wide text-cyan-100">{scoreMeaning(analysis.product_score)}</p>
            <p className="mt-3 text-center text-sm leading-6 text-slate-200">{recommendation.rationale}</p>
            {analysis.score_alignment_note ? <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-300">{analysis.score_alignment_note}</p> : null}
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
              <div className="rounded-[1.6rem] border border-white/15 bg-white/[0.12] p-5 backdrop-blur-xl">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={verdictTone}>{recommendation.verdict}</Badge>
                  <Badge tone={fakeRisk >= 65 ? "bad" : fakeRisk >= 35 ? "warn" : "good"}>{riskLabel(fakeRisk)}</Badge>
                  <Badge tone={confidenceTone(confidenceLabel)}>{confidenceLabel} confidence</Badge>
                </div>
                <h2 className="mt-4 text-4xl font-black leading-tight lg:text-5xl">Clear answer in one screen.</h2>
                <p className="mt-3 max-w-3xl text-base leading-7 text-slate-100">{analysis.overall_summary}</p>
              </div>

              <div className="ri-mini-bot hidden rounded-[1.6rem] border border-white/15 bg-slate-950/45 p-5 backdrop-blur-xl xl:block">
                <div className="ri-mini-bot-head">
                  <span />
                  <span />
                </div>
                <div className="mt-5 rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-ink">
                  Verdict ready
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/15 bg-white/90 p-4 text-ink shadow-soft">
                <p className="text-xs font-black uppercase text-slate-500">Fake Review Risk</p>
                <p className="mt-2 text-2xl font-black text-coral">{riskLabel(fakeRisk)}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{formatPercent(fakeRisk)} pattern pressure</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/90 p-4 text-ink shadow-soft">
                <p className="text-xs font-black uppercase text-slate-500">Value for Money</p>
                <p className="mt-2 text-2xl font-black text-teal">{valueVerdict}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{formatPercent(valueScore)} value read</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/90 p-4 text-ink shadow-soft">
                <p className="text-xs font-black uppercase text-slate-500">Top Complaint</p>
                <p className="mt-2 break-words text-lg font-black leading-snug text-coral">{biggestComplaint}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/90 p-4 text-ink shadow-soft">
                <p className="text-xs font-black uppercase text-slate-500">Evidence</p>
                <p className="mt-2 text-2xl font-black text-ocean">{meta.review_count_estimate}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">valid reviews analyzed</p>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/15 bg-slate-950/50 p-4 backdrop-blur-xl">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber">Best for</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {bestForItems.map((item) => (
                      <span key={item} className="rounded-full bg-white px-3 py-2 text-xs font-black text-ink shadow-soft">{item}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/analyze" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-ink transition hover:-translate-y-0.5 hover:bg-cyan-100">
                    Test another product
                  </Link>
                  <Link href="/pricing" className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15">
                    Unlock unlimited scans
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuickCard eyebrow="Worth it?" value={shopperVerdict} detail="The fastest decision from the supplied reviews." tone={verdictTone} />
        <QuickCard eyebrow="Fake review risk" value={riskLabel(fakeRisk)} detail="Based on suspicious wording, repetition, and warning signals." tone={fakeRisk >= 65 ? "bad" : fakeRisk >= 35 ? "warn" : "good"} />
        <QuickCard eyebrow="Value for money" value={valueScore >= 72 ? "Strong" : valueScore >= 48 ? "Mixed" : "Weak"} detail={analysis.value_for_money_opinion} tone={valueScore >= 72 ? "good" : valueScore >= 48 ? "warn" : "bad"} />
        <QuickCard eyebrow="Best for" value={bestFor(analysis)} detail="Matched from praised use cases and repeated customer language." tone="info" />
      </section>

      <ScoreGuide activeScore={analysis.product_score} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BuyerMeterCard label="Trust score" value={trustScore} tone={trustScore >= 72 ? "good" : trustScore >= 48 ? "warn" : "bad"} detail="Score, evidence quality, sentiment, and review risk combined." />
        <BuyerMeterCard label="Confidence" value={analysis.confidence_score * 100} tone={confidenceTone(confidenceLabel)} detail={meta.confidence_detail ?? "Confidence is based on valid review volume."} />
        <BuyerMeterCard label="Fake risk" value={fakeRisk} tone={fakeRisk >= 65 ? "bad" : fakeRisk >= 35 ? "warn" : "good"} detail="Lower risk means cleaner review signal." />
        <BuyerMeterCard label="Sentiment" value={sentimentPercentScore} tone={sentimentPercentScore >= 68 ? "good" : sentimentPercentScore <= 40 ? "bad" : "warn"} detail={`${sentimentLabelFromPercent(sentimentPercentScore)} shopper emotion.`} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <div className="grid gap-5 md:grid-cols-2">
          <InsightList title="Biggest strengths" items={analysis.praised_features.slice(0, 5)} tone="good" />
          <InsightList title="Biggest complaints" items={analysis.common_complaints.slice(0, 5)} tone="bad" />
          <InsightList title="Red flags" items={[...analysis.quality_concerns, ...analysis.durability_issues, ...analysis.support_issues].slice(0, 5)} tone="warn" />
          <InsightList title="Loved features" items={analysis.positive_points.slice(0, 5)} tone="info" />
        </div>
        <div className="space-y-5">
          <RatingBreakdown breakdown={meta.rating_breakdown} />
          <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">AI quick verdict</p>
            <p className="mt-4 text-2xl font-black text-ink dark:text-white">{recommendation.verdict}: {recommendation.rationale}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/analyze" className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
                Test another product
              </Link>
              <Link href="/compare" className="rounded-xl border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white">
                Compare products
              </Link>
            </div>
          </article>
        </div>
      </section>

      <SponsoredResources
        placement="results"
        compact
        eyebrow="AI commerce resources"
        title="Useful next-step tools"
        description="Partner resources stay below the verdict so the buying answer remains the hero."
      />
    </div>
  );
}

function SellerResults({ result }: { result: AnalyzeResponse }) {
  const { analysis, meta } = result;
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
      <SellerMagicMoment result={result} />

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink text-white shadow-soft dark:bg-slate-950">
        <div className="ri-scan-grid absolute inset-0 opacity-20" />
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">Seller command center</Badge>
              <Badge tone={confidenceTone(confidenceLabel)}>{confidenceLabel} evidence</Badge>
              <Badge>{platformLabel(meta.platform ?? "other")}</Badge>
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-black lg:text-6xl">Enterprise review intelligence.</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">{analysis.overall_summary}</p>
            {analysis.score_alignment_note ? <p className="mt-4 max-w-3xl rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold leading-6 text-cyan-100">{analysis.score_alignment_note}</p> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/pricing" className="rounded-xl bg-white px-5 py-3 text-sm font-black text-ink transition hover:bg-cyan-100">
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
              <p className="mt-4 text-4xl font-black">{meta.review_count_estimate}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black uppercase text-slate-400">Satisfaction</p>
              <p className="mt-4 text-4xl font-black">{formatPercent(analysis.seller_insights.customer_satisfaction_score)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black uppercase text-slate-400">Complaint pressure</p>
              <p className="mt-4 text-4xl font-black">{formatPercent(complaintPressure)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black uppercase text-slate-400">Opportunity</p>
              <p className="mt-4 text-4xl font-black">{formatPercent(opportunityScore)}</p>
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
          <h3 className="mt-3 text-3xl font-black text-ink dark:text-white">What to fix, what to advertise, what to stop promising.</h3>
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
            <h2 className="mt-5 max-w-4xl text-3xl font-black text-ink dark:text-white">Strategic insight layers</h2>
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

export function ResultsDashboard({ result }: { result: AnalyzeResponse }) {
  if (result.meta.audience === "seller" || result.meta.audience === "both") {
    return <SellerResults result={result} />;
  }

  return <BuyerResults result={result} />;
}
