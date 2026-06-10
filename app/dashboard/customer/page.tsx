"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardMetric, DashboardShell, MiniBarChart } from "@/components/DashboardShell";
import { InsightList } from "@/components/InsightList";
import { QuickNav } from "@/components/QuickNav";
import { getClientAccount,
  getStoredScanTally
} from "@/lib/clientAccount";
import { readLatestResult } from "@/lib/resultStorage";

type ShopperScan = {
  id: string;
  date: string;
  productName: string;
  verdict: string;
  fakeReviewRisk: string;
  score: number;
  complaint: string;
  summary: string;
};

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

function toScore(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function readShopperHistory(): ShopperScan[] {
  if (typeof window === "undefined") return [];

  const account = getClientAccount();

  const scans: ShopperScan[] = [];

  try {
    const latest = readLatestResult(account);

    if (latest?.analysis) {
      const analysis = latest.analysis as Record<string, unknown>;
      const recommendation = analysis.buyer_recommendation as Record<string, unknown> | undefined;

      scans.push({
        id: String(Date.now()),
        date: new Date().toISOString().slice(0, 10),
        productName: cleanText((analysis.product_name ?? analysis.productName), "Latest scanned product"),
        verdict: cleanText(recommendation?.verdict ?? analysis.recommendation ?? analysis.verdict, "Maybe"),
        fakeReviewRisk: cleanText(analysis.fake_review_risk_level ?? analysis.fakeReviewRisk ?? analysis.risk_level, "Unknown"),
        score: toScore(analysis.product_score ?? analysis.productScore ?? analysis.confidence_score ?? analysis.score),
        complaint: cleanText(
          analysis.biggest_complaint ??
            analysis.mainComplaint ??
            (Array.isArray(analysis.common_complaints) ? analysis.common_complaints[0] : "") ??
            (Array.isArray(analysis.complaints) ? analysis.complaints[0] : ""),
          "No major complaint saved."
        ),
        summary: cleanText(analysis.overall_summary ?? analysis.summary, "Open the latest result to review the full analysis."),
      });
    }
  } catch {
    // Ignore malformed latest result.
  }

  const extraKeys = [
    "reviewintel_result_history",
    "reviewintel_shopper_history",
    "reviewintel_scan_history",
    "reviewintel_recent_scans",
  ];

  for (const key of extraKeys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;

        const record = item as Record<string, unknown>;
        const analysis = (record.analysis ?? record.result ?? record) as Record<string, unknown>;
        const recommendation = analysis.buyer_recommendation as Record<string, unknown> | undefined;

        scans.push({
          id: String(record.id ?? record.createdAt ?? record.date ?? Math.random()),
          date: String(record.date ?? record.createdAt ?? new Date().toISOString()).slice(0, 10),
          productName: cleanText(record.productName ?? analysis.product_name ?? analysis.productName, "Scanned product"),
          verdict: cleanText(recommendation?.verdict ?? analysis.recommendation ?? analysis.verdict, "Maybe"),
          fakeReviewRisk: cleanText(analysis.fake_review_risk_level ?? analysis.fakeReviewRisk ?? analysis.risk_level, "Unknown"),
          score: toScore(analysis.product_score ?? analysis.productScore ?? analysis.confidence_score ?? analysis.score),
          complaint: cleanText(
            analysis.biggest_complaint ??
              analysis.mainComplaint ??
              (Array.isArray(analysis.common_complaints) ? analysis.common_complaints[0] : "") ??
              (Array.isArray(analysis.complaints) ? analysis.complaints[0] : ""),
            "No major complaint saved."
          ),
          summary: cleanText(analysis.overall_summary ?? analysis.summary, "Open the result to review the full analysis."),
        });
      }
    } catch {
      // Ignore malformed history entries.
    }
  }

  const seen = new Set<string>();

  return scans
    .filter((scan) => {
      const key = `${scan.date}-${scan.productName}-${scan.verdict}-${scan.score}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
}

function verdictLabel(scan: ShopperScan) {
  const text = `${scan.verdict}`.toLowerCase();

  if (text.includes("avoid")) return "Avoid";
  if (text.includes("buy") || text.includes("worth")) return "Worth buying";
  if (text.includes("risk")) return "Risky";
  return "Compare first";
}

function isFakeRisk(scan: ShopperScan) {
  const risk = scan.fakeReviewRisk.toLowerCase();
  return risk.includes("high") || risk.includes("fake") || risk.includes("suspicious");
}

function averageScore(scans: ShopperScan[]) {
  const scores = scans.map((scan) => scan.score).filter((score) => score > 0);
  if (!scores.length) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export default function CustomerDashboardPage() {
  const [history, setHistory] = useState<ShopperScan[]>([]);
  const [scanTallyTotal, setScanTallyTotal] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [selectedScan, setSelectedScan] = useState<ShopperScan | null>(null);

  const clearShopperScans = () => {
    const confirmed = window.confirm("Clear all shopper scan history from this browser? This cannot be undone.");
    if (!confirmed) return;

    const keysToClear = [
      "reviewintel_latest_result",
      "reviewintel_result_history",
      "reviewintel_shopper_history",
      "reviewintel_scan_history",
      "reviewintel_recent_scans",
      "reviewintel_last_result",
    ];

    for (const key of keysToClear) {
      window.localStorage.removeItem(key);
    }

    setHistory([]);
    window.dispatchEvent(new Event("storage"));
  };

  const deleteShopperScan = (scanToDelete: ShopperScan) => {
    const confirmed = window.confirm(`Delete this scan: ${scanToDelete.productName}?`);
    if (!confirmed) return;

    const nextHistory = history.filter((scan) => scan.id !== scanToDelete.id);
    setHistory(nextHistory);
    setSelectedScan((current) => current?.id === scanToDelete.id ? null : current);

    try {
      window.localStorage.setItem("reviewintel_shopper_history", JSON.stringify(nextHistory));
      window.localStorage.removeItem("reviewintel_latest_result");
      window.dispatchEvent(new Event("storage"));
    } catch {
      // If storage fails, keep the UI update only.
    }
  };

  const saveScanAsLatestResult = (scan: ShopperScan) => {
    try {
      window.localStorage.setItem(
        "reviewintel_latest_result",
        JSON.stringify({
          analysis: {
            productName: scan.productName,
            product_name: scan.productName,
            verdict: scan.verdict,
            recommendation: scan.verdict,
            fakeReviewRisk: scan.fakeReviewRisk,
            fake_review_risk_level: scan.fakeReviewRisk,
            productScore: scan.score,
            product_score: scan.score,
            biggestComplaint: scan.complaint,
            biggest_complaint: scan.complaint,
            summary: scan.summary,
            overall_summary: scan.summary,
          },
        })
      );
    } catch {
      // Keep modal open even if local storage fails.
    }
  };

  const openShopperScan = (scan: ShopperScan) => {
    saveScanAsLatestResult(scan);
    setSelectedScan(scan);
  };

  const viewFullResult = (scan: ShopperScan) => {
    saveScanAsLatestResult(scan);
    window.location.href = "/results";
  };

  useEffect(() => {
    const refresh = () => {
      const account = getClientAccount();
      const normalizedPlan = String(account?.plan ?? "").toLowerCase().trim();
      setIsPremium(
        normalizedPlan === "buyer_pro" ||
          normalizedPlan === "shopper_premium" ||
          normalizedPlan === "shopper premium" ||
          normalizedPlan === "premium"
      );
      setHistory(readShopperHistory());
      setScanTallyTotal(getStoredScanTally().total);
    };

    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("reviewintel:scan-tally", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("reviewintel:scan-tally", refresh);
    };
  }, []);

  const dashboard = useMemo(() => {
    const worthBuying = history.filter((scan) => verdictLabel(scan) === "Worth buying");
    const avoid = history.filter((scan) => verdictLabel(scan) === "Avoid");
    const risky = history.filter((scan) => verdictLabel(scan) === "Risky" || verdictLabel(scan) === "Compare first");
    const fakeRisk = history.filter(isFakeRisk);
    const score = averageScore(history);

    return { worthBuying, avoid, risky, fakeRisk, score };
  }, [history]);

  return (
    <DashboardShell
      title="Shopper dashboard"
      subtitle="Your saved product checks, buying verdicts, fake-review warnings, and best finds in one clean view."
      experience="buyer"
    >
      <QuickNav mode="shopper" current="/dashboard/customer" />

      <section className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-ocean">Shopping intelligence</p>
        <h2 className="mt-2 text-3xl font-black text-ink dark:text-white">Know what to buy, compare, or avoid.</h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          This dashboard keeps your scanned products organized so you do not have to reread reviews again before checkout.
        </p>
      </section>

      <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric
          label="Total scans"
          value={String(scanTallyTotal)}
          detail={scanTallyTotal ? "All shopper scans counted unless you clear them." : "Scan a product to start your tally."}
          tone="info"
        />
        <DashboardMetric
          label="Worth buying"
          value={String(dashboard.worthBuying.length)}
          detail="Products with the strongest buying signal."
          tone="good"
        />
        <DashboardMetric
          label="Compare first"
          value={String(dashboard.risky.length)}
          detail="Products that need caution or comparison."
          tone="warn"
        />
        <DashboardMetric
          label="Avoid / fake risk"
          value={String(dashboard.avoid.length + dashboard.fakeRisk.length)}
          detail="Products with avoid signals or suspicious reviews."
          tone="bad"
        />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Recent scans</p>
              <h3 className="mt-2 text-2xl font-black text-ink dark:text-white">Latest product checks</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/analyze" className="rounded-xl bg-ink px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-ocean dark:bg-white dark:text-ink">
                Scan product
              </Link>
              {history.length ? (
                <button
                  type="button"
                  onClick={clearShopperScans}
                  className="rounded-xl border border-coral/30 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-coral hover:bg-coral hover:text-white"
                >
                  Clear all
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {history.length ? (
              history.slice(0, isPremium ? 12 : 5).map((scan) => {
                const verdict = verdictLabel(scan);

                return (
                  <article key={`${scan.id}-${scan.productName}`} className="rounded-2xl border border-line bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{scan.date}</p>
                        <h4 className="mt-1 text-lg font-black text-ink dark:text-white">{scan.productName}</h4>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{scan.complaint || scan.summary}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openShopperScan(scan)}
                            className="rounded-xl border border-line px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-ink hover:border-ocean hover:text-ocean dark:border-white/10 dark:text-white"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => viewFullResult(scan)}
                            className="rounded-xl bg-ink px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-ocean dark:bg-white dark:text-ink"
                          >
                            Full result
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteShopperScan(scan)}
                            className="rounded-xl border border-coral/30 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-coral hover:bg-coral hover:text-white"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-700 dark:bg-black/20 dark:text-slate-200">
                          {verdict}
                        </span>
                        <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-700 dark:bg-black/20 dark:text-slate-200">
                          Score {scan.score || "—"}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-line p-6 text-sm font-semibold text-slate-500 dark:border-white/10 dark:text-slate-400">
                No shopper scans saved yet. Scan a product to start your buying history.
              </div>
            )}
          </div>
        </article>

        <aside className="grid gap-5">
          <MiniBarChart
            items={[
              { label: "Worth buying", value: Math.min(100, dashboard.worthBuying.length * 25), tone: "good" },
              { label: "Compare first", value: Math.min(100, dashboard.risky.length * 25), tone: "warn" },
              { label: "Avoid", value: Math.min(100, dashboard.avoid.length * 25), tone: "bad" },
              { label: "Fake risk", value: Math.min(100, dashboard.fakeRisk.length * 25), tone: "bad" },
            ]}
          />

          <InsightList
            title="Best finds"
            tone="good"
            items={dashboard.worthBuying.length ? dashboard.worthBuying.slice(0, 5).map((scan) => scan.productName) : ["Products worth buying will appear here."]}
          />

          <InsightList
            title="Fake-review alerts"
            tone="bad"
            items={dashboard.fakeRisk.length ? dashboard.fakeRisk.slice(0, 5).map((scan) => `${scan.productName}: ${scan.fakeReviewRisk}`) : ["No high fake-review risk alerts saved yet."]}
          />
        </aside>
      </section>

      {!isPremium ? (
        <section className="mt-6 rounded-[2rem] border border-ocean/20 bg-ocean/10 p-6 dark:border-ocean/30 dark:bg-ocean/10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-ocean">Shopper Free</p>
          <h3 className="mt-2 text-2xl font-black text-ink dark:text-white">You get 3 free scans per day.</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Upgrade to Shopper Premium for more scans, deeper fake-review reasoning, and a fuller buying-confidence history.
          </p>
          <Link href="/pricing" className="mt-5 inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-black text-white hover:bg-ocean dark:bg-white dark:text-ink">
            View Shopper Premium
          </Link>
        </section>
      ) : (
        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <InsightList
            title="Avoid list"
            tone="bad"
            items={dashboard.avoid.length ? dashboard.avoid.slice(0, 6).map((scan) => scan.productName) : ["Avoid decisions will appear here."]}
          />
          <InsightList
            title="Compare before buying"
            tone="warn"
            items={dashboard.risky.length ? dashboard.risky.slice(0, 6).map((scan) => scan.productName) : ["Risky or uncertain products will appear here."]}
          />
          <InsightList
            title="Buying confidence"
            tone="info"
            items={[
              dashboard.score === null ? "Average buying score will appear after saved scans." : `Average buying score: ${dashboard.score}%`,
              "Use this history before checkout so you do not buy based on reviews you no longer remember.",
            ]}
          />
        </section>
      )}
      {selectedScan ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/20 bg-white p-6 shadow-[0_40px_140px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-ocean">Scan preview</p>
                <h2 className="mt-2 text-3xl font-black text-ink dark:text-white">{selectedScan.productName}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{selectedScan.date}</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedScan(null)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600 hover:border-ocean hover:text-ocean dark:border-white/10 dark:text-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-white/5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Verdict</p>
                <p className="mt-2 text-2xl font-black text-ink dark:text-white">{verdictLabel(selectedScan)}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-white/5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Score</p>
                <p className="mt-2 text-2xl font-black text-ocean">{selectedScan.score || "—"}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-white/5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Fake-review risk</p>
                <p className="mt-2 text-2xl font-black text-teal">{selectedScan.fakeReviewRisk || "Unknown"}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 dark:bg-white/5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Main warning</p>
                <p className="mt-2 text-lg font-black text-coral">{selectedScan.complaint || "No major complaint saved."}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-line bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Complete scan notes</p>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                {selectedScan.summary || selectedScan.complaint || "No detailed summary was saved for this scan."}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => viewFullResult(selectedScan)}
                className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white hover:bg-ocean dark:bg-white dark:text-ink"
              >
                Open full result
              </button>

              <button
                type="button"
                onClick={() => deleteShopperScan(selectedScan)}
                className="rounded-xl border border-coral/30 px-5 py-3 text-sm font-black text-coral hover:bg-coral hover:text-white"
              >
                Delete scan
              </button>

              <button
                type="button"
                onClick={() => setSelectedScan(null)}
                className="rounded-xl border border-line px-5 py-3 text-sm font-black text-ink hover:border-ocean hover:text-ocean dark:border-white/10 dark:text-white"
              >
                Close preview
              </button>
            </div>
          </section>
        </div>
      ) : null}

    </DashboardShell>
  );
}
