"use client";

import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";
import { SellerBusinessKpiDashboard } from "@/components/SellerBusinessKpiDashboard";
import { saveStoredSellerResultToJournal } from "@/lib/sellerJournal";
import { readLatestSellerResult } from "@/lib/sellerResultStorage";

type SellerResult = {
  summary: string;
  reviewsAnalyzed: number;
  healthScore: number;
  buyerSatisfaction: number;
  refundRisk: number;
  topComplaints: string[];
  topPraise: string[];
  buyerObjections: string[];
  productFixes: string[];
  listingFixes: string[];
  adAngles: string[];
  nextActions: string[];
};

type StoredSellerResult = {
  result: SellerResult;
  fileName: string;
  createdAt: string;
};

type MobileResultCardDetail = {
  title: string;
  details: string[];
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score || 0)));
}

function statusFor(result: SellerResult) {
  const health = clampScore(result.healthScore);
  const satisfaction = clampScore(result.buyerSatisfaction);
  const refund = clampScore(result.refundRisk);

  if (health >= 80 && satisfaction >= 75 && refund <= 35) {
    return {
      label: "Strong Product",
      color: "emerald",
      message: "This product has strong buyer signals. Focus on polishing friction points and turning praise into better listing copy."
    };
  }

  if (health >= 60 && satisfaction >= 55 && refund <= 65) {
    return {
      label: "Good, But Needs Work",
      color: "amber",
      message: "This product has potential, but repeated buyer objections should be fixed before scaling ads or inventory."
    };
  }

  return {
    label: "Needs Attention",
    color: "rose",
    message: "The review signals show meaningful risk. Fix the biggest product and listing issues before pushing more traffic."
  };
}

