"use client";

type AnyRecord = Record<string, unknown>;

function asArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/[.;\n]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function clampScore(value: unknown, fallback = 72) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function percent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function estimateShare(count: number, total: number) {
  if (!total || total < 1) return "Directional";
  return `About ${percent((count / total) * 100)}`;
}

function peopleStyle(count: number, total: number) {
  if (!total || total < 1) return "More reviews needed";
  const outOfTen = Math.max(1, Math.min(10, Math.round((count / total) * 10)));
  return `${outOfTen} out of 10`;
}

function firstUseful(items: string[], fallback: string) {
  return items.find((item) => item && item.length > 2) ?? fallback;
}

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, 6);
}

function getReviewCount(analysis: AnyRecord) {
  const metadata =
    analysis.metadata && typeof analysis.metadata === "object"
      ? (analysis.metadata as Record<string, unknown>)
      : {};

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
  const seller = analysis.seller_insights ?? analysis.sellerInsights;

  if (seller && typeof seller === "object") {
    return seller as Record<string, unknown>;
  }

  return {};
}

function getComplaints(analysis: AnyRecord) {
  const seller = getSellerInsights(analysis);
  return unique([
    ...asArray(analysis?.common_complaints),
    ...asArray(analysis?.quality_concerns),
    ...asArray(analysis?.product_quality_concerns),
    ...asArray(seller?.complaint_clusters),
    ...asArray(seller?.shipping_complaint_detection),
    ...asArray(seller?.packaging_shipping_issues),
    ...asArray(seller?.seller_recommendations).filter((item) => /complaint|risk|issue|problem|return|refund|shipping|packaging/i.test(item))
  ]);
}

function getPraise(analysis: AnyRecord) {
  return unique([
    ...asArray(analysis?.positive_themes),
    ...asArray(analysis?.strengths),
    ...asArray(analysis?.top_positive_signals),
    ...asArray(analysis?.keywords),
    ...asArray(getSellerInsights(analysis)?.sentiment_trends).filter((item) => /positive|praise|like|love|comfort|easy|value|quality/i.test(item))
  ]);
}

function getFeatureRequests(analysis: AnyRecord) {
  const seller = getSellerInsights(analysis);
  return unique([
    ...asArray(analysis?.feature_requests),
    ...asArray(analysis?.improvement_suggestions),
    ...asArray(seller?.product_improvement_recommendations),
    ...asArray(seller?.seller_recommendations)
  ]);
}

function getSupportIssues(analysis: AnyRecord) {
  const seller = getSellerInsights(analysis);
  return unique([
    ...asArray(analysis?.support_issues),
    ...asArray(analysis?.packaging_issues),
    ...asArray(seller?.shipping_complaint_detection),
    ...asArray(seller?.packaging_shipping_issues),
    ...asArray(seller?.support_issues)
  ]);
}

