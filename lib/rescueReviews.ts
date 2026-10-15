/**
 * Owner-pasted rescue reviews: the owner researches a failed scan's product
 * personally (their own browser, their own eyes) and pastes the reviews they
 * found into the admin rescue page. This module parses the paste into
 * library-shaped records and consolidates them into the product library
 * with provenance "owner_research".
 *
 * Mirrors lib/sellerLibrary.ts record shape and load-merge-save discipline:
 * load the stored corpus first, fresh-first merge with body-key dedupe, and
 * save the consolidated corpus — scan evidence already in the library is
 * never wiped.
 */

import {
  LIBRARY_CORPUS_CAP,
  libraryProductKeyFor,
  loadLibraryCorpus,
  saveLibraryCorpus,
  type LibraryReviewRecord,
} from "@/lib/productReviewLibrary";

export const RESCUE_LIBRARY_PROVENANCE = "owner_research";

/** Minimum body length for a pasted block to be worth storing as evidence. */
const MIN_BODY_LENGTH = 20;

/** Maximum reviews accepted from a single paste. */
const MAX_REVIEWS_PER_PASTE = 100;

function cleanText(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Detect a rating prefix like "5 stars", "5/5", "4 out of 5", "★★★★★". Anchored: stray digits mid-sentence must not parse. */
export function parseRescueRatingPrefix(block: string): number | null {
  const head = block.trim().slice(0, 40).toLowerCase();
  const starRun = head.match(/^(★{1,5}|☆{1,5})(?:\s|$)/);
  if (starRun) {
    const solid = (starRun[1].match(/★/g) || []).length;
    if (solid >= 1 && solid <= 5) return solid;
  }
  const match = head.match(/^([1-5])(?:\.\d+)?\s*(?:\/\s*5|out of 5|stars?)(?=\s|$)/);
  if (match) {
    const n = Number(match[1]);
    if (n >= 1 && n <= 5) return n;
  }
  return null;
}

function stripRatingPrefix(block: string): string {
  // Only strip when a rating actually parsed (same anchor rules as the parser).
  if (parseRescueRatingPrefix(block) === null) return block.trim();
  return block
    .trim()
    .replace(/^([1-5](?:\.\d+)?\s*(?:\/\s*5|out of 5|stars?)|★{1,5}|☆{1,5})\s*/i, "")
    .trim();
}

/**
 * Parse owner-pasted text into library records. Blocks are split on blank
 * lines; each block with >=20 readable chars becomes a review. Returns the
 * parsed records (never throws).
 */
export function parseOwnerPastedReviews(
  text: string,
  source: { productUrl?: string | null; marketplace?: string | null }
): LibraryReviewRecord[] {
  const raw = String(text ?? "");
  if (!raw.trim()) return [];
  const blocks = raw
    .split(/\r?\n\s*\r?\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
  const records: LibraryReviewRecord[] = [];
  for (let index = 0; index < blocks.length && records.length < MAX_REVIEWS_PER_PASTE; index += 1) {
    const block = blocks[index];
    const rating = parseRescueRatingPrefix(block);
    const body = cleanText(stripRatingPrefix(block), 4000);
    if (body.length < MIN_BODY_LENGTH) continue;
    records.push({
      id: `owner-rescue-${index + 1}`,
      body,
      sourceUrl: source.productUrl ?? null,
      source: source.marketplace ?? null,
      title: null,
      rating,
      date: null,
      verified: false,
      provenance: RESCUE_LIBRARY_PROVENANCE,
    });
  }
  return records;
}

/** Normalized body key for dedupe (identical bodies must not double-count). */
function bodyKey(record: LibraryReviewRecord): string | null {
  const body = cleanText(record.body, 4000);
  if (!body) return null;
  return body.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Fresh-first merge with body-key dedupe + cap. Records already in the
 * stored corpus (from scans, captures, or seller imports) keep their
 * place and provenance; only genuinely new bodies are appended.
 */
export function mergeRescueReviewsWithCorpus(
  fresh: LibraryReviewRecord[],
  stored: LibraryReviewRecord[]
): LibraryReviewRecord[] {
  const seen = new Set<string>();
  for (const record of stored) {
    const key = bodyKey(record);
    if (key) seen.add(key);
  }
  const merged: LibraryReviewRecord[] = [...stored];
  for (const record of fresh) {
    const key = bodyKey(record);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(record);
    if (merged.length >= LIBRARY_CORPUS_CAP) break;
  }
  return merged;
}

function marketplaceFromUrl(productUrl: string | null | undefined): string | null {
  if (!productUrl) return null;
  try {
    return new URL(productUrl).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * Save owner-researched reviews into the product library under the queue
 * row's product key (load-merge-save). Returns the number of newly added
 * reviews, or 0 on any failure. Never throws.
 */
export async function saveRescueReviewsToLibrary(input: {
  productKey?: string | null;
  productUrl?: string | null;
  productName?: string | null;
  records: LibraryReviewRecord[];
}): Promise<{ saved: number; productKey: string | null }> {
  const productUrl = String(input.productUrl ?? "").trim() || null;
  const productKey =
    String(input.productKey ?? "").trim() ||
    (productUrl ? libraryProductKeyFor({ listingUrl: productUrl }) : null);
  if (!productKey || !input.records.length) return { saved: 0, productKey };
  try {
    const entry = await loadLibraryCorpus(productKey);
    const merged = mergeRescueReviewsWithCorpus(input.records, entry.reviews);
    const added = merged.length - entry.reviews.length;
    const ok = await saveLibraryCorpus({
      productKey,
      canonicalUrl: productUrl,
      productName: String(input.productName ?? "").trim() || null,
      brand: null,
      store: marketplaceFromUrl(productUrl),
      aggregateRating: null,
      aggregateCount: null,
      corpus: merged,
      previousScanCount: entry.scanCount,
    });
    return { saved: ok ? Math.max(0, added) : 0, productKey };
  } catch {
    return { saved: 0, productKey };
  }
}
