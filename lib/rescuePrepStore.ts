/**
 * Rescue Prep store adapter — wires lib/rescuePrep.ts to RI's own tables.
 *
 * Reads: scan_rescue_queue (via lib/rescueQueue), product_review_library
 * (corpus size + aggregate snapshot), product_scan_memory (prior scans).
 * Writes: rescue_prep_packs — used when the migration
 * supabase/migrations/20261016_rescue_prep_packs.sql has been applied by
 * the owner; every write resolves false (fail-soft) when the table is
 * absent. The adapter never touches the queue item itself: no status
 * changes, no auto-rescue, no emails — the pack is advisory only.
 */
import { isSupabaseConfigured, supabaseInsert, supabaseSelect } from "@/lib/supabaseServer";
import { getRescueQueueRow, listRescueQueue } from "@/lib/rescueQueue";
import {
  prepareRescuePack,
  type PriorScanSummary,
  type RescuePrepPack,
  type RescuePrepStore,
  type RescueQueueItem,
} from "@/lib/rescuePrep";

export const RESCUE_PREP_PACKS_TABLE = "rescue_prep_packs";
export const PRODUCT_REVIEW_LIBRARY_TABLE = "product_review_library";
export const PRODUCT_SCAN_MEMORY_TABLE = "product_scan_memory";

type Rec = Record<string, unknown>;

function ready(): boolean {
  try {
    return isSupabaseConfigured();
  } catch {
    return false;
  }
}

function toQueueItem(row: Rec): RescueQueueItem {
  return {
    id: String(row.id ?? ""),
    scan_ref: String(row.scan_ref ?? ""),
    account_email: row.account_email ? String(row.account_email) : null,
    product_key: row.product_key ? String(row.product_key) : null,
    product_name: row.product_name ? String(row.product_name) : null,
    product_url: row.product_url ? String(row.product_url) : null,
    reason: row.reason ? String(row.reason) : null,
    created_at: row.created_at ? String(row.created_at) : null,
  };
}

export const rescuePrepStore: RescuePrepStore = {
  async loadRescueQueueItem(ref: string): Promise<RescueQueueItem | null> {
    if (!ready()) return null;
    // The ref may be the queue row id or the scan_ref.
    const byId = await getRescueQueueRow(ref);
    if (byId) return toQueueItem(byId as unknown as Rec);
    try {
      const pending = await listRescueQueue("pending", 50);
      const hit = pending.find((r) => String((r as Rec).scan_ref ?? "") === ref);
      return hit ? toQueueItem(hit as unknown as Rec) : null;
    } catch {
      return null;
    }
  },

  async loadLibraryCorpusSize(productKey: string): Promise<{ size: number | null; scanCount: number | null }> {
    if (!ready()) return { size: null, scanCount: null };
    try {
      const rows = await supabaseSelect<Rec>(
        PRODUCT_REVIEW_LIBRARY_TABLE,
        `select=aggregate_rating,aggregate_count,review_count,scan_count&product_key=eq.${encodeURIComponent(productKey)}&limit=1`
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return { size: 0, scanCount: 0 };
      const size = typeof row.review_count === "number" ? row.review_count : null;
      const scanCount = typeof row.scan_count === "number" ? row.scan_count : null;
      return { size, scanCount };
    } catch {
      return { size: null, scanCount: null };
    }
  },

  async loadPriorScans(productKey: string): Promise<PriorScanSummary[]> {
    if (!ready()) return [];
    try {
      const rows = await supabaseSelect<Rec>(
        PRODUCT_SCAN_MEMORY_TABLE,
        `select=created_at,verdict,product_score&product_key=eq.${encodeURIComponent(productKey)}&order=created_at.desc&limit=10`
      );
      if (!Array.isArray(rows)) return [];
      return rows.map((r) => ({
        verdict: r.verdict ? String(r.verdict) : "",
        score: typeof r.product_score === "number" ? r.product_score : null,
        createdAt: r.created_at ? String(r.created_at) : null,
      }));
    } catch {
      return [];
    }
  },

  async loadAggregateSnapshot(productKey: string): Promise<{ rating: number | null; count: number | null } | null> {
    if (!ready()) return null;
    try {
      const rows = await supabaseSelect<Rec>(
        PRODUCT_REVIEW_LIBRARY_TABLE,
        `select=aggregate_rating,aggregate_count&product_key=eq.${encodeURIComponent(productKey)}&limit=1`
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return null;
      const rating = typeof row.aggregate_rating === "number" ? row.aggregate_rating : row.aggregate_rating ? Number(row.aggregate_rating) : null;
      const count = typeof row.aggregate_count === "number" ? row.aggregate_count : null;
      if (rating === null && count === null) return null;
      return {
        rating: typeof rating === "number" && Number.isFinite(rating) ? rating : null,
        count: typeof count === "number" && Number.isFinite(count) ? count : null,
      };
    } catch {
      return null;
    }
  },

  async loadPrepPack(queueId: string): Promise<RescuePrepPack | null> {
    if (!ready()) return null;
    try {
      const rows = await supabaseSelect<Rec>(
        RESCUE_PREP_PACKS_TABLE,
        `select=pack&queue_id=eq.${encodeURIComponent(queueId)}&order=created_at.desc&limit=1`
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      return row && row.pack && typeof row.pack === "object" ? (row.pack as RescuePrepPack) : null;
    } catch {
      return null; // table absent or read failed — idempotency check degrades gracefully
    }
  },

  async savePrepPack(pack: RescuePrepPack): Promise<boolean> {
    if (!ready()) return false;
    try {
      const rows = await supabaseInsert<Rec>(RESCUE_PREP_PACKS_TABLE, [
        {
          queue_id: pack.queueId,
          scan_ref: pack.scanRef,
          product_key: pack.productKey,
          pack,
        },
      ]);
      return Array.isArray(rows) && rows.length > 0;
    } catch {
      return false; // migration not applied yet, or write failed — fail soft
    }
  },
};

/** One-call entry: build and persist the pack for a pending rescue item. */
export function prepareRescuePackForQueueRef(queueRef: string) {
  return prepareRescuePack(queueRef, rescuePrepStore);
}
