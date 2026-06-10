"use client";

import { useMemo, useState } from "react";
import { formatPercent } from "@/lib/analysisScoring";
import { sellerFriendlyTheme } from "@/lib/insightSanitizer";
import type { AnalyzeResponse } from "@/lib/types";

type TabKey = "clusters" | "keywords" | "risks";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "clusters", label: "Clusters" },
  { key: "keywords", label: "Keywords" },
  { key: "risks", label: "Risk map" }
];

function barColor(index: number) {
  return ["bg-coral", "bg-amber", "bg-ocean", "bg-teal", "bg-plum"][index % 5];
}

export function SellerIntelligenceTabs({ result }: { result: AnalyzeResponse }) {
  const [active, setActive] = useState<TabKey>("clusters");

  const rows = useMemo(() => {
    if (active === "keywords") {
      return result.analysis.keyword_analysis.slice(0, 8).map((item) => ({
        label: item.keyword,
        detail: sellerFriendlyTheme(item.context, "Mentioned in reviews."),
        value: Math.min(100, Math.max(16, item.mentions * 14))
      }));
    }

    if (active === "risks") {
      const risks = [
        ...result.analysis.seller_insights.refund_risk_issues,
        ...result.analysis.quality_concerns,
        ...result.analysis.durability_issues,
        ...result.analysis.support_issues
      ];
      return risks.slice(0, 8).map((item, index) => ({
        label: item,
        detail: index < 3 ? "Priority risk" : "Monitor",
        value: Math.min(100, 76 - index * 7)
      }));
    }

    return result.analysis.seller_insights.complaint_clusters.slice(0, 8).map((item, index) => ({
      label: item,
      detail: index < 3 ? "Recurring theme" : "Secondary signal",
      value: Math.min(100, 82 - index * 8)
    }));
  }, [active, result]);

  return (
    <article className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Interactive seller intelligence</p>
          <h3 className="mt-2 text-2xl font-black text-ink dark:text-white">Business signal board</h3>
        </div>
        <div className="flex rounded-2xl border border-line bg-mist p-1 dark:border-white/10 dark:bg-white/5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                active === tab.key ? "bg-ink text-white dark:bg-white dark:text-ink" : "text-slate-500 hover:text-ink dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {rows.length ? rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="rounded-2xl border border-line p-4 dark:border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-black text-ink dark:text-white">{row.label}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{row.detail}</p>
              </div>
              <p className="text-xl font-black text-slate-500 dark:text-slate-300">{formatPercent(row.value)}</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div className={`h-full rounded-full ${barColor(index)}`} style={{ width: `${row.value}%` }} />
            </div>
          </div>
        )) : (
          <p className="rounded-2xl border border-line p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            No strong signals detected in this layer.
          </p>
        )}
      </div>
    </article>
  );
}
