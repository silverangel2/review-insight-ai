"use client";

/**
 * Seller dashboard stats — the SINGLE source of truth for the headline
 * numbers on the seller dashboard (products scanned, saved scans, average
 * product score, latest score, satisfaction, reviews tracked).
 *
 * Every completed seller analysis is written to two stores by the result
 * page (the product record store via attachSellerAnalysisToProduct and the
 * improvement journal via saveStoredSellerResultToJournal). Reading those
 * two stores naively double-counts every analysis and mixes different
 * fallbacks, which is how the dashboard showed "4 products / 1 saved scan /
 * 30% average / 0% latest" at the same time. This helper merges both stores
 * into one deduped scan list (newest first) and derives every headline
 * number from that list, so the stats cannot contradict each other.
 *
 * Rules:
 * - Product records are canonical: their scans are added first.
 * - A journal scan is skipped when it is the same analysis as an already
 *   added scan (same normalized analysis id, or same product + day + score).
 * - Scores of 0 / missing are treated as "no score saved" (null), never as
 *   a real 0% — a missing score must render as an honest fallback ("—"),
 *   never as "0%" or "No%".
 * - Pure: never writes storage, never throws.
 */

import {
  dedupeSellerProducts,
  sellerProductCanonicalKey,
  sellerProductIdentityFor,
} from "@/lib/sellerProductConsolidation";
import type { SellerProduct } from "@/lib/sellerProducts";

/** Honest customer-facing product label. Raw PRD-/CMR- codes and
 *  "Untitled product" must never render — plain shopper language instead. */
export function sellerProductDisplayName(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "Product name unavailable";
  const lowered = text.toLowerCase();
  if (lowered === "untitled product" || lowered === "unnamed product") {
    return "Product name unavailable";
  }
  if (/^(prd|cmr)-[a-z0-9]{3,}$/i.test(text)) return "Product name unavailable";
  return text;
}

/** Honest score rendering: null (no score saved) renders as "—", never "0%" or "No%". */
export function formatSellerScore(score: number | null | undefined): string {
  return typeof score === "number" && Number.isFinite(score) ? `${Math.round(score)}%` : "—";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function finiteNumber(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  return Number.isFinite(n) ? n : null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const n = finiteNumber(record[key]);
    if (n !== null) return n;
  }
  return null;
}

/** Product-store / journal scan score on a 0–100 scale. 0 or missing means
 *  "no score saved" (null) — never a real 0%. */
