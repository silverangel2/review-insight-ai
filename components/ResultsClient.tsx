"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import { reconcileAnalysisScores } from "@/lib/analysisScoring";
import { getClientAccount, saveActiveMode } from "@/lib/clientAccount";
import { clearLatestResult, readLatestResult, saveLatestResult } from "@/lib/resultStorage";
import type { AnalyzeResponse, SubscriptionPlan } from "@/lib/types";

function reconcileResponse(result: AnalyzeResponse): AnalyzeResponse {
  return {
    ...result,
    analysis: reconcileAnalysisScores(result.analysis, result.meta.review_count_estimate)
  };
}

export function ResultsClient() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [accountPlan, setAccountPlan] = useState<SubscriptionPlan | null>(null);

  useEffect(() => {
    try {
      const account = getClientAccount();
      setAccountPlan(account?.plan ?? null);
      const parsed = readLatestResult(account);
      if (!parsed) return;

      const reconciled = reconcileResponse(parsed);
      saveLatestResult(reconciled, account);
      setResult(reconciled);
      saveActiveMode(account?.role === "seller" && parsed.meta.audience === "both" ? "seller" : parsed.meta.audience);
    } catch {
      clearLatestResult();
    }
  }, []);

  if (!result) {
    return (
      <section className="ri-reveal-pop relative overflow-hidden rounded-[2rem] border border-line bg-white p-8 text-center shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-teal via-ocean to-amber" />
        <Badge tone="warn">No scan loaded</Badge>
        <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-black text-ink dark:text-white">Run a real analysis to see ReviewIntel results.</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Public sample results have been removed from the customer experience. Paste reviews or upload a CSV/TXT file to generate a fresh result.
        </p>
        <Link href="/analyze" className="mt-6 inline-flex rounded-2xl bg-ink px-6 py-4 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
          Run AI Analysis
        </Link>
      </section>
    );
  }

  const isSellerAudience = result.meta.audience === "seller" || result.meta.audience === "both";
  const sellerPlanLabel = accountPlan === "seller_pro" ? "Seller Pro" : accountPlan === "seller_starter" ? "Seller Starter" : "Seller Premium";
  const resultHeading = isSellerAudience ? `${sellerPlanLabel} intelligence` : "Shopper quick answer";

  return (
    <div className="space-y-5">
      <section className="ri-reveal-pop relative overflow-hidden rounded-[1.6rem] border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-b from-teal via-ocean to-amber" />
        <div className="flex flex-col gap-4 pl-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean dark:text-cyan-300">
              Your latest scan
            </p>
            <h1 className="mt-2 text-2xl font-black text-ink dark:text-white">
              {resultHeading}
            </h1>
          </div>
          <div className="grid gap-2 sm:grid-cols-1 lg:min-w-48">
            <Link href="/analyze" className="rounded-2xl bg-ink px-4 py-3 text-center text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ocean dark:bg-white dark:text-ink">
              Run another scan
            </Link>
          </div>
        </div>
      </section>

      <ResultsDashboard result={result} accountPlan={accountPlan} />
    </div>
  );
}
