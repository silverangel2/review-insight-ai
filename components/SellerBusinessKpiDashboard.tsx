"use client";

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


type AnyRecord = Record<string, unknown>;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[.;\n]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function cleanScore(value: unknown, fallback = 72) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function displayPercent(value: unknown, fallback = 72) {
  return `${cleanScore(value, fallback)}%`;
}

function estimateShare(count: number, total: number) {
  if (!total || total < 5) return "Directional";
  return `About ${Math.round((count / total) * 100)}%`;
}

function peopleStyle(count: number, total: number) {
  if (!total || total < 5) return "Small sample";
  const outOfTen = Math.max(1, Math.min(10, Math.round((count / total) * 10)));
  return `${outOfTen}/10 buyers`;
}

function shortText(value: string, max = 88) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean;
}

function firstUseful(items: string[], fallback: string) {
  return items.find((item) => item && item.length > 2) ?? fallback;
}

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, 6);
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
      /complaint|risk|issue|problem|return|refund|shipping|packaging|durability|quality/i.test(item)
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
      /positive|praise|like|love|comfort|easy|value|quality|works|useful/i.test(item)
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

function MiniBars({ tone = "teal" }: { tone?: "teal" | "amber" | "blue" | "rose" | "violet" }) {
  const bg =
    tone === "amber"
      ? "bg-amber"
      : tone === "rose"
        ? "bg-coral"
        : tone === "violet"
          ? "bg-violet-500"
          : tone === "blue"
            ? "bg-blue-600"
            : "bg-teal";
  return (
    <div className="flex h-20 items-end gap-2">
      {[38, 52, 70, 88, 62].map((height, index) => (
        <span
          key={index}
          className={`w-4 rounded-full ${bg}`}
          style={{ height: `${height}%`, opacity: 0.35 + index * 0.12 }}
        />
      ))}
    </div>
  );
}

function MiniArc({ score, tone = "teal" }: { score: number; tone?: "teal" | "amber" | "blue" | "rose" | "violet" }) {
  const border =
    tone === "amber"
      ? "border-t-amber border-r-amber"
      : tone === "rose"
        ? "border-t-coral border-r-coral"
        : tone === "violet"
          ? "border-t-violet-500 border-r-violet-500"
          : tone === "blue"
            ? "border-t-blue-600 border-r-blue-600"
            : "border-t-teal border-r-teal";
  return (
    <div className="relative h-24 w-24 rounded-full border-[12px] border-slate-100">
      <div className={`absolute inset-[-12px] rounded-full border-[12px] border-transparent ${border}`} />
      <div className="absolute inset-0 grid place-items-center text-xl font-black text-ink">{formatResultPercent(score)}%</div>
    </div>
  );
}

