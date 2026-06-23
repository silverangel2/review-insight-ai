"use client";

import { useState } from "react";
import {
  cleanReviewInsightText,
  sanitizeSellerInsightList,
  sellerFriendlyTheme
} from "@/lib/insightSanitizer";

type AnyRecord = Record<string, unknown>;
type GaugeKind = "needle" | "bars" | "wave" | "heat" | "signal" | "priority";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => cleanReviewInsightText(String(item))).filter(Boolean);
  if (typeof value === "string") return value.split(/[.;\n]/).map((item) => cleanReviewInsightText(item)).filter(Boolean);
  return [];
}

function cleanScore(value: unknown, fallback = 72) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function estimateShare(count: number, total: number) {
  if (!total || total < 5) return "Directional";
  return `About ${Math.round((count / total) * 100)}%`;
}

function peopleStyle(count: number, total: number) {
  if (!total || total < 5) return "Small sample";
  const outOfTen = Math.max(1, Math.min(10, Math.round((count / total) * 10)));
  return `${outOfTen} of 10 signals`;
}

function compactText(value: string) {
  const clean = sellerFriendlyTheme(value, "clean review signal needs more evidence").replace(/\s+/g, " ").trim();
  return clean;
}

function unique(items: string[]) {
  return sanitizeSellerInsightList(items, [], 8);
}

