"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getClientAccount } from "@/lib/clientAccount";
import { displayCodeForResult } from "@/lib/productDisplay";

type ShopperScan = {
  id?: string;
  productName?: string;
  verdict?: string;
  score?: number;
  createdAt?: string;
};

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeScore(value: unknown, key = "") {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number)) return null;
  if (key === "rating" && number > 0 && number <= 5) return Math.round(number * 20);
  if (/confidence|sentiment/i.test(key) && number > 0 && number <= 1) return Math.round(number * 100);
  return Math.round(number);
}

function readShopperScore(...sources: Record<string, unknown>[]) {
  const keys = ["productScore", "product_score", "buyingConfidence", "score", "confidenceScore", "confidence_score", "rating"];

  for (const source of sources) {
    for (const key of keys) {
      const score = normalizeScore(source[key], key);
      if (score !== null) return score;
    }
  }

  return undefined;
}

function shopperHistoryKeys(account: ReturnType<typeof getClientAccount>) {
  const identity = (account?.email || "guest").trim().toLowerCase();
  const plan = (account?.plan || "free_buyer").trim().toLowerCase();

  return [
    `reviewintel_shopper_result_history:${plan}:${identity}`
  ];
}

function scanFromHistoryItem(item: unknown): ShopperScan {
  const historyItem = item as {
    id?: string;
    savedAt?: string;
    result?: {
      analysisId?: string;
      createdAt?: string;
      verdict?: string;
      productScore?: number;
      buyingConfidence?: number;
      product?: { name?: string; title?: string };
      analysis?: { verdict?: string; score?: number; summary?: string };
    };
  };
  const result = historyItem.result || (item as typeof historyItem.result);
  const resultRecord = recordOf(result);
  const analysisRecord = recordOf(resultRecord.analysis);

  return {
    id: historyItem.id || result?.analysisId || result?.createdAt,
    productName: displayCodeForResult(result, result?.product?.name || result?.product?.title || result?.analysis?.summary || "Product scan"),
    verdict: result?.verdict || result?.analysis?.verdict || "Checked",
    score: readShopperScore(resultRecord, analysisRecord),
    createdAt: historyItem.savedAt || result?.createdAt
  };
}

function readHistory(account: ReturnType<typeof getClientAccount>): ShopperScan[] {
  if (typeof window === "undefined") return [];

  for (const key of shopperHistoryKeys(account)) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(scanFromHistoryItem).slice(0, 10);
    } catch {
      // try next key
    }
  }

  return [];
}

function clearHistory(account: ReturnType<typeof getClientAccount>) {
  if (typeof window === "undefined") return;
  shopperHistoryKeys(account).forEach((key) => window.localStorage.removeItem(key));
}

function verdictTone(verdict = "") {
  const value = verdict.toLowerCase();

  if (value.includes("buy") || value.includes("worth")) {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }

  if (value.includes("avoid")) {
    return "bg-rose-50 text-rose-800 border-rose-200";
  }

  return "bg-amber-50 text-amber-800 border-amber-200";
}

function BigButton({
  href,
  icon,
  title,
  helper,
  locked = false
}: {
  href: string;
  icon: string;
  title: string;
  helper: string;
  locked?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[1.5rem] border border-line bg-white p-4 shadow-soft sm:rounded-[2rem] sm:p-6 transition hover:-translate-y-1 hover:shadow-glow dark:border-white/10 dark:bg-slate-950"
    >
      <div className="flex items-center gap-4">
        <div className="grid size-12 place-items-center rounded-2xl bg-teal text-2xl sm:size-16 sm:rounded-[1.5rem] sm:text-3xl text-white shadow-glow">
          {icon}
        </div>

        <div className="min-w-0">
          <h2 className="text-lg font-black text-ink sm:text-2xl dark:text-white">
            {title} {locked ? "🔒" : ""}
          </h2>
          <p className="mt-1 text-xs font-bold leading-relaxed sm:text-sm text-slate-500 dark:text-slate-400">{helper}</p>
        </div>
      </div>
    </Link>
  );
}

