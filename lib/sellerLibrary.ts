/**
 * Seller import lane for the product review library.
 *
 * Sellers bring their OWN product's reviews (CSV upload). When the seller
 * supplies a product identity AND gives explicit consent, the accepted
 * review rows are consolidated into `product_review_library` under the same
 * `marketplace:identifier` key space as the scan/capture lanes — the
 * marketplace is always derived from the product-link hostname, never a
 * bare store name.
 *
 * Fail-soft by design: no consent, no identity, unreadable rows, or any
 * storage error leaves the seller report behaving exactly as it did before
 * the library existed. Records carry provenance "seller_csv_import".
 */
import {
  LIBRARY_CORPUS_CAP,
  libraryProductKeyFor,
  loadLibraryCorpus,
  saveLibraryCorpus,
  type LibraryReviewRecord,
} from "@/lib/productReviewLibrary";

export const SELLER_LIBRARY_PROVENANCE = "seller_csv_import";

/** Minimum body length for a CSV row to be worth storing as evidence. */
const MIN_BODY_LENGTH = 20;

type SellerRow = Record<string, unknown>;

function cleanText(value: unknown, maxLen: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Column candidates mirroring detectColumns in lib/sellerReviewIntelligence.ts. */
const BODY_CANDIDATES = [
  "review text",
  "review body",
  "review",
  "body",
  "comment",
  "comments",
  "content",
  "text",
  "feedback",
  "description",
  "message",
];
const RATING_CANDIDATES = ["rating", "stars", "star rating", "score"];
const DATE_CANDIDATES = ["review date", "date", "created at", "published", "timestamp"];
const TITLE_CANDIDATES = ["review title", "title", "headline", "subject"];
const VERIFIED_CANDIDATES = ["verified purchase", "verified"];

function findColumn(row: SellerRow, candidates: string[]): string | null {
  for (const header of Object.keys(row)) {
    const key = normalizeHeader(header);
    if (candidates.some((c) => key === c || key.includes(c))) return header;
  }
  return null;
}

function bodyColumns(row: SellerRow): string[] {
  return Object.keys(row).filter((header) => {
    const key = normalizeHeader(header);
    return BODY_CANDIDATES.some(
      (c) => key === c || key.endsWith(` ${c}`) || key.startsWith(`${c} `)
    );
  });
}

/** Same rating semantics as parseRating in lib/sellerReviewIntelligence.ts. */
function parseSellerRating(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 1 && value <= 5 ? Math.round(value) : null;
  }
  const text = cleanText(value, 40).toLowerCase();
  if (!text) return null;
  const direct = Number(text);
  if (Number.isFinite(direct) && direct >= 1 && direct <= 5) return Math.round(direct);
  const match = text.match(/([1-5])(?:\.\d+)?\s*(?:\/\s*5|out of 5|stars?)?/);
  if (match) {
    const n = Number(match[1]);
    if (n >= 1 && n <= 5) return n;
  }
  return null;
}

function parseSellerVerified(value: unknown): boolean | null {
  const text = cleanText(value, 20).toLowerCase();
  if (!text) return null;
  if (/^(yes|true|1|verified|y)$/.test(text)) return true;
  if (/^(no|false|0|n)$/.test(text)) return false;
  return null;
}

/** First non-empty value in an exact "asin" column (case-insensitive header). */
export function sellerAsinFromRows(rows: SellerRow[]): string | null {
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    for (const header of Object.keys(row)) {
      if (normalizeHeader(header) === "asin") {
        const value = cleanText(row[header], 40).toUpperCase();
        if (value) return value;
      }
    }
  }
  return null;
}

/**
 * Canonical library key for a seller import. The marketplace always comes
 * from the product-link hostname (the scan/capture key space); the
 * identifier is the CSV's ASIN column or an Amazon listing ID in the URL.
 * Returns null when no identity can be derived — no consolidation on a
 * fuzzy identity.
 */
export function sellerLibraryKeyFor(input: {
  productLink?: string | null;
  asin?: string | null;
}): string | null {
  const link = String(input.productLink ?? "").trim();
  if (!link) return null;
  return libraryProductKeyFor({
    asin: cleanText(input.asin, 40) || null,
    listingUrl: link,
  });
}

