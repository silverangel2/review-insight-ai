"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { InsightList } from "@/components/InsightList";
import { ScoreCard } from "@/components/ScoreCard";
import { formatPercent, sentimentToPercent } from "@/lib/analysisScoring";
import { canAccessSellerAnalytics, hasUnlimitedUsage, planLabel, type ClientAccount } from "@/lib/account";
import { accountHeaders, getClientAccount, getStoredQuota, quotaText, saveActiveMode, saveQuota } from "@/lib/clientAccount";
import type { AnalyzeResponse, ComparisonMode, ComparisonPriority, ProductComparisonInput, QuotaInfo } from "@/lib/types";

const SAMPLE_A = "";

const SAMPLE_B = "";

const INITIAL_QUOTA: QuotaInfo = {
  plan: "free_buyer",
  limit: 3,
  used: 0,
  remaining: 3,
  resets_at: ""
};

const priorityOptions: Array<{ value: ComparisonPriority; label: string }> = [
  { value: "lowest_price", label: "Lowest price" },
  { value: "best_quality", label: "Best quality" },
  { value: "durability", label: "Durability" },
  { value: "fast_shipping", label: "Fast shipping" },
  { value: "fewest_complaints", label: "Fewest complaints" },
  { value: "best_reviews", label: "Best reviews" },
  { value: "daily_use", label: "Daily use" },
  { value: "gift_purchase", label: "Gift purchase" },
  { value: "business_use", label: "Business use" },
  { value: "custom", label: "Custom needs" }
];

type ProductDraft = ProductComparisonInput & {
  result?: AnalyzeResponse;
};

function newProduct(index: number, reviews = ""): ProductDraft {
  return {
    id: `${Date.now()}-${index}`,
    name: `Product ${String.fromCharCode(65 + index)}`,
    price: "",
    category: "",
    url: "",
    reviews
  };
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function priceNumber(value?: string) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function recommendationPoints(verdict: string) {
  if (verdict === "Buy") return 26;
  if (verdict === "Maybe") return 13;
  return 0;
}

function productScore(product: ProductDraft, mode: ComparisonMode, priorities: ComparisonPriority[]) {
  const analysis = product.result?.analysis;
  if (!analysis) return 0;

  let score = analysis.product_score * 0.45 + ((analysis.sentiment_score + 1) * 50) * 0.25 + analysis.confidence_score * 100 * 0.15;
  score += recommendationPoints(analysis.buyer_recommendation.verdict);

  const complaintPenalty = analysis.common_complaints.length * 2 + analysis.durability_issues.length * 4 + analysis.seller_insights.refund_risk_issues.length * 3;
  score -= complaintPenalty;

  if (priorities.includes("durability")) score -= analysis.durability_issues.length * 5;
  if (priorities.includes("fewest_complaints")) score -= analysis.common_complaints.length * 4;
  if (priorities.includes("best_quality")) score -= analysis.quality_concerns.length * 4;
  if (priorities.includes("fast_shipping")) score -= analysis.packaging_issues.length * 2 + analysis.seller_insights.shipping_complaint_detection.length * 2;
  if (mode === "seller") score += analysis.seller_insights.competitor_opportunity_insights.length * 2;

  return Math.max(0, Math.min(100, score));
}

function pickWinner(products: ProductDraft[], mode: ComparisonMode, priorities: ComparisonPriority[]) {
  const scored = products
    .filter((product) => product.result)
    .map((product) => ({ product, score: productScore(product, mode, priorities) }))
    .sort((left, right) => right.score - left.score);

  return scored[0] ?? null;
}

function bestBudget(products: ProductDraft[]) {
  return products
    .filter((product) => product.result && priceNumber(product.price) !== null)
    .sort((left, right) => priceNumber(left.price)! - priceNumber(right.price)!)[0];
}

function strongestBy(products: ProductDraft[], value: (product: ProductDraft) => number) {
  return products.filter((product) => product.result).sort((left, right) => value(right) - value(left))[0];
}

function weakest(products: ProductDraft[]) {
  return products.filter((product) => product.result).sort((left, right) => productScore(left, "buyer", []) - productScore(right, "buyer", []))[0];
}

function updateProduct(products: ProductDraft[], id: string, patch: Partial<ProductDraft>) {
  return products.map((product) => (product.id === id ? { ...product, ...patch } : product));
}

async function analyzeProduct(product: ProductDraft, mode: ComparisonMode) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...accountHeaders() },
    body: JSON.stringify({
      productName: product.name,
      productUrl: product.url,
      platform: "other",
      audience: mode,
      ingestionMode: "deep_paste",
      reviewSections: [
        {
          id: product.id,
          title: `${product.name} pasted reviews`,
          text: product.reviews,
          source: "paste"
        }
      ]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const failure = new Error(data.error || `${product.name} analysis failed.`) as Error & { quota?: QuotaInfo };
    failure.quota = data.quota;
    throw failure;
  }
  return data as AnalyzeResponse;
}

