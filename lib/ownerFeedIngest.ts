/**
 * Owner-Feed ingestion: Junel hand-copies real reviews (.docx batches,
 * structured into the ~/workspace/review-library-inbox/ batch files).
 * This module parses a batch file into library-shaped review records and
 * consolidates them into the SAME product_review_library that scans use,
 * with provenance "owner_fed" — so a later scan consolidates them like
 * scan evidence and shoppers see honest, human-supplied reviews.
 *
 * The parser is STRICT: any entry whose header/meta/body cannot be parsed
 * fails the whole batch loudly with the offending entry named. Nothing is
 * guessed. The one documented anomaly (AirPods batch: review 51's reviewer
 * name "(not captured)") is carried verbatim with an explicit ingest note —
 * it is real data from the batch, not an invention.
 *
 * Owner rules: zero OpenAI; no invented review data.
 */

import {
  LIBRARY_CORPUS_CAP,
  libraryProductKeyFor,
  loadLibraryCorpus,
  saveLibraryCorpus,
  type LibraryReviewRecord,
} from "@/lib/productReviewLibrary";
import {
  adaptOwnerFeedReview,
  sortReviewBatch,
  sortAnnotationsFor,
  type SortedReviewAnnotations,
} from "@/lib/reviewSorter";

/** Provenance for owner hand-fed reviews. Rescue-lane uses "owner_research" (a
 *  different intake: owner researched a failed scan). These are distinct. */
export const OWNER_FEED_PROVENANCE = "owner_fed";

/** Honest source label: the review IS an amazon marketplace review; the
 *  parenthetical marks how RI obtained it, so it can never be mistaken for
 *  a fresh collector retrieval. */
export const OWNER_FEED_SOURCE = "Amazon marketplace review (hand-fed by owner)";

const MAX_BODY_LENGTH = 6000;

/** Thin bodies the adjudication itself would reject (<12 chars): skipped at
 *  ingest, reported loudly in the receipt — never invented, never silent. */
const ADJUDICATION_MIN_BODY = 12;

export type OwnerFeedBatch = {
  productId: string; // 10-char ASIN, uppercase
  productTitle: string;
  productUrl: string;
  store: string; // e.g. "amazon.ca"
  receivedAt: string; // ISO
  declaredCount: number;
  declaredDistribution: Record<number, number>;
  reviews: OwnerFeedReview[]; // storable (body >= adjudication minimum)
  skippedShortBodies: Array<{ index: number; rating: number; chars: number }>;
};

export type OwnerFeedReview = {
  index: number;
  reviewer: string;
  rating: number; // 1..5
  title: string;
  reviewDate: string; // ISO date YYYY-MM-DD
  body: string;
  helpfulCount: number | null;
  hasAttachments: boolean;
  ingestNote: string | null; // set only for documented anomalies
};

type FrontMatter = {
  product: string;
  product_id: string;
  product_url: string;
  store: string;
  review_count: number;
  rating_distribution: Record<number, number>;
  received: string;
};

function fail(message: string): never {
  throw new Error(`owner-feed-ingest: ${message}`);
}