function KpiCard({
  title,
  metric,
  icon,
  tone,
  visual,
  insight,
  action,
  impact
}: {
  title: string;
  metric: string;
  icon: string;
  tone: string;
  visual: "bars" | "arc" | "line";
  insight: string;
  action: string;
  impact: string;
}) {
  const numeric = Number(metric.replace(/[^0-9]/g, "")) || 72;

  return (
    <article className="group relative min-h-[400px] [perspective:1200px]">
      <div className="relative h-full min-h-[400px] rounded-[1.75rem] transition duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] overflow-y-auto">
        <div className={`absolute inset-0 overflow-hidden rounded-[1.75rem] border border-white/70 bg-gradient-to-br ${tone} p-5 shadow-soft [backface-visibility:hidden] dark:border-white/10`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{title}</p>
              <p className="mt-3 max-w-full break-words text-4xl font-black leading-none text-slate-950">{metric}</p>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/75 text-3xl shadow-inner">{icon}</div>
          </div>

          <div className="mt-5 flex h-28 items-center justify-center">
            {visual === "bars" ? <MiniBars /> : visual === "arc" ? <MiniArc score={Math.min(99, numeric)} /> : (
              <div className="w-full">
                <div className="h-3 rounded-full bg-white/70">
                  <div className="h-3 rounded-full bg-slate-950/80" style={{ width: `${Math.min(96, numeric)}%` }} />
                </div>
                <div className="mt-3 flex justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  <span>Weak</span><span>Watch</span><span>Strong</span>
                </div>
              </div>
            )}
          </div>

          <p className="mt-4 min-h-[54px] text-sm font-bold leading-6 text-slate-700">{shortText(insight, 120)}</p>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Tap / hover for seller action</p>
        </div>

        <div className="absolute inset-0 overflow-y-auto rounded-[1.75rem] border border-white/70 bg-white p-5 shadow-soft [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-y-auto dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-ocean">Seller action</p>
          <h3 className="mt-3 text-xl font-black text-ink dark:text-white">{title}</h3>
          <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <p><span className="font-black text-ink dark:text-white">Action: </span>{action}</p>
            <p><span className="font-black text-ink dark:text-white">Business impact: </span>{impact}</p>
          </div>
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
  const score = cleanScore(analysis.product_score ?? analysis.productScore ?? analysis.confidence_score, 74);

  const topComplaint = firstUseful(complaints, "unclear durability or expectation gap");
  const topPraise = firstUseful(praise, "the strongest positive proof point needs more review evidence");
  const topRequest = firstUseful(requests, "clarify the most important buyer expectation in the listing");
  const topSupport = firstUseful(support, "support, shipping, packaging, or return concerns need monitoring");

  const totalSignalBase = Math.max(reviewCount, complaints.length + praise.length + support.length + 4);
  const complaintShare = complaints.length ? estimateShare(Math.min(complaints.length, totalSignalBase), totalSignalBase) : "Low signal";
  const praisePeople = praise.length ? peopleStyle(Math.min(praise.length + 2, totalSignalBase), totalSignalBase) : "Directional";
  const sampleWarning = reviewCount && reviewCount < 15 ? "Small sample size — directional signal only." : "Based on the provided review sample.";

  const cards = [
    {
      title: "Conversion Blocker",
      metric: complaintShare,
      icon: "🚧",
      tone: "from-orange-100 via-white to-rose-100",
      visual: "line" as const,
      insight: `Buyers may hesitate because reviews point to ${topComplaint}.`,
      action: `Address "${topComplaint}" directly in the listing, FAQ, images, and expectation-setting copy.`,
      impact: "Reduces buyer hesitation before checkout and helps prevent surprise complaints after purchase."
    },
    {
      title: "Revenue Opportunity",
      metric: praisePeople,
      icon: "💰",
      tone: "from-emerald-100 via-white to-teal/20",
      visual: "bars" as const,
      insight: `Your strongest sales proof is ${topPraise}.`,
      action: `Turn "${topPraise}" into headline copy, image captions, comparison tables, and benefit bullets.`,
      impact: "Makes customer proof easier to notice, which can improve trust and conversion."
    },
    {
      title: "Buyer Trust Gap",
      metric: displayPercent(score),
      icon: "🛡️",
      tone: "from-sky-100 via-white to-blue-100",
      visual: "arc" as const,
      insight: "Customers are checking whether the product feels real, reliable, worth the price, and supported.",
      action: "Add real-use photos, honest drawbacks, warranty/support wording, and realistic performance limits.",
      impact: "Answers doubts before shoppers leave the page."
    },
    {
      title: "Top Complaint Share",
      metric: complaints.length ? `${complaints.length} signals` : "0 signals",
      icon: "📉",
      tone: "from-rose-100 via-white to-orange-100",
      visual: "bars" as const,
      insight: complaints.length ? `Most visible complaint area: ${topComplaint}.` : "No strong repeated complaint cluster was detected.",
      action: complaints.length ? `Fix or clearly explain "${topComplaint}" first.` : "Keep collecting reviews and watch for repeated objections.",
      impact: "Prioritizes the issue most likely to affect ratings, returns, and conversion."
    },
    {
      title: "Repeat Praise Signal",
      metric: praise.length ? `${praise.length} proofs` : "Weak signal",
      icon: "⭐",
      tone: "from-yellow-100 via-white to-amber/20",
      visual: "line" as const,
      insight: `Positive buyer language suggests highlighting ${topPraise}.`,
      action: "Use this proof in product copy, image overlays, and ads.",
      impact: "Converts review praise into marketing claims backed by customer language."
    },
    {
      title: "Support Risk",
      metric: support.length ? "Watch" : "Low",
      icon: "🎧",
      tone: "from-violet-100 via-white to-blue-100",
      visual: "bars" as const,
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
            {sampleWarning} This section translates review signals into buyer psychology, conversion risk, and revenue-focused actions.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-mist px-5 py-4 text-sm font-black text-ink dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
          {plan?.includes("pro") ? "Seller Pro depth" : "Seller snapshot"}
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => <KpiCard key={card.title} {...card} />)}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-xl font-black text-ink dark:text-white">Money Opportunity</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
            <li><span className="font-black">What may be costing sales:</span> {topComplaint}</li>
            <li><span className="font-black">What to highlight more:</span> {topPraise}</li>
            <li><span className="font-black">What to fix first:</span> {topRequest}</li>
            <li><span className="font-black">What to answer before checkout:</span> durability, value, and support expectations.</li>
          </ul>
        </article>

        <article className="rounded-[1.75rem] border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-xl font-black text-ink dark:text-white">Buyer Psychology</h3>
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
