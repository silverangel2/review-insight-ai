"use client";


function sellerShortName(name: string, max = 22) {
  const cleaned = String(name || "Product")
    .replace(/\.(csv|xlsx|xls|txt)$/i, "")
    .replace(/^reviewintel[_\s-]*/i, "")
    .replace(/^sample[_\s-]*/i, "")
    .replace(/^seller[_\s-]*comments[_\s-]*/i, "Seller comments ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardMetric, DashboardShell, MiniBarChart } from "@/components/DashboardShell";
import { InsightList } from "@/components/InsightList";
import { ProOnlyGate } from "@/components/ProOnlyGate";
import { SellerImprovementCalendar } from "@/components/SellerImprovementCalendar";
import { SponsorAnalytics } from "@/components/SponsorAnalytics";
import { readSellerProducts, type SellerProduct } from "@/lib/sellerProducts";
import { readSellerJournal } from "@/lib/sellerJournal";
import { getClientAccount } from "@/lib/clientAccount";
import { sellerHistoryKey } from "@/lib/sellerResultStorage";
import { AdSlot } from "@/components/advertising/AdSlot";
import { displayCodeForResult, productDisplayCode } from "@/lib/productDisplay";

function uniqueTop(items: string[], limit = 6) {
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

function average(items: number[]) {
  const valid = items.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}


function scanArray(scan: unknown, keys: string[]) {
  const record = scan as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
      return [value.trim()];
    }
  }
  return [];
}

function scanText(scan: unknown, keys: string[], fallback = "") {
  const record = scan as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && value.length) return String(value[0]);
  }
  return fallback;
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

function isCompareScan(scan: unknown) {
  const record = scan as Record<string, unknown>;
  const result = record.result as Record<string, unknown> | undefined;

  return (
    (record.type === "compare" || record.type === "seller_compare" || record.mode === "seller_compare") ||
    record.source === "seller-pro-compare" ||
    (result?.type === "compare" || result?.type === "seller_compare" || result?.mode === "seller_compare") ||
    Boolean(record.compareId || result?.compareId)
  );
}

function readSellerAuditHistory() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(sellerHistoryKey());
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}


function productHealthRows(scans: unknown[]) {
  type ProductGroup = {
    name: string;
    scans: {
      scan: unknown;
      score: number;
      savedAt: number;
      concerns: string[];
      positives: string[];
      actions: string[];
    }[];
  };

  const groups = new Map<string, ProductGroup>();

  for (const scan of scans) {
    if (isCompareScan(scan)) continue;

    const name = scanText(scan, ["productName", "name", "title", "fileName"], "Unnamed product");
    const score = scanNumber(scan, ["productScore", "score", "rating", "confidenceScore"], 0);
    const concerns = scanArray(scan, ["painPoints", "complaints", "negativeSignals", "topComplaints", "issues"]);
    const positives = scanArray(scan, ["praises", "positiveSignals", "topPositiveFeedback", "praisedFeatures", "strengths", "positivePoints"]);
    const actions = scanArray(scan, ["actionPlan", "actions", "recommendations", "sellerActions", "improvementSuggestions"]);

    const record = scan as Record<string, unknown>;
    const savedAtRaw =
      record.savedAt ||
      record.createdAt ||
      record.analyzedAt ||
      record.date ||
      new Date().toISOString();

    const savedAt = new Date(String(savedAtRaw)).getTime();

    const current = groups.get(name) ?? { name, scans: [] };

    current.scans.push({
      scan,
      score,
      savedAt: Number.isFinite(savedAt) ? savedAt : Date.now(),
      concerns,
      positives,
      actions
    });

    groups.set(name, current);
  }

  return Array.from(groups.values())
    .map((group) => {
      const ordered = [...group.scans].sort((a, b) => b.savedAt - a.savedAt);
      const latest = ordered[0];
      const previous = ordered[1];

      const validScores = ordered.map((item) => item.score).filter((score) => score > 0);
      const avgScore = validScores.length
        ? Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length)
        : 0;

      const latestScore = latest?.score || avgScore || 0;
      const previousScore = previous?.score || 0;
      const scoreChange = previous ? latestScore - previousScore : 0;

      const allConcerns = ordered.flatMap((item) => item.concerns);
      const allPositives = ordered.flatMap((item) => item.positives);
      const allActions = ordered.flatMap((item) => item.actions);

      const recurringConcerns = uniqueTop(allConcerns, 3);
      const mainConcern = recurringConcerns[0] ?? "No clear concern detected";
      const topPositive = uniqueTop(allPositives, 1)[0] ?? "No strong positive signal yet";
      const nextAction = uniqueTop(allActions, 1)[0] ?? "Run another scan to confirm the next improvement";

      const trend =
        !previous ? "New" :
        scoreChange >= 5 ? "Improving" :
        scoreChange <= -5 ? "Declining" :
        "Stable";

      const priority =
        latestScore < 50 || scoreChange <= -8 ? "Fix first" :
        latestScore < 70 || scoreChange < 0 ? "Improve" :
        latestScore < 85 ? "Watch" :
        "Strong";

      const urgencyScore =
        (100 - latestScore) +
        (scoreChange < 0 ? Math.abs(scoreChange) * 2 : 0) +
        (recurringConcerns.length * 3);

      return {
        name: group.name,
        avgScore,
        latestScore,
        previousScore,
        scoreChange,
        trend,
        scanCount: ordered.length,
        latestScanDate: latest?.savedAt ?? 0,
        mainConcern,
        recurringConcerns,
        topPositive,
        nextAction,
        priority,
        urgencyScore
      };
    })
    .sort((a, b) => {
      if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
      return a.latestScore - b.latestScore;
    });
}

