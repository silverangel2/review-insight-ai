/**
 * Product review library: ReviewIntel's own accumulated evidence.
 *
 * Every scan that verifies an exact listing consolidates its accepted
 * reviews into a per-product corpus stored in Supabase
 * (`product_review_library`). Later scans of the same product load that
 * corpus and adjudicate it together with the fresh reviews, so the
 * verdict rests on everything ReviewIntel has ever accepted for the
 * product: an unchanged corpus yields the identical verdict (the scorer
 * is deterministic), and genuinely new reviews re-verdict on the larger
 * corpus.
 *
 * The library grows ONLY from ReviewIntel's own scans. Every function
 * here is fail-soft: missing env, a missing table, or any storage error
 * leaves the scan behaving exactly as it did before the library existed.
 */
import { supabaseDelete, supabaseSelect, supabaseUpsert } from "@/lib/supabaseServer";

export const PRODUCT_REVIEW_LIBRARY_TABLE = "product_review_library";
export const LIBRARY_CORPUS_CAP = 500;

export type LibraryReviewRecord = Record<string, unknown>;

export type ProductLibraryEntry = {
  productKey: string;
  reviews: LibraryReviewRecord[];
  scanCount: number;
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

/** ASIN-style canonical identifier from a listing URL, when present. */
function identifierFromUrl(listingUrl: string): string | null {
  const dp = listingUrl.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1];
  if (dp) return dp.toUpperCase();
  const gp = listingUrl.match(/\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1];
  if (gp) return gp.toUpperCase();
  return null;
}