export default function CustomerDashboardPage() {
  const [history, setHistory] = useState<ShopperScan[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [dashboardAllowed, setDashboardAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const refresh = () => {
      const account = getClientAccount();
      const plan = String(account?.plan || "").toLowerCase();
      const premium = plan === "buyer_pro" || plan === "buyer_beta" || plan.includes("premium");

      setIsPremium(premium);
      setDashboardAllowed(premium);

      if (!premium) {
        clearHistory(account);
        setHistory([]);
        window.location.replace("/analyze");
        return;
      }

      setHistory(readHistory(account));
    };

    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const avoidCount = useMemo(() => {
    return history.filter((scan) => String(scan.verdict || "").toLowerCase().includes("avoid")).length;
  }, [history]);

  if (dashboardAllowed !== true) {
    return (
      <main className="min-h-screen bg-paper px-6 py-12 text-ink dark:bg-slate-950 dark:text-white">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-line bg-white p-8 text-center shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-teal dark:text-cyan-200">Shopper Free</p>
          <h1 className="mt-3 text-3xl font-black">Dashboard is premium-only.</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-500 dark:text-slate-400">
            Free shoppers can analyze products and view the current scan result, but saved dashboards are not enabled.
          </p>
          <Link href="/analyze" className="mt-6 inline-flex rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white dark:bg-white dark:text-ink">
            Go to Analyze
          </Link>
        </section>
      </main>
    );
  }

  const todayCount = history.length;
  const scanLimitLabel = isPremium ? `${todayCount}/10` : "3/day";
  const historyWindowLabel = isPremium ? "30 days" : "Off";
  const historyHelper = isPremium
    ? "Premium keeps 10 scans per week"
    : "Free does not save scan history";

  return (
    <main className="min-h-screen bg-paper px-3 py-4 text-ink sm:px-6 sm:py-8 lg:px-8 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            href="/analyze"
            className="rounded-full border border-line bg-white px-3 py-2 text-xs font-black sm:px-4 sm:text-sm text-ink shadow-soft transition hover:border-teal dark:border-white/10 dark:bg-slate-950 dark:text-white"
          >
            Analyze Product
          </Link>

          <span className="rounded-full border border-line bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] sm:px-4 sm:text-xs sm:tracking-[0.2em] text-teal shadow-soft dark:border-white/10 dark:bg-slate-950 dark:text-cyan-200">
            {isPremium ? "Shopper Premium" : "Shopper Free"}
          </span>
        </div>

        <section className="rounded-[1.75rem] border border-line bg-white p-4 shadow-soft sm:rounded-[2.5rem] sm:p-10 dark:border-white/10 dark:bg-slate-950">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] sm:text-sm sm:tracking-[0.3em] text-teal dark:text-cyan-200">
            Shopping Hub
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-ink sm:mt-4 sm:text-6xl dark:text-white">
            What are you buying today?
          </h1>

          <p className="mt-3 max-w-2xl text-sm font-bold leading-relaxed sm:mt-4 sm:text-lg text-slate-500 dark:text-slate-400">
            Pick one button. ReviewIntel will help you buy, compare, or avoid.
          </p>

          <div className="mt-5 grid gap-3 sm:mt-8 sm:gap-5 md:grid-cols-2">
            <BigButton
              href="/analyze"
              icon="📸"
              title="Analyze Product"
              helper="Upload one screenshot or paste one link."
            />

            <BigButton
              href={isPremium ? "/compare" : "/pricing"}
              icon="⚖️"
              title="Compare Products"
              helper="Check two products side by side."
              locked={!isPremium}
            />

            <BigButton
              href={isPremium ? "#recent-scans" : "/pricing"}
              icon="🕘"
              title="Recent Scans"
              helper={isPremium ? "See what you checked recently." : "Saved history is premium-only."}
              locked={!isPremium}
            />

            <BigButton
              href={isPremium ? "#avoid-list" : "/pricing"}
              icon="🚫"
              title="Avoid List"
              helper={isPremium ? "Products with warning signs." : "Avoid history is premium-only."}
              locked={!isPremium}
            />
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-line bg-white p-4 sm:rounded-[2rem] sm:p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Today</p>
            <p className="mt-1 text-3xl font-black sm:mt-2 sm:text-4xl text-ink dark:text-white">{scanLimitLabel}</p>
            <p className="mt-2 text-sm font-bold text-slate-500">{historyHelper}</p>
          </div>

          <div className="rounded-[1.5rem] border border-line bg-white p-4 sm:rounded-[2rem] sm:p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">History</p>
            <p className="mt-1 text-3xl font-black sm:mt-2 sm:text-4xl text-ink dark:text-white">{historyWindowLabel}</p>
            <p className="mt-2 text-sm font-bold text-slate-500">{isPremium ? "Saved scans auto-clear" : "Current scan only"}</p>
          </div>

          <div className="rounded-[1.5rem] border border-line bg-white p-4 sm:rounded-[2rem] sm:p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Warnings</p>
            <p className="mt-1 text-3xl font-black sm:mt-2 sm:text-4xl text-ink dark:text-white">{avoidCount}</p>
            <p className="mt-2 text-sm font-bold text-slate-500">Products to think twice about</p>
          </div>
        </section>

        <section id="recent-scans" className="mt-6 rounded-[1.5rem] border border-line bg-white p-4 shadow-soft sm:rounded-[2rem] sm:p-6 dark:border-white/10 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Recent Scans</p>
              <h2 className="mt-2 text-lg font-black text-ink sm:text-2xl dark:text-white">Last products checked</h2>
            </div>

            <Link
              href="/analyze"
              className="rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white shadow-soft dark:bg-white dark:text-ink"
            >
              New Scan
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {!isPremium ? (
              <div className="rounded-2xl bg-slate-50 p-6 text-center dark:bg-white/5">
                <p className="text-xl font-black text-ink dark:text-white">History is premium-only.</p>
                <p className="mt-2 text-sm font-bold text-slate-500">Shopper Free shows only the current scan result after analysis.</p>
              </div>
            ) : history.length ? (
              history.slice(0, 5).map((scan, index) => (
                <div key={scan.id || index} className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-white/5">
                  <div>
                    <p className="text-lg font-black text-ink dark:text-white">
                      {scan.productName || "Product scan"}
                    </p>
                    <p className="text-sm font-bold text-slate-500">
                      Score: {scan.score || "—"}/100
                    </p>
                  </div>

                  <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${verdictTone(scan.verdict)}`}>
                    {scan.verdict || "Checked"}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-slate-50 p-6 text-center dark:bg-white/5">
                <p className="text-xl font-black text-ink dark:text-white">No scans yet.</p>
                <p className="mt-2 text-sm font-bold text-slate-500">Analyze a product to start your saved history.</p>
              </div>
            )}
          </div>
        </section>

        <section id="avoid-list" className="mt-6 rounded-[1.5rem] border border-line bg-white p-4 shadow-soft sm:rounded-[2rem] sm:p-6 dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Avoid List</p>
          <h2 className="mt-2 text-lg font-black text-ink sm:text-2xl dark:text-white">Products with warning signs</h2>

          <div className="mt-5 space-y-3">
            {!isPremium ? (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500 dark:bg-white/5">
                Avoid history is premium-only. Free scans still show the current verdict on the results page.
              </div>
            ) : history.filter((scan) => String(scan.verdict || "").toLowerCase().includes("avoid")).length ? (
              history
                .filter((scan) => String(scan.verdict || "").toLowerCase().includes("avoid"))
                .slice(0, 5)
                .map((scan, index) => (
                  <div key={scan.id || index} className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
                    <p className="font-black">{scan.productName || "Avoid product"}</p>
                    <p className="mt-1 text-xs font-bold leading-relaxed sm:text-sm">ReviewIntel marked this as AVOID.</p>
                  </div>
                ))
            ) : (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500 dark:bg-white/5">
                No avoid products yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