function InsightBlock({
  title,
  subtitle,
  items,
  icon
}: {
  title: string;
  subtitle: string;
  items: string[];
  icon: string;
}) {
  const safeItems = items?.length ? items : ["No clear signal found yet."];

  return (
    <div className="seller-insight-card rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-xl">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {safeItems.slice(0, 6).map((item, index) => (
          <div key={index} className="seller-insight-item rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function PriorityPlan({ items }: { items: string[] }) {
  const safeItems = items?.length ? items : ["Review the top complaint themes and improve the product listing before scaling sales."];

  return (
    <div className="seller-priority-plan rounded-[2rem] border border-slate-900 bg-slate-950 p-6 text-white shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">Priority Action Plan</p>
      <h3 className="mt-2 text-3xl font-black">What to fix next</h3>

      <div className="seller-priority-list mt-5 space-y-3">
        {safeItems.slice(0, 5).map((item, index) => (
          <div key={index} className="seller-priority-item flex gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <div className="seller-priority-number flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-sm font-black text-slate-950">
              {index + 1}
            </div>
            <p className="text-sm font-semibold text-slate-100">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SellerResultPage() {
  const [stored, setStored] = useState<StoredSellerResult | null>(null);
  const [mobileCardDetail, setMobileCardDetail] = useState<MobileResultCardDetail | null>(null);

  useEffect(() => {
    try {
      const parsed = readLatestSellerResult() as StoredSellerResult | null;
      if (!parsed) return;
      setStored(parsed);
      saveStoredSellerResultToJournal(parsed);
    } catch {
      setStored(null);
    }
  }, []);

  const result = stored?.result || null;
  const status = useMemo(() => (result ? statusFor(result) : null), [result]);

  useEffect(() => {
    function handleSellerCardDetail(event: Event) {
      const detail = (event as CustomEvent<MobileResultCardDetail>).detail;

      if (!detail?.title || !Array.isArray(detail.details)) return;

      setMobileCardDetail({
        title: detail.title,
        details: detail.details.filter(Boolean)
      });
    }

    window.addEventListener("reviewintel:seller-result-card-detail", handleSellerCardDetail);

    return () => {
      window.removeEventListener("reviewintel:seller-result-card-detail", handleSellerCardDetail);
    };
  }, []);

  function openMobileResultCardDetail(event: MouseEvent<HTMLElement>) {
    if (typeof window === "undefined") return;

    const isMobileLayout =
      document.documentElement.dataset.layoutMode === "mobile" ||
      window.matchMedia("(max-width: 640px)").matches;

    if (!isMobileLayout) return;

    const target = event.target as HTMLElement | null;
    const card = target?.closest(
      ".seller-insight-card"
    ) as HTMLElement | null;

    if (!card) return;

    const title =
      card.querySelector("h2, h3")?.textContent?.replace(/\s+/g, " ").trim() ||
      "Seller insight";

    const subtitle =
      card.querySelector("p")?.textContent?.replace(/\s+/g, " ").trim() || "";

    const itemTexts = Array.from(card.querySelectorAll(".seller-insight-item"))
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() || "")
      .map((line) => line.replace(/^[-•\d.\s]+/, "").trim())
      .filter(Boolean)
      .filter((line) => line.length > 6);

    const fallbackTexts = Array.from(card.querySelectorAll("li, p, span, div"))
      .filter((node) => node.children.length === 0)
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() || "")
      .map((line) => line.replace(/^[-•\d.\s]+/, "").trim())
      .filter(Boolean)
      .filter((line) => line.length > 6)
      .filter((line) => line.toLowerCase() !== title.toLowerCase())
      .filter((line) => !subtitle || line.toLowerCase() !== subtitle.toLowerCase());

    const details = Array.from(new Set(itemTexts.length ? itemTexts : fallbackTexts))
      .filter((line) => line.length < 320)
      .slice(0, 8);

    setMobileCardDetail({
      title,
      details: [
        ...(subtitle ? [subtitle] : []),
        ...(details.length ? details : ["No detailed items found for this card."])
      ]
    });
  }

  if (!result || !status) {
    return (
      <main onClick={openMobileResultCardDetail} className="seller-result-page min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 px-4 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl">
          <h1 className="text-3xl font-black">No seller result found.</h1>
          <p className="mt-3 text-slate-600">Upload a CSV first to generate a seller intelligence report.</p>
          <Link href="/seller/analyze" className="mt-6 inline-flex rounded-2xl bg-cyan-300 px-5 py-3 font-black text-slate-950">
            Upload CSV
          </Link>
        </div>
      </main>
    );
  }

  const biggestProblem = result.topComplaints?.[0] || result.buyerObjections?.[0] || "No major repeated issue found yet.";
  const bestOpportunity = result.topPraise?.[0] || result.adAngles?.[0] || "Use positive buyer language to improve listing and ads.";
  const fixFirst = result.productFixes?.[0] || result.listingFixes?.[0] || "Improve the clearest buyer friction point first.";

  return (
    <main onClick={openMobileResultCardDetail} className="seller-result-page min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/seller/analyze"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-cyan-300/50 hover:text-slate-950"
          >
            ← New CSV Scan
          </Link>

          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-800">
            Seller Intelligence Report
          </span>
        </div>

        <section className="seller-result-hero rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="seller-result-hero-grid grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-700">ReviewIntel Seller Result</p>
              <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950 sm:text-6xl">{status.label}</h1>
              <p className="mt-4 max-w-3xl text-lg font-semibold text-slate-600">{status.message}</p>
              <p className="mt-4 text-sm font-bold text-slate-500">
                CSV: {stored?.fileName || "Uploaded file"} • Reviews analyzed: {result.reviewsAnalyzed}
              </p>
            </div>

            <div className="seller-result-summary-card rounded-[2rem] border border-cyan-200 bg-cyan-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-700">Executive Summary</p>
              <p className="mt-3 text-2xl font-black leading-tight text-slate-950">{result.summary}</p>
            </div>
          </div>
        </section>

        <SellerBusinessKpiDashboard
          analysis={{
            product_score: result.healthScore,
            productScore: result.healthScore,
            confidence_score: result.buyerSatisfaction,
            reviewsAnalyzed: result.reviewsAnalyzed,
            review_count: result.reviewsAnalyzed,
            topComplaints: result.topComplaints,
            complaints: result.topComplaints,
            topPraise: result.topPraise,
            praise: result.topPraise,
            buyerObjections: result.buyerObjections,
            featureRequests: result.productFixes,
            supportIssues: result.buyerObjections,
            productFixes: result.productFixes,
            listingFixes: result.listingFixes,
            adAngles: result.adAngles,
            nextActions: result.nextActions
          }}
          plan="seller-pro"
        />

        <section className="seller-result-top-cards mt-6 grid gap-4 lg:grid-cols-3">
          <div className="seller-result-mini-card rounded-[2rem] border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-rose-700">Biggest Problem</p>
            <h2 className="mt-3 text-2xl font-black text-rose-950">{biggestProblem}</h2>
          </div>

          <div className="seller-result-mini-card rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">Best Opportunity</p>
            <h2 className="mt-3 text-2xl font-black text-emerald-950">{bestOpportunity}</h2>
          </div>

          <div className="seller-result-mini-card rounded-[2rem] border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-700">Fix First</p>
            <h2 className="mt-3 text-2xl font-black text-cyan-950">{fixFirst}</h2>
          </div>
        </section>

        <section className="seller-insight-grid mt-6 grid gap-5 lg:grid-cols-2">
          <InsightBlock title="Top Complaints" subtitle="What buyers are unhappy about." icon="⚠️" items={result.topComplaints} />
          <InsightBlock title="Top Praise" subtitle="What buyers already love." icon="⭐" items={result.topPraise} />
          <InsightBlock title="Buyer Objections" subtitle="What may stop shoppers from buying." icon="🧠" items={result.buyerObjections} />
          <InsightBlock title="Product Fixes" subtitle="Improvements that can reduce complaints." icon="🛠️" items={result.productFixes} />
          <InsightBlock title="Listing Fixes" subtitle="Copy, image, and detail improvements." icon="📝" items={result.listingFixes} />
          <InsightBlock title="Ad Angles" subtitle="Positive review themes you can use in marketing." icon="📣" items={result.adAngles} />
        </section>

        <section className="mt-6">
          <PriorityPlan items={result.nextActions} />
        </section>

        {mobileCardDetail ? (
          <div
            className="seller-mobile-card-modal fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setMobileCardDetail(null)}
          >
            <div
              className="max-h-[76vh] w-full max-w-[25rem] overflow-y-auto rounded-[1.75rem] border border-white/50 bg-white p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-cyan-700">
                    Seller result detail
                  </p>
                  <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">
                    {mobileCardDetail.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileCardDetail(null)}
                  className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3">
                {mobileCardDetail.details.map((detail, index) => (
                  <div
                    key={`${detail}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[0.95rem] font-semibold leading-relaxed text-slate-800"
                  >
                    {detail}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <style jsx global>{`
          @media (max-width: 640px) {
            html[data-layout-mode="mobile"] .seller-result-page,
            html[data-layout-mode="auto"] .seller-result-page {
              padding: 3.75rem 0.75rem 4rem !important;
              overflow-x: hidden !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-result-hero,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-hero {
              padding: 1rem !important;
              border-radius: 1.25rem !important;
              box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08) !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-result-hero-grid,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-hero-grid {
              grid-template-columns: minmax(0, 1fr) !important;
              gap: 0.9rem !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-result-hero h1,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-hero h1 {
              margin-top: 0.45rem !important;
              font-size: 2rem !important;
              line-height: 1.05 !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-result-hero p,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-hero p {
              margin-top: 0.55rem !important;
              font-size: 0.86rem !important;
              line-height: 1.45 !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-result-summary-card,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-summary-card {
              padding: 1rem !important;
              border-radius: 1rem !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-result-summary-card p:first-child,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-summary-card p:first-child {
              font-size: 0.68rem !important;
              line-height: 1.2 !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-result-summary-card p:last-child,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-summary-card p:last-child {
              display: block !important;
              margin-top: 0.5rem !important;
              font-size: 1rem !important;
              line-height: 1.35 !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-money-kpi-section,
            html[data-layout-mode="auto"] .seller-result-page .seller-money-kpi-section {
              margin-top: 1rem !important;
              padding: 0.9rem !important;
              border-radius: 1.25rem !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-money-kpi-section h2,
            html[data-layout-mode="auto"] .seller-result-page .seller-money-kpi-section h2 {
              margin-top: 0.35rem !important;
              font-size: 1.4rem !important;
              line-height: 1.12 !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-money-kpi-section p,
            html[data-layout-mode="auto"] .seller-result-page .seller-money-kpi-section p {
              font-size: 0.78rem !important;
              line-height: 1.35 !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-kpi-grid,
            html[data-layout-mode="auto"] .seller-result-page .seller-kpi-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 0.65rem !important;
              margin-top: 0.8rem !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-kpi-card,
            html[data-layout-mode="auto"] .seller-result-page .seller-kpi-card {
              height: 13.5rem !important;
              min-height: 13.5rem !important;
              max-height: none !important;
              border-radius: 1rem !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-kpi-card article,
            html[data-layout-mode="auto"] .seller-result-page .seller-kpi-card article {
              padding: 0.75rem !important;
              border-radius: 1rem !important;
              overflow-y: auto !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-kpi-card svg,
            html[data-layout-mode="auto"] .seller-result-page .seller-kpi-card svg {
              width: 100% !important;
              height: 3.4rem !important;
              max-width: none !important;
              max-height: none !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-kpi-card p,
            html[data-layout-mode="auto"] .seller-result-page .seller-kpi-card p {
              display: block !important;
              margin-top: 0.35rem !important;
              font-size: 0.7rem !important;
              line-height: 1.35 !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-kpi-card p:nth-of-type(2),
            html[data-layout-mode="auto"] .seller-result-page .seller-kpi-card p:nth-of-type(2) {
              font-size: 1.2rem !important;
              line-height: 1.05 !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-kpi-card h3,
            html[data-layout-mode="auto"] .seller-result-page .seller-kpi-card h3 {
              font-size: 0.9rem !important;
              line-height: 1.2 !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-money-summary-grid,
            html[data-layout-mode="auto"] .seller-result-page .seller-money-summary-grid {
              grid-template-columns: minmax(0, 1fr) !important;
              gap: 0.65rem !important;
              margin-top: 0.8rem !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-money-summary-card,
            html[data-layout-mode="auto"] .seller-result-page .seller-money-summary-card {
              padding: 0.9rem !important;
              border-radius: 1rem !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-money-summary-card h3,
            html[data-layout-mode="auto"] .seller-result-page .seller-money-summary-card h3 {
              font-size: 1rem !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-money-summary-card li,
            html[data-layout-mode="mobile"] .seller-result-page .seller-money-summary-card p,
            html[data-layout-mode="auto"] .seller-result-page .seller-money-summary-card li,
            html[data-layout-mode="auto"] .seller-result-page .seller-money-summary-card p {
              font-size: 0.78rem !important;
              line-height: 1.4 !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-result-top-cards,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-top-cards {
              grid-template-columns: minmax(0, 1fr) !important;
              gap: 0.6rem !important;
              margin-top: 0.9rem !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-result-mini-card,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-mini-card {
              min-height: 0 !important;
              max-height: none !important;
              padding: 0.85rem !important;
              border-radius: 1rem !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-result-mini-card p,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-mini-card p {
              font-size: 0.66rem !important;
              line-height: 1.15 !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-result-mini-card h2,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-mini-card h2 {
              display: block !important;
              margin-top: 0.35rem !important;
              font-size: 1rem !important;
              line-height: 1.3 !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-insight-grid,
            html[data-layout-mode="auto"] .seller-result-page .seller-insight-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 0.65rem !important;
              margin-top: 0.9rem !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-insight-card,
            html[data-layout-mode="auto"] .seller-result-page .seller-insight-card {
              min-height: 13rem !important;
              max-height: none !important;
              padding: 0.75rem !important;
              border-radius: 1rem !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-insight-card h3,
            html[data-layout-mode="auto"] .seller-result-page .seller-insight-card h3 {
              font-size: 0.9rem !important;
              line-height: 1.15 !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-insight-card p,
            html[data-layout-mode="auto"] .seller-result-page .seller-insight-card p,
            html[data-layout-mode="mobile"] .seller-result-page .seller-insight-item,
            html[data-layout-mode="auto"] .seller-result-page .seller-insight-item {
              display: block !important;
              font-size: 0.7rem !important;
              line-height: 1.3 !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-insight-item:nth-child(n + 4),
            html[data-layout-mode="auto"] .seller-result-page .seller-insight-item:nth-child(n + 4) {
              display: none !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-priority-plan,
            html[data-layout-mode="auto"] .seller-result-page .seller-priority-plan {
              margin-top: 0.9rem !important;
              padding: 1rem !important;
              border-radius: 1.25rem !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-priority-plan h3,
            html[data-layout-mode="auto"] .seller-result-page .seller-priority-plan h3 {
              font-size: 1.35rem !important;
              line-height: 1.15 !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-priority-list,
            html[data-layout-mode="auto"] .seller-result-page .seller-priority-list {
              grid-template-columns: minmax(0, 1fr) !important;
              gap: 0.5rem !important;
              margin-top: 0.75rem !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-priority-item,
            html[data-layout-mode="auto"] .seller-result-page .seller-priority-item {
              min-height: 0 !important;
              max-height: none !important;
              padding: 0.7rem !important;
              border-radius: 0.85rem !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-priority-item p,
            html[data-layout-mode="auto"] .seller-result-page .seller-priority-item p {
              display: block !important;
              font-size: 0.78rem !important;
              line-height: 1.35 !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-priority-item:nth-child(n + 5),
            html[data-layout-mode="auto"] .seller-result-page .seller-priority-item:nth-child(n + 5) {
              display: none !important;
            }

            /* Mobile seller result card readability override */
            html[data-layout-mode="mobile"] .seller-result-page .seller-kpi-grid,
            html[data-layout-mode="mobile"] .seller-result-page .seller-insight-grid,
            html[data-layout-mode="mobile"] .seller-result-page .seller-result-top-cards,
            html[data-layout-mode="auto"] .seller-result-page .seller-kpi-grid,
            html[data-layout-mode="auto"] .seller-result-page .seller-insight-grid,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-top-cards {
              grid-template-columns: minmax(0, 1fr) !important;
              gap: 0.85rem !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-kpi-card,
            html[data-layout-mode="mobile"] .seller-result-page .seller-result-mini-card,
            html[data-layout-mode="mobile"] .seller-result-page .seller-insight-card,
            html[data-layout-mode="mobile"] .seller-result-page .seller-priority-item,
            html[data-layout-mode="auto"] .seller-result-page .seller-kpi-card,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-mini-card,
            html[data-layout-mode="auto"] .seller-result-page .seller-insight-card,
            html[data-layout-mode="auto"] .seller-result-page .seller-priority-item {
              min-height: 0 !important;
              max-height: none !important;
              padding: 1rem !important;
              border-radius: 1.15rem !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-kpi-card p,
            html[data-layout-mode="mobile"] .seller-result-page .seller-result-mini-card p,
            html[data-layout-mode="mobile"] .seller-result-page .seller-insight-card p,
            html[data-layout-mode="mobile"] .seller-result-page .seller-insight-item,
            html[data-layout-mode="mobile"] .seller-result-page .seller-priority-item p,
            html[data-layout-mode="auto"] .seller-result-page .seller-kpi-card p,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-mini-card p,
            html[data-layout-mode="auto"] .seller-result-page .seller-insight-card p,
            html[data-layout-mode="auto"] .seller-result-page .seller-insight-item,
            html[data-layout-mode="auto"] .seller-result-page .seller-priority-item p {
              display: block !important;
              font-size: 0.92rem !important;
              line-height: 1.45 !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-kpi-card h2,
            html[data-layout-mode="mobile"] .seller-result-page .seller-kpi-card h3,
            html[data-layout-mode="mobile"] .seller-result-page .seller-result-mini-card h2,
            html[data-layout-mode="mobile"] .seller-result-page .seller-insight-card h3,
            html[data-layout-mode="auto"] .seller-result-page .seller-kpi-card h2,
            html[data-layout-mode="auto"] .seller-result-page .seller-kpi-card h3,
            html[data-layout-mode="auto"] .seller-result-page .seller-result-mini-card h2,
            html[data-layout-mode="auto"] .seller-result-page .seller-insight-card h3 {
              font-size: 1.15rem !important;
              line-height: 1.25 !important;
              overflow: visible !important;
            }

            html[data-layout-mode="mobile"] .seller-result-page .seller-insight-item:nth-child(n + 4),
            html[data-layout-mode="mobile"] .seller-result-page .seller-priority-item:nth-child(n + 5),
            html[data-layout-mode="auto"] .seller-result-page .seller-insight-item:nth-child(n + 4),
            html[data-layout-mode="auto"] .seller-result-page .seller-priority-item:nth-child(n + 5) {
              display: block !important;
            }

          }
        `}</style>
      </div>
    </main>
  );
}
