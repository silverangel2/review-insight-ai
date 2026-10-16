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
import { supabaseSelect, supabaseUpsert } from "@/lib/supabaseServer";

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
  product_key?: unknown;
  corpus?: unknown;
  scan_count?: unknown;
};

/** Load the stored corpus for a product. Any failure reads as an empty library. */
export async function loadLibraryCorpus(
  productKey: string
): Promise<ProductLibraryEntry> {
  const empty: ProductLibraryEntry = { productKey, reviews: [], scanCount: 0 };
  if (!productKey) return empty;
  try {
    const rows = await supabaseSelect<LibraryRow>(
      PRODUCT_REVIEW_LIBRARY_TABLE,
      `product_key=eq.${encodeURIComponent(productKey)}&select=product_key,corpus,scan_count&limit=1`
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
    const row = await supabaseUpsert(
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
    return row !== null && row !== undefined;
  } catch {
    return false;
  }
}
