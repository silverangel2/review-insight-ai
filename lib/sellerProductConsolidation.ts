"use client";

/**
 * Seller product consolidation — Junel's spec: every seller scan is sorted
 * by product and merged into that product's consolidated record; every new
 * scan merges into the same product instead of living as a disconnected
 * one-off report.
 *
 * Two halves:
 *  1. attachSellerAnalysisToProduct — the merge on save. Resolves the
 *     product record by normalized identity (listing URL wins, product name
 *     falls back), creates it when missing, and appends the analysis
 *     snapshot. Never duplicates a product, never throws.
 *  2. consolidateSellerProductScans — the consolidated business analysis:
 *     a deterministic rollup over ALL of a product's analyses (weighted
 *     averages, trend, recurring complaints/strengths, merged actions).
 *     No network, no AI, no invented data — every number derives from the
 *     stored scan snapshots.
 */

import type { SubscriptionPlan } from "@/lib/types";
import {
  createSellerProduct,
  readSellerProducts,
  saveActiveSellerProductId,
  writeSellerProducts,
  type SellerProduct,
  type SellerProductScan,
} from "@/lib/sellerProducts";

/* ------------------------------------------------------------------ */
/* Product identity                                                    */
/* ------------------------------------------------------------------ */

export type SellerProductIdentity = {
  /** Stable merge key: `url:<host>/<identifier>` or `name:<platform>:<normalized>`. */
  key: string;
  /** Display label for a newly created product record. */
  label: string;
  /** Canonical product URL, when one was supplied. */
  productUrl: string;
  /** Platform slug, when known. */
  platform: string;
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNameToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.(csv|xlsx|xls|txt)$/i, "")
    .replace(/^reviewintel[_\s-]*/i, "")
    .replace(/^sample[_\s-]*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hostOf(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

function identifierFromUrl(url: string): string | null {
  const dp = url.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1];
  if (dp) return dp.toUpperCase();
  const gp = url.match(/\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1];
  if (gp) return gp.toUpperCase();
  return null;
}

function pathSlug(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return path && path !== "/" ? path : null;
  } catch {
    return null;
  }
}

/**
 * Normalized product identity for merge. Listing URL wins (identifier when
 * present, otherwise host+path); product/file name is the fallback. The key
 * is stable across casing, punctuation, and CSV filename noise, so the same
 * product never splits into duplicate records.
 */
export function sellerProductIdentityFor(input: {
  productUrl?: string | null;
  productLink?: string | null;
  productName?: string | null;
  fileName?: string | null;
  platform?: string | null;
}): SellerProductIdentity {
  const rawUrl = cleanText(input.productUrl || input.productLink);
  const rawName = cleanText(input.productName || input.fileName);
  const platform = cleanText(input.platform).toLowerCase() || "other";

  if (rawUrl) {
    const host = hostOf(rawUrl);
    const identifier = identifierFromUrl(rawUrl);
    if (host && identifier) {
      return {
        key: `url:${host}/${identifier}`,
        label: cleanText(rawName) || `${host} ${identifier}`,
        productUrl: rawUrl,
        platform,
      };
    }
    if (host) {
      const slug = pathSlug(rawUrl);
      return {
        key: `url:${host}${slug ?? ""}`,
        label: cleanText(rawName) || host,
        productUrl: rawUrl,
        platform,
      };
    }
  }

  const token = normalizeNameToken(rawName) || "unnamed-product";
  return {
    key: `name:${platform}:${token}`,
    label: cleanText(rawName) || "Untitled product",
    productUrl: "",
    platform,
  };
}

