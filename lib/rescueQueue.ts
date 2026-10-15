/**
 * Scan rescue queue: the receive lane's human fallback.
 *
 * When a scan finishes without a verdict (insufficient review evidence),
 * the analyze route records a candidate here, fail-soft, and keeps the
 * shopper response byte-identical to what it would have been. The owner
 * reviews the queue, researches the product personally, pastes the reviews
 * they found through the admin rescue page, and a rescore + one service
 * email closes the loop with the customer.
 *
 * Storage is injectable for tests; production wiring uses the Supabase
 * helpers. Every function refuses to throw — a missing table or a storage
 * error behaves like an empty queue.
 */

import { supabaseSelect, supabaseUpsert } from "@/lib/supabaseServer";

export const RESCUE_QUEUE_TABLE = "scan_rescue_queue";

export type RescueStatus = "pending" | "rescued" | "emailed" | "closed";

export type RescueQueueCandidate = {
  scanRef: string;
  accountEmail?: string | null;
  productKey?: string | null;
  productName?: string | null;
  productUrl?: string | null;
  reason?: string | null;
};

export type RescueQueueRow = {
  id: string;
  scan_ref: string;
  account_email: string | null;
  product_key: string | null;
  product_name: string | null;
  product_url: string | null;
  reason: string | null;
  status: RescueStatus;
  verdict: string | null;
  buying_score: number | null;
  created_at: string;
  updated_at: string;
  rescued_at: string | null;
  emailed_at: string | null;
};

type StorageDeps = {
  select: typeof supabaseSelect;
  upsert: typeof supabaseUpsert;
};

const defaultDeps: StorageDeps = { select: supabaseSelect, upsert: supabaseUpsert };

const VALID_STATUSES: RescueStatus[] = ["pending", "rescued", "emailed", "closed"];

/** Verdict-request email validation (shared with the public subscribe route). */
export function isValidRescueEmail(email: unknown): boolean {
  const text = String(email ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text);
}

