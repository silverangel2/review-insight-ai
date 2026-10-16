/**
 * First-party community reviews: shoppers write product reviews on
 * ReviewIntel itself.
 *
 * Every review is tied to a product library key (`marketplace:identifier`,
 * same key space as scans, page captures and seller imports) and moderated
 * through pending/approved/hidden. The tier rule (Junel's decision):
 *
 *  - Tier A (approved AND purchase-verified): eligible to feed the product
 *    library corpus via saveLibraryCorpus with provenance
 *    "reviewintel_community". Displayed and scored.
 *  - Tier B (everything else approved): displayed as "community
 *    experiences" on the result view only, never touching the
 *    Buying Score corpus.
 *
 * The code is inert until the `community_reviews` migration is applied:
 * supabaseSelect/supabaseUpsert resolve null/[] when the table (or env)
 * is missing, and every function here degrades instead of throwing.
 */
import {
  isSupabaseConfigured,
  supabaseSelect,
  supabaseUpdate,
  supabaseUpsert,
} from "@/lib/supabaseServer";
import {
  LIBRARY_CORPUS_CAP,
  loadLibraryCorpus,
  saveLibraryCorpus,
  type LibraryReviewRecord,
} from "@/lib/productReviewLibrary";
import {
  adaptCommunityRow,
  sortAnnotationsFor,
  sortReviewBatch,
  sorterBodyKey,
  type SortedReviewAnnotations,
} from "@/lib/reviewSorter";

export const COMMUNITY_REVIEWS_TABLE = "community_reviews";
export const COMMUNITY_REVIEW_ASKS_TABLE = "community_review_asks";
export const COMMUNITY_PROVENANCE = "reviewintel_community";

export const COMMUNITY_BODY_MIN = 20;
export const COMMUNITY_BODY_MAX = 4000;
export const COMMUNITY_STORE_MAX = 120;
export const COMMUNITY_PRODUCT_NAME_MAX = 200;
export const COMMUNITY_URL_MAX = 500;

export type CommunityReviewStatus = "pending" | "approved" | "hidden";

export type CommunityReview = {
  id: string;
  account_email?: string;
  product_key: string;
  product_name?: string | null;
  product_url?: string | null;
  stars: number;
  body: string;
  store?: string | null;
  bought_it: boolean;
  verified_purchase: boolean;
  proof_sha256?: string | null;
  proof_ocr_confidence?: number | null;
  status: CommunityReviewStatus;
  created_at?: string;
  updated_at?: string;
};

export type PublicCommunityReview = {
  id: string;
  stars: number;
  body: string;
  store: string | null;
  bought_it: boolean;
  verified_purchase: boolean;
  created_at: string | null;
};

export class CommunityReviewError extends Error {
  code: "VALIDATION" | "STORAGE";
  constructor(code: "VALIDATION" | "STORAGE", message: string) {
    super(message);
    this.code = code;
  }
}

type StorageDeps = {
  select: typeof supabaseSelect;
  upsert: typeof supabaseUpsert;
  update: typeof supabaseUpdate;
  loadCorpus?: typeof loadLibraryCorpus;
  saveCorpus?: typeof saveLibraryCorpus;
};

const defaultDeps: StorageDeps = {
  select: supabaseSelect,
  upsert: supabaseUpsert,
  update: supabaseUpdate,
};

function cleanText(value: unknown, max: number, fallback = "") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase().slice(0, 160);
  return email.includes("@") ? email : "";
}

/**
 * Normalize any product-key rendering into the canonical
 * `marketplace:identifier` form. Accepts the analyze response's
 * space-separated form ("amazon.ca b0dgjdkhrq") and the colon form
 * ("amazon.ca:B0DGJDKHRQ").
 */
export function normalizeProductKey(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parts = raw.split(/[:\s]+/).filter(Boolean);
  if (parts.length < 2) return null;
  const marketplace = parts[0].toLowerCase().replace(/^www\./, "");
  const identifier = parts.slice(1).join("").toUpperCase();
  if (!/^[a-z0-9][a-z0-9.-]*$/i.test(marketplace)) return null;
  if (!/^[A-Z0-9_-]{4,64}$/.test(identifier)) return null;
  return `${marketplace}:${identifier}`;
}

function asStatus(value: unknown): CommunityReviewStatus {
  return value === "approved" || value === "hidden" ? value : "pending";
}