function extractScore(record: Record<string, unknown>): number | null {
  const raw = pickNumber(record, [
    "productHealthScore",
    "productScore",
    "healthScore",
    "score",
  ]);
  if (raw === null || raw <= 0) return null;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function extractSatisfaction(record: Record<string, unknown>): number | null {
  const raw = pickNumber(record, [
    "customerSatisfactionScore",
    "sentimentScore",
    "satisfactionScore",
    "buyerSatisfaction",
  ]);
  if (raw === null || raw <= 0) return null;
  const scaled = raw > 0 && raw <= 1 ? raw * 100 : raw;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function extractReviewCount(record: Record<string, unknown>): number {
  const raw = pickNumber(record, ["reviewCount", "reviewsAnalyzed", "review_count"]);
  return raw !== null && raw >= 0 ? Math.round(raw) : 0;
}

function extractDateMs(record: Record<string, unknown>): number {
  const raw =
    record.savedAt || record.createdAt || record.analyzedAt || record.date || "";
  const text = String(raw || "").trim();
  // Day-granularity scan dates ("2026-10-15") parse at noon to avoid
  // timezone day-shifts; full ISO stamps parse as-is.
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? Date.parse(`${text}T12:00:00`)
    : Date.parse(text);
  return Number.isFinite(ms) ? (ms as number) : 0;
}

function dayKey(ms: number): string {
  if (!ms) return "unknown-day";
  return new Date(ms).toISOString().slice(0, 10);
}

/** "seller-scan-<analysisId>" and "<analysisId>" are the same analysis. */
function normalizedAnalysisId(record: Record<string, unknown>): string {
  const raw = String(record.id || "").trim().toLowerCase();
  if (!raw) return "";
  return raw
    .replace(/^seller-scan-/, "")
    .replace(/^seller-session-/, "")
    .replace(/[^a-z0-9]/g, "");
}

function looksLikeCompare(record: Record<string, unknown>): boolean {
  const typeText = String(
    record.type || record.mode || asRecord(record.result).type || ""
  ).toLowerCase();
  if (typeText.includes("compare")) return true;
  const idText = String(
    record.compareId || asRecord(record.result).compareId || record.id || ""
  ).toUpperCase();
  return idText.startsWith("CMR-");
}

export type SellerDashboardScanEntry = {
  /** Canonical product identity key (URL wins, name falls back). */
  key: string;
  day: string;
  dateMs: number;
  score: number | null;
  satisfaction: number | null;
  reviewCount: number;
  /** The raw scan record (product-store or journal shape). */
  record: unknown;
};

export type SellerDashboardStats = {
  /** The deduped scan list, newest first — the one list every stat derives from. */
  records: unknown[];
  /** Distinct products with at least one saved scan. */
  productCount: number;
  /** Saved seller scans (compare runs not included). */
  scanCount: number;
  /** Average score across saved scans, null when no score is saved yet. */
  averageScore: number | null;
  /** Newest saved score, null when no score is saved yet. */
  latestScore: number | null;
  /** Average satisfaction across saved scans, null when none saved yet. */
  satisfaction: number | null;
  /** Total reviews across saved scans. */
  reviewCount: number;
};

function averageOrNull(values: (number | null)[]): number | null {
  const valid = values.filter((value): value is number => typeof value === "number");
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

/**
 * Build the unified seller scan index and derive every headline dashboard
 * stat from it. Inputs are the raw stores; the helper dedupes and merges.
 */
export function buildSellerDashboardStats(input: {
  products: SellerProduct[];
  journalScans: unknown[];
}): SellerDashboardStats {
  const products = dedupeSellerProducts(
    Array.isArray(input.products) ? input.products : []
  );
  const journalScans = Array.isArray(input.journalScans) ? input.journalScans : [];

  const entries: SellerDashboardScanEntry[] = [];
  const seenIds = new Set<string>();
  const seenTriples = new Set<string>();

  function add(entry: SellerDashboardScanEntry) {
    const normId = normalizedAnalysisId(asRecord(entry.record));
    if (normId && seenIds.has(normId)) return;
    // Same product + same day + same score + same review volume is the same
    // analysis written to both stores (the result page writes both on every
    // completed analysis). Scans without a score only dedupe by id.
    const triple =
      entry.score !== null
        ? `${entry.key}|${entry.day}|${entry.score}|${entry.reviewCount}`
        : "";
    if (triple && seenTriples.has(triple)) return;
    if (normId) seenIds.add(normId);
    if (triple) seenTriples.add(triple);
    entries.push(entry);
  }

  // Product records are canonical: their scans win the merge.
  for (const product of products) {
    const key = sellerProductCanonicalKey(product);
    for (const scan of Array.isArray(product.scans) ? product.scans : []) {
      const record = asRecord(scan);
      if (looksLikeCompare(record)) continue;
      const dateMs = extractDateMs(record);
      add({
        key,
        day: dayKey(dateMs),
        dateMs,
        score: extractScore(record),
        satisfaction: extractSatisfaction(record),
        reviewCount: extractReviewCount(record),
        record: scan,
      });
    }
  }

  // Journal scans fill gaps (older analyses, or scans whose product record
  // was never created) — never double-counting an analysis already added.
  for (const journalScan of journalScans) {
    const record = asRecord(journalScan);
    if (looksLikeCompare(record)) continue;
    const identity = sellerProductIdentityFor({
      productUrl: typeof record.productUrl === "string" ? record.productUrl : undefined,
      productName: typeof record.productName === "string" ? record.productName : undefined,
      platform: "other",
    });
    const dateMs = extractDateMs(record);
    add({
      key: identity.key,
      day: dayKey(dateMs),
      dateMs,
      score: extractScore(record),
      satisfaction: extractSatisfaction(record),
      reviewCount: extractReviewCount(record),
      record: journalScan,
    });
  }

  // Newest first; product-record scans keep priority on ties.
  entries.sort((a, b) => b.dateMs - a.dateMs);

  const productCount = new Set(entries.map((entry) => entry.key)).size;
  const scores = entries.map((entry) => entry.score);
  const latestScore = entries.map((entry) => entry.score).find((score) => score !== null) ?? null;

  return {
    records: entries.map((entry) => entry.record),
    productCount,
    scanCount: entries.length,
    averageScore: averageOrNull(scores),
    latestScore,
    satisfaction: averageOrNull(entries.map((entry) => entry.satisfaction)),
    reviewCount: entries.reduce((sum, entry) => sum + entry.reviewCount, 0),
  };
}
