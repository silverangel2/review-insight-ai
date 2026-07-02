"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  deleteSellerCompareHistoryItem,
  readActiveSellerCompare,
  readSellerCompareHistory,
  setActiveSellerCompare,
  type SellerCompareHistoryItem,
} from "@/lib/sellerCompareHistory";

function list(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|•|- /)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function text(value: unknown, fallback = "Not enough evidence yet.") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function score(value: unknown) {
  return typeof value === "number" ? `${Math.round(value)}% confidence` : "AI confidence";
}


type SellerCompareProofRecord = Record<string, unknown>;

function isSellerCompareProofRecord(value: unknown): value is SellerCompareProofRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sellerProofRecord(source: SellerCompareProofRecord | null, key: string): SellerCompareProofRecord | null {
  if (!source) return null;
  const value = source[key];
  return isSellerCompareProofRecord(value) ? value : null;
}

function sellerProofString(source: SellerCompareProofRecord | null, key: string): string {
  if (!source) return "";
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function sellerProofNumber(source: SellerCompareProofRecord | null, key: string): number | null {
  if (!source) return null;
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sellerProofArray(source: SellerCompareProofRecord | null, key: string): unknown[] {
  if (!source) return [];
  const value = source[key];
  return Array.isArray(value) ? value : [];
}

function getSellerCompareProof(product: unknown) {
  const raw = isSellerCompareProofRecord(product) ? product : {};
  const analysis = sellerProofRecord(raw, "analysis");

  const productIdentity =
    sellerProofRecord(raw, "productIdentity") ||
    sellerProofRecord(analysis, "productIdentity");

  const reviewEvidence =
    sellerProofRecord(raw, "reviewEvidence") ||
    sellerProofRecord(analysis, "reviewEvidence");

  const listingEvidence = sellerProofRecord(reviewEvidence, "listingEvidence");

  const reviewAuthenticity =
    sellerProofRecord(raw, "reviewAuthenticity") ||
    sellerProofRecord(reviewEvidence, "reviewAuthenticity") ||
    sellerProofRecord(analysis, "reviewAuthenticity");

  const stableKey =
    sellerProofString(raw, "stableProductKey") ||
    sellerProofString(raw, "productKey") ||
    sellerProofString(analysis, "stableProductKey") ||
    sellerProofString(analysis, "productKey");

  return {
    stableKey,
    store: sellerProofString(productIdentity, "store") || sellerProofString(listingEvidence, "store"),
    brand: sellerProofString(productIdentity, "brand"),
    price: sellerProofNumber(productIdentity, "price") ?? sellerProofNumber(listingEvidence, "price"),
    rating: sellerProofNumber(productIdentity, "rating") ?? sellerProofNumber(listingEvidence, "rating"),
    reviewCount: sellerProofNumber(productIdentity, "reviewCount") ?? sellerProofNumber(listingEvidence, "reviewCount"),
    sourcesChecked: sellerProofArray(reviewEvidence, "sourcesChecked"),
    commentsAnalyzed: sellerProofNumber(reviewEvidence, "commentsAnalyzed") ?? sellerProofNumber(reviewEvidence, "reviewsFound"),
    evidenceStrength: sellerProofString(reviewEvidence, "evidenceStrength"),
    exactListingConfidence: sellerProofString(listingEvidence, "confidence"),
    aiLikeRisk: sellerProofNumber(reviewAuthenticity, "score"),
  };
}

function SellerProofPill({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "Not found" : String(value);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">{display}</p>
    </div>
  );
}

function SellerProductProofCard({ label, product }: { label: string; product: unknown }) {
  const proof = getSellerCompareProof(product);

  return (
    <div className="rounded-3xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-300/20 dark:bg-cyan-300/10">
      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-200">
        {label} tool proof
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SellerProofPill label="Store" value={proof.store || "Not confirmed"} />
        <SellerProofPill label="Brand" value={proof.brand || "Not confirmed"} />
        <SellerProofPill label="Price" value={proof.price !== null ? `$${proof.price}` : null} />
        <SellerProofPill label="Rating" value={proof.rating !== null ? `${proof.rating}/5` : null} />
        <SellerProofPill label="Review count" value={proof.reviewCount} />
        <SellerProofPill label="Sources checked" value={proof.sourcesChecked.length} />
        <SellerProofPill label="Comments analyzed" value={proof.commentsAnalyzed} />
        <SellerProofPill label="Evidence strength" value={proof.evidenceStrength || "Not enough"} />
        <SellerProofPill label="Exact listing" value={proof.exactListingConfidence || "Not confirmed"} />
        <SellerProofPill label="AI-like risk" value={proof.aiLikeRisk !== null ? `${proof.aiLikeRisk}%` : "Not scored"} />
        <SellerProofPill label="Memory" value={proof.stableKey ? "Saved/merged" : "New/unknown"} />
        <SellerProofPill label="Stable key" value={proof.stableKey ? "Matched" : "Not matched"} />
      </div>

      {proof.sourcesChecked.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Sources checked</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {proof.sourcesChecked.slice(0, 6).map((source, index) => (
              <span
                key={`${String(source)}-${index}`}
                className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-black text-cyan-800 dark:border-cyan-300/20 dark:bg-slate-950 dark:text-cyan-200"
              >
                {String(source).slice(0, 40)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SellerCompareToolProof({ result }: { result: unknown }) {
  const raw = result as unknown as SellerCompareProofRecord;

  const yourProduct =
    raw.yourProduct ||
    raw.productA ||
    raw.primaryProduct ||
    raw.yourAnalysis ||
    raw.yourResult ||
    raw.yourScan ||
    raw.sellerProduct ||
    raw.sellerAnalysis ||
    raw.leftProduct ||
    raw.firstProduct ||
    null;

  const competitorProduct =
    raw.competitorProduct ||
    raw.productB ||
    raw.competitorAnalysis ||
    raw.competitorResult ||
    raw.competitorScan ||
    raw.competitor ||
    raw.rightProduct ||
    raw.secondProduct ||
    null;

  const yourProof = getSellerCompareProof(yourProduct);
  const competitorProof = getSellerCompareProof(competitorProduct);

  const yourEvidenceScore =
    yourProof.sourcesChecked.length * 3 +
    (yourProof.commentsAnalyzed || 0) +
    (yourProof.reviewCount || 0) / 100;

  const competitorEvidenceScore =
    competitorProof.sourcesChecked.length * 3 +
    (competitorProof.commentsAnalyzed || 0) +
    (competitorProof.reviewCount || 0) / 100;

  const evidenceGap =
    Math.abs(yourEvidenceScore - competitorEvidenceScore) < 2
      ? "Both products have similar review evidence depth."
      : yourEvidenceScore > competitorEvidenceScore
        ? "Your product has stronger review evidence depth."
        : "The competitor has stronger review evidence depth.";

  const hasAnyProof =
    Boolean(yourProduct) ||
    Boolean(competitorProduct) ||
    yourProof.sourcesChecked.length > 0 ||
    competitorProof.sourcesChecked.length > 0;

  if (!hasAnyProof) return null;

  return (
    <section className="rounded-[2rem] border border-cyan-200 bg-white p-4 shadow-sm dark:border-cyan-300/20 dark:bg-slate-950 sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-200">
          AI tool proof
        </p>
        <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
          What ReviewIntel checked for seller compare
        </h2>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-600 dark:text-slate-300">
          Seller Compare uses product memory, exact listing search, and review evidence to show the buyer trust gap.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SellerProductProofCard label="Your product" product={yourProduct} />
        <SellerProductProofCard label="Competitor" product={competitorProduct} />
      </div>

      <p className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-black text-cyan-900 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100">
        {evidenceGap}
      </p>
    </section>
  );
}


export default function SellerCompareResultPage() {
  const [active, setActive] = useState<SellerCompareHistoryItem | null>(null);
  const [history, setHistory] = useState<SellerCompareHistoryItem[]>([]);

  function refresh() {
    const savedHistory = readSellerCompareHistory();
    const savedActive = readActiveSellerCompare();

    setHistory(savedHistory);
    setActive(savedActive || savedHistory[0] || null);

    if (!savedActive && savedHistory[0]) {
      setActiveSellerCompare(savedHistory[0].id);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const visibleActive = active || history[0] || null;

  if (!visibleActive) {
    return (
      <main className="min-h-screen bg-[#f7f3ea] px-4 py-10 text-[#172033]">
        <section className="mx-auto max-w-4xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-teal-600">
            Seller Compare
          </p>
          <h1 className="mt-3 text-4xl font-black">No compare result yet.</h1>
          <p className="mt-4 text-base font-semibold text-slate-600">
            Run a Seller Pro comparison first to create a dedicated competitor strategy result.
          </p>
          <Link
            href="/dashboard/seller/compare"
            className="mt-6 inline-flex rounded-2xl bg-teal-600 px-6 py-3 text-sm font-black text-white"
          >
            Run seller compare
          </Link>
        </section>
      </main>
    );
  }

  const comparison = visibleActive.comparison ?? {};
  const heroSummary = text(comparison.executiveSummary, "ReviewIntel created your competitor strategy.");
  const position = text(comparison.competitivePosition, "Competitive position needs more review evidence.");
  const warning = text(comparison.comparabilityWarning, "");

  const fixFirst = list(comparison.fixFirst);
  const marketMove = text(comparison.marketMove, "No clear market move was detected.");
  const outgrowStrategy = list(comparison.outgrowStrategy);
  const competitorAdvantages = list(comparison.competitorAdvantages);
  const yourAdvantages = list(comparison.yourAdvantages);
  const conversionGaps = list(comparison.conversionGaps);
  const productMoves = list(comparison.productMoves);
  const listingMoves = list(comparison.listingMoves);
  const adAngles = list(comparison.adAngles);
  const riskWarnings = list(comparison.riskWarnings);
  const thirtyDayPlan = list(comparison.thirtyDayPlan);
  const ninetyDayPlan = list(comparison.ninetyDayPlan);

  return (
    <main className="seller-compare-result-page min-h-screen bg-[#f7f3ea] px-4 py-8 text-[#172033]">
      <section className="mx-auto max-w-7xl">
        <div className="seller-compare-result-shell overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="seller-compare-hero bg-slate-950 px-6 py-7 text-white md:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-teal-300">
                  Seller Pro AI Compare
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
                  Competitor Outgrowth Plan
                </h1>
                <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-300">
                  {visibleActive.yourLabel} <span className="text-teal-300">vs</span> {visibleActive.competitorLabel}
                </p>
              </div>

              <div className="seller-compare-score-card rounded-3xl border border-teal-400/30 bg-teal-400/10 px-5 py-4">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-200">
                  AI Confidence
                </p>
                <p className="mt-2 text-3xl font-black text-white">{score(comparison.confidence)}</p>
              </div>
            </div>
          </div>

          <div className="seller-compare-summary-grid grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="border-b border-slate-200 p-6 md:p-8 lg:border-b-0 lg:border-r">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
                Competitive position
              </p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950">{position}</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-slate-700">{heroSummary}</p>

              <div className="seller-compare-summary-card mt-6 rounded-3xl border border-teal-200 bg-teal-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-700">
                  Best market move
                </p>
                <p className="mt-3 text-xl font-black leading-8 text-teal-950">{marketMove}</p>
              </div>

              {warning ? (
                <p className="seller-compare-warning mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
                  {warning}
                </p>
              ) : null}
            </section>

            <section className="seller-compare-summary-left p-6 md:p-8">
              <div className="seller-compare-risk-card rounded-3xl border border-rose-200 bg-rose-50 p-6">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-rose-700">
                  Fix first
                </p>
                <h3 className="mt-3 text-2xl font-black text-rose-950">
                  Highest-impact correction
                </h3>
                <ActionList items={fixFirst} empty="No urgent fix was detected." tone="rose" limit={4} />
              </div>
            </section>
          </div>

          <div className="seller-compare-strategy-grid seller-compare-strategy-grid-3 grid gap-5 border-t border-slate-200 bg-slate-50 p-6 md:grid-cols-3 md:p-8">
            <SellerCompareToolProof result={visibleActive} />

            <StrategyCard title="Competitor wins because" items={competitorAdvantages} tone="amber" />
            <StrategyCard title="You already win on" items={yourAdvantages} tone="teal" />
            <StrategyCard title="Conversion leaks" items={conversionGaps} tone="rose" />
          </div>

          <div className="seller-compare-strategy-grid seller-compare-strategy-grid-4 grid gap-5 p-6 md:grid-cols-2 md:p-8">
            <StrategyCard title="Product moves" items={productMoves} tone="slate" />
            <StrategyCard title="Listing moves" items={listingMoves} tone="slate" />
            <StrategyCard title="Ad angles to test" items={adAngles} tone="teal" />
            <StrategyCard title="Risk warnings" items={riskWarnings} tone="rose" />
          </div>

          <div className="seller-compare-plan-section border-t border-slate-200 bg-slate-950 p-6 text-white md:p-8">
            <div className="seller-compare-plan-grid grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-300">
                  Outgrow strategy
                </p>
                <ActionList items={outgrowStrategy} empty="No outgrowth strategy was generated." tone="dark" limit={6} />
              </section>

              <div className="seller-compare-roadmap-grid grid gap-5 md:grid-cols-2">
                <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-300">
                    30-day attack plan
                  </p>
                  <ActionList items={thirtyDayPlan} empty="No 30-day plan was generated." tone="dark" limit={6} />
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-300">
                    90-day roadmap
                  </p>
                  <ActionList items={ninetyDayPlan} empty="No 90-day roadmap was generated." tone="dark" limit={6} />
                </section>
              </div>
            </div>
          </div>

          <div className="seller-compare-actions flex flex-wrap gap-3 border-t border-slate-200 bg-white p-6 md:p-8">
            <Link
              href="/dashboard/seller/compare"
              className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-black text-white hover:bg-slate-800"
            >
              Run another compare
            </Link>
            <Link
              href="/seller/analyze"
              className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-800 hover:bg-slate-50"
            >
              Back to seller analyze
            </Link>
          </div>
        </div>

        {history.length > 0 ? (
          <section className="seller-compare-history mt-6 rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Compare history</h2>
            <div className="mt-4 grid gap-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSellerCompare(item.id);
                      refresh();
                    }}
                    className="text-left"
                  >
                    <p className="text-sm font-black text-slate-950">
                      {item.yourLabel} vs {item.competitorLabel}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      deleteSellerCompareHistoryItem(item.id);
                      refresh();
                    }}
                    className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-black text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <style jsx global>{`
          @media (max-width: 640px) {
            html[data-layout-mode="mobile"] .seller-compare-result-page,
            html[data-layout-mode="auto"] .seller-compare-result-page {
              padding: 3.75rem 0.75rem 4rem !important;
              overflow-x: hidden !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-result-shell,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-result-shell {
              border-radius: 1.25rem !important;
              box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08) !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-hero,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-hero {
              padding: 1rem !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-hero h1,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-hero h1 {
              margin-top: 0.45rem !important;
              font-size: 2rem !important;
              line-height: 1.05 !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-hero p,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-hero p {
              font-size: 0.8rem !important;
              line-height: 1.35 !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-score-card,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-score-card {
              width: 100% !important;
              padding: 0.8rem !important;
              border-radius: 1rem !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-score-card p:first-child,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-score-card p:first-child {
              font-size: 0.66rem !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-score-card p:nth-child(2),
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-score-card p:nth-child(2) {
              font-size: 1.35rem !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-summary-grid,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-summary-grid {
              grid-template-columns: minmax(0, 1fr) !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-summary-grid > section,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-summary-grid > section {
              padding: 1rem !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-summary-grid h2,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-summary-grid h2 {
              font-size: 1.45rem !important;
              line-height: 1.2 !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-summary-grid p,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-summary-grid p {
              font-size: 0.82rem !important;
              line-height: 1.45 !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-summary-card,
            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-risk-card,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-summary-card,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-risk-card {
              margin-top: 0.75rem !important;
              padding: 0.9rem !important;
              border-radius: 1rem !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-strategy-grid,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-strategy-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 0.65rem !important;
              padding: 0.9rem !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-strategy-card,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-strategy-card {
              min-height: 11rem !important;
              max-height: none !important;
              padding: 0.75rem !important;
              border-radius: 1rem !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-strategy-card h3,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-strategy-card h3 {
              font-size: 0.9rem !important;
              line-height: 1.2 !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-strategy-card li,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-strategy-card li {
              font-size: 0.72rem !important;
              line-height: 1.35 !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-plan-section,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-plan-section {
              padding: 0.9rem !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-plan-grid,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-plan-grid,
            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-roadmap-grid,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-roadmap-grid {
              grid-template-columns: minmax(0, 1fr) !important;
              gap: 0.65rem !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-plan-section section,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-plan-section section {
              max-height: none !important;
              padding: 0.8rem !important;
              border-radius: 1rem !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-plan-section p,
            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-plan-section li,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-plan-section p,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-plan-section li {
              font-size: 0.76rem !important;
              line-height: 1.4 !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-action-item:nth-child(n + 5),
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-action-item:nth-child(n + 5) {
              display: none !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-actions,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-actions {
              padding: 0.9rem !important;
              gap: 0.55rem !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-actions a,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-actions a {
              flex: 1 1 100% !important;
              padding: 0.75rem 0.9rem !important;
              border-radius: 0.85rem !important;
              font-size: 0.78rem !important;
              text-align: center !important;
            }

            html[data-layout-mode="mobile"] .seller-compare-result-page .seller-compare-history,
            html[data-layout-mode="auto"] .seller-compare-result-page .seller-compare-history {
              position: static !important;
              width: auto !important;
              max-width: none !important;
              max-height: none !important;
              margin-top: 0.9rem !important;
              padding: 0.9rem !important;
              border-radius: 1rem !important;
              overflow: visible !important;
            }
          }
        `}</style>
      </section>
    
</main>
  );
}


function StrategyCard({
  title,
  items,
  empty = "No clear pattern detected.",
  tone = "slate",
}: {
  title: string;
  items: string[];
  empty?: string;
  tone?: "slate" | "teal" | "rose" | "amber";
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal-200 bg-teal-50 text-teal-950"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-950"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-slate-200 bg-white text-slate-950";

  return (
    <section className={`seller-compare-strategy-card rounded-3xl border p-6 ${toneClass}`}>
      <h3 className="text-xl font-black">{title}</h3>
      <ActionList items={items} empty={empty} tone={tone} limit={6} />
    </section>
  );
}

function ActionList({
  items,
  empty,
  tone,
  limit = 6,
}: {
  items: string[];
  empty: string;
  tone: "slate" | "teal" | "rose" | "amber" | "dark";
  limit?: number;
}) {
  const dotClass =
    tone === "dark"
      ? "bg-teal-300"
      : tone === "rose"
        ? "bg-rose-500"
        : tone === "amber"
          ? "bg-amber-500"
          : tone === "teal"
            ? "bg-teal-500"
            : "bg-slate-500";

  const textClass = tone === "dark" ? "text-slate-200" : "text-slate-700";
  const emptyClass = tone === "dark" ? "text-slate-400" : "text-slate-500";

  if (!items.length) {
    return <p className={`mt-4 text-sm font-semibold ${emptyClass}`}>{empty}</p>;
  }

  return (
    <ul className="mt-4 space-y-3">
      {items.slice(0, limit).map((item, index) => (
        <li key={`${item}-${index}`} className={`seller-compare-action-item flex gap-3 text-sm font-semibold leading-6 ${textClass}`}>
          <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