function marketplaceFor(input: {
  canonicalMarketplace?: string | null;
  store?: string | null;
  listingUrl?: string | null;
}): string | null {
  const named = cleanText(input.canonicalMarketplace || input.store).toLowerCase();
  if (named) return named.replace(/^www\./, "");
  const url = cleanText(input.listingUrl);
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * Canonical library key for a verified listing: `marketplace:identifier`
 * (e.g. `amazon.ca:B0DGJDKHRQ`). Returns null when no canonical identifier
 * is known — consolidation never happens on a fuzzy identity.
 */
export function libraryProductKeyFor(input: {
  asin?: string | null;
  canonicalMarketplace?: string | null;
  store?: string | null;
  listingUrl?: string | null;
}): string | null {
  const marketplace = marketplaceFor(input);
  if (!marketplace) return null;
  const identifier =
    cleanText(input.asin).toUpperCase() ||
    (input.listingUrl ? identifierFromUrl(input.listingUrl) : null);
  if (!identifier) return null;
  return `${marketplace}:${identifier}`;
}

type LibraryRow = {
  id?: unknown;
  product_key?: unknown;
  corpus?: unknown;
  scan_count?: unknown;
};

/**
 * Stable identity for one stored review record, used by unionLibraryCorpus
 * to keep the library from re-adding the same review on every scan.
 * Prefers a stable evidence hash when the record carries one; otherwise
 * falls back to a normalized body key (same normalization as the
 * owner-feed ingest lane) plus rating/reviewer disambiguators. Two records
 * are the "same review" when their identities match, even if their
 * provenance or wrapper fields differ between runs.
 */
export function libraryRecordIdentity(record: LibraryReviewRecord): string {
  if (!record || typeof record !== "object") return "";
  const stable = cleanText((record as Record<string, unknown>).stableEvidenceHash);
  if (stable) return `hash:${stable.toLowerCase()}`;
  const body = String((record as Record<string, unknown>).body ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!body) return "";
  const extras = [
    cleanText((record as Record<string, unknown>).reviewerName),
    cleanText((record as Record<string, unknown>).rating),
  ]
    .filter(Boolean)
    .join("|");
  return extras ? `body:${body}|${extras}` : `body:${body}`;
}

/**
 * Union of the stored corpus and this run's accepted records, deduped by
 * libraryRecordIdentity. Stored order is kept; genuinely new accepted
 * records append after it. Rejected-in-this-run records that were already
 * stored STAY stored — adjudication governs per-scan evidence, never
 * storage retention. The union is capped at LIBRARY_CORPUS_CAP with stored
 * records first: a full library keeps everything it had and only newly
 * accepted records past the cap are dropped.
 */
export function unionLibraryCorpora(
  stored: LibraryReviewRecord[],
  accepted: LibraryReviewRecord[]
): LibraryReviewRecord[] {
  const seen = new Set<string>();
  const next: LibraryReviewRecord[] = [];
  for (const record of [...(stored || []), ...(accepted || [])]) {
    const identity = libraryRecordIdentity(record);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    next.push(record);
    if (next.length >= LIBRARY_CORPUS_CAP) break;
  }
  return next;
}

/** Load the stored corpus for a product. Any failure reads as an empty library. */
export async function loadLibraryCorpus(
  productKey: string
): Promise<ProductLibraryEntry> {
  const empty: ProductLibraryEntry = { productKey, reviews: [], scanCount: 0 };
  if (!productKey) return empty;
  try {
    // Deterministic under duplicate rows: the freshest row (updated_at desc)
    // wins. Duplicate rows are a repairable schema state (the original
    // migration declared product_key unique; a missing constraint lets
    // upserts 409 and duplicates accumulate); reads must never be a coin
    // flip. See supabase/migrations/20261016_product_review_library_dedupe_unique.sql.
    const rows = await supabaseSelect<LibraryRow>(
      PRODUCT_REVIEW_LIBRARY_TABLE,
      `product_key=eq.${encodeURIComponent(productKey)}&select=product_key,corpus,scan_count&order=updated_at.desc&limit=1`
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) return empty;
    const corpus = Array.isArray(row.corpus)
      ? (row.corpus as unknown[]).filter(
          (item): item is LibraryReviewRecord =>
            Boolean(item) && typeof item === "object" && !Array.isArray(item)
        )
      : [];
    const scanCount = Number(row.scan_count);
    return {
      productKey,
      reviews: corpus.slice(0, LIBRARY_CORPUS_CAP),
      scanCount: Number.isFinite(scanCount) && scanCount > 0 ? Math.floor(scanCount) : 0,
    };
  } catch {
    return empty;
  }
}

/**
 * Persist the consolidated (post-adjudication) corpus for a product.
 * Fire-and-forget semantics: resolves false instead of throwing so a
 * storage problem can never fail or delay a shopper's scan result.
 *
 * Write mechanics, honestly stated: the upsert relies on the unique
 * constraint on product_key (the original migration declared it). If the
 * live table is missing that constraint, PostgREST rejects the upsert with
 * a 409 ("no unique or exclusion constraint matching the ON CONFLICT
 * specification") and the write is a no-op — PostgREST cannot merge
 * without the constraint, and the API offers no transactional
 * multi-request alternative, so this function cannot paper over a missing
 * constraint. Fix it with
 * supabase/migrations/20261016_product_review_library_dedupe_unique.sql.
 *
 * Duplicate-row healing: when the constraint IS present but stale
 * duplicates predate it, the successful upsert lands on the canonical row
 * and this function then best-effort deletes the other rows for the key.
 * Fail-soft: any sweep failure is ignored.
 */
export async function saveLibraryCorpus(input: {
  productKey: string;
  canonicalUrl?: string | null;
  productName?: string | null;
  brand?: string | null;
  store?: string | null;
  aggregateRating?: number | null;
  aggregateCount?: number | null;
  corpus: LibraryReviewRecord[];
  previousScanCount: number;
  /**
   * Owner-feed ingestion passes 0: ingesting hand-fed reviews is not a scan.
   * Defaults to 1 (unchanged behavior for the scan path).
   */
  scanIncrement?: number;
}): Promise<boolean> {
  if (!input.productKey || !input.corpus.length) return false;
  try {
    const now = new Date().toISOString();
    // supabaseUpsert resolves null (never throws) when unconfigured or when
    // PostgREST rejects the write — treat that as "not saved".
    const row = await supabaseUpsert<{ id?: unknown } & LibraryRow>(
      PRODUCT_REVIEW_LIBRARY_TABLE,
      [
        {
          product_key: input.productKey,
          canonical_url: input.canonicalUrl || null,
          product_name: input.productName || null,
          brand: input.brand || null,
          store: input.store || null,
          aggregate_rating: input.aggregateRating ?? null,
          aggregate_count: input.aggregateCount ?? null,
          corpus: input.corpus.slice(0, LIBRARY_CORPUS_CAP),
          review_count: Math.min(input.corpus.length, LIBRARY_CORPUS_CAP),
          scan_count: Math.max(0, Math.floor(input.previousScanCount || 0)) + (input.scanIncrement ?? 1),
          last_seen_at: now,
          updated_at: now,
        },
      ],
      "product_key"
    );
    if (row === null || row === undefined) return false;
    // Heal pre-existing duplicates: keep the row just written (the
    // constraint-bearing upsert merged into one canonical row), delete any
    // other rows for the key. Best effort; never blocks the scan.
    try {
      const winnerId = row && typeof row === "object" ? String(row.id ?? "") : "";
      if (winnerId) {
        await supabaseDelete(
          PRODUCT_REVIEW_LIBRARY_TABLE,
          `product_key=eq.${encodeURIComponent(input.productKey)}&id=neq.${encodeURIComponent(winnerId)}`
        );
      }
    } catch {
      // Sweep failures are silently ignored — the write already landed.
    }
    return true;
  } catch {
    return false;
  }
}