/* ------------------------------------------------------------------ */
/* Stored result -> scan snapshot                                       */
/* ------------------------------------------------------------------ */

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function cleanStrings(values: unknown, limit = 6, fallback?: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const list = Array.isArray(values) ? values : typeof values === "string" ? [values] : [];
  for (const item of list) {
    const text = cleanText(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  if (!out.length && fallback) out.push(fallback);
  return out;
}

export type StoredSellerAnalysis = {
  result?: Record<string, unknown> | null;
  fileName?: string | null;
  productLink?: string | null;
  createdAt?: string | null;
  savedAt?: string | null;
};

/** Normalize a seller-analyze API result into a product scan snapshot. */
export function sellerScanFromStoredResult(
  stored: StoredSellerAnalysis,
  productNameHint?: string
): SellerProductScan {
  const result = (stored?.result ?? {}) as Record<string, unknown>;
  const num = (key: string): number => clampScore(result[key]);
  const strings = (keys: string[], limit = 6, fallback?: string) => {
    for (const key of keys) {
      const got = cleanStrings(result[key], limit, fallback);
      if (got.length) return got;
    }
    return fallback ? [fallback] : [];
  };

  const createdAt = cleanText(stored?.createdAt || stored?.savedAt);
  const date = /^\d{4}-\d{2}-\d{2}/.test(createdAt)
    ? createdAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const health = num("healthScore");
  const satisfaction = num("buyerSatisfaction");
  const complaintSeverity = num("refundRisk");
  const sentiment = num("buyerSatisfaction");

  const reviewCountRaw = result["reviewsAnalyzed"];
  const reviewCount =
    typeof reviewCountRaw === "number" && Number.isFinite(reviewCountRaw) && reviewCountRaw >= 0
      ? Math.round(reviewCountRaw)
      : 0;

  const complaints = strings(["topComplaints", "buyerObjections"], 6, "No major complaint cluster detected.");
  const strengths = strings(["topPraise"], 6, "Positive feedback needs more review volume.");
  const actions = strings(["nextActions", "productFixes", "listingFixes"], 6, "Monitor the next scan and compare complaint movement.");

  return {
    id: `seller-scan-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date,
    productHealthScore: health,
    customerSatisfactionScore: satisfaction,
    complaintSeverityScore: complaintSeverity,
    sentimentScore: sentiment,
    reviewCount,
    topComplaint: complaints[0] || "No dominant complaint yet",
    topPositiveTheme: strengths[0] || "Positive theme needs more review volume",
    aiSummary: cleanText(result["summary"]) || "Seller analysis saved.",
    actionRecommendation: actions[0] || "Run another scan and compare movement.",
    strengths,
    complaints,
    actionPlan: actions,
    tone: "mixed",
  };
}

/* ------------------------------------------------------------------ */
/* The merge: every new scan attaches to its product record            */
/* ------------------------------------------------------------------ */

/** Find an existing product record matching the identity (never duplicate). */
export function findSellerProductByIdentity(
  products: SellerProduct[],
  identity: SellerProductIdentity
): SellerProduct | null {
  for (const product of products) {
    const existing = sellerProductIdentityFor({
      productUrl: product.productUrl,
      productName: product.name,
      platform: product.platform,
    });
    if (existing.key === identity.key) return product;
  }
  return null;
}

/**
 * Attach a completed seller analysis to its product record — resolving or
 * creating the product by normalized identity, then appending the snapshot.
 * Never throws; returns null when the account is not a seller, the plan
 * product limit is reached, or storage is unavailable.
 */
export function attachSellerAnalysisToProduct(
  stored: StoredSellerAnalysis,
  plan: SubscriptionPlan | undefined
): { product: SellerProduct; scan: SellerProductScan } | null {
  try {
    if (!stored?.result) return null;
    const products = readSellerProducts();
    if (!products) return null;

    const identity = sellerProductIdentityFor({
      productLink: stored.productLink,
      fileName: stored.fileName,
    });

    let product = findSellerProductByIdentity(products, identity);
    if (!product) {
      product = createSellerProduct(
        {
          name: identity.label,
          productUrl: identity.productUrl,
          platform: (identity.platform || "other") as SellerProduct["platform"],
        },
        plan
      );
    }

    const scan = sellerScanFromStoredResult(stored, identity.label);
    const latest = readSellerProducts().find((item) => item.id === product!.id)?.scans?.[0];
    if (typeof latest?.productHealthScore === "number") {
      const delta = scan.productHealthScore - latest.productHealthScore;
      scan.tone = delta >= 5 ? "improvement" : scan.productHealthScore >= 72 ? "positive" : scan.productHealthScore >= 50 ? "mixed" : "negative";
    }

    const current = readSellerProducts();
    const target = current.find((item) => item.id === product!.id);
    if (!target) return null;
    const scans = [scan, ...(target.scans ?? []).filter((item) => item.id !== scan.id)].slice(0, 180);
    const next: SellerProduct = { ...target, scans, updatedAt: new Date().toISOString() };
    writeSellerProducts(current.map((item) => (item.id === product!.id ? next : item)));
    saveActiveSellerProductId(product.id);
    return { product: next, scan };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* The consolidation: deterministic business analysis per product      */
/* ------------------------------------------------------------------ */

export type ConsolidatedSellerTheme = {
  label: string;
  analyses: number;
  reviews: number;
};

export type ConsolidatedSellerAnalysis = {
  analysisCount: number;
  totalReviews: number;
  firstDate: string | null;
  lastDate: string | null;
  avgHealth: number | null;
  avgSatisfaction: number | null;
  avgSentiment: number | null;
  avgComplaintSeverity: number | null;
  trend: "improving" | "declining" | "stable" | "needs_data";
  trendDelta: number | null;
  trendNote: string;
  topComplaints: ConsolidatedSellerTheme[];
  topStrengths: ConsolidatedSellerTheme[];
  priorityActions: ConsolidatedSellerTheme[];
};

function weightFor(scan: SellerProductScan): number {
  return Number.isFinite(scan.reviewCount) && scan.reviewCount > 0 ? scan.reviewCount : 1;
}

function weightedAverage(scans: SellerProductScan[], pick: (s: SellerProductScan) => number): number | null {
  let total = 0;
  let weight = 0;
  for (const scan of scans) {
    const value = pick(scan);
    if (!Number.isFinite(value)) continue;
    const w = weightFor(scan);
    total += value * w;
    weight += w;
  }
  if (weight <= 0) return null;
  return Math.round(total / weight);
}

function themeKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function rollupThemes(
  scans: SellerProductScan[],
  pick: (s: SellerProductScan) => string[],
  limit: number
): ConsolidatedSellerTheme[] {
  const byKey = new Map<string, { label: string; analyses: number; reviews: number }>();
  for (const scan of scans) {
    const seen = new Set<string>();
    for (const raw of pick(scan)) {
      const label = cleanText(raw);
      if (!label) continue;
      const key = themeKey(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const w = weightFor(scan);
      const entry = byKey.get(key) ?? { label, analyses: 0, reviews: 0 };
      entry.analyses += 1;
      entry.reviews += w;
      byKey.set(key, entry);
    }
  }
  return Array.from(byKey.values())
    .sort((a, b) => b.reviews - a.reviews || b.analyses - a.analyses)
    .slice(0, limit);
}

/**
 * Deterministic consolidated business analysis over ALL of a product's
 * analyses. Empty-safe: returns an empty analysis for products with no
 * scans yet. Every number derives from the stored snapshots.
 */
export function consolidateSellerProductScans(scans: SellerProductScan[]): ConsolidatedSellerAnalysis {
  const ordered = [...(scans ?? [])]
    .filter((scan) => scan && typeof scan === "object")
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  const empty: ConsolidatedSellerAnalysis = {
    analysisCount: 0,
    totalReviews: 0,
    firstDate: null,
    lastDate: null,
    avgHealth: null,
    avgSatisfaction: null,
    avgSentiment: null,
    avgComplaintSeverity: null,
    trend: "needs_data",
    trendDelta: null,
    trendNote: "Run a seller analysis to start this product's consolidated record.",
    topComplaints: [],
    topStrengths: [],
    priorityActions: [],
  };
  if (!ordered.length) return empty;

  const totalReviews = ordered.reduce(
    (sum, scan) => sum + (Number.isFinite(scan.reviewCount) && scan.reviewCount > 0 ? Math.round(scan.reviewCount) : 0),
    0
  );

  const avgHealth = weightedAverage(ordered, (s) => s.productHealthScore);
  let trend: ConsolidatedSellerAnalysis["trend"] = "needs_data";
  let trendDelta: number | null = null;
  const mid = Math.ceil(ordered.length / 2);
  if (ordered.length >= 2) {
    const early = weightedAverage(ordered.slice(0, mid), (s) => s.productHealthScore);
    const late = weightedAverage(ordered.slice(mid), (s) => s.productHealthScore);
    if (early !== null && late !== null) {
      trendDelta = late - early;
      trend = trendDelta >= 5 ? "improving" : trendDelta <= -5 ? "declining" : "stable";
    }
  }
  const trendNote =
    trend === "improving"
      ? `Improving by ${trendDelta} points across the latest analyses. Keep proving what buyers like.`
      : trend === "declining"
        ? `Down ${Math.abs(trendDelta ?? 0)} points across the latest analyses. Fix the repeated complaint before adding more traffic.`
        : trend === "stable"
          ? "Stable across analyses. Use the next scan to confirm whether your last improvement changed buyer signals."
          : "One analysis so far — the trend line starts with the next scan.";

  return {
    analysisCount: ordered.length,
    totalReviews,
    firstDate: cleanText(ordered[0].date) || null,
    lastDate: cleanText(ordered[ordered.length - 1].date) || null,
    avgHealth,
    avgSatisfaction: weightedAverage(ordered, (s) => s.customerSatisfactionScore),
    avgSentiment: weightedAverage(ordered, (s) => s.sentimentScore),
    avgComplaintSeverity: weightedAverage(ordered, (s) => s.complaintSeverityScore),
    trend,
    trendDelta,
    trendNote,
    topComplaints: rollupThemes(ordered, (s) => s.complaints ?? [], 6),
    topStrengths: rollupThemes(ordered, (s) => s.strengths ?? [], 6),
    priorityActions: rollupThemes(ordered, (s) => s.actionPlan ?? [], 8),
  };
}
