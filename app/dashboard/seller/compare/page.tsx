"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  saveSellerCompareHistoryItem,
  setActiveSellerCompare,
  type SellerCompareHistoryItem,
} from "@/lib/sellerCompareHistory";
import { sellerHistoryKey } from "@/lib/sellerResultStorage";
import { readStoredLocale } from "@/lib/i18n";

function sellerCompareRecordId() {
  return `CMR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function saveSellerCompareToHistory(payload: {
  email: string;
  plan?: string;
  role?: string;
  result: SellerCompareHistoryItem;
  request?: unknown;
}) {
  const email = payload.email.trim().toLowerCase();
  if (!email) return;

  const cmrId = sellerCompareRecordId();
  const title = `Compare: ${payload.result.yourLabel} vs ${payload.result.competitorLabel}`;


  const record = {
    id: cmrId,
    code: cmrId,
    displayCode: cmrId,
    refCode: cmrId,

    type: "seller_compare",
    mode: "seller_compare",
    source: "seller_compare",
    analysisType: "seller_compare",
    reportType: "seller_compare",
    category: "seller_compare",

    title,
    productName: title,
    product: title,
    name: title,
    summary: "Seller competitor comparison",
    verdict: "Seller Compare",
    yourLabel: payload.result.yourLabel,
    competitorLabel: payload.result.competitorLabel,
    comparison: payload.result.comparison,
    yourProduct: payload.result.yourProduct,
    competitorProduct: payload.result.competitorProduct,
    compareId: payload.result.id,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timestamp: Date.now(),

    email,
    plan: payload.plan || "seller_pro",
    role: payload.role || "seller",

    counted: false,
    scanCount: 0,
    isCompare: true,
    isSellerCompare: true,

    result: payload.result,
    analysis: payload.result,
    report: payload.result,
    request: payload.request,
  };

  const response = await fetch("/api/account/analyses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(record),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || "Seller compare cloud history save failed.");
  }
}

type SellerResult = {
  summary?: string;
  reviewsAnalyzed?: number;
  healthScore?: number;
  buyerSatisfaction?: number;
  refundRisk?: number;
  topComplaints?: string[];
  topPraise?: string[];
  buyerObjections?: string[];
  productFixes?: string[];
  listingFixes?: string[];
  adAngles?: string[];
  nextActions?: string[];
};

type AiComparison = {
  competitivePosition?: string;
  confidence?: number;
  executiveSummary?: string;
  marketMove?: string;
  fixFirst?: string[];
  outgrowStrategy?: string[];
  competitorAdvantages?: string[];
  yourAdvantages?: string[];
  conversionGaps?: string[];
  productMoves?: string[];
  listingMoves?: string[];
  adAngles?: string[];
  riskWarnings?: string[];
  thirtyDayPlan?: string[];
  ninetyDayPlan?: string[];
  comparabilityWarning?: string;
};


function saveCompareToNormalSellerHistory(item: SellerCompareHistoryItem) {
  if (typeof window === "undefined") return;

  try {
    const key = sellerHistoryKey();
    const raw = window.localStorage.getItem(key);
    const current = raw ? JSON.parse(raw) : [];

    const historyItem = {
      id: item.id,
      type: "seller_compare",
      mode: "seller_compare",
      source: "seller_compare",
      fileName: `Compare: ${item.yourLabel} vs ${item.competitorLabel}`,
      savedAt: item.createdAt,
      createdAt: item.createdAt,
      compareId: item.id,
      result: {
        ...item,
        type: "seller_compare",
        mode: "seller_compare",
        compareId: item.id,
      },
    };

    const next = [
      historyItem,
      ...(Array.isArray(current) ? current.filter((entry) => entry?.id !== item.id) : [])
    ].slice(0, 40);

    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Do not block compare result if browser storage fails.
  }
}

function cleanFileName(file: File | null, fallback: string) {
  if (!file?.name) return fallback;
  return file.name
    .replace(/\.(csv|xlsx|xls|txt)$/i, "")
    .replace(/^reviewintel[_\s-]*/i, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 48);
}

async function analyzeSellerCsv(file: File) {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("csv", file, file.name);
  formData.append("locale", readStoredLocale());
  formData.append("purpose", "seller_compare_side");

  const response = await fetch("/api/seller-analyze", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

if (!response.ok) {
    throw new Error(data?.error || "Seller analysis failed.");
  }

  return data as SellerResult;
}

async function compareWithAi(params: {
  yourProduct: SellerResult;
  competitorProduct: SellerResult;
  yourLabel: string;
  competitorLabel: string;
}) {
  const response = await fetch("/api/seller-compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, locale: readStoredLocale() }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "AI competitor strategy failed.");
  }

  return data as AiComparison;
}

function safeText(value: unknown, fallback: string) {
  if (Array.isArray(value)) {
    const joined = value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .join("\n");
    return joined || fallback;
  }

  return typeof value === "string" && value.trim() ? value : fallback;
}

function safeArray(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) {
    const cleaned = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return cleaned.length ? cleaned : fallback;
  }

  if (typeof value === "string" && value.trim()) {
    const cleaned = value
      .split(/\n|•|- /)
      .map((item) => item.trim())
      .filter(Boolean);
    return cleaned.length ? cleaned : fallback;
  }

  return fallback;
}

function normalizeComparison(comparison: AiComparison) {
  return {
    competitivePosition: safeText(comparison.competitivePosition, "Competitive position needs more review evidence."),
    confidence: typeof comparison.confidence === "number" ? comparison.confidence : 80,
    executiveSummary: safeText(comparison.executiveSummary, "ReviewIntel created a competitor strategy from the available review evidence."),
    marketMove: safeText(comparison.marketMove, "Focus on the biggest buyer conversion gap first."),
    fixFirst: safeText(comparison.fixFirst, "Fix the biggest buyer objection first."),
    outgrowStrategy: safeArray(comparison.outgrowStrategy, ["Use review evidence to close conversion gaps faster than the competitor."]),
    competitorAdvantages: safeArray(comparison.competitorAdvantages, ["No clear competitor advantage detected."]),
    yourAdvantages: safeArray(comparison.yourAdvantages, ["No clear advantage detected yet."]),
    conversionGaps: safeArray(comparison.conversionGaps, ["No clear conversion gap detected."]),
    productMoves: safeArray(comparison.productMoves, ["No product move detected yet."]),
    listingMoves: safeArray(comparison.listingMoves, ["No listing move detected yet."]),
    adAngles: safeArray(comparison.adAngles, ["No ad angle detected yet."]),
    riskWarnings: safeArray(comparison.riskWarnings, ["No major risk warning detected."]),
    thirtyDayPlan: safeArray(comparison.thirtyDayPlan, ["Focus on quick listing and buyer-objection fixes."]),
    ninetyDayPlan: safeArray(comparison.ninetyDayPlan, ["Build a stronger product and listing roadmap based on review evidence."]),
    comparabilityWarning: safeText(comparison.comparabilityWarning, ""),
  };
}

export default function SellerComparePage() {
  const router = useRouter();
  const [yourFile, setYourFile] = useState<File | null>(null);
  const [competitorFile, setCompetitorFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function runCompare() {
    if (!yourFile || !competitorFile) {
      setError("Upload your product CSV and competitor CSV first.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const yourLabel = cleanFileName(yourFile, "Your product");
      const competitorLabel = cleanFileName(competitorFile, "Competitor product");

      const [yourAnalysis, competitorAnalysis] = await Promise.all([
        analyzeSellerCsv(yourFile),
        analyzeSellerCsv(competitorFile),
      ]);

      const comparison = await compareWithAi({
        yourProduct: yourAnalysis,
        competitorProduct: competitorAnalysis,
        yourLabel,
        competitorLabel,
      });

      const item = saveSellerCompareHistoryItem({
        yourLabel,
        competitorLabel,
        yourProduct: {
          label: yourLabel,
          ...yourAnalysis,
        },
        competitorProduct: {
          label: competitorLabel,
          ...competitorAnalysis,
        },
        comparison: normalizeComparison(comparison),
      });

      if (!item) {
        throw new Error("Could not save compare result. Please check browser storage.");
      }

      try {
        const storedAccount =
          typeof window !== "undefined"
            ? JSON.parse(
                localStorage.getItem("reviewintel:account") ||
                  localStorage.getItem("reviewintel-account") ||
                  localStorage.getItem("reviewintel_account") ||
                  "null"
              )
            : null;

        if (storedAccount?.email) {
          await saveSellerCompareToHistory({
            email: storedAccount.email,
            plan: storedAccount.plan || "seller_pro",
            role: storedAccount.role || "seller",
            result: item,
            request: { source: "seller_compare", yourLabel, competitorLabel },
          });
        }
      } catch (historyError) {
        console.warn("Seller compare history save failed", historyError);
      }

      setActiveSellerCompare(item.id);
      saveCompareToNormalSellerHistory(item);
      router.push("/dashboard/seller/compare/result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seller compare failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-10 text-[#172033]">
      <section className="mx-auto max-w-6xl rounded-[32px] border border-[#d9e2ec] bg-white/95 p-8 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.35em] text-teal-600">
          ReviewIntel Seller Pro Compare
        </p>

        <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
          Your product vs competitor
        </h1>

        <p className="mt-4 max-w-3xl text-base font-semibold text-slate-600">
          Upload your review CSV and a competitor review CSV. ReviewIntel will analyze both,
          create a focused AI strategy, save it to compare history, and open a dedicated result page.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <UploadBox
            title="Your product CSV"
            description="Your Amazon/customer review export."
            file={yourFile}
            onChange={setYourFile}
          />

          <UploadBox
            title="Competitor CSV"
            description="Competitor review export."
            file={competitorFile}
            onChange={setCompetitorFile}
          />
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={runCompare}
          disabled={!yourFile || !competitorFile || busy}
          className="mt-6 w-full rounded-2xl bg-slate-900 px-6 py-4 text-base font-black text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-900 disabled:shadow-none"
        >
          {busy ? "Comparing your product vs competitor..." : "Compare Your Product vs Competitor"}
        </button>

        <div className="mt-7 rounded-2xl border border-teal-100 bg-teal-50/70 p-5">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-teal-700">
            What this creates
          </p>
          <div className="mt-3 grid gap-3 text-sm font-semibold text-slate-700 md:grid-cols-3">
            <p>Conversion gaps buyers notice</p>
            <p>Product/listing moves to beat competitors</p>
            <p>30-day and 90-day seller action plan</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function UploadBox({
  title,
  description,
  file,
  onChange,
}: {
  title: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block cursor-pointer rounded-3xl border border-slate-200 bg-slate-50 p-6 transition hover:border-teal-300 hover:bg-teal-50">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">
        {title}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-600">{description}</p>
      <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-bold text-slate-700">
        {file ? cleanFileName(file, file.name) : "Choose CSV file"}
      </div>
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}
