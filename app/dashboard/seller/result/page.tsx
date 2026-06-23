"use client";

import { useEffect, useMemo, useState } from "react";
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
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
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
          <div key={index} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
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
    <div className="rounded-[2rem] border border-slate-900 bg-slate-950 p-6 text-white shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">Priority Action Plan</p>
      <h3 className="mt-2 text-3xl font-black">What to fix next</h3>

      <div className="mt-5 space-y-3">
        {safeItems.slice(0, 5).map((item, index) => (
          <div key={index} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-sm font-black text-slate-950">
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

  if (!result || !status) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 px-4 py-10 text-slate-950">
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
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

        <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-700">ReviewIntel Seller Result</p>
              <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950 sm:text-6xl">{status.label}</h1>
              <p className="mt-4 max-w-3xl text-lg font-semibold text-slate-600">{status.message}</p>
              <p className="mt-4 text-sm font-bold text-slate-500">
                CSV: {stored?.fileName || "Uploaded file"} • Reviews analyzed: {result.reviewsAnalyzed}
              </p>
            </div>

            <div className="rounded-[2rem] border border-cyan-200 bg-cyan-50 p-6">
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

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-rose-700">Biggest Problem</p>
            <h2 className="mt-3 text-2xl font-black text-rose-950">{biggestProblem}</h2>
          </div>

          <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">Best Opportunity</p>
            <h2 className="mt-3 text-2xl font-black text-emerald-950">{bestOpportunity}</h2>
          </div>

          <div className="rounded-[2rem] border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-700">Fix First</p>
            <h2 className="mt-3 text-2xl font-black text-cyan-950">{fixFirst}</h2>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
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
      </div>
    </main>
  );
}
