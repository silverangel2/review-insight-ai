"use client";

import { useMemo, useState } from "react";
import type { AnalyzeResponse } from "@/lib/types";

export function SellerReportActions({ result }: { result: AnalyzeResponse }) {
  const [status, setStatus] = useState("");

  const report = useMemo(
    () => ({
      analysis_id: result.meta.analysis_id ?? null,
      platform: result.meta.platform,
      review_count: result.meta.review_count_estimate,
      confidence: result.meta.confidence_label,
      summary: result.analysis.overall_summary,
      seller_insights: result.analysis.seller_insights,
      keywords: result.analysis.keyword_analysis,
      generated_at: new Date().toISOString()
    }),
    [result]
  );

  function exportReport() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `reviewintel-seller-report-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Report exported.");
  }

  function saveAnalysis() {
    const saved = JSON.parse(window.localStorage.getItem("reviewintel:saved-seller-reports") || "[]") as unknown[];
    window.localStorage.setItem("reviewintel:saved-seller-reports", JSON.stringify([report, ...saved].slice(0, 20)));
    setStatus("Saved locally.");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button onClick={exportReport} className="rounded-xl bg-ink px-4 py-3 text-sm font-black text-white dark:bg-white dark:text-ink">
          Export report
        </button>
        <button onClick={saveAnalysis} className="rounded-xl border border-line px-4 py-3 text-sm font-black text-ink dark:border-white/10 dark:text-white">
          Save analysis
        </button>
      </div>
      {status ? <p className="text-xs font-bold text-teal">{status}</p> : null}
    </div>
  );
}
