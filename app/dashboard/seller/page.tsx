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

function scanNumberSources(scan: unknown): Record<string, unknown>[] {
  const root = scan && typeof scan === "object" ? (scan as Record<string, unknown>) : {};
  const sources: Record<string, unknown>[] = [root];
  const nestedKeys = ["result", "analysis", "report", "analysis_json", "analysisJson", "payload", "data", "seller_insights"];

  for (const key of nestedKeys) {
    const nested = root[key];
    if (nested && typeof nested === "object") {
      sources.push(nested as Record<string, unknown>);

      for (const childKey of nestedKeys) {
        const child = (nested as Record<string, unknown>)[childKey];
        if (child && typeof child === "object") {
          sources.push(child as Record<string, unknown>);
        }
      }
    }
  }

  return sources;
}

function normalizeDashboardNumber(value: unknown, key: string) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number)) return null;

  if (key === "rating" && number > 0 && number <= 5) return Math.round(number * 20);
  if (/confidence|sentiment|satisfaction/i.test(key) && number > 0 && number <= 1) return Math.round(number * 100);

  return Math.round(number);
}

function scanNumber(scan: unknown, keys: string[], fallback = 0) {
  for (const source of scanNumberSources(scan)) {
    for (const key of keys) {
      const normalized = normalizeDashboardNumber(source[key], key);
      if (normalized !== null) return normalized;
    }
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
    const score = scanNumber(scan, ["productScore", "product_score", "healthScore", "score", "buyingConfidence", "confidenceScore", "confidence_score", "rating"], 0);
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

function sellerTrendSeries(scans: unknown[]) {
  return scans
    .filter((scan) => !isCompareScan(scan))
    .map((scan) => {
      const score = scanNumber(
        scan,
        ["productScore", "product_score", "healthScore", "score", "buyingConfidence", "confidenceScore", "confidence_score", "rating"],
        0
      );
      const rawDate = scanText(scan, ["savedAt", "createdAt", "analyzedAt", "date"], "");
      const date = rawDate ? new Date(rawDate) : new Date();

      return {
        score,
        date,
        label: Number.isFinite(date.getTime())
          ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : "Scan",
      };
    })
    .filter((point) => point.score > 0 && Number.isFinite(point.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-10);
}

function trendPolyline(points: ReturnType<typeof sellerTrendSeries>) {
  if (!points.length) return "";

  if (points.length === 1) {
    const y = 100 - Math.max(0, Math.min(100, points[0].score));
    return `0,${y} 100,${y}`;
  }

  return points
    .map((point, index) => {
      const x = Math.round((index / Math.max(1, points.length - 1)) * 100);
      const y = Math.round(100 - Math.max(0, Math.min(100, point.score)));
      return `${x},${y}`;
    })
    .join(" ");
}

function sellerTrendLabel(points: ReturnType<typeof sellerTrendSeries>) {
  if (points.length < 2) return "Need one more scan to show movement.";

  const first = points[0].score;
  const last = points[points.length - 1].score;
  const delta = last - first;

  if (delta >= 8) return `Improving by ${delta} points across recent scans. Keep proving what buyers like.`;
  if (delta <= -8) return `Down ${Math.abs(delta)} points across recent scans. Fix the repeated complaint before adding more traffic.`;
  return `Stable across recent scans. Use the next scan to confirm if your last improvement changed buyer signals.`;
}

function dashboardAdvisor(rows: ReturnType<typeof productHealthRows>, concerns: string[]) {
  const weakest = rows[0];
  const strongest = [...rows].sort((a, b) => b.avgScore - a.avgScore)[0];

  if (weakest && (weakest.latestScore < 70 || weakest.trend === "Declining")) {
    const changeText = weakest.previousScore
      ? ` Trend: ${weakest.trend}${weakest.scoreChange ? ` (${weakest.scoreChange > 0 ? "+" : ""}${weakest.scoreChange} points)` : ""}.`
      : " This is a newly tracked product.";

    return `Focus first on ${sellerShortName(weakest.name, 34)}. Latest score is ${weakest.latestScore}%.${changeText} Main buyer concern: ${sellerShortName(weakest.mainConcern, 58)}.`;
  }

  if (strongest && strongest.latestScore >= 85) {
    return `${sellerShortName(strongest.name, 34)} is your strongest product signal right now at ${strongest.latestScore}%. Use its best buyer feedback as proof in your listing, ads, and product positioning.`;
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
        const query = new URLSearchParams({
          email: accountEmail,
          plan: String(account?.plan || ""),
          role: String(account?.role || ""),
        });
        const response = await fetch(`/api/account/analyses?${query.toString()}`, {
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
  }, [account?.email, account?.plan, account?.role]);

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
    const productAuditScans = auditScans.filter((scan) => !isCompareScan(scan));

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

    const satisfaction = average(latestScans.map((scan) => scanNumber(scan, ["sentimentScore", "sentiment_score", "satisfactionScore", "customer_satisfaction_score", "buyerSatisfaction", "sentiment"], 0)));
    const productScore = average(latestScans.map((scan) => scanNumber(scan, ["productScore", "product_score", "healthScore", "score", "buyingConfidence", "confidenceScore", "confidence_score", "rating"], 0)));
    const reviewCount = latestScans.reduce<number>((sum, scan) => sum + scanNumber(scan, ["reviewCount", "reviewsAnalyzed", "review_count", "validReviewCount"], 0), 0);
    const trendSeries = sellerTrendSeries(productImprovementScans);
    const trendDelta = trendSeries.length > 1
      ? trendSeries[trendSeries.length - 1].score - trendSeries[0].score
      : 0;

    const productRows = productHealthRows(latestScans);
    const weakestProduct = productRows[0] ?? null;
    const strongestProduct = [...productRows].sort((a, b) => {
      if (b.latestScore !== a.latestScore) return b.latestScore - a.latestScore;
      return b.scoreChange - a.scoreChange;
    })[0] ?? null;

    return {
      scans: productAuditScans,
      auditScans,
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
      trendSeries,
      trendPoints: trendPolyline(trendSeries),
      trendLabel: sellerTrendLabel(trendSeries),
      trendDelta,
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
<section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
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
  const sellerCommandCards = [
    {
      eyebrow: "Fix first",
      title: dashboard.weakestProduct ? productDisplayCode(dashboard.weakestProduct.name) : "Run seller analysis",
      detail: dashboard.weakestProduct
        ? `${dashboard.weakestProduct.latestScore || "No"}% latest score. Main concern: ${sellerShortName(dashboard.weakestProduct.mainConcern, 58)}.`
        : "No saved product scan yet. Start with one seller analysis so the dashboard can rank your products.",
      href: "/seller/analyze",
      action: dashboard.weakestProduct ? "Improve listing" : "Run scan",
      tone: "seller-command-card-risk"
    },
    {
      eyebrow: "Promote proof",
      title: dashboard.strongestProduct ? productDisplayCode(dashboard.strongestProduct.name) : "Find a winner",
      detail: dashboard.strongestProduct
        ? `Use this proof in copy: ${sellerShortName(dashboard.strongestProduct.topPositive, 58)}.`
        : "Your strongest product proof appears after saved scans with positive buyer signals.",
      href: "/dashboard/seller",
      action: "Review signals",
      tone: "seller-command-card-good"
    },
    {
      eyebrow: "Buyer friction",
      title: dashboard.painPoints[0] ? sellerShortName(dashboard.painPoints[0], 42) : "No repeated concern",
      detail: dashboard.painPoints[0]
        ? "Turn this into one visible listing answer, one support answer, and one product improvement note."
        : "Repeated buyer concerns will surface here when ReviewIntel sees enough seller scan history.",
      href: "/seller/analyze",
      action: "Scan reviews",
      tone: "seller-command-card-warn"
    },
    {
      eyebrow: isSellerPro ? "Competitor move" : "Next upgrade",
      title: isSellerPro ? "Compare against a rival" : "Seller Pro compare",
      detail: isSellerPro
        ? "Use Seller Pro Compare to find competitor weaknesses, pricing gaps, and positioning angles. It saves to history but stays out of product health averages."
        : "Upgrade to Seller Pro when you want competitor compare, calendar tracking, and deeper positioning guidance.",
      href: isSellerPro ? "/dashboard/seller/compare" : "/pricing",
      action: isSellerPro ? "Compare" : "See plans",
      tone: "seller-command-card-info"
    }
  ];

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

        <section className="seller-premium-hero mb-6 rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-ocean">Seller Pro summary</p>
          <h2 className="mt-2 text-3xl font-black text-ink dark:text-white">Your product improvement command center.</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            {dashboard.advisorNote}
          </p>
        </section>

        <section className="seller-premium-command-grid mb-6 grid gap-4 lg:grid-cols-4">
          {sellerCommandCards.map((card) => (
            <article key={card.eyebrow} className={`seller-command-card min-w-0 rounded-[1.35rem] border bg-white p-5 shadow-soft dark:bg-gradient-to-r from-sky-600 to-teal-500 ${card.tone}`}>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{card.eyebrow}</p>
              <h3 className="mt-2 max-w-full break-words text-lg font-black leading-tight text-ink [overflow-wrap:anywhere] dark:text-white">{card.title}</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{card.detail}</p>
              <Link href={card.href} className="mt-4 inline-flex rounded-xl bg-ink px-4 py-2.5 text-xs font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
                {card.action}
              </Link>
            </article>
          ))}
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

        {isSellerPro && dashboard.trendSeries.length ? (
          <section className="seller-improvement-trend mb-6 rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-teal">Improvement graph</p>
                <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">Is your product health moving up or down?</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                  {dashboard.trendLabel}
                </p>
              </div>
              <Link href="/seller/analyze" className="w-fit rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
                Run next seller scan
              </Link>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-[1.5rem] border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <svg viewBox="0 0 100 100" className="h-52 w-full overflow-visible" role="img" aria-label="Seller product score trend">
                  {[20, 40, 60, 80].map((line) => (
                    <line key={line} x1="0" x2="100" y1={line} y2={line} stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
                  ))}
                  <polyline
                    points={dashboard.trendPoints}
                    fill="none"
                    stroke="url(#sellerTrendGradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {dashboard.trendSeries.map((point, index) => {
                    const x = dashboard.trendSeries.length === 1
                      ? 50
                      : Math.round((index / Math.max(1, dashboard.trendSeries.length - 1)) * 100);
                    const y = Math.round(100 - Math.max(0, Math.min(100, point.score)));

                    return (
                      <circle
                        key={`${point.label}-${index}`}
                        cx={x}
                        cy={y}
                        r="3"
                        fill="white"
                        stroke="#10c6a3"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  <defs>
                    <linearGradient id="sellerTrendGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="#df5f63" />
                      <stop offset="48%" stopColor="#ffb238" />
                      <stop offset="100%" stopColor="#10c6a3" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs font-black text-slate-500 dark:text-slate-300">
                  <span>{dashboard.trendSeries[0]?.label}</span>
                  <span>{dashboard.trendSeries[dashboard.trendSeries.length - 1]?.label}</span>
                </div>
              </div>

              <div className="grid gap-3">
                <article className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Latest score</p>
                  <p className="mt-2 text-3xl font-black text-ink dark:text-white">
                    {dashboard.trendSeries[dashboard.trendSeries.length - 1]?.score ?? 0}%
                  </p>
                </article>
                <article className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Movement</p>
                  <p className={`mt-2 text-3xl font-black ${dashboard.trendDelta >= 0 ? "text-teal" : "text-coral"}`}>
                    {dashboard.trendDelta > 0 ? "+" : ""}{dashboard.trendDelta} pts
                  </p>
                </article>
                <article className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Next focus</p>
                  <p className="mt-2 text-sm font-black leading-6 text-ink dark:text-white">
                    {dashboard.weakestProduct
                      ? sellerShortName(dashboard.weakestProduct.mainConcern, 90)
                      : "Run another scan to build a clearer improvement target."}
                  </p>
                </article>
              </div>
            </div>
          </section>
        ) : null}

        {dashboard.productRows.length ? (
          <section className="seller-growth-pulse mb-6 rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-teal">Seller growth pulse</p>
                <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">What to do next, in plain language.</h2>
              </div>
              <p className="max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                Product scans build the trend. Compare scans guide strategy, but they stay out of the health score so your tracking stays fair.
              </p>
            </div>

            <div className="seller-growth-pulse-grid mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <article className="rounded-[1.25rem] border border-coral/20 bg-rose-50 p-4 dark:border-rose-300/20 dark:bg-rose-400/10">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-coral">Fix next</p>
                <h3 className="mt-2 text-xl font-black text-ink dark:text-white">
                  {dashboard.weakestProduct ? productDisplayCode(dashboard.weakestProduct.name) : "Run a seller scan"}
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
                  {dashboard.weakestProduct
                    ? `${dashboard.weakestProduct.latestScore}% score. Start with: ${sellerShortName(dashboard.weakestProduct.mainConcern, 90)}`
                    : "No improvement target yet."}
                </p>
              </article>

              <article className="rounded-[1.25rem] border border-teal/20 bg-emerald-50 p-4 dark:border-emerald-300/20 dark:bg-emerald-400/10">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-teal">Use as proof</p>
                <h3 className="mt-2 text-xl font-black text-ink dark:text-white">
                  {dashboard.strongestProduct ? productDisplayCode(dashboard.strongestProduct.name) : "Find a winning signal"}
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
                  {dashboard.strongestProduct
                    ? sellerShortName(dashboard.strongestProduct.topPositive, 100)
                    : "Strong buyer proof appears here after saved scans."}
                </p>
              </article>
            </div>

            <div className="seller-growth-product-bars mt-5 grid gap-3">
              {dashboard.productRows.slice(0, 5).map((product) => (
                <div key={product.name} className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-ink dark:text-white">{productDisplayCode(product.name)}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                        {product.trend} {product.previousScore ? `· ${product.scoreChange > 0 ? "+" : ""}${product.scoreChange} pts` : "· new"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-ocean shadow-inner dark:bg-slate-900">
                      {product.latestScore || 0}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white dark:bg-slate-900">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#df5f63,#ffb238,#10c6a3)]"
                      style={{ width: `${Math.max(4, Math.min(100, product.latestScore || 0))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {dashboard.productRows.length ? (
          <section className="seller-premium-ranking mb-6 rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Product health ranking</p>
                <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">See which product needs attention first.</h2>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Priority order</p>
            </div>

            <div className="seller-ranking-table mt-5 overflow-hidden rounded-2xl border border-line dark:border-white/10">
              <div className="seller-ranking-header grid grid-cols-[1.2fr_0.6fr_0.7fr_1.4fr_0.8fr] bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <span>Product</span>
                <span>Latest</span>
                <span>Trend</span>
                <span>Main buyer concern</span>
                <span>Priority</span>
              </div>
              {dashboard.productRows.slice(0, 8).map((product) => (
                <div key={product.name} className="seller-ranking-row grid grid-cols-[1.2fr_0.6fr_0.7fr_1.4fr_0.8fr] gap-3 border-t border-line px-4 py-4 text-sm dark:border-white/10">
                  <div className="seller-ranking-product">
                    <p className="font-black text-ink dark:text-white">{productDisplayCode(product.name)}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{product.scanCount} scan{product.scanCount === 1 ? "" : "s"}</p>
                  </div>
                  <p className="seller-ranking-score font-black text-ocean">{product.latestScore ? `${product.latestScore}%` : "—"}</p>
                  <div className="seller-ranking-trend">
                    <p className="font-black text-slate-700 dark:text-slate-200">{product.trend}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {product.previousScore ? `${product.scoreChange > 0 ? "+" : ""}${product.scoreChange} pts` : "New"}
                    </p>
                  </div>
                  <p className="seller-ranking-concern font-semibold leading-6 text-slate-600 dark:text-slate-300">{product.mainConcern}</p>
                  <p className={`seller-ranking-priority font-black ${priorityTone(product.priority)}`}>{product.priority}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="seller-premium-focus-grid mb-6 grid gap-5 lg:grid-cols-2">
          <article className="min-w-0 overflow-hidden rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
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

          <article className="min-w-0 overflow-hidden rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
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
          <article className="min-w-0 overflow-hidden rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
            {isSellerPro ? <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">Compare intelligence</p> : null}
            {isSellerPro ? <h3 className="mt-3 max-w-full break-words text-2xl font-black text-ink [overflow-wrap:anywhere] dark:text-white">Compare results guide strategy, but do not affect product health averages.</h3> : null}
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Use compare scans to find positioning opportunities, competitor weaknesses, and product advantages. They should guide strategy but not change normal product health averages.
            </p>
          </article>

          <article className="min-w-0 overflow-hidden rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
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
          <section className="seller-calendar-workspace mb-6 rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
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
          <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
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
          <section className="mt-6 rounded-2xl border border-line bg-white shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
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
                            <td className="whitespace-nowrap px-4 py-3 font-black text-ocean">{scanNumber(scan, ["productScore", "product_score", "healthScore", "score", "buyingConfidence", "confidenceScore", "confidence_score", "rating"], 0)}</td>
                            <td className="whitespace-nowrap px-4 py-3 font-black text-slate-700 dark:text-slate-200">{scanNumber(scan, ["sentimentScore", "sentiment_score", "sentiment", "satisfactionScore", "customer_satisfaction_score", "buyerSatisfaction"], 0)}</td>
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
          <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
            <h2 className="text-2xl font-black text-ink dark:text-white">Seller Pro unlocks the improvement calendar.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Seller Premium gets the seller intelligence dashboard and improvement planning. Seller Pro adds competitor compare, saved calendar, notes, scan momentum, and deeper tracking tools.
            </p>
          </section>
        ) : null}

        <AdSlot placement="seller_dashboard" compact className="mt-6" />
        <style jsx global>{`
          .reviewintel-route-dashboard-seller .seller-command-card-risk {
            border-color: rgba(223, 95, 99, .26);
            background: linear-gradient(180deg, #fff7f7, #ffffff);
          }

          .reviewintel-route-dashboard-seller .seller-command-card-good {
            border-color: rgba(16, 198, 163, .28);
            background: linear-gradient(180deg, #f0fffb, #ffffff);
          }

          .reviewintel-route-dashboard-seller .seller-command-card-warn {
            border-color: rgba(245, 158, 11, .3);
            background: linear-gradient(180deg, #fff9ed, #ffffff);
          }

          .reviewintel-route-dashboard-seller .seller-command-card-info {
            border-color: rgba(35, 86, 163, .26);
            background: linear-gradient(180deg, #f3f8ff, #ffffff);
          }

          @media (max-width: 640px) {
            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .dashboard-shell-main {
              display: block !important;
              width: 100% !important;
              max-width: 430px !important;
              margin: 0 auto !important;
              padding: 4.5rem 0.75rem 5rem !important;
              overflow-x: hidden !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .dashboard-shell-main[data-dashboard-experience="seller"]
              .dashboard-shell-sidebar {
              display: none !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .dashboard-shell-content {
              width: 100% !important;
              min-width: 0 !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .dashboard-shell-content
              :is(p, span, li, label, th, td) {
              font-size: 0.8rem !important;
              line-height: 1.45 !important;
              letter-spacing: 0 !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .dashboard-shell-page-title,
            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              :is(
                .seller-premium-hero,
                .seller-premium-command-grid > article,
                .seller-growth-pulse,
                .seller-premium-ranking,
                .seller-premium-focus-grid > article,
                .seller-premium-insight-grid > article,
                .seller-premium-utility-grid > article,
                .seller-calendar-workspace
              ) {
              padding: 1rem !important;
              border-radius: 1rem !important;
              gap: 0.75rem !important;
              box-shadow: 0 12px 32px rgba(15, 23, 42, 0.07) !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .dashboard-shell-page-title {
              margin-bottom: 0.85rem !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .dashboard-shell-page-title h1 {
              margin-top: 0.55rem !important;
              font-size: 1.55rem !important;
              line-height: 1.12 !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              :is(.seller-premium-hero h2, .seller-growth-pulse h2, .seller-premium-ranking h2, .seller-calendar-workspace h2) {
              margin-top: 0.45rem !important;
              font-size: 1.35rem !important;
              line-height: 1.18 !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              :is(.seller-premium-focus-grid h3, .seller-premium-utility-grid h3) {
              margin-top: 0.5rem !important;
              font-size: 1.08rem !important;
              line-height: 1.25 !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-premium-command-grid {
              grid-template-columns: 1fr !important;
              gap: 0.65rem !important;
              margin-bottom: 0.85rem !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-premium-command-grid h3 {
              font-size: 1.02rem !important;
              line-height: 1.22 !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-premium-command-grid p {
              display: -webkit-box !important;
              -webkit-line-clamp: 3 !important;
              -webkit-box-orient: vertical !important;
              overflow: hidden !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-premium-metrics {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 0.65rem !important;
              margin-bottom: 0.85rem !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-premium-metrics > article {
              min-height: 8.75rem !important;
              padding: 0.85rem !important;
              border-radius: 1rem !important;
              overflow: hidden !important;
              word-break: normal !important;
              overflow-wrap: break-word !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-premium-metrics > article > p:nth-child(2) {
              margin-top: 0.45rem !important;
              font-size: 1.35rem !important;
              line-height: 1.05 !important;
              overflow-wrap: anywhere !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-premium-metrics > article > p:nth-child(3) {
              display: -webkit-box !important;
              -webkit-line-clamp: 3 !important;
              -webkit-box-orient: vertical !important;
              overflow: hidden !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-growth-pulse-grid {
              grid-template-columns: 1fr !important;
              gap: 0.65rem !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-growth-pulse :is(h3, p) {
              overflow-wrap: anywhere !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-growth-pulse article,
            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-growth-product-bars > div {
              padding: 0.85rem !important;
              border-radius: 0.95rem !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              :is(.seller-premium-focus-grid, .seller-premium-insight-grid, .seller-premium-utility-grid) {
              grid-template-columns: 1fr !important;
              gap: 0.75rem !important;
              margin-bottom: 0.85rem !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-premium-insight-grid li:nth-child(n + 5) {
              display: none !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-ranking-table {
              margin-top: 0.8rem !important;
              overflow: visible !important;
              border: 0 !important;
              border-radius: 0 !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-ranking-header {
              display: none !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-ranking-row {
              display: grid !important;
              grid-template-columns: minmax(0, 1fr) auto !important;
              gap: 0.45rem 0.75rem !important;
              margin-top: 0.55rem !important;
              padding: 0.85rem !important;
              border: 1px solid #dbe4ee !important;
              border-radius: 0.9rem !important;
              background: #f8fafc !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              :is(.seller-ranking-score, .seller-ranking-priority) {
              text-align: right !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              :is(.seller-ranking-trend, .seller-ranking-concern) {
              grid-column: 1 / -1 !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              .seller-ranking-concern {
              padding-top: 0.45rem !important;
              border-top: 1px solid #e2e8f0 !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              details > summary {
              min-height: 3.25rem !important;
              padding: 0.9rem !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              details table {
              display: block !important;
              width: 100% !important;
              min-width: 0 !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              details thead {
              display: none !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              details :is(tbody, tr, td) {
              display: block !important;
              width: 100% !important;
              max-width: none !important;
              min-width: 0 !important;
              white-space: normal !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              details tr {
              margin-bottom: 0.7rem !important;
              padding: 0.75rem !important;
              border: 1px solid #dbe4ee !important;
              border-radius: 0.95rem !important;
              background: #f8fafc !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              details td {
              padding: 0.25rem 0 !important;
              border: 0 !important;
              font-size: 0.78rem !important;
              line-height: 1.35 !important;
              overflow-wrap: anywhere !important;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              details td::before {
              display: block;
              margin-bottom: 0.1rem;
              font-size: 0.62rem;
              font-weight: 900;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              color: #718096;
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              details td:nth-child(1)::before {
              content: "Date";
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              details td:nth-child(2)::before {
              content: "Product";
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              details td:nth-child(3)::before {
              content: "Score";
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              details td:nth-child(4)::before {
              content: "Sentiment";
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              details td:nth-child(5)::before {
              content: "Concern";
            }

            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              a,
            html:is([data-layout-mode="mobile"], [data-layout-mode="auto"])
              .reviewintel-route-dashboard-seller
              button {
              min-height: 2.75rem !important;
              font-size: 0.8rem !important;
            }

            html[data-layout-mode="mobile"]
              main.dashboard-shell-main[data-dashboard-experience="seller"] {
              display: block !important;
              width: 100% !important;
              max-width: 430px !important;
              margin: 0 auto !important;
              padding: 4.5rem 0.75rem 5rem !important;
              overflow-x: hidden !important;
            }

            html[data-layout-mode="mobile"]
              main.dashboard-shell-main[data-dashboard-experience="seller"]
              .dashboard-shell-sidebar {
              display: none !important;
            }

            html[data-layout-mode="mobile"]
              main.dashboard-shell-main[data-dashboard-experience="seller"]
              .dashboard-shell-content {
              width: 100% !important;
              min-width: 0 !important;
            }

            html[data-layout-mode="mobile"]
              main.dashboard-shell-main[data-dashboard-experience="seller"]
              :is(
                .dashboard-shell-page-title,
                .seller-premium-hero,
                .seller-growth-pulse,
                .seller-premium-ranking,
                .seller-premium-focus-grid > article,
                .seller-premium-insight-grid > article,
                .seller-premium-utility-grid > article,
                .seller-calendar-workspace
              ) {
              padding: 1rem !important;
              border-radius: 1rem !important;
            }

            html[data-layout-mode="mobile"]
              main.dashboard-shell-main[data-dashboard-experience="seller"]
              .seller-premium-metrics {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 0.65rem !important;
            }

            html[data-layout-mode="mobile"]
              main.dashboard-shell-main[data-dashboard-experience="seller"]
              .seller-premium-metrics > article {
              min-height: 8.75rem !important;
              padding: 0.85rem !important;
              border-radius: 1rem !important;
              overflow: hidden !important;
            }

            html[data-layout-mode="mobile"]
              main.dashboard-shell-main[data-dashboard-experience="seller"]
              .seller-premium-metrics > article > p:nth-child(2) {
              font-size: 1.35rem !important;
              line-height: 1.05 !important;
              overflow-wrap: anywhere !important;
            }

            html[data-layout-mode="mobile"]
              main.dashboard-shell-main[data-dashboard-experience="seller"]
              .seller-premium-metrics > article > p:nth-child(3) {
              display: -webkit-box !important;
              -webkit-line-clamp: 3 !important;
              -webkit-box-orient: vertical !important;
              overflow: hidden !important;
            }

            html[data-layout-mode="mobile"]
              main.dashboard-shell-main[data-dashboard-experience="seller"]
              :is(.seller-premium-focus-grid, .seller-premium-insight-grid, .seller-premium-utility-grid) {
              grid-template-columns: 1fr !important;
              gap: 0.75rem !important;
            }

            html[data-layout-mode="mobile"]
              main.dashboard-shell-main[data-dashboard-experience="seller"]
              .seller-ranking-header {
              display: none !important;
            }

            html[data-layout-mode="mobile"]
              main.dashboard-shell-main[data-dashboard-experience="seller"]
              .seller-ranking-row {
              display: grid !important;
              grid-template-columns: minmax(0, 1fr) auto !important;
              gap: 0.45rem 0.75rem !important;
              margin-top: 0.55rem !important;
              padding: 0.85rem !important;
              border: 1px solid #dbe4ee !important;
              border-radius: 0.9rem !important;
              background: #f8fafc !important;
            }

            html[data-layout-mode="mobile"]
              main.dashboard-shell-main[data-dashboard-experience="seller"]
              details table {
              min-width: 0 !important;
            }
          }
        `}</style>
      </DashboardShell>
    </ProOnlyGate>
  );
}
