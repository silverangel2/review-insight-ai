/**
 * Review sorter: the deterministic intake sorter standing at EVERY feed
 * boundary (owner feed, community, collected scan records).
 *
 * Every incoming review leaves here with:
 *   - the canonical productKey (never invented — null when unknowable),
 *   - stars preserved exactly as supplied,
 *   - theme tags from the ONE dimension map (lib/analysisCopy.ts
 *     DIMENSION_DEPTH + DIMENSION_ALIASES — imported, never duplicated),
 *   - direction for/against/mixed from stars plus the scorer's own
 *     sentiment word lists with its negation guard (lib/buyingScore.ts —
 *     imported, never duplicated),
 *   - provenance preserved verbatim,
 *   - variant attribution when the link carries it (see
 *     lib/productIdentity.ts),
 *   - a serious marker when the text hits a severity:"red" dimension —
 *     serious negatives are NEVER dropped for shortness.
 *
 * Rejections are named, never silent: duplicate | junk | too_short |
 * missing_stars | missing_body. The shortness floor (12 chars) matches the
 * owner-feed ingest precedent (ADJUDICATION_MIN_BODY): bodies the
 * adjudication itself would reject.
 *
 * Deterministic, zero OpenAI, zero network. The sorter annotates and
 * rejects; it never deletes stored data and never changes score math.
 */

import { DIMENSION_ALIASES, DIMENSION_DEPTH, depthFor } from "@/lib/analysisCopy";
import {
  NEGATIVE_WORDS,
  NEGATORS,
  POSITIVE_WORDS,
  countUnnegated,
} from "@/lib/buyingScore";
import { parseProductLink, type VariantAttributes } from "@/lib/productIdentity";

export type SorterFeed = "owner_feed" | "community" | "collected";

export type RawReviewInput = {
  /** Stable per-feed id (e.g. "owner-fed-b0dgjdkhrq-51"). */
  id: string;
  /** Original 1-based index inside the feed batch, when the feed has one. */
  index?: number | null;
  body: string;
  title?: string | null;
  /** 1..5, or null when the feed did not supply stars. */
  stars: number | null;
  reviewerName?: string | null;
  date?: string | null;
  productUrl?: string | null;
  /** Provenance preserved verbatim ("owner_fed", "reviewintel_community", ...). */
  provenance: string;
};

export type ReviewDirection = "for" | "against" | "mixed" | "unknown";

export type SortedReview = RawReviewInput & {
  productKey: string | null;
  /** Dimension keys from the analysis copy deck (canonical, aliases resolved). */
  themeTags: string[];
  /** True when any theme tag is a severity:"red" dimension. */
  serious: boolean;
  seriousKinds: string[];
  direction: ReviewDirection;
  /** Blended stars+lexicon sentiment, -1..1 (same blend as the scorer). */
  sentimentScore: number;
  variant: VariantAttributes | null;
  /** Normalized body identity used for duplicate detection. */
  bodyKey: string | null;
  /** Processing notes, e.g. ["serious_short"] — never customer-facing. */
  sortFlags: string[];
};

export type SortRejectionReason =
  | "duplicate"
  | "junk"
  | "too_short"
  | "missing_stars"
  | "missing_body";

export type SortRejection = {
  id: string;
  index?: number | null;
  reason: SortRejectionReason;
  detail: string;
};

export type SortResult = {
  productKey: string | null;
  sorted: SortedReview[];
  rejected: SortRejection[];
};

/** Annotations a feed boundary stamps onto the stored record (all optional). */
export type SortedReviewAnnotations = {
  themeTags: string[];
  sortDirection: ReviewDirection;
  sortSentimentScore: number;
  sortSerious: boolean;
  sortSeriousKinds: string[];
  variantAttributes: VariantAttributes | null;
  sortFlags: string[];
};

export function sortAnnotationsFor(record: SortedReview): SortedReviewAnnotations {
  return {
    themeTags: record.themeTags,
    sortDirection: record.direction,
    sortSentimentScore: record.sentimentScore,
    sortSerious: record.serious,
    sortSeriousKinds: record.seriousKinds,
    variantAttributes: record.variant,
    sortFlags: record.sortFlags,
  };
}

/** Shortness floor: matches the owner-feed ingest precedent (12 chars). */
export const SORTER_MIN_BODY = 12;

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function wordHit(haystack: string, phrase: string): boolean {
  const p = phrase.trim().toLowerCase();
  if (!p) return false;
  return new RegExp(`\\b${escapeRegExp(p)}\\b`, "i").test(haystack);
}

/**
 * Map text to dimension keys, mirroring the existing matchDimension
 * precedence in lib/reviewAnalysis.ts: direct key hit, then alias hit,
 * then the dimension's loose signal keywords. Deterministic order: the
 * DIMENSION_DEPTH declaration order.
 */