export function CompareForm() {
  const [mode, setMode] = useState<ComparisonMode>("buyer");
  const [priorities, setPriorities] = useState<ComparisonPriority[]>(["best_quality", "fewest_complaints"]);
  const [products, setProducts] = useState<ProductDraft[]>([newProduct(0, SAMPLE_A), newProduct(1, SAMPLE_B)]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [quota, setQuota] = useState<QuotaInfo>(INITIAL_QUOTA);
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedAccount = getClientAccount();
    setQuota(getStoredQuota());
    setAccount(storedAccount);
    setMode((currentMode) => {
      if (storedAccount?.role === "admin") return currentMode;
      if (storedAccount?.role === "seller") return "seller";
      return "buyer";
    });
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    saveActiveMode(mode);
  }, [mode]);

  const sellerModeAllowed = account ? canAccessSellerAnalytics(account.role, account.plan) : false;
  const developerMode = account?.role === "admin";
  const unlimited = account ? hasUnlimitedUsage(account.role, account.plan) : quota.limit === null;
  const visibleModes: ComparisonMode[] = developerMode ? ["buyer", "seller"] : sellerModeAllowed ? ["seller"] : ["buyer"];
  const quotaSummary = isHydrated ? quotaText(quota) : "3 of 3 free guest analyses left";
  const analyzedProducts = products.filter((product) => product.result);
  const canCompare = products.length >= 2 && products.every((product) => product.name.trim() && product.reviews.trim().length >= 80);
  const winner = useMemo(() => pickWinner(products, mode, priorities), [mode, priorities, products]);
  const modeTitle = mode === "buyer" ? "Shopper mode: which product should I buy?" : "Seller mode: competitor/product intelligence";
  const modeDetail =
    mode === "buyer"
      ? "Built for shoppers. It weighs review quality, complaints, value, durability, shipping, and your buying priorities."
      : "Built for sellers. It turns reviews into competitor advantages, weakness detection, product fixes, listing improvements, and market gaps.";

  function togglePriority(value: ComparisonPriority) {
    setPriorities((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function addProduct() {
    if (products.length >= 5) return;
    setProducts((current) => [...current, newProduct(current.length)]);
  }

  function removeProduct(id: string) {
    if (products.length <= 2) return;
    setProducts((current) => current.filter((product) => product.id !== id));
  }

  async function compare() {
    setError("");
    setIsLoading(true);
    setProducts((current) => current.map((product) => ({ ...product, result: undefined })));

    try {
      if (mode === "seller" && !sellerModeAllowed) {
        throw new Error("Seller comparison is available for Seller plans.");
      }

      const latestQuota = getStoredQuota();
      if (!unlimited && latestQuota.limit !== null && (latestQuota.remaining ?? 0) < products.length) {
        throw new Error(`Comparison needs ${products.length} remaining product analyses. Upgrade or wait for the daily reset.`);
      }

      const nextProducts: ProductDraft[] = [];
      for (const product of products) {
        const result = await analyzeProduct(product, mode);
        saveQuota(result.meta.quota);
        setQuota(result.meta.quota);
        nextProducts.push({ ...product, result });
      }

      setProducts(nextProducts);
    } catch (caught) {
      if (caught instanceof Error && "quota" in caught && caught.quota) {
        saveQuota(caught.quota as QuotaInfo);
        setQuota(caught.quota as QuotaInfo);
      }
      setError(caught instanceof Error ? caught.message : "Comparison failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function exportReport() {
    const report = {
      mode,
      priorities,
      winner: winner?.product.name ?? null,
      products: products.map((product) => ({
        name: product.name,
        price: product.price,
        category: product.category,
        url: product.url,
        confidence: product.result?.meta.confidence_label ?? null,
        analysis: product.result?.analysis ?? null
      }))
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "reviewintel-comparison-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const budget = bestBudget(products);
  const quality = strongestBy(products, (product) => product.result?.analysis.product_score ?? 0);
  const durability = strongestBy(products, (product) => -(product.result?.analysis.durability_issues.length ?? 0));
  const avoid = weakest(products);

  return (
    <section className="space-y-8">
      <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge tone={developerMode ? "good" : "info"}>{developerMode ? "Seller Pro" : planLabel(account?.plan ?? "free_buyer")}</Badge>
            <h1 className="mt-4 text-3xl font-black text-ink dark:text-white">{modeTitle}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {modeDetail}
            </p>
          </div>
          <div className="flex rounded-xl border border-line bg-mist p-1 dark:border-white/10 dark:bg-white/5">
            {visibleModes.map((nextMode) => (
              <button
                key={nextMode}
                onClick={() => setMode(nextMode)}
                disabled={nextMode === "seller" && !sellerModeAllowed}
                className={`rounded-lg px-4 py-2 text-sm font-black transition ${
                  mode === nextMode ? "bg-ink text-white dark:bg-white dark:text-ink" : "text-slate-600 hover:text-ink dark:text-slate-300 dark:hover:text-white"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {nextMode === "buyer" ? "Shopper mode" : "Seller mode"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-ink dark:text-white">{mode === "buyer" ? "What matters most to you?" : "What business signal matters most?"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {mode === "buyer"
                ? "ReviewIntel weights the recommendation toward the product you should buy."
                : "ReviewIntel weights the comparison toward competitor intelligence and product improvement opportunities."}
            </p>
          </div>
          <Badge tone={unlimited ? "good" : "warn"}>{unlimited ? "Unlimited testing" : quotaSummary}</Badge>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {priorityOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => togglePriority(option.value)}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                priorities.includes(option.value)
                  ? "border-ocean bg-ocean/10 text-ocean dark:border-cyan-300 dark:text-cyan-300"
                  : "border-line bg-white text-slate-600 hover:border-ocean hover:text-ink dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {products.map((product, index) => (
          <ProductInput
            key={product.id}
            product={product}
            label={`Product ${index + 1}`}
            canRemove={products.length > 2}
            onRemove={() => removeProduct(product.id)}
            onChange={(patch) => setProducts((current) => updateProduct(current, product.id, patch))}
          />
        ))}
      </div>

      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          onClick={addProduct}
          disabled={products.length >= 5}
          className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-black text-slate-600 transition hover:border-ocean hover:text-ocean disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
        >
          Add Product
        </button>
        <button
          onClick={compare}
          disabled={!canCompare || isLoading}
          className="min-h-16 rounded-2xl bg-[linear-gradient(135deg,#2356a3,#08b7a8_48%,#ffb238)] px-10 py-4 text-base font-black text-white shadow-[0_18px_60px_rgba(8,183,168,0.28)] transition hover:-translate-y-0.5 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Comparing..." : "Run AI Comparison"}
        </button>
      </div>

      {error ? <p className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}
      {mode === "seller" && !sellerModeAllowed ? (
        <p className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm font-bold text-amber">
          Seller comparison is locked for Shopper accounts. Use a Seller plan to unlock business comparison.
        </p>
      ) : null}

      {winner && analyzedProducts.length >= 2 ? (
        <section className="space-y-6">
          <article className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <Badge tone="good">Winner: {winner.product.name}</Badge>
                <h2 className="mt-4 text-3xl font-black text-ink dark:text-white">
                  {mode === "buyer" ? "Which product should I buy?" : "Competitor/product intelligence"}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {mode === "buyer"
                    ? `${winner.product.name} has the strongest review profile for your priorities, with ${percent(winner.product.result!.analysis.confidence_score)} confidence and a ${winner.product.result!.analysis.buyer_recommendation.verdict} recommendation.`
                    : `${winner.product.name} has the strongest review evidence in this set. Use competitor strengths and weaker-product complaints to guide product, listing, packaging, and support improvements.`}
                </p>
              </div>
              <button onClick={exportReport} className="rounded-xl border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white">
                Export comparison report
              </button>
            </div>
          </article>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ScoreCard label="Best overall" value={winner.product.name} detail={`Weighted score ${formatPercent(winner.score)}.`} tone="good" />
            <ScoreCard label="Best budget" value={budget?.name ?? "Need prices"} detail={budget?.price || "Add prices to compare budget value."} tone="info" />
            <ScoreCard label="Best quality" value={quality?.name ?? "Need analysis"} detail={`${formatPercent(quality?.result?.analysis.product_score ?? 0)} product score.`} tone="info" />
            <ScoreCard label="Best to avoid" value={avoid?.name ?? "None"} detail={avoid ? "Lowest review evidence score in this comparison." : "No weak product detected yet."} tone={avoid ? "bad" : "good"} />
          </section>

          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft dark:border-white/10 dark:bg-slate-950">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line text-left text-sm dark:divide-white/10">
                <thead className="bg-mist text-xs font-black uppercase text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-4">Product</th>
                    <th className="px-4 py-4">Recommendation</th>
                    <th className="px-4 py-4">Score</th>
                    <th className="px-4 py-4">Confidence</th>
                    <th className="px-4 py-4">Sentiment</th>
                    <th className="px-4 py-4">Complaints</th>
                    <th className="px-4 py-4">Durability</th>
                    <th className="px-4 py-4">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line dark:divide-white/10">
                  {analyzedProducts.map((product) => {
                    const analysis = product.result!.analysis;
                    return (
                      <tr key={product.id} className={winner.product.id === product.id ? "bg-teal/5" : ""}>
                        <td className="px-4 py-4 font-black text-ink dark:text-white">{product.name}</td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{analysis.buyer_recommendation.verdict}</td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{formatPercent(productScore(product, mode, priorities))}</td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{product.result!.meta.confidence_label ?? "Low"}</td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{formatPercent(analysis.sentiment_percentage ?? sentimentToPercent(analysis.sentiment_score))}</td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{analysis.common_complaints.length}</td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{durability?.id === product.id ? "Strongest" : `${analysis.durability_issues.length} issues`}</td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{analysis.value_for_money_opinion}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            {analyzedProducts.map((product) => (
              <ProductColumn key={product.id} product={product} mode={mode} />
            ))}
          </section>
        </section>
      ) : null}
    </section>
  );
}

function ProductInput({
  product,
  label,
  canRemove,
  onRemove,
  onChange
}: {
  product: ProductDraft;
  label: string;
  canRemove: boolean;
  onRemove: () => void;
  onChange: (patch: Partial<ProductDraft>) => void;
}) {
  return (
    <article className="rounded-2xl border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black uppercase text-ocean dark:text-cyan-300">{label}</p>
        {canRemove ? (
          <button onClick={onRemove} className="rounded-lg border border-line px-3 py-1 text-xs font-black text-slate-600 transition hover:border-coral hover:text-coral dark:border-white/10 dark:text-slate-300">
            Remove
          </button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Product name" value={product.name} onChange={(value) => onChange({ name: value })} />
        <Field label="Price" value={product.price ?? ""} onChange={(value) => onChange({ price: value })} placeholder="$49.99" />
        <Field label="Category" value={product.category ?? ""} onChange={(value) => onChange({ category: value })} placeholder="Portable blender" />
        <Field label="Product URL" value={product.url ?? ""} onChange={(value) => onChange({ url: value })} placeholder="Optional" />
      </div>
      <label className="mt-4 block">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Reviews</span>
        <textarea
          value={product.reviews}
          placeholder="Paste reviews here"
          onChange={(event) => onChange({ reviews: event.target.value })}
          className="mt-2 min-h-[150px] w-full resize-y rounded-xl border border-line bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
        />
      </label>
    </article>
  );
}

function Field({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-ink dark:text-white">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
      />
    </label>
  );
}

function ProductColumn({ product, mode }: { product: ProductDraft; mode: ComparisonMode }) {
  const analysis = product.result!.analysis;
  const confidence = product.result!.meta.confidence_label ?? "Low";

  return (
    <div className="space-y-5 rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{product.name}</Badge>
          <Badge tone={confidence === "High" ? "good" : confidence === "Medium" ? "warn" : "bad"}>{confidence} confidence</Badge>
        </div>
        <h3 className="mt-3 text-2xl font-black text-ink dark:text-white">{analysis.overall_summary}</h3>
      </div>
      {mode === "buyer" ? (
        <>
          <InsightList title="Pros" items={analysis.positive_points} tone="good" />
          <InsightList title="Cons" items={analysis.negative_points} tone="bad" />
          <InsightList title="Common complaints" items={analysis.common_complaints} tone="warn" />
          <InsightList title="Fake-review warnings" items={analysis.fake_review_indicators} tone="info" />
        </>
      ) : (
        <>
          <InsightList title="Customer pain points" items={analysis.seller_insights.main_customer_pain_points} tone="bad" />
          <InsightList title="Product improvements" items={analysis.seller_insights.product_improvement_recommendations} tone="good" />
          <InsightList title="Listing improvements" items={analysis.seller_insights.listing_improvement_suggestions} tone="info" />
          <InsightList title="Market gaps" items={analysis.seller_insights.competitor_opportunity_insights} tone="warn" />
        </>
      )}
    </div>
  );
}
