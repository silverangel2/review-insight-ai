"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { QuickNav } from "@/components/QuickNav";
import { getClientAccount } from "@/lib/clientAccount";
import { readSellerJournal } from "@/lib/sellerJournal";
import { readSellerProducts } from "@/lib/sellerProducts";

function scanText(scan: unknown, keys: string[], fallback = "") {
  const record = scan as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && value.length) return String(value[0]);
  }

  return fallback;
}

function scanArray(scan: unknown, keys: string[]) {
  const record = scan as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
    if (typeof value === "string" && value.trim()) return [value.trim()];
  }

  return [];
}

function scanNumber(scan: unknown, keys: string[], fallback = 0) {
  const record = scan as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  }

  return fallback;
}

function uniqueTop(items: string[], limit = 4) {
  const seen = new Set<string>();

  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function productRowsFromScans(scans: unknown[]) {
  const groups = new Map<
    string,
    {
      scores: number[];
      concerns: string[];
      positives: string[];
      actions: string[];
      reviewCount: number;
      scanCount: number;
      latestDate: string;
    }
  >();

  for (const scan of scans) {
    const name = scanText(scan, ["productName", "name", "title"], "Unnamed product");
    const score = scanNumber(scan, ["productScore", "score", "rating", "confidenceScore"], 0);
    const date = scanText(scan, ["date", "createdAt"], "");

    const current =
      groups.get(name) ??
      {
        scores: [],
        concerns: [],
        positives: [],
        actions: [],
        reviewCount: 0,
        scanCount: 0,
        latestDate: "",
      };

    current.scanCount += 1;
    if (score > 0) current.scores.push(score);

    current.concerns.push(...scanArray(scan, ["mainComplaint", "complaints", "topComplaints", "issues", "painPoints"]));
    current.positives.push(...scanArray(scan, ["praises", "positiveSignals", "topPositiveFeedback", "praisedFeatures", "strengths", "positivePoints"]));
    current.actions.push(...scanArray(scan, ["actionPlan", "actions", "recommendations", "sellerActions", "improvementSuggestions"]));
    current.reviewCount += scanNumber(scan, ["reviewCount", "reviewsAnalyzed", "review_count", "validReviewCount"], 0);

    if (date && date > current.latestDate) current.latestDate = date;

    groups.set(name, current);
  }

  return Array.from(groups.entries())
    .map(([name, value]) => {
      const avgScore = value.scores.length
        ? Math.round(value.scores.reduce((sum, score) => sum + score, 0) / value.scores.length)
        : 0;

      return {
        name,
        avgScore,
        scanCount: value.scanCount,
        reviewCount: value.reviewCount,
        latestDate: value.latestDate || "No date",
        mainConcern: uniqueTop(value.concerns, 1)[0] ?? "No clear concern detected",
        topPositive: uniqueTop(value.positives, 1)[0] ?? "No strong positive signal yet",
        nextAction: uniqueTop(value.actions, 1)[0] ?? "Run another scan to confirm the next improvement",
        priority:
          avgScore >= 85 ? "Strong" :
          avgScore >= 70 ? "Watch" :
          avgScore >= 50 ? "Improve" :
          "Fix first",
      };
    })
    .sort((a, b) => a.avgScore - b.avgScore);
}

function priorityStyle(priority: string) {
  if (priority === "Strong") return "bg-teal/10 text-teal";
  if (priority === "Watch") return "bg-ocean/10 text-ocean";
  if (priority === "Improve") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  return "bg-coral/10 text-coral";
}

export default function SellerProductsPage() {
  const [account, setAccount] = useState<ReturnType<typeof getClientAccount> | null>(null);
  const [journalScans, setJournalScans] = useState<unknown[]>([]);
  const [productScans, setProductScans] = useState<unknown[]>([]);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");

  const clearSellerScans = () => {
    const confirmed = window.confirm("Clear all seller scan history from this browser? This cannot be undone.");
    if (!confirmed) return;

    const keys = Object.keys(window.localStorage);

    for (const key of keys) {
      const lowerKey = key.toLowerCase();

      if (
        lowerKey.includes("seller_journal") ||
        lowerKey.includes("seller_products") ||
        lowerKey.includes("seller_product") ||
        lowerKey.includes("product_scans") ||
        lowerKey.includes("compare_history")
      ) {
        window.localStorage.removeItem(key);
      }
    }

    setJournalScans([]);
    setProductScans([]);
    window.dispatchEvent(new Event("storage"));
  };

  const deleteSellerProduct = (productName: string) => {
    const confirmed = window.confirm(`Delete all saved seller scans for ${productName}?`);
    if (!confirmed) return;

    const matchesProduct = (scan: unknown) =>
      scanText(scan, ["productName", "name", "title"], "Unnamed product") === productName;

    const nextJournal = journalScans.filter((scan) => !matchesProduct(scan));
    const nextProductScans = productScans.filter((scan) => !matchesProduct(scan));

    setJournalScans(nextJournal);
    setProductScans(nextProductScans);

    try {
      const keys = Object.keys(window.localStorage);

      for (const key of keys) {
        const lowerKey = key.toLowerCase();

        if (lowerKey.includes("seller_journal")) {
          window.localStorage.setItem(key, JSON.stringify(nextJournal));
        }

        if (lowerKey.includes("seller_products") || lowerKey.includes("seller_product") || lowerKey.includes("product_scans")) {
          window.localStorage.removeItem(key);
        }
      }

      window.dispatchEvent(new Event("storage"));
    } catch {
      // Keep UI update even if storage update fails.
    }
  };

  const openSellerProduct = (productName: string) => {
    const scans = [...journalScans, ...productScans].filter((scan) =>
      scanText(scan, ["productName", "name", "title"], "Unnamed product") === productName
    );

    const latestScan = scans[0];

    if (latestScan) {
      try {
        window.localStorage.setItem(
          "reviewintel_latest_result",
          JSON.stringify({
            analysis: latestScan,
          })
        );
      } catch {
        // Continue to results even if local storage fails.
      }
    }

    window.location.href = "/results";
  };

  useEffect(() => {
    const refresh = () => {
      setAccount(getClientAccount());
      setJournalScans(readSellerJournal());
      setProductScans(readSellerProducts().flatMap((product) => product.scans ?? []));
    };

    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const isSeller = account?.role === "seller";

  const rows = useMemo(() => {
    const allRows = productRowsFromScans([...journalScans, ...productScans]);

    return allRows.filter((row) => {
      const matchesQuery = row.name.toLowerCase().includes(query.toLowerCase());
      const matchesPriority = priority === "all" || row.priority === priority;

      return matchesQuery && matchesPriority;
    });
  }, [journalScans, productScans, query, priority]);

  if (account && !isSeller) {
    return (
      <DashboardShell
        title="Tracked products"
        subtitle="This product manager is available for seller accounts."
        experience="seller"
      >
        <QuickNav mode="seller" current="/dashboard/seller/products" />

        <section className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <h2 className="text-2xl font-black text-ink dark:text-white">Seller product tracking is not available on shopper accounts.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Shopper accounts are for buying decisions. Seller accounts track product health, complaints, actions, and improvement history.
          </p>
          <Link href="/analyze" className="mt-5 inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-black text-white hover:bg-ocean dark:bg-white dark:text-ink">
            Go to Analyze
          </Link>
        </section>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Tracked products"
      subtitle="All saved seller products, grouped by product name and sorted by improvement priority."
      experience="seller"
    >
      <QuickNav mode="seller" current="/dashboard/seller/products" />

      <section className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-ocean">Product manager</p>
            <h1 className="mt-2 text-3xl font-black text-ink dark:text-white">See every product you are tracking.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Use this page when you have many products. The main dashboard stays clean, while this page shows the full product list.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/seller" className="rounded-xl border border-line px-5 py-3 text-sm font-black text-ink hover:border-ocean hover:text-ocean dark:border-white/10 dark:text-white">
              Back to Seller Dashboard
            </Link>
            {rows.length ? (
              <button
                type="button"
                onClick={clearSellerScans}
                className="rounded-xl border border-coral/30 px-5 py-3 text-sm font-black text-coral hover:bg-coral hover:text-white"
              >
                Clear all
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_220px]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products..."
            className="rounded-2xl border border-line bg-slate-50 px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white"
          />

          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="rounded-2xl border border-line bg-slate-50 px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            <option value="all">All priorities</option>
            <option value="Fix first">Fix first</option>
            <option value="Improve">Improve</option>
            <option value="Watch">Watch</option>
            <option value="Strong">Strong</option>
          </select>
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">All products</p>
            <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">{rows.length} product{rows.length === 1 ? "" : "s"} found</h2>
          </div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Sorted by lowest score first</p>
        </div>

        <div className="mt-5 grid gap-4">
          {rows.length ? (
            rows.map((product) => (
              <article key={product.name} className="rounded-2xl border border-line bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black text-ink dark:text-white">{product.name}</h3>
                      <span className={`rounded-full px-3 py-1.5 text-xs font-black uppercase ${priorityStyle(product.priority)}`}>
                        {product.priority}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      <strong>Main concern:</strong> {product.mainConcern}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      <strong>Winning signal:</strong> {product.topPositive}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      <strong>Next move:</strong> {product.nextAction}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openSellerProduct(product.name)}
                        className="rounded-xl bg-ink px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-ocean dark:bg-white dark:text-ink"
                      >
                        Open latest
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSellerProduct(product.name)}
                        className="rounded-xl border border-coral/30 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-coral hover:bg-coral hover:text-white"
                      >
                        Delete product history
                      </button>
                    </div>
                  </div>

                  <div className="grid min-w-[220px] grid-cols-2 gap-3 text-center">
                    <div className="rounded-2xl bg-white p-4 dark:bg-black/20">
                      <p className="text-2xl font-black text-ocean">{product.avgScore ? `${product.avgScore}%` : "—"}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Avg score</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 dark:bg-black/20">
                      <p className="text-2xl font-black text-ink dark:text-white">{product.scanCount}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Scans</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 dark:bg-black/20">
                      <p className="text-2xl font-black text-ink dark:text-white">{product.reviewCount}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Reviews</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 dark:bg-black/20">
                      <p className="text-sm font-black text-ink dark:text-white">{product.latestDate}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Latest</p>
                    </div>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center dark:border-white/10">
              <h3 className="text-xl font-black text-ink dark:text-white">No tracked products yet.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Run a seller analysis and attach it to a product. Your products will appear here automatically.
              </p>
              <Link href="/analyze" className="mt-5 inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-black text-white hover:bg-ocean dark:bg-white dark:text-ink">
                Run Seller Scan
              </Link>
            </div>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
