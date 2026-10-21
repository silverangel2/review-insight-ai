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
import {
  extractProductFingerprint,
  matchListingToFingerprint,
  type FingerprintInput,
  type ProductFingerprint,
} from "@/lib/productFingerprint";

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

/* ==========================================================================
 * Cross-store fingerprint linking (additive, 2026-10-20).
 *
 * The per-marketplace keys above stay exactly as they are. This section adds
 * the owner's match-words layer on top: a product's fingerprint (see
 * lib/productFingerprint.ts) links the marketplace listings that provably
 * name the same product, and their stored corpora pool into one verdict
 * corpus. Pooling is gated like the library-trust rule demands — identity
 * (fingerprint match), provenance (every pooled review carries its source
 * marketplace), deduplication (libraryRecordIdentity, the same rule the
 * per-key union uses) — and every pair that does NOT pool is reported in
 * `exclusions` with its verdict and reason. Nothing here writes storage:
 * pooling is a read-time view the caller may persist under its own key.
 * ======================================================================== */

export type FingerprintLibraryEntry = {
  /** Existing per-marketplace library key, e.g. "amazon.ca:B0DGJDKHRQ". */
  productKey: string;
  /** Listing evidence for this entry's product (title/brand/model/ids). */
  listing: FingerprintInput;
  reviews: LibraryReviewRecord[];
};

export type PooledLibraryGroup = {
  /** Fingerprint identity of the group's anchor entry, when anchored. */
  fingerprintKey: string | null;
  fingerprint: ProductFingerprint;
  productKeys: string[];
  /** Pooled, deduped reviews; each carries sourceMarketplace provenance. */
  reviews: LibraryReviewRecord[];
};

export type PoolingExclusion = {
  productKey: string;
  againstKey: string;
  verdict: "no_match" | "ambiguous";
  reason: string;
};

/** Marketplace a stored review came from: stamped field, else its source URL's host. */
export function reviewSourceMarketplace(
  record: LibraryReviewRecord,
  fallbackProductKey?: string | null
): string | null {
  if (!record || typeof record !== "object") return null;
  const stamped = cleanText(record.sourceMarketplace);
  if (stamped) return stamped.toLowerCase();
  const url = cleanText(record.sourceUrl);
  if (url) {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, "") || null;
    } catch {
      /* fall through to the key */
    }
  }
  const key = cleanText(fallbackProductKey);
  const fromKey = key.split(":")[0];
  return fromKey ? fromKey.toLowerCase() : null;
}

/**
 * Copy of a review record with sourceMarketplace provenance guaranteed.
 * Existing provenance is never overwritten — a stamped record keeps the
 * marketplace it was first attributed to.
 */
export function stampReviewProvenance(
  record: LibraryReviewRecord,
  productKey: string
): LibraryReviewRecord {
  if (!record || typeof record !== "object") return record;
  if (cleanText(record.sourceMarketplace)) return record;
  const marketplace = reviewSourceMarketplace(record, productKey);
  if (!marketplace) return record;
  return { ...record, sourceMarketplace: marketplace };
}

/**
 * Pool library entries whose listings provably share one fingerprint.
 * Pairwise decisions run the fingerprint matcher in both directions and a
 * pair links only when BOTH directions prove match: pooling moves reviews,
 * so the stricter reading wins — if either direction can only say
 * "ambiguous" (e.g. one listing carries a model the other cannot evidence),
 * the pair stays unmerged and the doubt is logged in `exclusions`.
 * Deterministic for a given input order; groups keep input order, and the
 * pooled corpus is the identity-deduped union (stored order first), capped
 * at LIBRARY_CORPUS_CAP exactly like the per-key union.
 */
export function poolLinkedLibraryCorpora(entries: FingerprintLibraryEntry[]): {
  groups: PooledLibraryGroup[];
  exclusions: PoolingExclusion[];
} {
  const exclusions: PoolingExclusion[] = [];
  const fingerprints = entries.map((entry) => extractProductFingerprint(entry.listing));
  const parent = entries.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    while (parent[i] !== root) {
      const next = parent[i];
      parent[i] = root;
      i = next;
    }
    return root;
  };

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i].productKey === entries[j].productKey) continue;
      const forward = matchListingToFingerprint(fingerprints[i], entries[j].listing);
      const backward = matchListingToFingerprint(fingerprints[j], entries[i].listing);
      const verdicts = [forward.verdict, backward.verdict];
      if (verdicts.includes("no_match")) {
        const bad = forward.verdict === "no_match" ? forward : backward;
        exclusions.push({
          productKey: entries[j].productKey,
          againstKey: entries[i].productKey,
          verdict: "no_match",
          reason: bad.reasons[0] || "no_match",
        });
        continue;
      }
      if (forward.verdict === "match" && backward.verdict === "match") {
        const ri = find(i);
        const rj = find(j);
        if (ri !== rj) parent[Math.max(ri, rj)] = Math.min(ri, rj);
        continue;
      }
      const amb = forward.verdict === "ambiguous" ? forward : backward;
      exclusions.push({
        productKey: entries[j].productKey,
        againstKey: entries[i].productKey,
        verdict: "ambiguous",
        reason: amb.reasons[0] || "ambiguous",
      });
    }
  }

  const byRoot = new Map<number, number[]>();
  entries.forEach((_, i) => {
    const root = find(i);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root)!.push(i);
  });

  const groups: PooledLibraryGroup[] = [...byRoot.values()].map((members) => {
    const anchor = members[0];
    let reviews: LibraryReviewRecord[] = [];
    for (const member of members) {
      const stamped = (entries[member].reviews || []).map((record) =>
        stampReviewProvenance(record, entries[member].productKey)
      );
      reviews = unionLibraryCorpora(reviews, stamped);
    }
    return {
      fingerprintKey: fingerprints[anchor].fingerprintKey,
      fingerprint: fingerprints[anchor],
      productKeys: members.map((m) => entries[m].productKey),
      reviews,
    };
  });

  return { groups, exclusions };
}

