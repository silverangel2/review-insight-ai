// Server-only runtime scan-progress store.
//
// Real live scan progress, driven by actual pipeline events (captureStage +
// retrieval counters). In-memory per server process: a poll that lands on a
// different serverless instance simply sees no record, and the UI shows an
// honest indeterminate state. Never fabricates counts. No external calls.
//
// This module lives apart from ./scanProgress (the client-safe pure model)
// because it imports node:async_hooks: components/ReviewIntelScanOverlay.tsx
// imports the pure model into the browser bundle, so this store must never be
// imported from client code. Server routes and lib modules only.
//
// Restored from the pre-PR-#40 implementation with identical semantics; the
// types now reference ./scanProgress so the two cannot diverge.

import { AsyncLocalStorage } from "node:async_hooks";
import type { LiveScanProgress } from "./scanStageModel";

/** Legacy stage name; identical to the stage union in LiveScanProgress. */
export type ScanProgressStage = LiveScanProgress["stage"];

/** Legacy snapshot; the LiveScanProgress contract plus the server-side bookkeeping. */
export type ScanProgressSnapshot = LiveScanProgress & {
  scanId: string;
  updatedAt: number;
  startedAt: number;
};

type Ctx = { ids: Set<string>; snapshot: ScanProgressSnapshot; pages: Set<string> };
const context = new AsyncLocalStorage<Ctx>();
const store: Map<string, ScanProgressSnapshot> = ((globalThis as Record<string, unknown>).__reviewIntelScanProgress as Map<string, ScanProgressSnapshot>) || new Map();
(globalThis as Record<string, unknown>).__reviewIntelScanProgress = store;
const TTL_MS = 30 * 60 * 1000;
const ORDER: ScanProgressStage[] = ["starting", "identifying", "searching", "reading", "checking", "scoring", "done"];

function safeId(id: string) { return /^[A-Za-z0-9_.:-]{6,120}$/.test(id); }
function hostOf(url: unknown) { try { return new URL(String(url)).hostname.replace(/^www\./, ""); } catch { return null; } }
function progressStoreBase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    // Fake/local env must never open a database connection.
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".invalid")) return null;
  } catch {
    return null;
  }
  return url.replace(/\/$/, "");
}

const PROGRESS_TABLE_MISSING = "__reviewIntelProgressTableMissing";

/** True after one response shows reviewintel_scan_progress does not exist. Later writes are skipped. */
export function progressTableWritesDisabled() {
  return (globalThis as Record<string, unknown>)[PROGRESS_TABLE_MISSING] === true;
}

export function resetProgressTableProbeForTests() {
  delete (globalThis as Record<string, unknown>)[PROGRESS_TABLE_MISSING];
}

/** Remember a missing-table response. Other failures (network, 500) are not cached. */
export function observeProgressTableResponse(status: number, body: string) {
  if (progressTableWritesDisabled()) return;
  const missing =
    status === 404 ||
    /PGRST205|42P01|could not find the table|schema cache|does not exist/i.test(String(body || ""));
  if (missing) (globalThis as Record<string, unknown>)[PROGRESS_TABLE_MISSING] = true;
}

function persistSnapshot(snapshot: ScanProgressSnapshot) {
  if (progressTableWritesDisabled()) return;
  const base = progressStoreBase();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base || !key) return;
  void fetch(`${base}/rest/v1/reviewintel_scan_progress?on_conflict=scan_id`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ scan_id: snapshot.scanId, snapshot, updated_at: new Date().toISOString() }),
    cache: "no-store",
  }).then(async (response) => {
    if (response.ok) return;
    const body = await response.text().catch(() => "");
    observeProgressTableResponse(response.status, body);
  }).catch(() => null);
}

function publish(ctx: Ctx) {
  ctx.snapshot.updatedAt = Date.now();
  for (const id of ctx.ids) {
    const snapshot = { ...ctx.snapshot, scanId: id, sourceHosts: [...ctx.snapshot.sourceHosts], snippets: [...ctx.snapshot.snippets] };
    store.set(id, snapshot);
    persistSnapshot(snapshot);
  }
  const cutoff = Date.now() - TTL_MS;
  for (const [id, snap] of store) if (snap.updatedAt < cutoff) store.delete(id);
}
function advance(ctx: Ctx, stage: ScanProgressStage) {
  if (ORDER.indexOf(stage) > ORDER.indexOf(ctx.snapshot.stage)) ctx.snapshot.stage = stage;
}

export function scanProgressActive() { return Boolean(context.getStore()); }