function priorityTone(priority: string) {
  if (priority === "Strong") return "text-teal";
  if (priority === "Watch") return "text-ocean";
  if (priority === "Improve") return "text-amber-600";
  return "text-coral";
}

function dashboardAdvisor(rows: ReturnType<typeof productHealthRows>, concerns: string[]) {
  const weakest = rows[0];
  const strongest = [...rows].sort((a, b) => b.avgScore - a.avgScore)[0];

  if (weakest && (weakest.latestScore < 70 || weakest.trend === "Declining")) {
    const changeText = weakest.previousScore
      ? ` Trend: ${weakest.trend}${weakest.scoreChange ? ` (${weakest.scoreChange > 0 ? "+" : ""}${weakest.scoreChange} points)` : ""}.`
      : " This is a newly tracked product.";

    return `Focus first on ${weakest.name}. Latest score is ${weakest.latestScore}%.${changeText} Main buyer concern: ${weakest.mainConcern}.`;
  }

  if (strongest && strongest.latestScore >= 85) {
    return `${strongest.name} is your strongest product signal right now at ${strongest.latestScore}%. Use its best buyer feedback as proof in your listing, ads, and product positioning.`;
  }

  if (concerns.length) {
    return `The strongest repeated buyer concern is ${concerns[0]}. Turn that into one visible listing improvement and one product/support action.`;
  }

  return "Run more seller scans to build a clearer product improvement map. The dashboard becomes more useful as your saved scan history grows.";
}