/**
 * Load the stored corpora for the given entries' keys and pool the ones
 * whose listings share a fingerprint. Fail-soft like every library read:
 * a storage failure reads as an empty corpus for that key (the entry then
 * simply pools nothing). The loader is injectable for tests.
 */
export async function loadPooledLibraryCorpus(
  entries: Array<{ productKey: string; listing: FingerprintInput }>,
  loadCorpus: typeof loadLibraryCorpus = loadLibraryCorpus
): Promise<{ groups: PooledLibraryGroup[]; exclusions: PoolingExclusion[] }> {
  const loaded: FingerprintLibraryEntry[] = [];
  for (const entry of entries) {
    const stored = await loadCorpus(entry.productKey);
    loaded.push({ productKey: entry.productKey, listing: entry.listing, reviews: stored.reviews });
  }
  return poolLinkedLibraryCorpora(loaded);
}

/* ==========================================================================
 * Fingerprint discovery (additive, 2026-10-20): find the library rows whose
 * listings provably name the scanned product, and pool their corpora.
 *
 * The per-key loader above serves only a scan that already knows the
 * product's canonical key — which requires a verified exact listing. A
 * screenshot-identified product arrives with brand + title but no listing,
 * so the library stayed invisible to it (the screenshot-evidence defect).
 * This loader reads a bounded set of library listing rows (metadata only),
 * runs the fingerprint matcher in BOTH directions per row — the same
 * both-directions rule poolLinkedLibraryCorpora applies between entries,
 * because pooling moves reviews — and only then loads the matched rows'
 * corpora, provenance-stamped and identity-deduped. Rows that do not prove
 * the match are reported in `exclusions` with verdict and reason; ambiguous
 * rows stay unmerged. Fail-soft like every library read: any storage
 * failure pools nothing and the scan behaves exactly as it did before.
 * ======================================================================== */

export const LIBRARY_FINGERPRINT_CANDIDATE_LIMIT = 200;

export type FingerprintLibraryPoolResult = {
  fingerprint: ProductFingerprint;
  /** Pooled, provenance-stamped, identity-deduped reviews from matched rows. */
  reviews: LibraryReviewRecord[];
  matchedProductKeys: string[];
  exclusions: PoolingExclusion[];
};

type LibraryListingRow = LibraryRow & {
  product_name?: unknown;
  brand?: unknown;
  store?: unknown;
  canonical_url?: unknown;
};

export async function loadFingerprintMatchedLibraryCorpus(
  identity: FingerprintInput,
  loadCorpus: typeof loadLibraryCorpus = loadLibraryCorpus
): Promise<FingerprintLibraryPoolResult> {
  const fingerprint = extractProductFingerprint(identity);
  const empty: FingerprintLibraryPoolResult = {
    fingerprint,
    reviews: [],
    matchedProductKeys: [],
    exclusions: [],
  };
  // An unanchored scan identity pools nothing: there is no strict way to
  // claim any stored product is this one.
  if (!fingerprint.fingerprintKey) return empty;
  try {
    const rows = await supabaseSelect<LibraryListingRow>(
      PRODUCT_REVIEW_LIBRARY_TABLE,
      `select=product_key,product_name,brand,store,canonical_url&order=updated_at.desc&limit=${LIBRARY_FINGERPRINT_CANDIDATE_LIMIT}`
    );
    const anchorListing: FingerprintInput = {
      brand: identity.brand ?? null,
      productName: identity.productName ?? identity.title ?? null,
      title: identity.title ?? identity.productName ?? null,
      model: identity.model ?? null,
      categoryBreadcrumbs: identity.categoryBreadcrumbs ?? null,
    };
    const exclusions: PoolingExclusion[] = [];
    const matchedProductKeys: string[] = [];
    let reviews: LibraryReviewRecord[] = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      const productKey = cleanText(row.product_key);
      const productName = cleanText(row.product_name);
      if (!productKey || !productName) continue;
      const listing: FingerprintInput = {
        brand: cleanText(row.brand) || null,
        productName,
        title: productName,
      };
      const forward = matchListingToFingerprint(fingerprint, listing);
      if (forward.verdict !== "match") {
        exclusions.push({
          productKey,
          againstKey: fingerprint.fingerprintKey,
          verdict: forward.verdict,
          reason: forward.reasons[0] || forward.verdict,
        });
        continue;
      }
      const backward = matchListingToFingerprint(
        extractProductFingerprint(listing),
        anchorListing
      );
      if (backward.verdict !== "match") {
        exclusions.push({
          productKey,
          againstKey: fingerprint.fingerprintKey,
          verdict: backward.verdict,
          reason: backward.reasons[0] || backward.verdict,
        });
        continue;
      }
      const entry = await loadCorpus(productKey);
      if (!entry.reviews.length) continue;
      matchedProductKeys.push(productKey);
      reviews = unionLibraryCorpora(
        reviews,
        entry.reviews.map((record) => stampReviewProvenance(record, productKey))
      );
    }
    return { fingerprint, reviews, matchedProductKeys, exclusions };
  } catch {
    return empty;
  }
}
