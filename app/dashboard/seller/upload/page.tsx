"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { readStoredLocale } from "@/lib/i18n";
import { saveLatestSellerResult } from "@/lib/sellerResultStorage";
import { incrementSellerScanAudit } from "@/lib/sellerScanAudit";


function makePrdCode() {
  return `PRD-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function getStoredSellerAccount() {
  if (typeof window === "undefined") return null;

  const raw =
    localStorage.getItem("reviewintel:account") ||
    localStorage.getItem("reviewintel-account") ||
    localStorage.getItem("reviewintel_account") ||
    "";

  if (!raw) return null;

  try {
    return JSON.parse(raw) as { email?: string; plan?: string; role?: string };
  } catch {
    return null;
  }
}

async function saveSellerProductToAccountHistory(result: SellerResult, fileName: string) {
  const account = getStoredSellerAccount();
  const prdCode = makePrdCode();

  const productName =
    fileName ||
    "Seller Product";

  await fetch("/api/account/analyses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      id: prdCode,
      code: prdCode,
      displayCode: prdCode,
      refCode: prdCode,

      type: "seller_analyze",
      mode: "seller_analyze",
      source: "seller_analyze",
      analysisType: "seller_analyze",
      reportType: "seller_analyze",
      category: "seller_analyze",

      title: productName,
      productName,
      product_name: productName,

      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timestamp: Date.now(),

      email: account?.email || "seller.pro@reviewintel.test",
      plan: account?.plan || "seller_pro",
      role: account?.role || "seller",

      counted: true,
      scanCount: 1,

      result,
      analysis: result,
      report: result,
      request: { source: "seller_analyze", fileName },
    }),
  });
}

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

export default function SellerDashboardPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  async function analyzeCsv() {
    if (!file) {
      setError("Upload a CSV file first.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("csv", file);
      formData.append("locale", readStoredLocale());

      const response = await fetch("/api/seller-analyze", {
        method: "POST",
        body: formData
      });

      const data: SellerResult | { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error("error" in data ? data.error || "Seller CSV analysis failed." : "Seller CSV analysis failed.");
      }

      saveLatestSellerResult({
        result: data,
        fileName,
        createdAt: new Date().toISOString()
      });

      // SELLER_PRODUCT_PRD_ACCOUNT_HISTORY_SAVE
      await saveSellerProductToAccountHistory(data as SellerResult, fileName);

      incrementSellerScanAudit();

      const stillOnSellerAnalyze =
        typeof window !== "undefined" &&
        ["/seller/analyze", "/dashboard/seller/upload"].includes(window.location.pathname);

      if (stillOnSellerAnalyze) {
        router.push("/seller/result");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Seller CSV analysis failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper px-3 py-4 text-ink sm:px-6 sm:py-8 lg:px-8 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            href="/seller/analyze"
            className="rounded-full border border-line bg-white px-3 py-2 text-xs font-bold sm:px-4 sm:text-sm text-ink shadow-soft transition hover:border-teal hover:text-ink dark:border-white/10 dark:bg-slate-950 dark:text-white"
          >
            ← Seller Dashboard
          </Link>

          <span className="rounded-full border border-line bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] sm:px-4 sm:text-xs sm:tracking-[0.2em] text-teal shadow-soft dark:border-white/10 dark:bg-slate-950 dark:text-cyan-200">
            Seller CSV Intelligence
          </span>
        </div>

        <section className="rounded-[1.75rem] border border-line bg-white p-4 shadow-soft sm:rounded-[2.5rem] sm:p-10 dark:border-white/10 dark:bg-slate-950">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] sm:text-sm sm:tracking-[0.3em] text-teal dark:text-cyan-200">ReviewIntel Seller</p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-ink sm:mt-4 sm:text-6xl dark:text-white">
            Upload Seller Reviews.
          </h1>

          <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-slate-500 sm:mt-4 sm:text-lg dark:text-slate-400">
            Upload your product review CSV. ReviewIntel will build a seller intelligence report with product health, buyer satisfaction, refund risk, complaints, product fixes, listing fixes, and ad angles.
          </p>

          <div id="upload-csv" className="mx-auto mt-5 max-w-2xl sm:mt-10">
            <label className="group flex min-h-[210px] sm:min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed border-teal/40 bg-white p-5 sm:rounded-[2.5rem] sm:border-4 sm:p-8 text-center shadow-soft transition hover:border-teal sm:hover:-translate-y-1 sm:hover:shadow-glow dark:border-cyan-300/40 dark:bg-slate-950">
              <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-teal text-3xl sm:mb-5 sm:size-24 sm:rounded-full sm:text-5xl font-black text-white shadow-glow">
                📄
              </div>

              <p className="text-xl font-black text-ink sm:text-3xl dark:text-white">
                {fileName || "Upload product review CSV"}
              </p>

              <p className="mt-2 max-w-xl text-xs font-bold leading-relaxed text-slate-500 sm:mt-3 sm:text-sm dark:text-slate-400">
                CSV only. Include review text, rating, date, product name, customer comments, or order feedback if available.
              </p>

              <input
                className="hidden"
                type="file"
                accept=".csv,text/csv"
                disabled={isLoading}
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] || null;
                  setFile(nextFile);
                  setFileName(nextFile?.name || "");
                  setError("");
                }}
              />
            </label>

            {error && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-black text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={!file || isLoading}
              onClick={analyzeCsv}
              className="mt-4 min-h-14 w-full rounded-2xl bg-ink px-5 py-4 text-base font-black sm:mt-6 sm:min-h-16 sm:rounded-3xl sm:px-8 sm:py-5 sm:text-xl text-white shadow-glow transition sm:hover:-translate-y-0.5 sm:hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-white dark:text-ink dark:disabled:bg-white/20 dark:disabled:text-white/40"
            >
              {isLoading ? "Building seller intelligence report..." : "⚡ Analyze Seller Reviews"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