/** Map one CSV row to a library record, or null when it can't map honestly. */
function rowToLibraryRecord(
  row: SellerRow,
  index: number,
  source: { sourceUrl?: string; marketplace?: string }
): LibraryReviewRecord | null {
  const bodyHeader = bodyColumns(row)
    .map((header) => ({ header, text: cleanText(row[header], 4000) }))
    .filter(({ text }) => text.length >= MIN_BODY_LENGTH)
    .sort((a, b) => b.text.length - a.text.length)[0];
  if (!bodyHeader) return null;

  const ratingHeader = findColumn(row, RATING_CANDIDATES);
  const dateHeader = findColumn(row, DATE_CANDIDATES);
  const titleHeader = findColumn(row, TITLE_CANDIDATES);
  const verifiedHeader = findColumn(row, VERIFIED_CANDIDATES);

  return {
    id: `seller-csv-${index + 1}`,
    body: bodyHeader.text,
    sourceUrl: source.sourceUrl,
    source: source.marketplace,
    title: titleHeader ? cleanText(row[titleHeader], 200) || null : null,
    rating: ratingHeader ? parseSellerRating(row[ratingHeader]) : null,
    date: dateHeader ? cleanText(row[dateHeader], 60) || null : null,
    verified: verifiedHeader ? parseSellerVerified(row[verifiedHeader]) : null,
    provenance: SELLER_LIBRARY_PROVENANCE,
  };
}

/** Map CSV rows to library-shaped records, dropping unreadable rows. */
export function sellerRowsToLibraryRecords(
  rows: SellerRow[],
  opts: { productLink?: string | null }
): LibraryReviewRecord[] {
  const sourceUrl = String(opts.productLink ?? "").trim() || undefined;
  let marketplace: string | undefined;
  if (sourceUrl) {
    try {
      marketplace =
        new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, "") || undefined;
    } catch {
      marketplace = undefined;
    }
  }
  const records: LibraryReviewRecord[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const record = rowToLibraryRecord(row as SellerRow, index, { sourceUrl, marketplace });
    if (record) records.push(record);
  }
  return records;
}

/** Normalized body key for dedupe (cross-lane identical bodies must not double-count). */
function bodyKey(record: LibraryReviewRecord): string | null {
  const body = cleanText(record.body, 4000);
  if (!body) return null;
  return body.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Fresh-first merge with body-key dedupe + cap. The seller route has no
 * scoring pass of its own, so cross-lane duplicates (same body from a scan
 * or capture) are dropped here instead of relying on adjudication.
 */
export function mergeSellerReviewSets(
  fresh: LibraryReviewRecord[],
  stored: LibraryReviewRecord[],
  limit: number = LIBRARY_CORPUS_CAP
): LibraryReviewRecord[] {
  const seen = new Set<string>();
  const merged: LibraryReviewRecord[] = [];
  for (const record of [...fresh, ...stored]) {
    const key = bodyKey(record);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(record);
    if (merged.length >= limit) break;
  }
  return merged;
}

export type SellerLibraryWrite = {
  productKey: string;
  canonicalUrl: string | null;
  productName: string | null;
  corpus: LibraryReviewRecord[];
};

/**
 * Build the library write request for a seller import, or null when nothing
 * should be stored (no consent, no identity, or no mappable rows).
 */
export function buildSellerLibraryWrite(input: {
  consent: boolean;
  productLink?: string | null;
  rows: SellerRow[];
  productName?: string | null;
}): SellerLibraryWrite | null {
  if (!input.consent) return null;
  const productKey = sellerLibraryKeyFor({
    productLink: input.productLink,
    asin: sellerAsinFromRows(input.rows),
  });
  if (!productKey) return null;
  const corpus = sellerRowsToLibraryRecords(input.rows, {
    productLink: input.productLink,
  });
  if (!corpus.length) return null;
  const canonicalUrl = String(input.productLink ?? "").trim() || null;
  return {
    productKey,
    canonicalUrl,
    productName: String(input.productName ?? "").trim() || null,
    corpus,
  };
}

function hostnameOf(url: string | null): string | null {
  const value = String(url ?? "").trim();
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * Load the stored corpus, merge the seller's rows (dedupe by body), and
 * save back — incrementing the scan count from the loaded entry so a
 * seller import never resets or wipes scan evidence. Fire-and-forget
 * semantics: resolves false instead of throwing.
 */
export async function persistSellerImportToLibrary(
  write: SellerLibraryWrite
): Promise<boolean> {
  try {
    const entry = await loadLibraryCorpus(write.productKey);
    const merged = mergeSellerReviewSets(write.corpus, entry.reviews);
    if (!merged.length) return false;
    return await saveLibraryCorpus({
      productKey: write.productKey,
      canonicalUrl: write.canonicalUrl,
      productName: write.productName,
      brand: null,
      store: hostnameOf(write.canonicalUrl),
      aggregateRating: null,
      aggregateCount: null,
      corpus: merged,
      previousScanCount: entry.scanCount,
    });
  } catch {
    return false;
  }
}
