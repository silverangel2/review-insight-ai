"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { InsightList } from "@/components/InsightList";
import { ScoreCard } from "@/components/ScoreCard";
import { formatPercent, sentimentToPercent } from "@/lib/analysisScoring";
import type { ClientAccount } from "@/lib/account";
import {
  accountHeaders,
  getClientAccount,
  getStoredQuota,
  quotaText,
  saveActiveMode,
  saveQuota,
  incrementStoredScanTally
} from "@/lib/clientAccount";
import { cleanReviewInsightText, sanitizeSellerInsightList } from "@/lib/insightSanitizer";


import type { AnalyzeResponse, ComparisonMode, ComparisonPriority, ProductComparisonInput, QuotaInfo } from "@/lib/types";
import { ReviewIntelScanOverlay } from "@/components/ReviewIntelScanOverlay";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}



function planLabel(plan?: string) {
  if (plan === "seller_pro") return "Seller Pro";
  if (plan === "seller_starter") return "Seller Starter";
    if (plan === "buyer_pro") return "Shopper Premium";
  if (plan === "free_buyer") return "Shopper Free";
  return "Shopper Free";
}

function canAccessSellerComparison(role?: string, plan?: string) {
  return role === "admin" || plan === "seller_pro";
}

function hasUnlimitedUsage(role?: string, plan?: string) {
  return role === "admin" || plan === "seller_pro" || plan === "buyer_pro";
}






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
  const [products, setProducts] = useState<ProductDraft[]>([newProduct(0), newProduct(1)]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingStep((current) => Math.min(4, current + 1));
    }, 16250);

    return () => window.clearInterval(timer);
  }, [isLoading]);

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

  const requiresLogin = !account;
  const sellerModeAllowed = account ? canAccessSellerComparison(account.role, account.plan) : false;
  const developerMode = account?.role === "admin";
  const unlimited = account ? hasUnlimitedUsage(account.role, account.plan) : false;
  const visibleModes: ComparisonMode[] = developerMode ? ["buyer", "seller"] : sellerModeAllowed ? ["seller"] : ["buyer"];
  const quotaSummary = requiresLogin ? "Create a free account to use your 3 total free AI actions." : isHydrated ? quotaText(quota) : "";
  const analyzedProducts = products.filter((product) => product.result);
  const canCompare = products.length >= 2 && products.every((product) => product.name.trim() && product.reviews.trim().length >= 80);
  const quotaLocked = !unlimited && !requiresLogin && quota.limit !== null && (quota.remaining ?? 0) <= 0;
  const winner = useMemo(() => pickWinner(products, mode, priorities), [mode, priorities, products]);
  const comparisonFit = useMemo(() => productComparisonFit(products), [products]);
  const modeTitle = mode === "buyer" ? "Shopper mode: which product should I buy?" : "Seller mode: other product/product intelligence";
  const modeDetail =
    mode === "buyer"
      ? "Built for shoppers. It weighs review quality, complaints, value, durability, shipping, and your buying priorities."
      : "Built for sellers. It turns reviews into comparison advantages, weakness detection, product fixes, listing improvements, and market gaps.";

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

    if (!getClientAccount()) {
      setError("Please sign up or log in to use Compare.");
      return;
    }

    setIsLoading(true);
    setProducts((current) => current.map((product) => ({ ...product, result: undefined })));

    try {
      if (mode === "seller" && !sellerModeAllowed) {
        throw new Error("Seller other product comparison is available for Seller Pro only.");
      }

      const latestQuota = getStoredQuota();
      if (!unlimited && latestQuota.limit !== null && (latestQuota.remaining ?? 0) < 1) {
        throw new Error("Comparison needs 1 remaining AI action. Upgrade or wait for the daily reset.");
      }

      const startingQuota = getStoredQuota();
      const nextProducts: ProductDraft[] = [];
      for (const product of products) {
        const result = await analyzeProduct(product, mode);
        nextProducts.push({ ...product, result });
      }

      if (!unlimited && startingQuota.limit !== null) {
        const adjustedQuota = {
          ...startingQuota,
          used: Math.min(startingQuota.limit, startingQuota.used + 1),
          remaining: Math.max(0, (startingQuota.remaining ?? startingQuota.limit) - 1)
        };
        saveQuota(adjustedQuota);
        setQuota(adjustedQuota);
      }

      incrementStoredScanTally();
      setProducts(nextProducts);
    } catch (caught) {
      if (caught instanceof Error && "quota" in caught && caught.quota) {
        saveQuota(caught.quota as QuotaInfo);
        setQuota(caught.quota as QuotaInfo);
      }
      setError(caught instanceof Error ? caught.message : "Comparison failed.");
    } finally {
      await wait(1800);
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

  if (requiresLogin) {
    return (

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,#050816_0%,#2356a3_38%,#08b7a8_74%,#ffb238_100%)] p-8 text-white shadow-[0_34px_120px_rgba(35,86,163,0.30)]">
        <div className="ri-scan-grid absolute inset-0 opacity-25" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <Badge tone="good">Free account required</Badge>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">Create a free account before comparing products.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-100">
              Free users get 3 total AI actions across Analyze and Compare combined. Sign up first so your usage and results stay attached to your account.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="rounded-2xl bg-white px-7 py-4 text-center text-sm font-black text-ink shadow-glow transition hover:-translate-y-0.5 hover:bg-cyan-100">
                Create free account
              </Link>
              <Link href="/login" className="rounded-2xl border border-white/20 bg-white/10 px-7 py-4 text-center text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15">
                Log in
              </Link>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Shared free limit</p>
            <div className="mt-5 grid gap-3">
              {["Analyze one product = 1 AI action", "Compare products = 1 AI action", "Free account total = 3 AI actions", "Premium plans unlock more usage"].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm font-black">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      {isLoading ? <ReviewIntelScanOverlay activeStep={loadingStep} /> : null}
      <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge tone={developerMode ? "good" : "info"}>{developerMode ? "Seller Pro" : planLabel(account?.plan ?? "free_buyer")}</Badge>
            <h1 className="mt-4 text-3xl font-black text-ink dark:text-white">{modeTitle}</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
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

      {!winner ? (
        <>
      <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-ink dark:text-white">{mode === "buyer" ? "What matters most to you?" : "What business signal matters most?"}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
              {mode === "buyer"
                ? "ReviewIntel weights the recommendation toward the product you should buy."
                : "ReviewIntel weights the comparison toward other product intelligence and product improvement opportunities."}
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
            mode={mode}
product={product}
            label={`Product ${index + 1}`}
            canRemove={products.length > 2}
            onRemove={() => removeProduct(product.id)}
            onChange={(patch) => setProducts((current) => updateProduct(current, product.id, patch))}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={addProduct}
          disabled={products.length >= 5}
          className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-ocean disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          Add Product
        </button>
        <button
          onClick={compare}
          disabled={!canCompare || isLoading || quotaLocked}
          className="rounded-xl bg-ink px-6 py-3 text-sm font-black text-white shadow-soft transition hover:bg-ocean disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-ink"
        >
          {isLoading ? "Comparing..." : "Run AI Comparison"}
        </button>
      </div>

      {error ? <p className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}
      {mode === "seller" && !sellerModeAllowed ? (
        <p className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm font-bold text-amber">
          Seller other product comparison is a Seller Pro feature. Seller Premium can analyze its own product reviews, but other product intelligence requires Seller Pro. Shopper Premium can use shopper product comparison.
        </p>
      ) : null}

        </>
      ) : null}

      {winner && analyzedProducts.length >= 2 ? (
        <section className="space-y-6">
          <article className="overflow-hidden rounded-[2.5rem] bg-[radial-gradient(circle_at_18%_20%,rgba(8,183,168,0.26),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(117,83,178,0.24),transparent_36%),linear-gradient(135deg,#142433_0%,#203756_48%,#151827_100%)] p-7 text-white shadow-soft">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="flex justify-center">
                <div className="relative grid h-72 w-72 place-items-center rounded-full border border-white/15 bg-white/10 shadow-[0_35px_120px_rgba(8,183,168,0.22)] backdrop-blur-2xl">
                  <div className="absolute inset-5 rounded-full border border-teal/25" />
                  <div className="absolute inset-10 rounded-full bg-[radial-gradient(circle_at_32%_24%,rgba(255,255,255,0.95),rgba(8,183,168,0.20)_34%,rgba(35,86,163,0.22)_100%)]" />
                  <div className="relative px-7 text-center">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-teal">
                      {mode === "buyer" ? "Market signal" : "Sales gap"}
                    </p>
                    <h2 className="mt-3 text-4xl font-black leading-none tracking-[-0.06em]">
                      {mode === "buyer" ? comparisonFit.isDirectComparison ? winner.product.name : "No winner" : "Market Pull"}
                    </h2>
                    <p className="mt-4 text-sm font-bold text-white/70">
                      {mode === "buyer" ? comparisonFit.isDirectComparison ? "Strong review profile" : "Analyze separately" : `${winner.product.id === analyzedProducts[0]?.id ? "Your Product" : "Competitor Product"} shows stronger signal`}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Badge tone="good">
                  {mode === "buyer" ? `Market signal: ${winner.product.name}` : "Competitive intelligence"}
                </Badge>
                <h1 className="mt-4 text-5xl font-black leading-none tracking-[-0.07em] sm:text-6xl">
                  {mode === "buyer" ? comparisonFit.isDirectComparison ? `Buy ${winner.product.name}` : "Not directly comparable" : "Competitive intelligence report"}
                </h1>
                <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/75">
                  {mode === "buyer"
                    ? `${winner.product.name} is the clearer choice from this comparison. It has the stronger review profile for your priorities, with ${percent(winner.product.result!.analysis.confidence_score)} confidence and a ${shopperCompareVerdict(winner.product.id, winner.product.id, avoid?.id)} comparison signal.`
                    : `This report compares market pull, buyer trust, complaint patterns, and sales opportunity. ${winner.product.id === analyzedProducts[0]?.id ? "Your Product" : "Competitor Product"} currently shows stronger market signals, but the purpose is to learn why, identify gaps, and improve your product strategy.`}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-white/50">
                      Weighted score
                    </p>
                    <p className="mt-2 text-2xl font-black text-teal">
                      {formatPercent(winner.score)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-white/50">
                      Decision
                    </p>
                    <p className="mt-2 text-2xl font-black">
                      {mode === "buyer" ? "Buy" : "Analyze"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-white/50">
                      Next step
                    </p>
                    <p className="mt-2 text-2xl font-black">
                      {mode === "buyer" ? "Check price" : "Improve"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="rounded-full bg-teal px-6 py-3 text-sm font-black text-ink transition hover:-translate-y-0.5"
                  >
                    Compare another product
                  </button>
                  <button
                    onClick={exportReport}
                    className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15"
                  >
                    Export comparison report
                  </button>
                </div>
              </div>
            </div>
          </article>

          {mode === "buyer" ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ScoreCard label={mode === "buyer" && !comparisonFit.isDirectComparison ? "Comparison fit" : "Best overall"} value={mode === "buyer" && !comparisonFit.isDirectComparison ? "Not directly comparable" : mode === "buyer" ? winner.product.name : winner.product.id === analyzedProducts[0]?.id ? "Your Product" : "Competitor Product"} detail={mode === "buyer" && !comparisonFit.isDirectComparison ? comparisonFit.reason : `Weighted score ${formatPercent(winner.score)}.`} tone={mode === "buyer" && !comparisonFit.isDirectComparison ? "warn" : "good"} />
              <ScoreCard label="Best budget" value={budget?.id === analyzedProducts[0]?.id ? "Your Product" : budget?.id ? "Competitor Product" : "Add prices"} detail={budget?.price || "Add prices to see which product gives better value for your money."} tone="info" />
              <ScoreCard label="Best quality" value={quality?.name ?? "Need analysis"} detail={`${formatPercent(quality?.result?.analysis.product_score ?? 0)} product score.`} tone="info" />
              <ScoreCard label="Best to avoid" value={avoid?.name ?? "None"} detail={avoid ? "This product has more warning signs in the reviews." : "No weak product detected yet."} tone={avoid ? "bad" : "good"} />
            </section>
          ) : (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ...(analyzedProducts[1]?.result?.analysis.seller_insights.seller_action_cards ?? []),
                ...(analyzedProducts[0]?.result?.analysis.seller_insights.seller_action_cards ?? []),
              ]
                .filter((card, index, cards) => cards.findIndex((item) => item.card_type === card.card_type) === index)
                .slice(0, 6)
                .map((card) => (
                  <SellerGaugeCard
                    key={card.card_type}
                    icon={sellerCardIcon(card.card_type)}
                    label={sellerCardLabel(card.card_type)}
                    value={cleanSellerCardText(card.title, sellerCardLabel(card.card_type))}
                    score={card.confidence}
                    detail={cleanSellerCardText(card.finding)}
                    reason={[
                      `Review evidence: ${cleanSellerCardText(card.review_evidence_theme)}`,
                      `Seller meaning: ${cleanSellerCardText(card.seller_meaning)}`,
                      `Recommended action: ${cleanSellerCardText(card.recommended_action)}`,
                    ].join("\n\n")}
                  />
                ))}

              {![
                ...(analyzedProducts[1]?.result?.analysis.seller_insights.seller_action_cards ?? []),
                ...(analyzedProducts[0]?.result?.analysis.seller_insights.seller_action_cards ?? []),
              ].length ? (
                <div className="rounded-[1.75rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950 md:col-span-2 xl:col-span-3">
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-ocean dark:text-cyan-300">
                    Seller intelligence pending
                  </p>
                  <h3 className="mt-3 text-2xl font-black text-ink dark:text-white">
                    Run a fresh seller comparison
                  </h3>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                    These cards now come from actual review evidence. Old cached results may not include the new seller intelligence fields.
                  </p>
                </div>
              ) : null}
            </section>
          )}

          {mode === "buyer" ? (
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
                          <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{mode === "buyer" ? comparisonFit.isDirectComparison ? shopperCompareVerdict(product.id, winner.product.id, avoid?.id) : "Analyze separately" : analysis.buyer_recommendation.verdict}</td>
                          <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{formatPercent(productScore(product, mode, priorities))}</td>
                          <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{product.result!.meta.confidence_label ?? "Low"}</td>
                          <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{formatPercent(analysis.sentiment_percentage ?? sentimentToPercent(analysis.sentiment_score))}</td>
                          <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{analysis.common_complaints.length}</td>
                          <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{durability?.id === product.id ? "Strongest" : `${analysis.durability_issues.length} issues`}</td>
                          <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                            {cleanReviewInsightText(analysis.value_for_money_opinion, "Value signal needs more clean review evidence.")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {mode !== "buyer" ? (
            <section className="overflow-hidden rounded-[2.25rem] bg-[linear-gradient(135deg,#0f172a_0%,#12335c_48%,#0f172a_100%)] p-7 text-white shadow-soft">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-teal">
                    Review-based seller intelligence
                  </p>
                  <h2 className="mt-3 text-4xl font-black tracking-[-0.06em]">
                    What the reviews say you should do next
                  </h2>
                  <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/70">
                    These actions are generated from the pasted review evidence. If the reviews are weak, noisy, or incomplete,
                    ReviewIntel will say there is not enough clean evidence instead of inventing advice.
                  </p>
                </div>
              </div>

              <div className="mt-7 grid gap-4 lg:grid-cols-3">
                {[
                  ...(analyzedProducts[1]?.result?.analysis.seller_insights.seller_action_cards ?? []),
                  ...(analyzedProducts[0]?.result?.analysis.seller_insights.seller_action_cards ?? []),
                ]
                  .filter((card, index, cards) => cards.findIndex((item) => item.card_type === card.card_type) === index)
                  .slice(0, 6)
                  .map((card) => (
                    <details key={`board-${card.card_type}`} className="group rounded-[1.75rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-center gap-3">
                          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal text-xl text-ink">
                            {sellerCardIcon(card.card_type)}
                          </span>
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                              {sellerCardLabel(card.card_type)}
                            </p>
                            <h3 className="text-xl font-black">
                              {cleanSellerCardText(card.title, sellerCardLabel(card.card_type))}
                            </h3>
                          </div>
                        </div>
                        <p className="mt-4 text-sm font-semibold leading-6 text-white/70">
                          {cleanSellerCardText(card.finding)}
                        </p>
                        <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-teal">
                          Open review-based reason +
                        </p>
                      </summary>

                      <div className="mt-5 space-y-3 rounded-2xl bg-white/10 p-4 text-sm font-semibold leading-6 text-white/75">
                        <p><span className="text-teal">Evidence:</span> {cleanSellerCardText(card.review_evidence_theme)}</p>
                        <p><span className="text-teal">Seller meaning:</span> {cleanSellerCardText(card.seller_meaning)}</p>
                        <p><span className="text-teal">Action:</span> {cleanSellerCardText(card.recommended_action)}</p>
                      </div>
                    </details>
                  ))}

                {![
                  ...(analyzedProducts[1]?.result?.analysis.seller_insights.seller_action_cards ?? []),
                  ...(analyzedProducts[0]?.result?.analysis.seller_insights.seller_action_cards ?? []),
                ].length ? (
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5 text-sm font-semibold leading-6 text-white/75 lg:col-span-3">
                    Run a fresh seller comparison to generate review-based seller intelligence cards.
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {mode === "buyer" ? (
            <section className="grid gap-5 lg:grid-cols-2">
              {analyzedProducts.map((product) => (
                <ProductColumn key={product.id} product={product} mode={mode} />
              ))}
            </section>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}


function sellerCardIcon(cardType: string) {
  switch (cardType) {
    case "other product_edge":
      return "🧠";
    case "your_product_risk":
      return "⚠️";
    case "attack_opportunity":
      return "⚔️";
    case "fix_first":
      return "🔧";
    case "advertise_this":
      return "📣";
    case "next_seller_move":
      return "🎯";
    default:
      return "💡";
  }
}

function sellerCardLabel(cardType: string) {
  switch (cardType) {
    case "other product_edge":
      return "Competitor edge";
    case "your_product_risk":
      return "Your product risk";
    case "attack_opportunity":
      return "Attack opportunity";
    case "fix_first":
      return "Fix first";
    case "advertise_this":
      return "Advertise this";
    case "next_seller_move":
      return "Next seller move";
    default:
      return "Seller action";
  }
}

function cleanSellerCardText(value: string | undefined, fallback = "Not enough clean review evidence.") {
  const cleaned = cleanReviewInsightText(value || "", fallback);
  return cleaned.trim() || fallback;
}


function SellerGaugeCard({
  icon,
  label,
  value,
  score,
  detail,
  reason,
}: {
  icon: string;
  label: string;
  value: string;
  score: number;
  detail: string;
  reason: string;
}) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <details className="group overflow-hidden rounded-[1.75rem] border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-950">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-mist text-2xl dark:bg-white/10">
              {icon}
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              {label}
            </p>
            <h3 className="mt-2 text-2xl font-black text-ink dark:text-white">
              {value}
            </h3>
          </div>

          <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-mist dark:bg-white/10">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(#08b7a8 ${safeScore * 3.6}deg, rgba(148,163,184,0.22) 0deg)`,
              }}
            />
            <div className="relative grid h-14 w-14 place-items-center rounded-full bg-white text-sm font-black text-ink shadow-sm dark:bg-slate-950 dark:text-white">
              {safeScore}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
          {detail}
        </p>

        <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-ocean dark:text-cyan-300">
          Open reason +
        </p>
      </summary>

      <div className="mt-5 rounded-2xl bg-mist p-4 text-sm font-semibold leading-6 text-slate-700 dark:bg-white/[0.04] dark:text-slate-300">
        {reason}
      </div>
    </details>
  );
}

function sellerGaugeScore(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}


function ProductInput({
  product,
  label,
  mode,
  canRemove,
  onRemove,
  onChange
}: {
  product: ProductDraft;
  label: string;
  mode: ComparisonMode;
  canRemove: boolean;
  onRemove: () => void;
  onChange: (patch: Partial<ProductDraft>) => void;
}) {
  const isSellerMode = mode !== "buyer";
  const displayLabel = isSellerMode
    ? label.includes("1")
      ? "YOUR PRODUCT"
      : "COMPETITOR PRODUCT"
    : label;
  const productNameLabel = isSellerMode
    ? label.includes("1")
      ? "Your product name"
      : "Competitor product name"
    : "Product name";
  const reviewPlaceholder = isSellerMode
    ? label.includes("1")
      ? "Paste your product reviews here"
      : "Paste other product product reviews here"
    : "Paste reviews here";

  return (
    <article className="rounded-[1.5rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black uppercase text-ocean dark:text-cyan-300">{displayLabel}</p>
        {canRemove ? (
          <button onClick={onRemove} className="rounded-lg border border-line px-3 py-1 text-xs font-black text-slate-600 transition hover:border-coral hover:text-coral dark:border-white/10 dark:text-slate-300">
            Remove
          </button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={productNameLabel} value={product.name} onChange={(value) => onChange({ name: value })} />
        <Field label="Price" value={product.price ?? ""} onChange={(value) => onChange({ price: value })} placeholder="$49.99" />
        <Field label="Category" value={product.category ?? ""} onChange={(value) => onChange({ category: value })} placeholder="Portable blender" />
        <Field label="Product URL" value={product.url ?? ""} onChange={(value) => onChange({ url: value })} placeholder="Optional" />
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-bold text-ink dark:text-white">Paste reviews</span>
        <textarea
          value={product.reviews}
          placeholder={reviewPlaceholder}
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



function productCategoryTokens(product: ProductDraft) {
  const source = `${product.name} ${product.reviews}`.toLowerCase();

  const groups = [
    { category: "electronics", tokens: ["phone", "laptop", "charger", "camera", "monitor", "headphone", "earbud", "speaker", "tablet", "keyboard", "mouse", "tv", "watch"] },
    { category: "kitchen", tokens: ["coffee", "blender", "kettle", "air fryer", "microwave", "toaster", "pan", "pot", "knife", "cooker", "mixer", "kitchen"] },
    { category: "beauty", tokens: ["skin", "cream", "serum", "shampoo", "conditioner", "makeup", "hair", "lotion", "cleanser", "beauty", "face"] },
    { category: "clothing", tokens: ["shirt", "pants", "jacket", "dress", "shoe", "shoes", "sneaker", "boots", "sock", "clothing", "wear"] },
    { category: "fitness", tokens: ["fitness", "gym", "exercise", "treadmill", "dumbbell", "protein", "yoga", "bike", "running", "workout"] },
    { category: "home", tokens: ["lamp", "chair", "desk", "mattress", "pillow", "blanket", "vacuum", "curtain", "shelf", "home", "furniture"] },
    { category: "baby", tokens: ["baby", "stroller", "diaper", "crib", "toddler", "infant", "bottle"] },
    { category: "pet", tokens: ["dog", "cat", "pet", "leash", "collar", "litter", "kennel"] },
    { category: "automotive", tokens: ["car", "truck", "vehicle", "tire", "battery", "engine", "dashcam", "automotive"] },
    { category: "food", tokens: ["snack", "coffee beans", "tea", "food", "drink", "beverage", "candy"] }
  ];

  return groups
    .map((group) => ({
      category: group.category,
      score: group.tokens.filter((token) => source.includes(token)).length
    }))
    .filter((group) => group.score > 0)
    .sort((a, b) => b.score - a.score);
}

type ProductCompareEntry = {
  name?: string;
  title?: string;
  url?: string;
  input?: string;
  reviews?: string;
  reviewText?: string;
  result?: {
    productName?: string;
    title?: string;
    overallSummary?: string;
    summary?: string;
    verdict?: string;
    bestFor?: string;
    topComplaints?: unknown;
    topPros?: unknown;
    topCons?: unknown;
    reviewHighlights?: unknown;
    [key: string]: unknown;
  };
};

function productComparisonFit(products: ProductCompareEntry[]) {
  const scannedProducts = products.filter((product) => product?.result);

  if (scannedProducts.length < 2) {
    return {
      isDirectComparison: false,
      reason: "Scan at least two products before ReviewIntel compares them."
    };
  }

  const categories = scannedProducts.map((product) => inferProductCompareCategory(product));
  const knownCategories = categories.filter(Boolean);

  if (knownCategories.length >= 2) {
    const uniqueCategories = Array.from(new Set(knownCategories));

    if (uniqueCategories.length === 1) {
      return {
        isDirectComparison: true,
        reason: "These products are in the same shopping category, so ReviewIntel can compare them directly."
      };
    }

    return {
      isDirectComparison: false,
      reason: `These products appear to be different categories (${uniqueCategories.join(" vs ")}), so ReviewIntel should not force a winner.`
    };
  }

  return {
    isDirectComparison: true,
    reason: "These products appear close enough to compare based on the scanned review evidence."
  };
}

function inferProductCompareCategory(product: ProductCompareEntry): string {
  const text = [
    product?.name,
    product?.title,
    product?.url,
    product?.input,
    product?.reviews,
    product?.reviewText,
    product?.result?.productName,
    product?.result?.title,
    product?.result?.overallSummary,
    product?.result?.summary,
    product?.result?.verdict,
    product?.result?.bestFor,
    product?.result?.topComplaints,
    product?.result?.topPros,
    product?.result?.topCons,
    product?.result?.reviewHighlights,
    JSON.stringify(product?.result ?? {})
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const categoryRules: Array<{ category: string; keywords: string[] }> = [
    {
      category: "luggage",
      keywords: [
        "luggage",
        "suitcase",
        "carry on",
        "carry-on",
        "checked bag",
        "spinner",
        "travel bag",
        "travelpro",
        "samsonite",
        "hardside",
        "hard shell",
        "expandable suitcase",
        "tsa lock",
        "packing cubes"
      ]
    },
    {
      category: "tv",
      keywords: ["tv", "television", "smart tv", "oled", "qled", "led tv", "roku tv", "fire tv", "4k tv", "screen size"]
    },
    {
      category: "laptop",
      keywords: ["laptop", "macbook", "chromebook", "notebook computer", "gaming laptop", "ram", "ssd"]
    },
    {
      category: "phone",
      keywords: ["iphone", "android phone", "smartphone", "cell phone", "mobile phone"]
    },
    {
      category: "headphones",
      keywords: ["headphones", "earbuds", "earphones", "noise cancelling", "bluetooth audio"]
    },
    {
      category: "appliance",
      keywords: ["air fryer", "microwave", "blender", "vacuum", "coffee maker", "toaster", "humidifier"]
    },
    {
      category: "beauty",
      keywords: ["shampoo", "conditioner", "serum", "moisturizer", "skin care", "skincare", "makeup"]
    },
    {
      category: "clothing",
      keywords: ["shirt", "pants", "jacket", "dress", "shoes", "sneakers", "hoodie", "leggings"]
    }
  ];

  for (const rule of categoryRules) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      return rule.category;
    }
  }

  return "";
}

function shopperCompareVerdict(productId: string, winnerId: string, avoidId?: string) {
  if (productId === winnerId) return "Better choice";
  if (avoidId && productId === avoidId) return "Avoid";
  return "Compare carefully";
}


function ProductColumn({ product, mode }: { product: ProductDraft; mode: ComparisonMode }) {
  const analysis = product.result!.analysis;
  const confidence = product.result!.meta.confidence_label ?? "Low";

  return (
    <div className="space-y-5 rounded-[1.5rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{product.name}</Badge>
          <Badge tone={confidence === "High" ? "good" : confidence === "Medium" ? "warn" : "bad"}>{confidence} confidence</Badge>
        </div>
        <h3 className="mt-3 text-2xl font-black text-ink dark:text-white">
          {cleanReviewInsightText(analysis.overall_summary, "ReviewIntel found usable comparison signals in the supplied reviews.")}
        </h3>
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
          <InsightList title="Customer pain points" items={sanitizeSellerInsightList(analysis.seller_insights.main_customer_pain_points, [], 6)} tone="bad" />
          <InsightList title="Product improvements" items={sanitizeSellerInsightList(analysis.seller_insights.product_improvement_recommendations, [], 6)} tone="good" />
          <InsightList title="Listing improvements" items={sanitizeSellerInsightList(analysis.seller_insights.listing_improvement_suggestions, [], 6)} tone="info" />
          <InsightList title="Market gaps" items={sanitizeSellerInsightList(analysis.seller_insights.competitor_opportunity_insights, [], 6)} tone="warn" />
        </>
      )}
    </div>
  );
}
