/**
 * Referee state — the Make-Sense Referee's memory of what it last
 * printed for a product (lib/reviewReferee.ts, duty D3).
 *
 * Shopper v2 deliberately never writes the legacy product memory
 * (product_scan_memory expects legacy screenshot-scored fields), so
 * the Referee keeps its own minimal state: the last printed verdict
 * word + score, the graded-corpus fingerprint and the unique-opinion
 * count for one product key. The next scan's flip gate reads it back.
 *
 * Storage: `product_referee_state` (migration
 * 20261020_product_referee_state.sql). Every function is fail-soft in
 * the library's pattern: a missing table, missing env, or any storage
 * error reads as "no state" (the flip gate then falls back to the
 * stored-corpus verdict, and holds nothing it cannot justify) and
 * writes resolve false instead of throwing. A storage problem must
 * never fail or delay a shopper's scan.
 */
import { supabaseSelect, supabaseUpsert } from "@/lib/supabaseServer";

export const REFEREE_STATE_TABLE = "product_referee_state";

export type RefereeState = {
  productKey: string;
  verdict: string;
  score: number | null;
  corpusFingerprint: string | null;
  uniqueOpinionCount: number;
  updatedAt: string | null;
};

type RefereeStateRow = {
  product_key?: unknown;
  verdict?: unknown;
  score?: unknown;
  corpus_fingerprint?: unknown;
  unique_opinions?: unknown;
  updated_at?: unknown;
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

/** Load the last printed referee state for a product. Any failure reads as no state. */
export async function loadRefereeState(productKey: string): Promise<RefereeState | null> {
  if (!productKey) return null;
  try {
    const rows = await supabaseSelect<RefereeStateRow>(
      REFEREE_STATE_TABLE,
      `product_key=eq.${encodeURIComponent(productKey)}&select=product_key,verdict,score,corpus_fingerprint,unique_opinions,updated_at&limit=1`
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row || !cleanText(row.verdict)) return null;
    const score = Number(row.score);
    const unique = Number(row.unique_opinions);
    return {
      productKey: cleanText(row.product_key) || productKey,
      verdict: cleanText(row.verdict).toUpperCase(),
      score: Number.isFinite(score) ? score : null,
      corpusFingerprint: cleanText(row.corpus_fingerprint) || null,
      uniqueOpinionCount: Number.isFinite(unique) && unique > 0 ? Math.floor(unique) : 0,
      updatedAt: cleanText(row.updated_at) || null,
    };
  } catch {
    return null;
  }
}

/**
 * Persist the printed decision for the next scan's flip gate.
 * Fire-and-forget semantics: resolves false instead of throwing.
 */
export async function saveRefereeState(state: {
  productKey: string;
  verdict: string;
  score: number | null;
  corpusFingerprint: string | null;
  uniqueOpinionCount: number;
}): Promise<boolean> {
  if (!state.productKey || !state.verdict) return false;
  try {
    const row = await supabaseUpsert<{ id?: unknown }>(
      REFEREE_STATE_TABLE,
      [
        {
          product_key: state.productKey,
          verdict: state.verdict,
          score: state.score,
          corpus_fingerprint: state.corpusFingerprint,
          unique_opinions: Math.max(0, Math.floor(state.uniqueOpinionCount || 0)),
          updated_at: new Date().toISOString(),
        },
      ],
      "product_key"
    );
    return row !== null && row !== undefined;
  } catch {
    return false;
  }
}