function pickDistinctTheme(items: string[], fallback: string, blocked: string[] = []) {
  const blockedKeys = new Set(blocked.map((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()));
  const choices = sanitizeSellerInsightList(items, [fallback], 10);

  return (
    choices.find((item) => {
      const key = item.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      return key && !blockedKeys.has(key) && item !== "Not enough clean review evidence";
    }) ?? fallback
  );
}

function metricToGaugeScore(metric: string) {
  const clean = metric.toLowerCase();
  const percentMatch = clean.match(/(\d{1,3})\s*%/);
  if (percentMatch) return Math.max(0, Math.min(100, Number(percentMatch[1])));

  const outOfTenMatch = clean.match(/(\d{1,2})\s*(?:of|\/)\s*10/);
  if (outOfTenMatch) return Math.max(0, Math.min(100, Number(outOfTenMatch[1]) * 10));

  const signalMatch = clean.match(/(\d{1,3})\s*signals?/);
  if (signalMatch) return Math.max(18, Math.min(88, Number(signalMatch[1]) * 14));

  if (/strong|high|watch/.test(clean)) return 78;
  if (/maintain|medium|directional|snapshot/.test(clean)) return 58;
  if (/low|weak|small|0/.test(clean)) return 34;
  return 64;
}

function getReviewCount(analysis: AnyRecord) {
  const metadata = asObject(analysis.metadata);
  return Number(
    analysis.review_count ??
      analysis.reviewCount ??
      analysis.total_reviews ??
      analysis.totalReviews ??
      metadata.review_count ??
      metadata.reviewCount ??
      0
  );
}

function getSellerInsights(analysis: AnyRecord): Record<string, unknown> {
  return asObject(analysis.seller_insights ?? analysis.sellerInsights);
}

function getComplaints(analysis: AnyRecord) {
  const seller = getSellerInsights(analysis);
  return unique([
    ...asArray(analysis.common_complaints),
    ...asArray(analysis.quality_concerns),
    ...asArray(analysis.product_quality_concerns),
    ...asArray(seller.complaint_clusters),
    ...asArray(seller.shipping_complaint_detection),
    ...asArray(seller.packaging_shipping_issues),
    ...asArray(seller.seller_recommendations).filter((item) =>
      /complaint|risk|issue|problem|return|refund|shipping|packaging|durability|quality|compatibility|fit/i.test(item)
    )
  ]);
}

function getPraise(analysis: AnyRecord) {
  const seller = getSellerInsights(analysis);
  return unique([
    ...asArray(analysis.positive_themes),
    ...asArray(analysis.strengths),
    ...asArray(analysis.top_positive_signals),
    ...asArray(analysis.keywords),
    ...asArray(seller.sentiment_trends).filter((item) =>
      /positive|praise|like|love|comfort|easy|value|quality|works|useful|fit|protect/i.test(item)
    )
  ]);
}

function getFeatureRequests(analysis: AnyRecord) {
  const seller = getSellerInsights(analysis);
  return unique([
    ...asArray(analysis.feature_requests),
    ...asArray(analysis.improvement_suggestions),
    ...asArray(seller.product_improvement_recommendations),
    ...asArray(seller.seller_recommendations)
  ]);
}

function getSupportIssues(analysis: AnyRecord) {
  const seller = getSellerInsights(analysis);
  return unique([
    ...asArray(analysis.support_issues),
    ...asArray(analysis.packaging_issues),
    ...asArray(seller.shipping_complaint_detection),
    ...asArray(seller.packaging_shipping_issues),
    ...asArray(seller.support_issues)
  ]);
}

function colorFor(kind: GaugeKind) {
  if (kind === "bars") return "#0f9f9a";
  if (kind === "wave") return "#2563eb";
  if (kind === "heat") return "#df5f63";
  if (kind === "signal") return "#8b5cf6";
  if (kind === "priority") return "#d98b16";
  return "#2356a3";
}

function GaugeIcon({ kind, score, label }: { kind: GaugeKind; score: number; label: string }) {
  const color = colorFor(kind);
  const safeScore = Math.max(8, Math.min(96, score));
  const dash = Math.round((safeScore / 100) * 238);

  if (kind === "bars" || kind === "signal") {
    const bars = kind === "signal" ? [38, 52, 76, 62, 88] : [46, 64, 74, 84, 58];
    return (
      <svg viewBox="0 0 160 100" className="h-20 w-full" role="img" aria-label={label}>
        <rect x="10" y="86" width="140" height="5" rx="2.5" fill="#e8eef6" />
        {bars.map((height, index) => (
          <rect key={index} x={20 + index * 26} y={86 - height} width="15" height={height} rx="7.5" fill={color} opacity={0.35 + index * 0.11} />
        ))}
        <circle cx={18 + safeScore * 1.24} cy="86" r="6" fill="#fff" stroke={color} strokeWidth="5" />
      </svg>
    );
  }

  if (kind === "wave") {
    return (
      <svg viewBox="0 0 180 100" className="h-20 w-full" role="img" aria-label={label}>
        <path d="M12 58 C42 22 70 76 102 44 C130 14 148 28 168 52" fill="none" stroke="#e5ebf3" strokeWidth="12" strokeLinecap="round" />
        <path d="M12 58 C42 22 70 76 102 44 C130 14 148 28 168 52" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} 260`} />
        <circle cx={Math.min(160, 18 + safeScore * 1.42)} cy={safeScore > 70 ? 35 : safeScore > 45 ? 50 : 66} r="9" fill={color} stroke="#fff" strokeWidth="5" />
      </svg>
    );
  }

  if (kind === "heat") {
    return (
      <svg viewBox="0 0 160 100" className="h-20 w-full" role="img" aria-label={label}>
        {[24, 38, 52, 66, 80].map((y, index) => (
          <g key={y}>
            <rect x="20" y={y} width="120" height="9" rx="4.5" fill="#edf2f8" />
            <rect x="20" y={y} width={Math.max(24, (safeScore + index * 8) * 1.05)} height="9" rx="4.5" fill={index < 2 ? "#d98b16" : color} opacity={0.9} />
          </g>
        ))}
      </svg>
    );
  }

  if (kind === "priority") {
    const angle = -130 + safeScore * 2.6;
    return (
      <svg viewBox="0 0 160 100" className="h-20 w-full" role="img" aria-label={label}>
        <path d="M30 82 A50 50 0 0 1 130 82" fill="none" stroke="#e5ebf3" strokeWidth="12" strokeLinecap="round" />
        <path d="M30 82 A50 50 0 0 1 130 82" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} 238`} />
        <g transform={`rotate(${angle} 80 82)`}>
          <path d="M80 82 L80 36" stroke="#0f172a" strokeWidth="7" strokeLinecap="round" />
          <circle cx="80" cy="82" r="8" fill="#0f172a" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 160 100" className="h-20 w-full" role="img" aria-label={label}>
      <path d="M22 74 C48 28 100 28 138 74" fill="none" stroke="#e5ebf3" strokeWidth="12" strokeLinecap="round" />
      <path d="M22 74 C48 28 100 28 138 74" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} 238`} />
      <g transform={`translate(${26 + safeScore * 1.06} ${safeScore > 72 ? 44 : safeScore > 48 ? 54 : 66})`}>
        <path d="M0 -18 L12 14 L0 8 L-12 14 Z" fill={color} stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
      </g>
      <path d="M26 84 H134" stroke="#edf2f8" strokeWidth="5" strokeLinecap="round" />
      <path d="M26 84 H76" stroke={color} strokeWidth="5" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}

function KpiCard({
  title,
  metric,
  tone,
  gauge,
  insight,
  action,
  impact
}: {
  title: string;
  metric: string;
  tone: string;
  gauge: GaugeKind;
  insight: string;
  action: string;
  impact: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const numeric = metricToGaugeScore(metric);

  return (
    <button
      type="button"
      onClick={() => setFlipped((value) => !value)}
      aria-pressed={flipped}
      className="h-[260px] rounded-[1.35rem] text-left [perspective:1200px] focus:outline-none focus:ring-4 focus:ring-ocean/20"
    >
      <div className={`relative h-full transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
        <article className={`absolute inset-0 overflow-y-auto rounded-[1.35rem] border bg-gradient-to-br ${tone} p-3 shadow-soft [backface-visibility:hidden] dark:border-white/10`}>
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-2">
              <p className="max-w-[8.6rem] text-[9px] font-black uppercase leading-4 tracking-[0.18em] text-slate-500">{title}</p>
              <span className="grid size-8 place-items-center rounded-2xl bg-white/75 text-[10px] font-black text-slate-700 shadow-inner">↻</span>
            </div>
            <div className="mt-2">
              <GaugeIcon kind={gauge} score={numeric} label={`${title} gauge`} />
            </div>
            <p className="mt-1 text-[1.35rem] font-black leading-none text-slate-950">{metric}</p>
            <p className="mt-2 text-[11px] font-bold leading-[1.35rem] text-slate-700">{compactText(insight)}</p>
            <p className="mt-auto text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Tap for business proof</p>
          </div>
        </article>

        <article className={`absolute inset-0 overflow-y-auto rounded-[1.35rem] border bg-gradient-to-br ${tone} p-3.5 shadow-soft [backface-visibility:hidden] [transform:rotateY(180deg)] dark:border-white/10`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Business proof</p>
              <h3 className="mt-1 text-base font-black text-slate-950">{title}</h3>
            </div>
            <span className="rounded-full bg-white/75 px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 shadow-inner">Back</span>
          </div>
          <div className="mt-3 space-y-2 text-[11px] leading-5 text-slate-700">
            <p><span className="font-black">Meaning:</span> {compactText(insight)}</p>
            <p><span className="font-black">Action:</span> {compactText(action)}</p>
            <p><span className="font-black">Impact:</span> {cleanReviewInsightText(impact, "Protects trust without overstating the sample.")}</p>
          </div>
        </article>
      </div>
    </button>
  );
}