function rowToReview(row: Record<string, unknown>): CommunityReview {
  return {
    id: String(row.id ?? ""),
    account_email: row.account_email ? String(row.account_email) : undefined,
    product_key: String(row.product_key ?? ""),
    product_name: row.product_name ? String(row.product_name) : null,
    product_url: row.product_url ? String(row.product_url) : null,
    stars: Number(row.stars) || 0,
    body: String(row.body ?? ""),
    store: row.store ? String(row.store) : null,
    bought_it: row.bought_it === true,
    verified_purchase: row.verified_purchase === true,
    proof_sha256: row.proof_sha256 ? String(row.proof_sha256) : null,
    proof_ocr_confidence:
      row.proof_ocr_confidence === null || row.proof_ocr_confidence === undefined
        ? null
        : Number(row.proof_ocr_confidence),
    status: asStatus(row.status),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function rowToPublic(row: Record<string, unknown>): PublicCommunityReview {
  return {
    id: String(row.id ?? ""),
    stars: Number(row.stars) || 0,
    body: String(row.body ?? ""),
    store: row.store ? String(row.store) : null,
    bought_it: row.bought_it === true,
    verified_purchase: row.verified_purchase === true,
    created_at: row.created_at ? String(row.created_at) : null,
  };
}

export type SubmitCommunityReviewInput = {
  accountEmail: unknown;
  productKey: unknown;
  productName?: unknown;
  productUrl?: unknown;
  stars: unknown;
  body: unknown;
  store?: unknown;
  boughtIt?: unknown;
  verifiedPurchase?: unknown;
  proofSha256?: unknown;
  proofOcrConfidence?: unknown;
};

/**
 * Validate and store one community review. One row per account per product
 * key: re-submitting replaces the previous review and returns it to
 * "pending" moderation. Throws CommunityReviewError("VALIDATION") for
 * shopper-fixable problems and CommunityReviewError("STORAGE") when the
 * write cannot complete (table or env missing).
 */
export async function submitCommunityReview(
  input: SubmitCommunityReviewInput,
  deps: StorageDeps = defaultDeps
): Promise<CommunityReview> {
  const accountEmail = cleanEmail(input.accountEmail);
  if (!accountEmail) throw new CommunityReviewError("VALIDATION", "A signed-in account is required to leave a review.");

  const productKey = normalizeProductKey(input.productKey);
  if (!productKey) throw new CommunityReviewError("VALIDATION", "We couldn't match this review to a product. Please submit it from the product's result page.");

  const stars = Math.round(Number(input.stars));
  if (!Number.isFinite(stars) || stars < 1 || stars > 5)
    throw new CommunityReviewError("VALIDATION", "Please choose a star rating from 1 to 5.");

  const body = cleanText(input.body, COMMUNITY_BODY_MAX);
  if (body.length < COMMUNITY_BODY_MIN)
    throw new CommunityReviewError("VALIDATION", `Please write at least ${COMMUNITY_BODY_MIN} characters so other shoppers can learn from your experience.`);

  const store = cleanText(input.store, COMMUNITY_STORE_MAX) || null;
  const productName = cleanText(input.productName, COMMUNITY_PRODUCT_NAME_MAX) || null;
  const productUrl = cleanText(input.productUrl, COMMUNITY_URL_MAX) || null;
  const boughtIt = input.boughtIt === true;
  const verifiedPurchase = input.verifiedPurchase === true && boughtIt;
  const proofSha256 = verifiedPurchase ? cleanText(input.proofSha256, 128) || null : null;
  const proofOcrConfidence = verifiedPurchase && Number.isFinite(Number(input.proofOcrConfidence))
    ? Math.round(Number(input.proofOcrConfidence))
    : null;

  if (deps === defaultDeps && !isSupabaseConfigured())
    throw new CommunityReviewError("STORAGE", "We couldn't save your review right now. Please try again later.");

  const now = new Date().toISOString();
  let row: Record<string, unknown> | null = null;
  try {
    row = (await deps.upsert<Record<string, unknown>>(
      COMMUNITY_REVIEWS_TABLE,
      [
        {
          account_email: accountEmail,
          product_key: productKey,
          product_name: productName,
          product_url: productUrl,
          stars,
          body,
          store,
          bought_it: boughtIt,
          verified_purchase: verifiedPurchase,
          proof_sha256: proofSha256,
          proof_ocr_confidence: proofOcrConfidence,
          status: "pending",
          updated_at: now,
        },
      ],
      "account_email,product_key"
    )) as Record<string, unknown> | null;
  } catch {
    row = null;
  }

  if (!row) throw new CommunityReviewError("STORAGE", "We couldn't save your review right now. Please try again later.");
  return rowToReview(row);
}

/**
 * Approved reviews for a product, public-safe fields only (never emails).
 * Fail-soft: any storage problem reads as no reviews.
 */
export async function listApprovedReviews(
  productKey: string,
  limit = 20,
  deps: StorageDeps = defaultDeps
): Promise<PublicCommunityReview[]> {
  const key = normalizeProductKey(productKey);
  if (!key) return [];
  try {
    const rows = await deps.select<Record<string, unknown>>(
      COMMUNITY_REVIEWS_TABLE,
      `select=id,stars,body,store,bought_it,verified_purchase,created_at&product_key=eq.${encodeURIComponent(
        key
      )}&status=eq.approved&order=created_at.desc&limit=${Math.max(1, Math.min(100, Math.floor(limit)))}`
    );
    return (Array.isArray(rows) ? rows : []).map(rowToPublic);
  } catch {
    return [];
  }
}

/** Full rows for the admin moderation view. Fail-soft. */
export async function listAllCommunityReviews(
  limit = 200,
  deps: StorageDeps = defaultDeps
): Promise<CommunityReview[]> {
  try {
    const rows = await deps.select<Record<string, unknown>>(
      COMMUNITY_REVIEWS_TABLE,
      `select=*&order=created_at.desc&limit=${Math.max(1, Math.min(500, Math.floor(limit)))}`
    );
    return (Array.isArray(rows) ? rows : []).map(rowToReview);
  } catch {
    return [];
  }
}

/** Moderate one review (pending/approved/hidden). Returns false when it cannot complete. */
export async function moderateCommunityReview(
  id: string,
  status: CommunityReviewStatus,
  deps: StorageDeps = defaultDeps
): Promise<CommunityReview | null> {
  const cleanId = String(id || "").trim();
  if (!cleanId || (status !== "pending" && status !== "approved" && status !== "hidden")) return null;
  try {
    const row = (await deps.update<Record<string, unknown>>(
      COMMUNITY_REVIEWS_TABLE,
      `id=eq.${encodeURIComponent(cleanId)}`,
      { status, updated_at: new Date().toISOString() }
    )) as Record<string, unknown> | null;
    return row ? rowToReview(row) : null;
  } catch {
    return null;
  }
}

export async function communityReviewSubmittedBy(
  accountEmail: string,
  productKey: string,
  deps: StorageDeps = defaultDeps
): Promise<boolean> {
  const key = normalizeProductKey(productKey);
  const email = cleanEmail(accountEmail);
  if (!key || !email) return false;
  try {
    const rows = await deps.select(
      COMMUNITY_REVIEWS_TABLE,
      `select=id&account_email=eq.${encodeURIComponent(email)}&product_key=eq.${encodeURIComponent(key)}&limit=1`
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function reviewAskAlreadySent(
  accountEmail: string,
  productKey: string,
  deps: StorageDeps = defaultDeps
): Promise<boolean> {
  const key = normalizeProductKey(productKey);
  const email = cleanEmail(accountEmail);
  if (!key || !email) return false;
  try {
    const rows = await deps.select(
      COMMUNITY_REVIEW_ASKS_TABLE,
      `select=id&account_email=eq.${encodeURIComponent(email)}&product_key=eq.${encodeURIComponent(key)}&limit=1`
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function recordReviewAsk(
  input: { accountEmail: string; productKey: string; analysisId?: string | null },
  deps: StorageDeps = defaultDeps
): Promise<boolean> {
  const key = normalizeProductKey(input.productKey);
  const email = cleanEmail(input.accountEmail);
  if (!key || !email) return false;
  try {
    const row = await deps.upsert(
      COMMUNITY_REVIEW_ASKS_TABLE,
      [
        {
          account_email: email,
          product_key: key,
          analysis_id: input.analysisId ? String(input.analysisId).slice(0, 128) : null,
          asked_at: new Date().toISOString(),
        },
      ],
      "account_email,product_key"
    );
    return row !== null && row !== undefined;
  } catch {
    return false;
  }
}

function communityRowToLibraryRecord(
  row: Record<string, unknown>,
  /** Sorter-bot annotations (theme tags, direction, serious markers, variant). */
  annotations?: SortedReviewAnnotations | null
): LibraryReviewRecord {
  const id = String(row.id ?? "");
  const record: LibraryReviewRecord = {
    source: COMMUNITY_PROVENANCE,
    sourceUrl: `https://community.reviewintel.local/${id}`,
    reviewId: `community-${id}`,
    rating: Math.max(1, Math.min(5, Math.round(Number(row.stars)) || 0)),
    body: String(row.body ?? ""),
    date: row.created_at ? String(row.created_at) : null,
    verified: row.verified_purchase === true,
    evidenceType: "WRITTEN_REVIEW",
    store: row.store ? String(row.store) : null,
    provenance: { source: COMMUNITY_PROVENANCE },
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

/**
 * Tier A feed: approved + purchase-verified community reviews join the
 * product library corpus for this product key. Mirrors the seller and
 * page-capture lanes: load, merge (exact-dedupe, fresh-first, capped),
 * save — never wiping evidence other lanes stored. Never throws.
 */
export async function feedTierAReviewsToLibrary(
  productKey: string,
  deps: StorageDeps = defaultDeps
): Promise<{ fed: boolean; fedCount: number }> {
  const key = normalizeProductKey(productKey);
  if (!key) return { fed: false, fedCount: 0 };
  const loadCorpus = deps.loadCorpus ?? loadLibraryCorpus;
  const saveCorpus = deps.saveCorpus ?? saveLibraryCorpus;
  try {
    const entry = await loadCorpus(key);
    const rows = await deps.select<Record<string, unknown>>(
      COMMUNITY_REVIEWS_TABLE,
      `select=id,stars,body,store,verified_purchase,created_at&product_key=eq.${encodeURIComponent(
        key
      )}&status=eq.approved&verified_purchase=eq.true&order=created_at.desc&limit=100`
    );
    const eligible = Array.isArray(rows) ? rows : [];
    if (!eligible.length) return { fed: false, fedCount: 0 };

    const existingReviewIds = new Set(
      entry.reviews.map((record) => String((record as { reviewId?: unknown }).reviewId || ""))
    );
    const freshRows = eligible.filter(
      (row) => !existingReviewIds.has(`community-${String(row.id ?? "")}`)
    );
    if (!freshRows.length) return { fed: false, fedCount: 0 };

    // SORTER BOT (additive, fail-soft): Tier-A rows are sorted (theme tags,
    // direction, serious markers, variant attribution, body dedupe) before
    // they join the library corpus. The sorter's duplicate rejection stands
    // (it matches the library's body-identity union semantics); rows the
    // sorter rejects for content reasons keep the exact pre-sorter mapping —
    // the approval+verification gate, not the sorter, is the authority on
    // what a Tier-A feed carries. Any sorter failure keeps the exact
    // pre-sorter mapping.
    let fresh: LibraryReviewRecord[];
    try {
      const existingBodyKeys = entry.reviews
        .map((record) => sorterBodyKey((record as { body?: unknown }).body))
        .filter((key): key is string => Boolean(key));
      const sortResult = sortReviewBatch({
        feed: "community",
        records: freshRows.map(adaptCommunityRow),
        productKey: key,
        existingBodyKeys,
      });
      const sortedById = new Map(sortResult.sorted.map((s) => [s.id, s]));
      const duplicateIds = new Set(
        sortResult.rejected.filter((r) => r.reason === "duplicate").map((r) => r.id)
      );
      fresh = [];
      for (const row of freshRows) {
        const rid = `community-${String(row.id ?? "")}`;
        if (duplicateIds.has(rid)) continue;
        const sorted = sortedById.get(rid);
        fresh.push(communityRowToLibraryRecord(row, sorted ? sortAnnotationsFor(sorted) : null));
      }
    } catch {
      fresh = freshRows.map((row) => communityRowToLibraryRecord(row));
    }
    if (!fresh.length) return { fed: false, fedCount: 0 };

    const seen = new Set<string>();
    const merged: LibraryReviewRecord[] = [];
    for (const record of [...fresh, ...entry.reviews]) {
      const fingerprint = JSON.stringify(record);
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      merged.push(record);
      if (merged.length >= LIBRARY_CORPUS_CAP) break;
    }

    const saved = await saveCorpus({
      productKey: key,
      corpus: merged,
      previousScanCount: entry.scanCount,
    });
    return { fed: saved, fedCount: saved ? fresh.length : 0 };
  } catch {
    return { fed: false, fedCount: 0 };
  }
}
