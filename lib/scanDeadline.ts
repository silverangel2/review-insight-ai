import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Hard time budget for one scan. Inside withScanDeadline(), every outbound fetch gets
 * a per-request timeout and is aborted once the scan's collection deadline passes, so
 * live retrieval can never hang a scan. Supabase (persistence) requests keep only the
 * per-request timeout, so a finished scan can still be saved and its operation closed.
 */
export const SCAN_COLLECTION_BUDGET_MS = 50_000;
export const SCAN_PER_REQUEST_TIMEOUT_MS = 8_000;
export const SCAN_TOTAL_BUDGET_MS = 80_000;

export function scanBudgets(env: Record<string, string | undefined> = process.env) {
  const num = (v: string | undefined, d: number, min: number, max: number) => {
    const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : d;
  };
  return {
    collectionMs: num(env.REVIEWINTEL_SCAN_COLLECTION_BUDGET_MS, SCAN_COLLECTION_BUDGET_MS, 5_000, 60_000),
    perRequestMs: num(env.REVIEWINTEL_SCAN_PER_REQUEST_TIMEOUT_MS, SCAN_PER_REQUEST_TIMEOUT_MS, 1_000, 15_000),
    totalMs: num(env.REVIEWINTEL_SCAN_TOTAL_BUDGET_MS, SCAN_TOTAL_BUDGET_MS, 10_000, 85_000),
  };
}

type Deadline = { deadlineAt: number; perRequestMs: number; aborted: number; persistHosts: string[] };
const store = new AsyncLocalStorage<Deadline>();
const g = globalThis as typeof globalThis & { __riScanDeadlineFetch?: { real: typeof fetch } };

function hostOf(input: unknown) {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : (input as { url?: string })?.url;
    return new URL(String(raw)).hostname.toLowerCase();
  } catch { return ""; }
}

function persistenceHosts() {
  return [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL].map((u) => hostOf(u || "")).filter(Boolean);
}

export class ScanDeadlineError extends Error {
  code = "SCAN_TIME_BUDGET";
  constructor(message = "Scan time budget reached.") { super(message); }
}

export function installScanFetchDeadline() {
  if (g.__riScanDeadlineFetch) return;
  const real = globalThis.fetch.bind(globalThis);
  g.__riScanDeadlineFetch = { real };
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const ctx = store.getStore();
    if (!ctx) return real(input, init);
    const persist = ctx.persistHosts.includes(hostOf(input));
    const remaining = ctx.deadlineAt - Date.now();
    if (!persist && remaining <= 0) { ctx.aborted++; throw new ScanDeadlineError(); }
    const limit = persist ? ctx.perRequestMs * 2 : Math.max(250, Math.min(ctx.perRequestMs, remaining));
    const signals = [AbortSignal.timeout(limit)];
    if (init.signal) signals.push(init.signal);
    try {
      return await real(input, { ...init, signal: AbortSignal.any(signals) });
    } catch (error) {
      if (!persist) ctx.aborted++;
      throw error;
    }
  }) as typeof fetch;
}

/** Milliseconds left in the active collection deadline, or null when no scan deadline is installed. */
export function scanCollectionRemainingMs(): number | null {
  const ctx = store.getStore();
  if (!ctx) return null;
  return ctx.deadlineAt - Date.now();
}

/** Run fn with a collection deadline; fetches inside are bounded. */
export function withScanDeadline<T>(budgetMs: number, fn: () => Promise<T>, perRequestMs = SCAN_PER_REQUEST_TIMEOUT_MS) {
  installScanFetchDeadline();
  const ctx: Deadline = { deadlineAt: Date.now() + budgetMs, perRequestMs, aborted: 0, persistHosts: persistenceHosts() };
  return store.run(ctx, fn);
}

/** Resolve fn's result, or the fallback once ms has passed (the slow work is abandoned). */
export async function raceWithBudget<T>(ms: number, fn: () => Promise<T>, onTimeout: () => T | Promise<T>): Promise<{ value: T; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ value: T; timedOut: boolean }>((resolve) => {
    timer = setTimeout(async () => resolve({ value: await onTimeout(), timedOut: true }), ms);
  });
  try {
    return await Promise.race([fn().then((value) => ({ value, timedOut: false })), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