function clean(value: unknown, max: number): string | null {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

/**
 * Record a rescue candidate. Fire-and-forget: resolves false instead of
 * throwing on dedupe conflict, missing table, or any storage error, so a
 * scan can never be delayed or failed by the queue.
 */
export async function recordRescueCandidate(
  candidate: RescueQueueCandidate,
  deps: Partial<StorageDeps> = {}
): Promise<boolean> {
  const scanRef = clean(candidate.scanRef, 120);
  if (!scanRef) return false;
  const { upsert } = { ...defaultDeps, ...deps };
  try {
    const now = new Date().toISOString();
    const written = await upsert(
      RESCUE_QUEUE_TABLE,
      [
        {
          scan_ref: scanRef,
          account_email: clean(candidate.accountEmail, 320),
          product_key: clean(candidate.productKey, 320),
          product_name: clean(candidate.productName, 400),
          product_url: clean(candidate.productUrl, 2000),
          reason: clean(candidate.reason, 400),
          status: "pending" as RescueStatus,
          updated_at: now,
        },
      ],
      "scan_ref"
    );
    return Boolean(written);
  } catch {
    return false;
  }
}

function normalizeRow(raw: Record<string, unknown>): RescueQueueRow | null {
  if (!raw || typeof raw !== "object") return null;
  const status = String(raw.status ?? "pending");
  return {
    id: String(raw.id ?? ""),
    scan_ref: String(raw.scan_ref ?? ""),
    account_email: raw.account_email == null ? null : String(raw.account_email),
    product_key: raw.product_key == null ? null : String(raw.product_key),
    product_name: raw.product_name == null ? null : String(raw.product_name),
    product_url: raw.product_url == null ? null : String(raw.product_url),
    reason: raw.reason == null ? null : String(raw.reason),
    status: (VALID_STATUSES as string[]).includes(status) ? (status as RescueStatus) : "pending",
    verdict: raw.verdict == null ? null : String(raw.verdict),
    buying_score:
      typeof raw.buying_score === "number" && Number.isFinite(raw.buying_score)
        ? Math.round(raw.buying_score)
        : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    rescued_at: raw.rescued_at == null ? null : String(raw.rescued_at),
    emailed_at: raw.emailed_at == null ? null : String(raw.emailed_at),
  };
}

/** List queue rows for one status (newest first). Fail-soft: [] on any error. */
export async function listRescueQueue(
  status: RescueStatus,
  limit = 50,
  deps: Partial<StorageDeps> = {}
): Promise<RescueQueueRow[]> {
  const { select } = { ...defaultDeps, ...deps };
  try {
    const rows = await select<Record<string, unknown>>(
      RESCUE_QUEUE_TABLE,
      `select=*&status=eq.${encodeURIComponent(status)}&order=created_at.desc&limit=${Math.max(1, Math.min(200, limit))}`
    );
    if (!Array.isArray(rows)) return [];
    return rows
      .map(normalizeRow)
      .filter((row): row is RescueQueueRow => row !== null && Boolean(row.id));
  } catch {
    return [];
  }
}

/** Fetch one row by id. Fail-soft: null on any error. */
export async function getRescueQueueRow(
  id: string,
  deps: Partial<StorageDeps> = {}
): Promise<RescueQueueRow | null> {
  const { select } = { ...defaultDeps, ...deps };
  const cleanId = clean(id, 80);
  if (!cleanId) return null;
  try {
    const rows = await select<Record<string, unknown>>(
      RESCUE_QUEUE_TABLE,
      `select=*&id=eq.${encodeURIComponent(cleanId)}&limit=1`
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    return row ? normalizeRow(row) : null;
  } catch {
    return null;
  }
}

type RescueUpdate = {
  status?: RescueStatus;
  verdict?: string | null;
  buyingScore?: number | null;
  productKey?: string | null;
  rescuedAt?: string | null;
  emailedAt?: string | null;
};

/**
 * Attach a guest's verdict-request email + explicit consent to a queue row.
 * Repeat subscribes overwrite the email — one row per scan_ref, no
 * duplicates. Resolves false on any error.
 */
export async function attachRescueConsent(
  id: string,
  email: string,
  subscribedAt: string,
  deps: Partial<StorageDeps> = {}
): Promise<boolean> {
  const cleanId = clean(id, 80);
  const cleanEmail = clean(email, 320);
  if (!cleanId || !cleanEmail) return false;
  const { upsert } = { ...defaultDeps, ...deps };
  try {
    const written = await upsert(
      RESCUE_QUEUE_TABLE,
      [
        {
          id: cleanId,
          account_email: cleanEmail,
          consent_source: "rescue_verdict_request",
          subscribed_at: subscribedAt,
          updated_at: new Date().toISOString(),
        },
      ],
      "id"
    );
    return Boolean(written);
  } catch {
    return false;
  }
}

/** Update a queue row (admin routes). Fail-soft: resolves false on any error. */
export async function updateRescueQueueRow(
  id: string,
  update: RescueUpdate,
  deps: Partial<StorageDeps> = {}
): Promise<boolean> {
  const cleanId = clean(id, 80);
  if (!cleanId) return false;
  const { upsert } = { ...defaultDeps, ...deps };
  try {
    const patch: Record<string, unknown> = {
      id: cleanId,
      updated_at: new Date().toISOString(),
    };
    if (update.status && VALID_STATUSES.includes(update.status)) patch.status = update.status;
    if (update.verdict !== undefined) patch.verdict = clean(update.verdict, 60);
    if (update.buyingScore !== undefined) {
      patch.buying_score =
        typeof update.buyingScore === "number" && Number.isFinite(update.buyingScore)
          ? Math.round(update.buyingScore)
          : null;
    }
    if (update.productKey !== undefined) patch.product_key = clean(update.productKey, 320);
    if (update.rescuedAt !== undefined) patch.rescued_at = update.rescuedAt;
    if (update.emailedAt !== undefined) patch.emailed_at = update.emailedAt;
    const written = await upsert(RESCUE_QUEUE_TABLE, [patch], "id");
    return Boolean(written);
  } catch {
    return false;
  }
}
