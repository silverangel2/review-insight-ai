// Real live scan progress, driven by actual pipeline events (captureStage +
// retrieval counters). In-memory per server process: a poll that lands on a
// different serverless instance simply sees no record, and the UI shows an
// honest indeterminate state. Never fabricates counts. No external calls.
import { AsyncLocalStorage } from "node:async_hooks";

export type ScanProgressStage = "starting" | "identifying" | "searching" | "reading" | "checking" | "scoring" | "done" | "failed";
export type ScanProgressSnapshot = {
  scanId: string;
  stage: ScanProgressStage;
  productIdentified: boolean;
  productName: string | null;
  sourcesChecked: number;
  sourceHosts: string[];
  reviewsFound: number | null;
  reviewsAccepted: number | null;
  snippets: Array<{ text: string; host: string | null }>;
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
function publish(ctx: Ctx) {
  ctx.snapshot.updatedAt = Date.now();
  for (const id of ctx.ids) store.set(id, { ...ctx.snapshot, scanId: id, sourceHosts: [...ctx.snapshot.sourceHosts], snippets: [...ctx.snapshot.snippets] });
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