/**
 * Dimension keys that may never be emitted as theme tags. The
 * `__generic_concern` placeholder is a mined-text fallback inside
 * reviewAnalysis.ts that Round 3's evidence gate drops before render —
 * the sorter tags only what it can evidence; an empty tag list is the
 * honest "no theme matched" outcome.
 */
const BANNED_TAG_KEYS = new Set(["__generic_concern"]);

export function matchThemeTags(text: string): string[] {
  const hay = String(text ?? "");
  if (!hay.trim()) return [];
  const found: string[] = [];
  const add = (key: string): void => {
    if (BANNED_TAG_KEYS.has(key)) return;
    if (!found.includes(key)) found.push(key);
  };
  // Direct key hits.
  for (const key of Object.keys(DIMENSION_DEPTH)) {
    if (wordHit(hay, key)) add(key);
  }
  // Alias hits resolve to the canonical key.
  for (const alias of Object.keys(DIMENSION_ALIASES)) {
    if (wordHit(hay, alias)) {
      const canonical = DIMENSION_ALIASES[alias];
      if (DIMENSION_DEPTH[canonical]) add(canonical);
    }
  }
  // Loose signal keywords.
  for (const key of Object.keys(DIMENSION_DEPTH)) {
    if (found.includes(key)) continue;
    const signals = DIMENSION_DEPTH[key].signals || [];
    if (signals.some((s) => wordHit(hay, s))) add(key);
  }
  return found;
}

/** True when the text hits any severity:"red" dimension (counterfeit, safety, died...). */
export function isSeriousNegative(text: string): { serious: boolean; kinds: string[] } {
  const kinds = matchThemeTags(text).filter((key) => depthFor(key)?.severity === "red");
  return { serious: kinds.length > 0, kinds };
}

/**
 * Normalized body identity for duplicate detection — same normalization
 * the owner-feed ingest lane uses (lowercased, whitespace-collapsed).
 * Body-only: the same words twice are one review for counting purposes,
 * whoever is named on them.
 */
