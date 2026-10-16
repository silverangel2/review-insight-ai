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

/** A bare upload filename (e.g. "anker-run1.csv") must never become a product name. */
function isFileNameLike(value: string): boolean {
  return /\.(csv|xlsx|xls|txt)$/i.test(value.trim());
}

/** "anker-run1.csv" -> "Anker Run1"; "reviews" -> "Reviews". Never returns empty. */
function humanizeFileName(value: string): string {
  const base = cleanText(value).replace(/\.(csv|xlsx|xls|txt)$/i, "");
  const words = base
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.length ? words.join(" ") : "Untitled product";
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
    // Display rule: a bare CSV filename must never become the product name.
    // With a URL, the label derives from the URL (host + identifier); with
    // only a filename, the label is a cleaned human-readable form.
    const urlLabel = host && identifier ? `${host} · ${identifier}` : host || "";
    const nameIsUsable = rawName && !isFileNameLike(rawName);
    const label = nameIsUsable ? rawName : urlLabel || "Untitled product";
    if (host && identifier) {
      return { key: `url:${host}/${identifier}`, label, productUrl: rawUrl, platform };
    }
    if (host) {
      const slug = pathSlug(rawUrl);
      return { key: `url:${host}${slug ?? ""}`, label, productUrl: rawUrl, platform };
    }
  }

  const token = normalizeNameToken(rawName) || "unnamed-product";
  return {
    key: `name:${platform}:${token}`,
    label: rawName ? (isFileNameLike(rawName) ? humanizeFileName(rawName) : rawName) : "Untitled product",
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
  productUrl?: string | null;
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

  // Canonical product URL rides on the scan so split records can be folded
  // back together later (retro-merge), even when the record name was lost.
  const scanProductUrl = cleanText(stored?.productUrl) || cleanText(stored?.productLink);

  // Stable scan id: re-opening a saved result re-attaches it without
  // duplicating the scan (the attach path dedupes by scan id).
  const meta = (result["meta"] as Record<string, unknown> | undefined) ?? {};
  const stableId = cleanText(
    result["analysisId"] || result["id"] || meta["analysis_id"] || meta["analysisId"]
  );
  const scanId = stableId
    ? `seller-scan-${stableId}`
    : `seller-scan-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id: scanId,
    date,
    productUrl: scanProductUrl,
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
  const list = Array.isArray(products) ? products : [];
  for (const product of list) {
    if (sellerProductCanonicalKey(product) === identity.key) return product;
  }
  return null;
}

/**
 * Canonical merge key for an already-stored product record. Prefers the
 * record's own product URL; falls back to the URL carried on any of its
 * scans (the retro-merge path for records that were split by filename);
 * name is the last resort. Records sharing a key are the same product.
 */
export function sellerProductCanonicalKey(product: SellerProduct): string {
  const record = (product ?? {}) as SellerProduct;
  const scanUrl = (Array.isArray(record.scans) ? record.scans : [])
    .map((scan) => cleanText((scan as SellerProductScan)?.productUrl))
    .find((value) => value.length > 0);
  const identity = sellerProductIdentityFor({
    productUrl: record.productUrl || scanUrl,
    productName: record.name,
    platform: record.platform,
  });
  return identity.key;
}

/** Rename a filename-like record name using the best available identity. */
function normalizedProductName(product: SellerProduct): string {
  const record = (product ?? {}) as SellerProduct;
  const name = cleanText(record.name);
  if (name && !isFileNameLike(name)) return name;
  const identity = sellerProductIdentityFor({
    productUrl: record.productUrl,
    productLink: (Array.isArray(record.scans) ? record.scans : [])
      .map((scan) => cleanText((scan as SellerProductScan)?.productUrl))
      .find((value) => value.length > 0),
    productName: name,
    platform: record.platform,
  });
  return identity.label;
}

function earliestIso(a: string, b: string): string {
  const left = cleanText(a);
  const right = cleanText(b);
  if (!left) return right;
  if (!right) return left;
  return left <= right ? left : right;
}

/**
 * Deterministic merge-on-read: fold records whose scans share the same
 * canonical URL key (or the same identity key) into one record. Scans merge
 * deduped by id, the earliest createdAt wins, and the name is normalized so
 * a bare CSV filename never survives when a better label exists.
 *
 * Pure: it returns a new list and never writes storage. Call it in every
 * read path (dashboard, journal views) and before find/create in the attach
 * path, where the merged list IS persisted.
 */
export function dedupeSellerProducts(products: SellerProduct[]): SellerProduct[] {
  const list = (Array.isArray(products) ? products : []).filter(
    (product) => product && (product as SellerProduct).id
  ) as SellerProduct[];
  if (list.length < 2) return list.map((product) => ({ ...product, name: normalizedProductName(product) }));

  const groups = new Map<string, SellerProduct[]>();
  for (const product of list) {
    const key = sellerProductCanonicalKey(product);
    const group = groups.get(key);
    if (group) group.push(product);
    else groups.set(key, [product]);
  }

  const merged: SellerProduct[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      const only = group[0];
      merged.push({ ...only, name: normalizedProductName(only) });
      continue;
    }
    const seen = new Set<string>();
    const scans: SellerProductScan[] = [];
    for (const product of group) {
      for (const scan of Array.isArray(product.scans) ? product.scans : []) {
        if (!scan || typeof scan !== "object") continue;
        const id = cleanText((scan as SellerProductScan).id);
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        scans.push(scan as SellerProductScan);
      }
    }
    // Newest first, matching the attach path's ordering.
    scans.sort((a, b) => String(b?.date || "").localeCompare(String(a?.date || "")));
    const sorted = [...group].sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
    const first = sorted[0];
    const scanUrls = group.flatMap((product) =>
      (Array.isArray(product.scans) ? product.scans : []).map((scan) =>
        cleanText((scan as SellerProductScan)?.productUrl)
      )
    );
    const productUrl =
      sorted.map((product) => cleanText(product.productUrl)).find((value) => value.length > 0) ||
      scanUrls.find((value) => value.length > 0) ||
      "";
    const imageUrl =
      sorted.map((product) => cleanText(product.imageUrl)).find((value) => value.length > 0) || "";
    const category =
      sorted.map((product) => cleanText(product.category)).find((value) => value.length > 0) || "";
    const createdAt = sorted.reduce(
      (acc, product) => earliestIso(acc, cleanText(product.createdAt)),
      cleanText(first.createdAt)
    );
    const updatedAt = sorted
      .map((product) => cleanText(product.updatedAt))
      .filter(Boolean)
      .sort()
      .pop() || new Date().toISOString();
    merged.push({
      ...first,
      name: normalizedProductName({ ...first, productUrl }),
      productUrl,
      imageUrl,
      category,
      scans: scans.slice(0, 180),
      createdAt,
      updatedAt,
    });
  }
  return merged;
}

/**
 * The single counting source for "how many seller analyses exist".
 * Counts scans across the deduped (merged) product records — one scan per
 * completed seller analysis, compare runs excluded (they never attach).
 * Never throws; 0 when storage is unavailable or the account is not a seller.
 */
export function countSellerAnalyses(): number {
  try {
    const products = dedupeSellerProducts(readSellerProducts());
    return products.reduce(
      (sum, product) => sum + (Array.isArray(product?.scans) ? product.scans.length : 0),
      0
    );
  } catch {
    return 0;
  }
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

/**
 * Resolve the product identity for a stored analysis. URL wins whenever one
 * is present anywhere on the stored payload or the result itself; the bare
 * CSV filename is only ever the last resort.
 */
export function sellerIdentityForStoredAnalysis(stored: StoredSellerAnalysis): SellerProductIdentity {
  const result = (stored?.result ?? {}) as Record<string, unknown>;
  const meta = (result["meta"] as Record<string, unknown> | undefined) ?? {};
  return sellerProductIdentityFor({
    productUrl: firstText(
      result["productUrl"],
      result["exactListingUrl"],
      result["listingUrl"],
      meta["productUrl"],
      meta["exactListingUrl"]
    ),
    productLink: firstText(stored?.productLink, result["productLink"]),
    productName: firstText(result["productName"], result["product_name"], meta["productName"]),
    fileName: stored?.fileName,
    platform: firstText(result["platform"], meta["platform"]),
  });
}

/**
 * Attach a completed seller analysis to its product record — resolving or
 * creating the product by normalized identity, then appending the snapshot.
 *
 * Durability contract: the merged list is written back to the same
 * localStorage store the dashboard reads (`reviewintel:seller-products:…`),
 * after a deterministic dedupe pass. Any filename-split records for the same
 * product are folded together here, so a later read can never see them split.
 * Never throws; returns null when the account is not a seller, the plan
 * product limit is reached, or storage is unavailable.
 */
export function attachSellerAnalysisToProduct(
  stored: StoredSellerAnalysis,
  plan: SubscriptionPlan | undefined
): { product: SellerProduct; scan: SellerProductScan } | null {
  try {
    if (!stored?.result) return null;
    const storedProducts = readSellerProducts();
    if (!storedProducts) return null;

    // Retro-merge first: filename-split records for the same product fold
    // together before we resolve this scan's product, and the folded list is
    // what gets persisted below.
    const products = dedupeSellerProducts(storedProducts);
    const identity = sellerIdentityForStoredAnalysis(stored);

    let product = findSellerProductByIdentity(products, identity);
    let working = products;
    if (!product) {
      const created = createSellerProduct(
        {
          name: identity.label,
          productUrl: identity.productUrl,
          platform: (identity.platform || "other") as SellerProduct["platform"],
        },
        plan
      );
      // createSellerProduct wrote the un-merged list; re-read through dedupe.
      working = dedupeSellerProducts(readSellerProducts());
      product = findSellerProductByIdentity(working, identity) ?? created;
    }

    const scan = sellerScanFromStoredResult({ ...stored, productUrl: identity.productUrl }, identity.label);
    const latest = working.find((item) => item.id === product!.id)?.scans?.[0];
    if (typeof latest?.productHealthScore === "number") {
      const delta = scan.productHealthScore - latest.productHealthScore;
      scan.tone = delta >= 5 ? "improvement" : scan.productHealthScore >= 72 ? "positive" : scan.productHealthScore >= 50 ? "mixed" : "negative";
    }

    const target = working.find((item) => item.id === product!.id);
    if (!target) return null;
    const scans = [scan, ...(target.scans ?? []).filter((item) => item.id !== scan.id)].slice(0, 180);
    const next: SellerProduct = { ...target, scans, updatedAt: new Date().toISOString() };
    writeSellerProducts(
      dedupeSellerProducts(working.map((item) => (item.id === product!.id ? next : item)))
    );
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

/* ------------------------------------------------------------------ */
/* Identity + dedupe for DB/history-shaped analysis records            */
/* ------------------------------------------------------------------ */

/**
 * A DB / history-shaped seller analysis record: Supabase `analyses` rows,
 * local audit-history entries, journal scans, dashboard scan blobs. The
 * canonical identity rule is the same as for product records — the product
 * URL wins, the stored product name is the fallback — so two CSV runs of
 * the same product fold into one card even when their filenames differ and
 * the product_name was written from the filename.
 */
export type SellerAnalysisRecordShape = Record<string, unknown>;

function recordAnalysisJson(record: Record<string, unknown>): Record<string, unknown> {
  const analysis = record.analysis_json;
  return analysis && typeof analysis === "object"
    ? (analysis as Record<string, unknown>)
    : {};
}

/** Canonical identity for a DB/history-shaped analysis record. */
export function sellerAnalysisIdentityFor(
  record: SellerAnalysisRecordShape | null | undefined
): SellerProductIdentity {
  const rec = ((record ?? {}) as Record<string, unknown>);
  const analysis = recordAnalysisJson(rec);
  return sellerProductIdentityFor({
    productUrl: firstText(
      analysis.productUrl,
      analysis.exactListingUrl,
      analysis.listingUrl,
      rec.productUrl,
      rec.exactListingUrl,
      rec.listingUrl
    ),
    productLink: firstText(analysis.productLink, rec.productLink),
    productName: firstText(
      rec.product_name,
      rec.productName,
      rec.name,
      rec.title,
      rec.fileName
    ),
    platform: firstText(rec.platform, analysis.platform),
  });
}

function recordCreatedAt(record: Record<string, unknown>): string {
  return cleanText(
    record.created_at ?? record.createdAt ?? record.savedAt ?? record.analyzedAt ?? record.date
  );
}

function recordReviewCount(record: Record<string, unknown>): number {
  const analysis = recordAnalysisJson(record);
  const raw =
    analysis.reviewsAnalyzed ??
    analysis.reviews_analyzed ??
    analysis.review_count ??
    analysis.reviewCount ??
    record.reviewsAnalyzed ??
    record.reviewCount ??
    record.review_count;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** A filename with the extension stripped ("anker-run2", "logi_03") is
 *  still a filename — it must never become a display name either. */
function looksLikeFilenameStem(value: string): boolean {
  const v = cleanText(value);
  return isFileNameLike(v) || /[-_]run\d*$/i.test(v) || /[-_]\d{2,}$/.test(v);
}

function displayNameForRecord(
  record: Record<string, unknown>,
  identity: SellerProductIdentity
): string {
  const stored = cleanText(
    record.product_name ?? record.productName ?? record.name ?? record.title
  );
  // A bare filename (or its stem) must never survive as the display name.
  // When the stored name is filename-derived, the label falls back to the
  // URL-derived identity label (e.g. "amazon.ca · B07P39MLKH") — identity-
  // honest, and it makes visibly clear both runs are the same product.
  if (stored && !looksLikeFilenameStem(stored)) return stored;
  const unlabeled = sellerProductIdentityFor({
    productUrl: identity.productUrl || null,
    platform: identity.platform || null,
  });
  return unlabeled.label;
}

export type DedupedSellerAnalysis<T extends SellerAnalysisRecordShape = SellerAnalysisRecordShape> =
  T & {
    /** How many raw records folded into this product card. */
    mergedRecordCount: number;
    /** Sum of review counts across the folded records. */
    mergedReviewCount: number;
    /** The canonical identity key all folded records share. */
    canonicalKey: string;
  };

/**
 * Deterministic merge of DB/history analysis records by canonical identity.
 * Two CSV runs of the same product (same link, different filenames) become
 * ONE card: the newest record wins for display fields, review counts sum,
 * and mergedRecordCount carries how many runs folded in. Pure — never
 * writes storage. Every dashboard read path (history list, product rows,
 * "last products checked", counts) must go through this.
 */
export function dedupeSellerAnalyses<T extends SellerAnalysisRecordShape>(
  records: T[] | null | undefined
): DedupedSellerAnalysis<T>[] {
  const list = (Array.isArray(records) ? records : []).filter(
    (record) => record && typeof record === "object"
  ) as T[];
  const groups = new Map<string, { identity: SellerProductIdentity; records: T[] }>();
  for (const record of list) {
    const identity = sellerAnalysisIdentityFor(record);
    const group = groups.get(identity.key);
    if (group) group.records.push(record);
    else groups.set(identity.key, { identity, records: [record] });
  }
  const merged: DedupedSellerAnalysis<T>[] = [];
  for (const [key, { identity, records: group }] of groups) {
    const sorted = [...group].sort((a, b) =>
      String(recordCreatedAt(b as Record<string, unknown>)).localeCompare(
        String(recordCreatedAt(a as Record<string, unknown>))
      )
    );
    const latest = sorted[0] as Record<string, unknown>;
    const mergedReviewCount = group.reduce(
      (sum, record) => sum + recordReviewCount(record as Record<string, unknown>),
      0
    );
    merged.push({
      ...(latest as T),
      product_name: displayNameForRecord(latest, identity),
      mergedRecordCount: group.length,
      mergedReviewCount,
      canonicalKey: key,
    });
  }
  // Newest product card first, matching the dashboard's ordering.
  merged.sort((a, b) =>
    String(recordCreatedAt(b as Record<string, unknown>)).localeCompare(
      String(recordCreatedAt(a as Record<string, unknown>))
    )
  );
  return merged;
}