function parseFrontMatter(text: string): { fm: FrontMatter; rest: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) fail("missing YAML front matter block (expected '---' ... '---' header)");
  const raw = match[1];
  const rest = match[2];
  const get = (key: string): string | null => {
    const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith(`${key}:`));
    return line ? line.slice(line.indexOf(":") + 1).trim() : null;
  };
  const productId = (get("product_id") || "").toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(productId))
    fail(`front matter product_id is not a 10-char ASIN (got "${productId}")`);
  const distRaw = get("rating_distribution") || get("rating_distribution_in_paste") || "";
  const distribution: Record<number, number> = {};
  for (const m of distRaw.matchAll(/(\d)-star\s*x(\d+)/g)) {
    distribution[Number(m[1])] = Number(m[2]);
  }
  if (!Object.keys(distribution).length)
    fail(`front matter rating_distribution unreadable (got "${distRaw}")`);
  const received = get("received") || "";
  const receivedIso = toIsoDateTime(received);
  if (!receivedIso) fail(`front matter received timestamp unreadable (got "${received}")`);
  return {
    fm: {
      product: get("product") || "",
      product_id: productId,
      product_url: get("product_url") || "",
      store: (get("store") || "").toLowerCase(),
      review_count: Number(get("review_count") || 0),
      rating_distribution: distribution,
      received: receivedIso,
    },
    rest,
  };
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function toIsoDate(monthName: string, day: string, year: string): string | null {
  const month = MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  const d = Number(day);
  const y = Number(year);
  if (!d || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function toIsoDateTime(value: string): string | null {
  // Accepts ISO already, or "Month D, YYYY".
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return new Date(direct).toISOString();
  const m = value.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  return m ? toIsoDate(m[1], m[2], m[3]) : null;
}

/**
 * Parse one batch file's text into a structured batch. Throws on any
 * malformed entry (loud failure, never a guess).
 */
export function parseOwnerFeedBatch(text: string): OwnerFeedBatch {
  const { fm, rest } = parseFrontMatter(text);
  // The markdown title + Notes section precede the first review block.
  // Blocks start at lines like "## 12. Name - 5 out of 5 stars - Title".
  const firstReviewAt = rest.search(/^## \d+\./m);
  if (firstReviewAt < 0) fail("no review blocks found (expected '## N.' headers)");
  const blocks = rest
    .slice(firstReviewAt)
    .split(/^## /m)
    .map((b) => b.trim())
    .filter(Boolean);
  const distribution: Record<number, number> = {};
  const allReviews: OwnerFeedReview[] = [];
  for (const block of blocks) {
    allReviews.push(parseReviewBlock(block, fm, allReviews.length + 1));
  }
  if (allReviews.length !== fm.review_count) {
    fail(
      `header count ${allReviews.length} does not match front matter review_count ${fm.review_count}`
    );
  }
  for (const r of allReviews) distribution[r.rating] = (distribution[r.rating] || 0) + 1;
  const declared = fm.rating_distribution;
  const distKeys = new Set([...Object.keys(distribution), ...Object.keys(declared)]);
  for (const k of distKeys) {
    if ((distribution[Number(k)] || 0) !== (declared[Number(k)] || 0)) {
      fail(
        `parsed rating distribution ${JSON.stringify(distribution)} does not match front matter ${JSON.stringify(declared)}`
      );
    }
  }
  // Thin bodies (<12 chars) are real reviews but below the adjudication's own
  // evidence floor: skipped at ingest and reported loudly, never stored.
  const skippedShortBodies: Array<{ index: number; rating: number; chars: number }> = [];
  const reviews = allReviews.filter((r) => {
    if (r.body.length < ADJUDICATION_MIN_BODY) {
      skippedShortBodies.push({ index: r.index, rating: r.rating, chars: r.body.length });
      return false;
    }
    return true;
  });
  return {
    productId: fm.product_id,
    productTitle: fm.product,
    productUrl: fm.product_url,
    store: fm.store,
    receivedAt: fm.received,
    declaredCount: fm.review_count,
    declaredDistribution: declared,
    reviews,
    skippedShortBodies,
  };
}

function parseReviewBlock(block: string, fm: FrontMatter, expectedIndex: number): OwnerFeedReview {
  const lines = block.split(/\r?\n/);
  const header = lines[0].trim();
  const h = header.match(/^(\d+)\.\s+(.+?)\s+-\s+(\d)\s+out of 5 stars\s+-\s+(.*)$/);
  if (!h) fail(`entry #${expectedIndex}: unparseable review header: "${header.slice(0, 80)}"`);
  const index = Number(h[1]);
  if (index !== expectedIndex)
    fail(`review numbering breaks: expected #${expectedIndex}, found #${index}`);
  const rating = Number(h[3]);
  if (rating < 1 || rating > 5) fail(`entry #${index}: rating out of range: ${rating}`);
  const reviewer = h[2].trim();
  const title = h[4].trim();

  const metaLine = (lines[1] || "").trim();
  const meta = metaLine.match(/^Reviewed in [A-Za-z ]+ on ([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*\|\s*Verified Purchase/);
  if (!meta) fail(`entry #${index}: unparseable meta line: "${metaLine.slice(0, 80)}"`);
  const reviewDate = toIsoDate(meta[1], meta[2], meta[3]);
  if (!reviewDate) fail(`entry #${index}: unreadable review date in meta line`);

  let helpfulCount: number | null = null;
  let hasAttachments = false;
  const bodyLines: string[] = [];
  for (const line of lines.slice(2)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("Helpful count shown:")) {
      const hm = t.match(/(\d+)\s+people? found this helpful/);
      helpfulCount = hm ? Number(hm[1]) : 0;
      continue;
    }
    if (t.startsWith("Attachments in original:")) {
      hasAttachments = true;
      continue;
    }
    bodyLines.push(t);
  }
  const body = bodyLines.join("\n\n");
  if (body.length > MAX_BODY_LENGTH)
    fail(`entry #${index}: body suspiciously long (${body.length} chars) — refusing to store`);

  return {
    index,
    reviewer,
    rating,
    title,
    reviewDate,
    body,
    helpfulCount,
    hasAttachments,
    ingestNote: reviewer === "(not captured)" ? "reviewer name was not captured in the owner paste" : null,
  };
}

/**
 * Normalized body key for dedupe: identical review bodies must never
 * double-count, whether the duplicate comes from the batch or the scan
 * corpus already stored.
 */
export function ownerFeedBodyKey(body: unknown): string | null {
  const b = String(body ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return b || null;
}

/**
 * Build the library-shaped record for one owner-fed review. Field mapping:
 * - body/title/rating/date/verifier fields mirror the native collector
 *   record shape (adjudication reads exactly these).
 * - sourceUrl + marketplaceProductId carry the exact listing identity, so
 *   the adjudication's exact-listing association passes like a fresh record.
 * - source is an honest label ("marketplace review, hand-fed by owner") —
 *   it is NOT presented as a fresh collector retrieval.
 * - provenance "owner_fed" marks how RI obtained the record (distinct from
 *   rescue's "owner_research").
 */
export function ownerFeedReviewRecord(
  review: OwnerFeedReview,
  batch: OwnerFeedBatch,
  /** Sorter-bot annotations (theme tags, direction, serious markers, variant). */
  annotations?: SortedReviewAnnotations | null
): LibraryReviewRecord {
  const id = `owner-fed-${batch.productId.toLowerCase()}-${review.index}`;
  const record: LibraryReviewRecord = {
    id,
    reviewId: id,
    body: review.body,
    title: review.title,
    rating: review.rating,
    date: review.reviewDate,
    retrievedAt: batch.receivedAt,
    reviewerName: review.reviewer,
    verified: true,
    reviewStructureVerified: true,
    marketplaceProductId: batch.productId,
    reviewedProductName: batch.productTitle,
    reviewedProductNameSource: "owner_feed_batch",
    sourceUrl: batch.productUrl,
    source: OWNER_FEED_SOURCE,
    helpfulCount: review.helpfulCount,
    hasAttachments: review.hasAttachments,
    provenance: OWNER_FEED_PROVENANCE,
    batchReceivedAt: batch.receivedAt,
    ingestNote: review.ingestNote,
  };
  if (annotations) {
    record.themeTags = annotations.themeTags;
    record.sortDirection = annotations.sortDirection;
    record.sortSentimentScore = annotations.sortSentimentScore;
    record.sortSerious = annotations.sortSerious;
    record.sortSeriousKinds = annotations.sortSeriousKinds;
    record.variantAttributes = annotations.variantAttributes;
    record.sortFlags = annotations.sortFlags;
  }
  return record;
}

export type IngestReceipt = {
  ok: boolean;
  productKey: string;
  productId: string;
  parsed: number;
  ingested: number;
  skippedShortBodies: Array<{ index: number; rating: number; chars: number }>;
  distribution: Record<number, number>;
  added: number;
  duplicatesSkipped: number;
  /** Reviews never examined because the 500-cap break fired (see ingest loop).
   *  Identity: parsed = added + duplicatesSkipped + capDropped + skippedShortBodies.length. */
  capDropped: number;
  storedTotal: number;
  scanCount: number;
  /** Sorter-bot outcome (additive; never changes the ingest contract). */
  sorter: { annotated: number; rejected: number; failed: boolean };
  error?: string;
};

/**
 * Ingest one batch file's text into the product library. Store functions
 * are injected so tests can run against a stub; the API route wires the
 * real loadLibraryCorpus/saveLibraryCorpus.
 *
 * Merge discipline: stored corpus keeps its records (place + provenance);
 * only genuinely new bodies are appended; identical re-ingest adds nothing.
 */
export async function ingestOwnerFeedBatch(
  batchText: string,
  store: {
    loadCorpus: (productKey: string) => Promise<{ reviews: LibraryReviewRecord[]; scanCount: number }>;
    saveCorpus: (input: {
      productKey: string;
      canonicalUrl?: string | null;
      productName?: string | null;
      store?: string | null;
      corpus: LibraryReviewRecord[];
      previousScanCount: number;
    }) => Promise<boolean>;
  }
): Promise<IngestReceipt> {
  const batch = parseOwnerFeedBatch(batchText);
  const productKey = libraryProductKeyFor({
    asin: batch.productId,
    store: batch.store,
    listingUrl: batch.productUrl,
  });
  if (!productKey) fail(`no canonical library key for product ${batch.productId}`);

  const existing = await store.loadCorpus(productKey);
  const seen = new Set<string>();
  for (const record of existing.reviews) {
    const key = ownerFeedBodyKey(record.body);
    if (key) seen.add(key);
  }

  // SORTER BOT (additive, fail-soft): annotate the batch's reviews with
  // theme tags, direction, serious markers and variant attribution before
  // the save. Any sorter failure returns the ingest to the exact
  // pre-sorter path — parsing, dedupe and the save are unchanged.
  let sortAnnotations = new Map<string, SortedReviewAnnotations>();
  let sorterRejected = 0;
  let sorterFailed = false;
  try {
    const adapted = batch.reviews.map((r) => adaptOwnerFeedReview(r, batch));
    const sortResult = sortReviewBatch({
      feed: "owner_feed",
      records: adapted,
      productKey,
      productUrl: batch.productUrl,
      existingBodyKeys: seen,
    });
    sorterRejected = sortResult.rejected.length;
    for (const sorted of sortResult.sorted) {
      sortAnnotations.set(sorted.id, sortAnnotationsFor(sorted));
    }
  } catch {
    sorterFailed = true;
    sortAnnotations = new Map();
  }

  const fresh: LibraryReviewRecord[] = [];
  let duplicatesSkipped = 0;
  let capDropped = 0;
  for (let i = 0; i < batch.reviews.length; i++) {
    const review = batch.reviews[i];
    const id = `owner-fed-${batch.productId.toLowerCase()}-${review.index}`;
    const record = ownerFeedReviewRecord(review, batch, sortAnnotations.get(id) ?? null);
    const key = ownerFeedBodyKey(record.body);
    if (key && seen.has(key)) {
      duplicatesSkipped += 1;
      continue;
    }
    if (key) seen.add(key);
    fresh.push(record);
    if (fresh.length + existing.reviews.length >= LIBRARY_CORPUS_CAP) {
      // Reviews past this point were never examined (cap break, not dedupe).
      capDropped = batch.reviews.length - i - 1;
      break;
    }
  }
  const corpus = [...existing.reviews, ...fresh].slice(0, LIBRARY_CORPUS_CAP);
  const saved = await store.saveCorpus({
    productKey,
    canonicalUrl: batch.productUrl,
    productName: batch.productTitle,
    store: batch.store,
    corpus,
    previousScanCount: existing.scanCount, // scanCount unchanged: ingestion is not a scan
  });
  if (!saved) fail(`storage refused the write for ${productKey}`);
  return {
    ok: true,
    productKey,
    productId: batch.productId,
    parsed: batch.declaredCount,
    ingested: batch.reviews.length,
    skippedShortBodies: batch.skippedShortBodies,
    distribution: batch.declaredDistribution,
    added: fresh.length,
    duplicatesSkipped,
    capDropped,
    storedTotal: corpus.length,
    scanCount: existing.scanCount,
    sorter: {
      annotated: sortAnnotations.size,
      rejected: sorterRejected,
      failed: sorterFailed,
    },
  };
}

/** Production wiring: the real Supabase-backed load/save. */
export async function ingestOwnerFeedBatchLive(batchText: string): Promise<IngestReceipt> {
  return ingestOwnerFeedBatch(batchText, {
    loadCorpus: loadLibraryCorpus,
    saveCorpus: (input) => saveLibraryCorpus({ ...input, scanIncrement: 0 }),
  });
}