export function SellerBusinessKpiDashboard({ analysis, plan }: { analysis: AnyRecord; plan?: string }) {
  const reviewCount = getReviewCount(analysis);
  const complaints = getComplaints(analysis);
  const praise = getPraise(analysis);
  const requests = getFeatureRequests(analysis);
  const support = getSupportIssues(analysis);
  const score = cleanScore(analysis.product_score ?? analysis.productScore ?? analysis.confidence_score, 74);

  const topComplaint = pickDistinctTheme(complaints, "unclear durability or expectation gap");
  const secondaryComplaint = pickDistinctTheme(complaints, "the next visible buyer objection", [topComplaint]);
  const topPraise = pickDistinctTheme(praise, "the strongest positive proof point needs more clean review evidence", [topComplaint, secondaryComplaint]);
  const topRequest = pickDistinctTheme(requests, "clarify the most important buyer expectation in the listing", [topComplaint, secondaryComplaint, topPraise]);
  const topSupport = pickDistinctTheme(support, "support, shipping, packaging, or return expectations need monitoring", [topComplaint, secondaryComplaint, topPraise, topRequest]);

  const totalSignalBase = Math.max(reviewCount, complaints.length + praise.length + support.length + 4);
  const complaintShare = complaints.length ? estimateShare(Math.min(complaints.length, totalSignalBase), totalSignalBase) : "Low signal";
  const praisePeople = praise.length ? peopleStyle(Math.min(praise.length + 2, totalSignalBase), totalSignalBase) : "Directional";
  const sampleWarning = reviewCount && reviewCount < 15 ? "Small sample size: directional signal only." : "Based on the provided review sample.";

  const cards = [
    {
      title: "Conversion Blocker",
      metric: complaintShare,
      tone: "border-coral/35 from-orange-100 via-white to-rose-100",
      gauge: "heat" as const,
      insight: `Buyers may hesitate because the sample points to ${topComplaint}.`,
      action: `Answer this objection directly in photos, bullets, FAQ, and expectation-setting copy: ${topComplaint}.`,
      impact: "Reduces pre-checkout doubt and prevents surprise complaints after purchase."
    },
    {
      title: "Revenue Opportunity",
      metric: praisePeople,
      tone: "border-teal/35 from-emerald-100 via-white to-teal/20",
      gauge: "bars" as const,
      insight: `The strongest sales proof is ${topPraise}.`,
      action: `Turn this customer-backed benefit into headline copy, image captions, benefit bullets, and ads: ${topPraise}.`,
      impact: "Makes customer proof easier to see before shoppers leave the page."
    },
    {
      title: "Buyer Trust Gap",
      metric: `${score}%`,
      tone: "border-blue-300 from-sky-100 via-white to-blue-100",
      gauge: "needle" as const,
      insight: "Buyers are checking whether the product feels real, reliable, worth the price, and supported.",
      action: "Add real-use proof, honest limits, warranty language, support clarity, and balanced review evidence.",
      impact: "Closes doubts before checkout and makes the product feel safer to try."
    },
    {
      title: "Top Complaint Share",
      metric: complaints.length ? `${complaints.length} signals` : "0 signals",
      tone: "border-coral/35 from-rose-100 via-white to-orange-100",
      gauge: "priority" as const,
      insight: complaints.length ? `The most visible complaint area is ${secondaryComplaint === "the next visible buyer objection" ? topComplaint : secondaryComplaint}.` : "No strong repeated complaint cluster was detected.",
      action: complaints.length ? `Fix or clearly explain this issue first: ${topComplaint}.` : "Keep collecting reviews and watch for repeated objections.",
      impact: "Prioritizes the issue most likely to hurt ratings, returns, and conversion."
    },
    {
      title: "Repeat Praise Signal",
      metric: praise.length ? `${praise.length} proofs` : "Weak signal",
      tone: "border-amber/40 from-yellow-100 via-white to-amber/20",
      gauge: "wave" as const,
      insight: `Positive buyer language supports highlighting ${topPraise}.`,
      action: "Use only clean customer-backed claims in product copy, images, and ads.",
      impact: "Converts review praise into marketing proof without inventing claims."
    },
    {
      title: "Support Risk",
      metric: support.length ? "Watch" : "Low",
      tone: "border-violet-300 from-violet-100 via-white to-blue-100",
      gauge: "signal" as const,
      insight: `Customer care signal: ${topSupport}.`,
      action: "Clarify shipping, returns, replacement, warranty, and contact expectations before checkout.",
      impact: "Protects trust after purchase and can reduce refunds, disputes, and negative reviews."
    }
  ];

  return (
    <section className="mt-8 rounded-[2rem] border border-line bg-white/85 p-5 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean">Seller money intelligence</p>
          <h2 className="mt-3 text-3xl font-black text-ink dark:text-white">What review patterns mean for sales</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {sampleWarning} Each gauge translates review evidence into buyer psychology, conversion risk, and seller action.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-mist px-5 py-4 text-sm font-black text-ink dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
          {plan?.includes("pro") ? "Seller Pro depth" : "Seller snapshot"}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => <KpiCard key={card.title} {...card} />)}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-xl font-black text-ink dark:text-white">Money Opportunity</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
            <li><span className="font-black">What may be costing sales:</span> {topComplaint}</li>
            <li><span className="font-black">What to highlight more:</span> {topPraise}</li>
            <li><span className="font-black">What to fix first:</span> {topRequest}</li>
            <li><span className="font-black">What to answer before checkout:</span> durability, value, support, and expectation fit.</li>
          </ul>
        </article>

        <article className="rounded-[1.75rem] border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-xl font-black text-ink dark:text-white">Buyer Psychology</h3>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
            <p><span className="font-black">Can I trust this?</span> Show real proof and balanced pros/cons.</p>
            <p><span className="font-black">Will it last?</span> Address reliability doubts and product limits.</p>
            <p><span className="font-black">Is it worth the price?</span> Connect price to quality, utility, and outcomes.</p>
            <p><span className="font-black">Will the seller help me?</span> Make support, returns, and replacements obvious.</p>
          </div>
        </article>
      </div>
    </section>
  );
}