export default function SellerDashboardPage() {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [accountAnalyses, setAccountAnalyses] = useState<Record<string, unknown>[]>([]);
  const [journalScans, setJournalScans] = useState<unknown[]>([]);
  const [account, setAccount] = useState<ReturnType<typeof getClientAccount> | null>(null);

  useEffect(() => {
    setAccount(getClientAccount());
    setProducts(readSellerProducts());
    setJournalScans(readSellerJournal());

    const refresh = () => {
      setAccount(getClientAccount());
      setProducts(readSellerProducts());
    setJournalScans(readSellerJournal());
    };

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    const accountEmail = String(account?.email || "");
    if (!accountEmail) return;

    let cancelled = false;

    async function loadAccountAnalyses() {
      try {
        const response = await fetch(`/api/account/analyses?email=${encodeURIComponent(accountEmail)}`, {
          cache: "no-store",
          credentials: "include",
        });

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.analyses)
            ? payload.analyses
            : Array.isArray(payload.history)
              ? payload.history
              : Array.isArray(payload.items)
                ? payload.items
                : [];

        if (!cancelled) {
          const countedHistory = (list as Record<string, unknown>[])
            .filter((item) => {
              const blob = JSON.stringify(item || {}).toLowerCase();
              const code = String(
                item.displayCode ||
                  item.code ||
                  item.refCode ||
                  item.id ||
                  ""
              ).toUpperCase();

              return (
                code.startsWith("PRD-") ||
                code.startsWith("CMR-") ||
                blob.includes("seller_compare") ||
                blob.includes("seller_analyze")
              );
            });

          setAccountAnalyses(countedHistory);
        }
      } catch (error) {
        console.warn("SELLER_DASHBOARD_API_ANALYSES_FETCH failed", error);
        if (!cancelled) setAccountAnalyses([]);
      }
    }

    loadAccountAnalyses();

    return () => {
      cancelled = true;
    };
  }, [account?.email]);

  const isSeller = account?.role === "seller";
  const isSellerPro = account?.plan === "seller_pro";

  const dashboard = useMemo(() => {
    const productScans = products.flatMap((product) => product.scans ?? []);

    // Audit/history scan count must use the same source as the History button.
    // This includes normal seller scans and Seller Pro Compare entries.
    const historyScans = readSellerAuditHistory();

    // Merge API history with local seller scan history.
    // Do not let API CMR-only records overwrite local PRD history and make counts flicker 10 → 4.
    const auditScans = [
      ...accountAnalyses,
      ...historyScans.filter((localScan) => {
        const localId = scanText(localScan, ["id", "displayCode", "code", "refCode"], "");
        return !accountAnalyses.some((apiScan) => {
          const apiId = scanText(apiScan, ["id", "displayCode", "code", "refCode"], "");
          return apiId && localId && apiId === localId;
        });
      }),
    ];

    // Product improvement tracking must stay product-only.
    // Compare results count for audit, but do not become tracked improvement products.
    const productImprovementScans = [...journalScans, ...productScans].filter((scan) => !isCompareScan(scan));
    const latestScans = productImprovementScans.slice(0, 30);

    // Recent product signals should show the same saved history source as the History button.
    // This includes PRD seller scans and CMR seller compare records.
    const recentSignalScans = auditScans.length ? auditScans.slice(0, 10) : latestScans.slice(0, 10);

    const painPoints = uniqueTop(
      latestScans.flatMap((scan) =>
        scanArray(scan, ["complaints", "topComplaints", "painPoints", "issues", "mainComplaint"])
      )
    );

    const featureRequests = uniqueTop(
      latestScans.flatMap((scan) =>
        scanArray(scan, ["featureRequests", "recommendations", "improvementSuggestions", "listingSuggestions", "opportunities"])
      )
    );

    const positiveSignals = uniqueTop(
      latestScans.flatMap((scan) =>
        scanArray(scan, ["praises", "positiveSignals", "topPositiveFeedback", "praisedFeatures", "strengths", "positivePoints"])
      )
    );

    const actionItems = uniqueTop(
      latestScans.flatMap((scan) =>
        scanArray(scan, ["actionPlan", "actions", "recommendations", "sellerActions", "improvementSuggestions"])
      )
    );

    const satisfaction = average(latestScans.map((scan) => scanNumber(scan, ["sentimentScore", "satisfactionScore", "sentiment"], 0)));
    const productScore = average(latestScans.map((scan) => scanNumber(scan, ["productScore", "score", "rating", "confidenceScore"], 0)));
    const reviewCount = latestScans.reduce<number>((sum, scan) => sum + scanNumber(scan, ["reviewCount", "reviewsAnalyzed", "review_count", "validReviewCount"], 0), 0);

    const productRows = productHealthRows(latestScans);
    const weakestProduct = productRows[0] ?? null;
    const strongestProduct = [...productRows].sort((a, b) => {
      if (b.latestScore !== a.latestScore) return b.latestScore - a.latestScore;
      return b.scoreChange - a.scoreChange;
    })[0] ?? null;

    return {
      scans: auditScans,
      latestScans,
      recentSignalScans,
      painPoints,
      featureRequests,
      positiveSignals,
      actionItems,
      satisfaction,
      productScore,
      reviewCount,
      productRows,
      weakestProduct,
      strongestProduct,
      advisorNote: dashboardAdvisor(productRows, painPoints)
    };
  }, [products, journalScans, accountAnalyses]);

  if (account && !isSeller) {
    return (
      <ProOnlyGate>
        <DashboardShell
          title="Seller dashboard"
          subtitle={isSellerPro ? "Seller Pro tools include competitor compare and advanced improvement tracking." : "Seller Premium includes seller analysis, reports, and improvement planning."}
          experience="seller"
        >
<section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <h2 className="text-2xl font-black text-ink dark:text-white">Seller dashboard is not available on shopper accounts.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Shopper accounts are for buying decisions. Seller dashboards are for product review intelligence, complaint tracking, and listing improvement.
            </p>
            <Link href="/seller/analyze" className="mt-5 inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
              Go to Shopper Analysis
            </Link>
          </section>
        </DashboardShell>
      </ProOnlyGate>
    );
  }

  const hasData = dashboard.scans.length > 0;
  const safeSatisfaction = typeof dashboard.satisfaction === "number" ? dashboard.satisfaction : null;
  const safeProductScore = typeof dashboard.productScore === "number" ? dashboard.productScore : null;
  const satisfactionTone = safeSatisfaction === null ? "warn" : safeSatisfaction >= 70 ? "good" : "warn";
  const productScoreTone = safeProductScore === null ? "warn" : safeProductScore >= 75 ? "good" : "warn";

  return (
    <ProOnlyGate>
      <DashboardShell
        title="Seller dashboard"
        subtitle={
          isSellerPro
            ? "Your Seller Pro workspace for product health, review signals, and improvement tracking."
            : hasData
              ? "A clean view of your saved seller scans, product scores, buyer concerns, and next improvement moves."
              : "Run a seller analysis to start building your seller intelligence dashboard."
        }
        experience="seller"
      >
        <SponsorAnalytics placement="seller_dashboard" />

        <section className="seller-premium-hero mb-6 rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-ocean">Seller Pro summary</p>
          <h2 className="mt-2 text-3xl font-black text-ink dark:text-white">Your product improvement command center.</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            {dashboard.advisorNote}
          </p>
        </section>

        <section className="seller-premium-metrics mb-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <DashboardMetric
            label="Products tracked"
            value={String(dashboard.productRows.length)}
            detail={dashboard.productRows.length ? "Products with saved seller scan history." : "Run seller scans to start tracking products."}
            tone="info"
          />
          <DashboardMetric
            label="Scans this month"
            value={String(dashboard.scans.length)}
            detail="Normal saved seller scans used for product improvement."
            tone="info"
          />
          <DashboardMetric
            label="Avg product score"
            value={safeProductScore === null ? "—" : `${safeProductScore}%`}
            detail="Average score from saved seller product scans."
            tone={productScoreTone}
          />
          <DashboardMetric
            label="Improvement focus"
            value={dashboard.weakestProduct ? dashboard.weakestProduct.priority : "—"}
            detail={dashboard.weakestProduct ? productDisplayCode(dashboard.weakestProduct.name) : "No product focus yet."}
            tone={dashboard.weakestProduct && dashboard.weakestProduct.latestScore < 70 ? "bad" : "warn"}
          />
        </section>

        {dashboard.productRows.length ? (
          <section className="seller-premium-ranking mb-6 rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Product health ranking</p>
                <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">See which product needs attention first.</h2>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Priority order</p>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-line dark:border-white/10">
              <div className="grid grid-cols-[1.2fr_0.6fr_0.7fr_1.4fr_0.8fr] bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <span>Product</span>
                <span>Latest</span>
                <span>Trend</span>
                <span>Main buyer concern</span>
                <span>Priority</span>
              </div>
              {dashboard.productRows.slice(0, 8).map((product) => (
                <div key={product.name} className="grid grid-cols-[1.2fr_0.6fr_0.7fr_1.4fr_0.8fr] gap-3 border-t border-line px-4 py-4 text-sm dark:border-white/10">
                  <div>
                    <p className="font-black text-ink dark:text-white">{productDisplayCode(product.name)}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{product.scanCount} scan{product.scanCount === 1 ? "" : "s"}</p>
                  </div>
                  <p className="font-black text-ocean">{product.latestScore ? `${product.latestScore}%` : "—"}</p>
                  <div>
                    <p className="font-black text-slate-700 dark:text-slate-200">{product.trend}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {product.previousScore ? `${product.scoreChange > 0 ? "+" : ""}${product.scoreChange} pts` : "New"}
                    </p>
                  </div>
                  <p className="font-semibold leading-6 text-slate-600 dark:text-slate-300">{product.mainConcern}</p>
                  <p className={`font-black ${priorityTone(product.priority)}`}>{product.priority}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="seller-premium-focus-grid mb-6 grid gap-5 lg:grid-cols-2">
          <article className="min-w-0 overflow-hidden rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-coral">Focus first</p>
            <h3 className="mt-3 max-w-full break-words text-2xl font-black text-ink [overflow-wrap:anywhere] dark:text-white">
              {dashboard.weakestProduct ? productDisplayCode(dashboard.weakestProduct.name) : "No product selected yet"}
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {dashboard.weakestProduct
                ? `${dashboard.weakestProduct.latestScore}% average. Main concern: ${dashboard.weakestProduct.mainConcern}`
                : "Run seller scans to identify the product that needs the most improvement."}
            </p>
          </article>

          <article className="min-w-0 overflow-hidden rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-teal">Best performer</p>
            <h3 className="mt-3 max-w-full break-words text-2xl font-black text-ink [overflow-wrap:anywhere] dark:text-white">
              {dashboard.strongestProduct ? productDisplayCode(dashboard.strongestProduct.name) : "No strong product signal yet"}
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {dashboard.strongestProduct
                ? `${dashboard.strongestProduct.latestScore}% average. Best signal: ${sellerShortName(dashboard.strongestProduct.topPositive, 44)}`
                : "Your strongest product will appear once seller scans are saved."}
            </p>
          </article>
        </section>

        <section className="seller-premium-insight-grid mb-6 grid gap-5 lg:grid-cols-3">
          <InsightList
            title="Buyer concerns"
            tone="bad"
            items={dashboard.painPoints.length ? dashboard.painPoints : ["Buyer concerns will appear after saved seller scans."]}
          />
          <InsightList
            title="Next moves"
            tone="info"
            items={dashboard.actionItems.length ? dashboard.actionItems : ["Seller actions will appear after saved seller scans."]}
          />
          <InsightList
            title="Winning signals"
            tone="good"
            items={dashboard.positiveSignals.length ? dashboard.positiveSignals : ["Positive buyer signals will appear after saved seller scans."]}
          />
        </section>

        <section className="seller-premium-utility-grid mb-6 grid gap-5 lg:grid-cols-2">
          <article className="min-w-0 overflow-hidden rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            {isSellerPro ? <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">Compare intelligence</p> : null}
            {isSellerPro ? <h3 className="mt-3 max-w-full break-words text-2xl font-black text-ink [overflow-wrap:anywhere] dark:text-white">Compare results guide strategy, but do not affect product health averages.</h3> : null}
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Use compare scans to find positioning opportunities, competitor weaknesses, and product advantages. They should guide strategy but not change normal product health averages.
            </p>
          </article>

          <article className="min-w-0 overflow-hidden rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-ocean">Report center</p>
            <h3 className="mt-3 max-w-full break-words text-2xl font-black text-ink [overflow-wrap:anywhere] dark:text-white">Export-ready seller insights.</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-white/10 dark:text-slate-200">Health report</span>
              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-white/10 dark:text-slate-200">Concern summary</span>
              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-white/10 dark:text-slate-200">Action plan</span>
            </div>
          </article>
        </section>

        {isSellerPro ? (
          <section className="mb-6 rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-ocean">Seller Pro workspace</p>
              <h2 className="mt-2 text-3xl font-black text-ink dark:text-white">Improvement calendar</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Track scan history, product score movement, buyer concerns, and notes in one clean calendar view.
              </p>
            </div>
            <SellerImprovementCalendar />
          </section>
        ) : null}

        {false && hasData ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <DashboardMetric
            label="Pain points"
            value={String(dashboard.painPoints.length)}
            detail={hasData ? "Unique complaint themes found from saved scans." : "Real complaint clusters will appear here."}
            tone={dashboard.painPoints.length ? "warn" : "good"}
          />
          <DashboardMetric
            label="Feature requests"
            value={String(dashboard.featureRequests.length)}
            detail={hasData ? "Improvement opportunities detected from reviews." : "Customer-requested improvements appear after scans."}
            tone="info"
          />
          <DashboardMetric
            label="Satisfaction"
            value={safeSatisfaction === null ? "—" : `${safeSatisfaction}%`}
            detail={hasData ? "Average sentiment from saved seller scans." : "Calculated after real seller scans."}
            tone={satisfactionTone}
          />
          <DashboardMetric
            label="Reviews tracked"
            value={String(dashboard.reviewCount)}
            detail={hasData ? "Estimated reviews included across saved scans." : "Review volume appears after scans."}
            tone="info"
          />
        </section>
        ) : null}

        {false && hasData ? (
        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <InsightList
            title={hasData ? "Seller recommendations" : "Seller recommendations"}
            tone="info"
            items={
              hasData
                ? dashboard.actionItems.length
                  ? dashboard.actionItems
                  : ["Saved scans exist, but no strong action cluster was detected yet."]
                : [
                    "No seller scan data yet.",
                    "Run a seller analysis to generate complaint clusters, feature requests, keyword intelligence, and improvement priorities.",
                    "Seller Pro calendar entries should come from saved real scan summaries."
                  ]
            }
          />

          <MiniBarChart
            items={[
              { label: "Complaints", value: Math.min(100, dashboard.painPoints.length * 18), tone: "bad" },
              { label: "Feature requests", value: Math.min(100, dashboard.featureRequests.length * 18), tone: "info" },
              { label: "Positive signals", value: Math.min(100, dashboard.positiveSignals.length * 18), tone: "good" },
              { label: "Product score", value: dashboard.productScore ?? 0, tone: "warn" }
            ]}
          />
        </section>
        ) : null}

        {false && hasData ? (
        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          <InsightList
            title="Top pain points"
            tone="bad"
            items={hasData && dashboard.painPoints.length ? dashboard.painPoints : ["Pain points will appear after real seller scans."]}
          />
          <InsightList
            title="Positive buyer signals"
            tone="good"
            items={hasData && dashboard.positiveSignals.length ? dashboard.positiveSignals : ["Positive signals will appear after real seller scans."]}
          />
          <InsightList
            title="Feature and listing opportunities"
            tone="info"
            items={hasData && dashboard.featureRequests.length ? dashboard.featureRequests : ["Feature requests and listing opportunities will appear after scans."]}
          />
        </section>
        ) : null}

        {!hasData && !isSellerPro ? (
          <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <h2 className="text-2xl font-black text-ink dark:text-white">Start your seller data</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              This dashboard no longer uses fake metrics. Run a seller analysis and saved scan data will populate this page.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/seller/analyze" className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
                Run Seller Analysis
              </Link>
              <Link href="/dashboard/seller/compare" className="rounded-xl border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-ocean hover:text-ocean dark:border-white/10 dark:text-white">
                Seller Premium
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-6 rounded-2xl border border-line bg-white shadow-soft dark:border-white/10 dark:bg-slate-950">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-ocean">Seller intelligence</p>
                  <h2 className="mt-1 text-2xl font-black text-ink dark:text-white">Recent product signals</h2>
                </div>
                <span className="rounded-full border border-line px-3 py-2 text-xs font-black text-slate-600 transition group-open:rotate-180 dark:border-white/10 dark:text-slate-300">
                  ↓
                </span>
              </summary>

              <div className="border-t border-line p-5 dark:border-white/10">
                <div className="overflow-x-auto rounded-2xl border border-line dark:border-white/10">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Date / time</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Score</th>
                        <th className="px-4 py-3">Sentiment</th>
                        <th className="px-4 py-3">Main concern</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.recentSignalScans
                    .filter((scan) => {
                      const blob = JSON.stringify(scan || {}).toLowerCase();
                      const display = String(
                        scan.displayCode ||
                          scan.code ||
                          scan.refCode ||
                          scan.id ||
                          ""
                      ).toUpperCase();

                      return (
                        display.startsWith("PRD-") ||
                        display.startsWith("CMR-") ||
                        blob.includes("seller_compare") ||
                        blob.includes("seller_analyze")
                      );
                    })
                    .slice(0, 10)
                    .map((scan, index) => {
                        const rawDate = scanText(scan, ["savedAt", "createdAt", "date"], "");
                        const dateLabel = rawDate
                          ? new Date(rawDate).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit"
                            })
                          : "Saved scan";

                        return (
                          <tr key={scanText(scan, ["id"], `scan-${index}`)} className="border-t border-line dark:border-white/10">
                            <td className="whitespace-nowrap px-4 py-3 text-xs font-black text-slate-500 dark:text-slate-400">{dateLabel}</td>
                            <td className="max-w-[220px] truncate px-4 py-3 font-black text-ink dark:text-white">
                              {displayCodeForResult(scan, scanText(scan, ["productName", "name", "title", "fileName"], "Saved product scan"))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-black text-ocean">{scanNumber(scan, ["productScore", "score", "rating"], 0)}</td>
                            <td className="whitespace-nowrap px-4 py-3 font-black text-slate-700 dark:text-slate-200">{scanNumber(scan, ["sentimentScore", "sentiment", "satisfactionScore"], 0)}</td>
                            <td className="max-w-[360px] truncate px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">
                              {sellerShortName(scanText(scan, ["mainComplaint", "complaints", "topComplaints", "issues"], "No main complaint recorded"), 80)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          </section>
        )}

        {!isSellerPro ? (
          <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <h2 className="text-2xl font-black text-ink dark:text-white">Seller Pro unlocks the improvement calendar.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Seller Premium gets the seller intelligence dashboard and improvement planning. Seller Pro adds competitor compare, saved calendar, notes, scan momentum, and deeper tracking tools.
            </p>
          </section>
        ) : null}

        <AdSlot placement="seller_dashboard" compact className="mt-6" />
      </DashboardShell>
    </ProOnlyGate>
  );
}