export async function runWithScanProgress<T>(scanId: string, work: () => Promise<T>): Promise<T> {
  if (!safeId(scanId)) return work();
  const now = Date.now();
  const ctx: Ctx = { ids: new Set([scanId]), pages: new Set(), snapshot: { scanId, stage: "starting", productIdentified: false, productName: null, sourcesChecked: 0, sourceHosts: [], reviewsFound: null, reviewsAccepted: null, snippets: [], updatedAt: now, startedAt: now } };
  return context.run(ctx, async () => {
    publish(ctx);
    try { const out = await work(); ctx.snapshot.stage = "done"; publish(ctx); return out; }
    catch (error) { ctx.snapshot.stage = "failed"; publish(ctx); throw error; }
  });
}

/** The client-supplied scan id (known to the browser before the response) aliases the server id. */
export function aliasScanProgress(scanId: string) {
  const ctx = context.getStore();
  if (ctx && safeId(scanId)) { ctx.ids.add(scanId); publish(ctx); }
}

export function getScanProgress(scanId: string): ScanProgressSnapshot | null {
  return safeId(scanId) ? store.get(scanId) || null : null;
}

/** Memory first, then the shared progress row (other serverless instances). */
export async function readScanProgress(scanId: string): Promise<ScanProgressSnapshot | null> {
  const local = getScanProgress(scanId);
  if (local) return local;
  if (progressTableWritesDisabled()) return null;
  const base = progressStoreBase();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base || !key || !safeId(scanId)) return null;
  const response = await fetch(
    `${base}/rest/v1/reviewintel_scan_progress?select=snapshot&scan_id=eq.${encodeURIComponent(scanId)}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
  ).catch(() => null);
  if (!response?.ok) {
    if (response) {
      const body = await response.text().catch(() => "");
      observeProgressTableResponse(response.status, body);
    }
    return null;
  }
  const rows = await response.json().catch(() => []) as Array<{ snapshot?: ScanProgressSnapshot }>;
  const snapshot = rows?.[0]?.snapshot;
  return snapshot && typeof snapshot === "object" ? { ...snapshot, scanId } : null;
}

/** Valid scan ids that have not published yet are pending (200), not a missing route. */
export function scanProgressHttp(scanId: string, progress: ScanProgressSnapshot | null) {
  if (!safeId(scanId)) return { status: 404, body: { scanId, progress: null } };
  if (!progress) return { status: 200, body: { scanId, progress: null, pending: true } };
  return { status: 200, body: { scanId, progress } };
}

/** Retrieval counter: unique raw reviews collected so far. */
export function reportReviewsFound(count: number) {
  const ctx = context.getStore(); if (!ctx) return;
  ctx.snapshot.reviewsFound = Math.max(ctx.snapshot.reviewsFound ?? 0, count); advance(ctx, "reading"); publish(ctx);
}

const RELEVANT = new Set(["identity", "search", "page", "adjudication", "evaluation"]);
/** Called from captureStage for every pipeline event; ignores everything when no progress context exists. */
export function noteScanProgressEvent(stage: string, data: unknown) {
  const ctx = context.getStore(); if (!ctx || !RELEVANT.has(stage)) return;
  try {
    const d = (typeof data === "function" ? (data as () => unknown)() : data) as Record<string, unknown>;
    const s = ctx.snapshot;
    if (stage === "identity") {
      const name = String(d?.productName || "").trim();
      if (name && name !== "unknown product") { s.productIdentified = true; s.productName = name.slice(0, 160); }
      advance(ctx, "identifying");
    } else if (stage === "search") {
      advance(ctx, "searching");
    } else if (stage === "page") {
      const url = String(d?.finalUrl || d?.sourceUrl || "");
      if (url && !ctx.pages.has(url)) {
        ctx.pages.add(url); s.sourcesChecked = ctx.pages.size;
        const host = hostOf(url); if (host && !s.sourceHosts.includes(host)) s.sourceHosts.push(host);
      }
      advance(ctx, "searching");
    } else if (stage === "adjudication") {
      const result = d?.result as { acceptedRecords?: Array<{ body?: string; sourceUrl?: string | null }> } | undefined;
      const accepted = Array.isArray(result?.acceptedRecords) ? result!.acceptedRecords : [];
      s.reviewsAccepted = accepted.length;
      s.snippets = accepted.slice(0, 4).map(record => {
        const body = String(record.body || "").replace(/\s+/g, " ").trim();
        return { text: body.length > 140 ? `${body.slice(0, body.lastIndexOf(" ", 140) > 60 ? body.lastIndexOf(" ", 140) : 140)}…` : body, host: hostOf(record.sourceUrl) };
      }).filter(item => item.text);
      advance(ctx, "checking");
    } else if (stage === "evaluation") {
      advance(ctx, "scoring");
    }
    publish(ctx);
  } catch { /* observation only */ }
}
