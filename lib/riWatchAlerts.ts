/**
 * ReviewIntel FYI watchlist alerts (Piece B): library-based change
 * detection for watched products. Pure, deterministic helpers — the cron
 * route (app/api/cron/ri-watchlist-alerts) does the I/O.
 *
 * The watchlist reuses the existing `product_watches` table (migration
 * 20261010_product_watches.sql); this module compares the CURRENT
 * product_review_library snapshot (aggregate rating + review count)
 * against the watch's STORED snapshot and decides whether the change is
 * worth one email. Never a series: the dedup log
 * (product_watch_alert_log) guarantees one email per watch per change.
 */

import crypto from "node:crypto";

/** Meaningful-change thresholds (Junel-tuned, conservative on purpose). */
export const WATCH_RATING_DELTA = 0.3;
export const WATCH_NEW_EVIDENCE_THRESHOLD = 10;
export const WATCH_MAX_PRODUCTS_PER_RUN = 25;

export type LibrarySnapshot = {
  aggregateRating: number | null;
  reviewCount: number;
  scanCount: number;
  /** Stable hash of the snapshot; a change here means "something moved". */
  hash: string;
};

export type StoredWatchSnapshot = {
  aggregateRating: number | null;
  reviewCount: number;
  hash: string | null;
};

export type WatchAlertDecision = {
  alert: boolean;
  reason: "rating_changed" | "new_evidence" | "no_change" | "no_baseline";
};

const finiteNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const finiteInt = (v: unknown): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : 0;
  return n < 0 ? 0 : n;
};

/** Build the current snapshot from a product_review_library row. */
export function snapshotFromLibraryRow(row: Record<string, unknown>): LibrarySnapshot {
  const aggregateRating = finiteNum(row.aggregate_rating);
  const reviewCount = finiteInt(row.review_count ?? row.corpus_length);
  const scanCount = finiteInt(row.scan_count);
  const hash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        r: aggregateRating,
        c: reviewCount,
        s: scanCount,
      })
    )
    .digest("hex")
    .slice(0, 32);
  return { aggregateRating, reviewCount, scanCount, hash };
}

/**
 * Decide whether a watched product deserves ONE alert email.
 * - no baseline yet → record the baseline, never alert (no alert storms)
 * - identical hash → nothing moved
 * - rating moved by >= WATCH_RATING_DELTA → alert (score changed)
 * - review count grew by >= WATCH_NEW_EVIDENCE_THRESHOLD → alert (new evidence)
 */
export function decideLibraryWatchAlert(
  previous: StoredWatchSnapshot,
  next: LibrarySnapshot
): WatchAlertDecision {
  if (!previous.hash) return { alert: false, reason: "no_baseline" };
  if (previous.hash === next.hash) return { alert: false, reason: "no_change" };
  if (
    previous.aggregateRating !== null &&
    next.aggregateRating !== null &&
    Math.abs(next.aggregateRating - previous.aggregateRating) >= WATCH_RATING_DELTA
  ) {
    return { alert: true, reason: "rating_changed" };
  }
  if (next.reviewCount - previous.reviewCount >= WATCH_NEW_EVIDENCE_THRESHOLD) {
    return { alert: true, reason: "new_evidence" };
  }
  return { alert: false, reason: "no_change" };
}

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function watchAlertEmailContent(input: {
  productName: string;
  reason: WatchAlertDecision["reason"];
  previousRating: number | null;
  rating: number | null;
  reviewCount: number;
  resultUrl: string;
  unwatchUrl: string;
  preferencesUrl: string;
}): { subject: string; text: string; html: string } {
  const fmt = (r: number | null) => (r === null ? "unrated" : `${r.toFixed(1)}★`);
  const why =
    input.reason === "rating_changed"
      ? `Its aggregate rating moved from ${fmt(input.previousRating)} to ${fmt(input.rating)}.`
      : `${input.reviewCount} buyer reviews are now counted in its ReviewIntel record.`;
  const subject = `Update on ${input.productName}`;
  const text =
    `${why}\n\nSee the full result: ${input.resultUrl}\n\n` +
    `Stop watching this product: ${input.unwatchUrl}\n` +
    `Manage all email preferences: ${input.preferencesUrl}\n\n` +
    `One email per change — you'll never get a reminder series from us.`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">` +
    `<p style="font-size:16px;line-height:1.7">${esc(why)}</p>` +
    `<p style="margin:24px 0"><a href="${esc(input.resultUrl)}" style="display:inline-block;background:#0e7490;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px">See the full result</a></p>` +
    `<p style="font-size:13px;line-height:1.7;color:#6b7280">One email per change — never a reminder series.<br>` +
    `<a href="${esc(input.unwatchUrl)}">Stop watching this product</a> · ` +
    `<a href="${esc(input.preferencesUrl)}">Email preferences</a></p></div>`;
  return { subject, text, html };
}