function KpiCard({
  title,
  metric,
  icon,
  tone,
  insight,
  action,
  impact
}: {
  title: string;
  metric: string;
  icon: string;
  tone: string;
  insight: string;
  action: string;
  impact: string;
}) {
  return (
    <article className="group relative min-h-[320px] [perspective:1200px]">
      <div className="relative h-full min-h-[320px] rounded-[1.75rem] transition duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
        <div className={`absolute inset-0 rounded-[1.75rem] border border-white/70 bg-gradient-to-br ${tone} p-5 shadow-soft [backface-visibility:hidden] dark:border-white/10`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{title}</p>
              <p className="mt-4 text-4xl font-black break-words text-slate-950">{metric}</p>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/70 text-3xl shadow-inner">
              {icon}
            </div>
          </div>
          <p className="mt-5 text-sm font-bold leading-6 text-slate-700">{insight}</p>
          <div className="mt-5 h-2 rounded-full bg-white/70">
            <div className="h-2 rounded-full bg-slate-950/80" style={{ width: "72%" }} />
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Hover / tap for business action</p>
        </div>

        <div className="absolute inset-0 overflow-y-auto rounded-[1.75rem] border border-white/70 bg-white p-5 shadow-soft [backface-visibility:hidden] [transform:rotateY(180deg)] dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-ocean">Seller action</p>
          <h3 className="mt-3 text-xl font-black break-words text-ink dark:text-white">{title}</h3>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <span className="font-black break-words text-ink dark:text-white">Action: </span>{action}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <span className="font-black break-words text-ink dark:text-white">Business impact: </span>{impact}
          </p>
        </div>
      </div>
    </article>
  );
}

export function SellerBusinessKpiDashboard({ analysis, plan }: { analysis: AnyRecord; plan?: string }) {
  const reviewCount = getReviewCount(analysis);
  const complaints = getComplaints(analysis);
  const praise = getPraise(analysis);
  const requests = getFeatureRequests(analysis);
  const support = getSupportIssues(analysis);
  const score = clampScore(analysis?.product_score ?? analysis?.productScore ?? analysis?.confidence_score, 74);

  const topComplaint = firstUseful(complaints, "the biggest repeated buyer hesitation is not clear yet");
  const topPraise = firstUseful(praise, "buyers need more repeated proof points before purchase");
  const topRequest = firstUseful(requests, "improve the listing with clearer product expectations");
  const topSupport = firstUseful(support, "support, shipping, packaging, or return concerns need monitoring");

  const complaintShare = complaints.length ? estimateShare(Math.min(complaints.length, Math.max(1, reviewCount)), Math.max(reviewCount, complaints.length + praise.length + 1)) : "Low signal";
  const praisePeople = praise.length ? peopleStyle(Math.min(praise.length + 2, Math.max(1, reviewCount)), Math.max(reviewCount, praise.length + complaints.length + 2)) : "Directional";
  const sampleWarning = reviewCount && reviewCount < 15 ? "Small sample size — directional signal only." : "Based on the provided review sample.";

  const cards = [
    {
      title: "Conversion Blocker",
      metric: complaintShare,
      icon: "🚧",
      tone: "from-orange-100 via-white to-coral/15",
      insight: `Buyers may hesitate because reviews point to: ${topComplaint}.`,
      action: `Address "${topComplaint}" directly in the product listing, FAQ, images, and expectation-setting copy.`,
      impact: "Reduces buyer hesitation before checkout and helps prevent surprise complaints after purchase."
    },
    {
      title: "Revenue Opportunity",
      metric: praisePeople,
      icon: "💰",
      tone: "from-emerald-100 via-white to-teal/15",
      insight: `Your strongest sales proof is: ${topPraise}.`,
      action: `Turn "${topPraise}" into headline copy, image captions, comparison tables, and benefit bullets.`,
      impact: "Makes the best customer proof easier to notice, which can improve trust and conversion."
    },
    {
      title: "Buyer Trust Gap",
      metric: `${Math.round(Number(score) || 0)}%`,
      icon: "🛡️",
      tone: "from-sky-100 via-white to-blue-200/40",
      insight: "Customers are checking whether the product feels authentic, reliable, worth the money, and supported after purchase.",
      action: "Add proof: real-use photos, honest drawbacks, warranty/support wording, and realistic performance limits.",
      impact: "Builds buyer confidence by answering doubts before shoppers leave the page."
    },
    {
      title: "Top Complaint Share",
      metric: complaints.length ? `${complaints.length} signal${complaints.length === 1 ? "" : "s"}` : "0 signals",
      icon: "📉",
      tone: "from-rose-100 via-white to-orange-100",
      insight: complaints.length ? `Most visible complaint area: ${topComplaint}.` : "No strong repeated complaint cluster was detected in this sample.",
      action: complaints.length ? `Fix or clearly explain "${topComplaint}" first.` : "Keep collecting reviews and watch for repeated objections.",
      impact: "Prioritizes the issue most likely to affect ratings, returns, and conversion."
    },
    {
      title: "Repeat Praise Signal",
      metric: praise.length ? `${praise.length} proof point${praise.length === 1 ? "" : "s"}` : "Weak signal",
      icon: "⭐",
      tone: "from-yellow-100 via-white to-amber/20",
      insight: `Positive buyer language suggests highlighting: ${topPraise}.`,
      action: "Use this proof in the product title support text, image overlays, and short-form ads.",
      impact: "Converts review praise into marketing claims backed by customer language."
    },
    {
      title: "Support Risk",
      metric: support.length ? "Watch" : "Low",
      icon: "🎧",
      tone: "from-violet-100 via-white to-blue-100",
      insight: `Customer care signal: ${topSupport}.`,
      action: "Clarify shipping, returns, replacement, warranty, and contact expectations before checkout.",
      impact: "Protects trust after purchase and can reduce refunds, disputes, and negative reviews."
    },
    {
      title: "Listing Priority",
      metric: "Fix first",
      icon: "📝",
      tone: "from-cyan-100 via-white to-teal/20",
      insight: `The next listing improvement should focus on: ${topRequest}.`,
      action: `Add a clear section that answers "${topRequest}" using simple buyer language.`,
      impact: "Turns customer confusion into a conversion-focused listing improvement."
    }
  ];

  return (
    <section className="mt-8 rounded-[2rem] border border-line bg-white/80 p-5 shadow-soft backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean">Seller money intelligence</p>
          <h2 className="mt-3 text-3xl font-black break-words text-ink dark:text-white">
            What review patterns mean for sales
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {sampleWarning} This section translates review signals into buyer psychology, conversion risk, and revenue-focused actions.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-mist px-5 py-4 text-sm font-black break-words text-ink dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
          {plan?.includes("pro") ? "Seller Pro depth" : "Seller Premium snapshot"}
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <KpiCard key={card.title} {...card} />
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-xl font-black break-words text-ink dark:text-white">Money Opportunity</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
            <li><span className="font-black">What may be costing sales:</span> {topComplaint}</li>
            <li><span className="font-black">What to highlight more:</span> {topPraise}</li>
            <li><span className="font-black">What to fix first:</span> {topRequest}</li>
            <li><span className="font-black">What to answer before checkout:</span> durability, value, and support expectations.</li>
          </ul>
        </article>

        <article className="rounded-[1.75rem] border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-xl font-black break-words text-ink dark:text-white">Buyer Psychology</h3>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
            <p><span className="font-black">Can I trust this?</span> Show authentic review proof and balanced pros/cons.</p>
            <p><span className="font-black">Will it last?</span> Address reliability doubts and product limits.</p>
            <p><span className="font-black">Is it worth the price?</span> Connect price to quality, utility, and outcomes.</p>
            <p><span className="font-black">Will the seller help me?</span> Make support, returns, and replacements obvious.</p>
          </div>
        </article>
      </div>
    </section>
  );
}