export function sorterBodyKey(body: unknown): string | null {
  const b = String(body ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return b || null;
}

function clampScore(v: number): number {
  return Math.max(-1, Math.min(1, Math.round(v * 1000) / 1000));
}

/**
 * Direction from stars + the scorer's unnegated sentiment lexicon.
 * Stars lead (they are the buyer's own verdict); the lexicon resolves
 * 3-star reviews and flags conflicted ones as mixed.
 */
export function directionForReview(
  stars: number,
  text: string
): { direction: ReviewDirection; sentimentScore: number; positive: number; negative: number } {
  const pos = countUnnegated(text, POSITIVE_WORDS);
  const neg = countUnnegated(text, NEGATIVE_WORDS);
  const lex = pos + neg > 0 ? (pos - neg) / (pos + neg) : 0;
  const sentimentScore = clampScore(0.6 * ((stars - 3) / 2) + 0.4 * lex);
  let direction: ReviewDirection;
  if (stars >= 4) direction = neg > pos * 2 ? "mixed" : "for";
  else if (stars <= 2) direction = pos > neg * 2 ? "mixed" : "against";
  else direction = pos > neg ? "for" : neg > pos ? "against" : "mixed";
  return { direction, sentimentScore, positive: pos, negative: neg };
}

function junkKind(body: string): "missing_body" | "junk" | "too_short" | null {
  const trimmed = body.trim();
  if (!trimmed) return "missing_body";
  const letters = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (letters.length < 3) return "junk"; // "ok", "n/a", "...", emoji-only
  if (trimmed.length < SORTER_MIN_BODY) return "too_short";
  return null;
}

function validStars(stars: unknown): number | null {
  if (typeof stars !== "number" || !Number.isFinite(stars)) return null;
  const rounded = Math.round(stars);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
}

export type SortBatchInput = {
  feed: SorterFeed;
  records: RawReviewInput[];
  /** Known canonical key (feed-level). Falls back to productUrl parsing. */
  productKey?: string | null;
  /** Feed-level product link (batch URL, result-page URL...). */
  productUrl?: string | null;
  /** Body keys already stored for this product — sorter-level dedupe. */
  existingBodyKeys?: Iterable<string> | null;
};

function resolveProductKey(input: SortBatchInput): string | null {
  if (input.productKey) return input.productKey;
  if (input.productUrl) {
    const parsed = parseProductLink(input.productUrl);
    if (parsed.ok) return parsed.canonicalKey;
  }
  return null;
}

function resolveVariant(record: RawReviewInput, feedUrl: string | null): VariantAttributes | null {
  const url = record.productUrl || feedUrl;
  if (!url) return null;
  const parsed = parseProductLink(url);
  return parsed.ok ? parsed.variant : null;
}

/**
 * Sort one feed batch. Deterministic; throws only on programmer-shaped
 * input (non-array records) — per-record problems become rejections, and
 * callers wrap the whole call in try/catch so a sorter failure returns the
 * feed to its pre-sorter path.
 */
export function sortReviewBatch(input: SortBatchInput): SortResult {
  if (!input || !Array.isArray(input.records))
    throw new Error("review-sorter: records must be an array");
  const productKey = resolveProductKey(input);
  const existing = new Set<string>();
  if (input.existingBodyKeys) {
    for (const key of input.existingBodyKeys) if (key) existing.add(key);
  }
  const batchSeen = new Set<string>();
  const sorted: SortedReview[] = [];
  const rejected: SortRejection[] = [];

  for (const record of input.records) {
    const id = String(record?.id ?? "");
    const index = record?.index ?? null;
    const body = String(record?.body ?? "");
    const reject = (reason: SortRejectionReason, detail: string): void => {
      rejected.push({ id, index, reason, detail });
    };

    const junk = junkKind(body);
    if (junk === "missing_body") {
      reject("missing_body", "no review text supplied");
      continue;
    }
    const stars = validStars(record?.stars);
    if (stars === null) {
      reject("missing_stars", "stars missing or outside 1..5");
      continue;
    }
    const textForTags = `${String(record?.title ?? "")} ${body}`;
    const serious = isSeriousNegative(textForTags);
    const flags: string[] = [];
    if (junk === "junk" || junk === "too_short") {
      if (serious.serious) {
        // Serious negatives are NEVER dropped for shortness.
        flags.push("serious_short");
      } else {
        reject(
          junk,
          junk === "junk"
            ? "content-free one-liner"
            : `body ${body.trim().length} chars, below the ${SORTER_MIN_BODY}-char evidence floor`
        );
        continue;
      }
    }

    const bodyKey = sorterBodyKey(body);
    if (bodyKey && (batchSeen.has(bodyKey) || existing.has(bodyKey))) {
      reject("duplicate", "identical review body already seen for this product");
      continue;
    }
    if (bodyKey) batchSeen.add(bodyKey);

    const themeTags = matchThemeTags(textForTags);
    const dir = directionForReview(stars, textForTags);
    const variant = resolveVariant(record, input.productUrl ?? null);

    sorted.push({
      ...record,
      id,
      index,
      body,
      stars,
      productKey,
      themeTags,
      serious: serious.serious,
      seriousKinds: serious.kinds,
      direction: dir.direction,
      sentimentScore: dir.sentimentScore,
      variant,
      bodyKey,
      sortFlags: flags,
    });
  }

  return { productKey, sorted, rejected };
}

// ---------------------------------------------------------------------------
// Feed adapters: normalize each feed's native record shape to RawReviewInput.
// Structural typing on purpose — the sorter stays dependency-light and each
// feed's wiring module owns its real types.
// ---------------------------------------------------------------------------

export type OwnerFeedLike = {
  index: number;
  body: string;
  title?: string | null;
  rating: number;
  reviewer?: string | null;
  reviewDate?: string | null;
};

export type OwnerBatchLike = {
  productId: string;
  productUrl?: string | null;
};

export function adaptOwnerFeedReview(review: OwnerFeedLike, batch: OwnerBatchLike): RawReviewInput {
  const pid = String(batch.productId ?? "").toLowerCase();
  return {
    id: `owner-fed-${pid}-${review.index}`,
    index: review.index,
    body: String(review.body ?? ""),
    title: review.title ?? null,
    stars: Number(review.rating),
    reviewerName: review.reviewer ?? null,
    date: review.reviewDate ?? null,
    productUrl: batch.productUrl ?? null,
    provenance: "owner_fed",
  };
}

export function adaptCommunityRow(row: Record<string, unknown>): RawReviewInput {
  const id = String(row.id ?? "");
  return {
    id: `community-${id}`,
    body: String(row.body ?? ""),
    title: null,
    stars: typeof row.stars === "number" ? row.stars : Number(row.stars),
    reviewerName: null,
    date: row.created_at ? String(row.created_at) : null,
    productUrl: row.product_url ? String(row.product_url) : null,
    provenance: "reviewintel_community",
  };
}

export function adaptCollectedRecord(record: Record<string, unknown>): RawReviewInput {
  const id =
    String(record.reviewId ?? record.id ?? "") || `collected-${sorterBodyKey(record.body) ?? "unknown"}`;
  return {
    id,
    body: String(record.body ?? ""),
    title: record.title != null ? String(record.title) : null,
    stars: typeof record.rating === "number" ? record.rating : Number(record.rating),
    reviewerName: record.reviewerName != null ? String(record.reviewerName) : null,
    date: record.date != null ? String(record.date) : null,
    productUrl: record.sourceUrl != null ? String(record.sourceUrl) : null,
    provenance: record.provenance != null ? String(record.provenance) : "collected",
  };
}
