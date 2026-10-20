/**
 * Review hunt: the second search for reviews (owner design, 2026-10-20).
 *
 * ReviewIntel hunts REVIEWS, not Amazon. Amazon is first when its reviews
 * are available; when a scan ends with ZERO accepted written reviews —
 * Amazon blocked/gated the fetch, or every collected review failed
 * adjudication — the hunt searches other stores for the EXACT same
 * product, matched by the match-words fingerprint (lib/productFingerprint
 * .ts), pools the matched listings' reviews with per-source provenance,
 * and hands them back so the caller can run them through the SAME shared
 * adjudication pass as every other record. Pooling never bypasses
 * adjudication, and a candidate that the fingerprint cannot prove is the
 * same product (no_match or ambiguous) is excluded with its reason
 * recorded — a wrong-product review is worse than none.
 *
 * Safety shape:
 *   - Kill switch: REVIEWINTEL_REVIEW_HUNT_ENABLED must be "1" (default
 *     OFF, same precedent as RI_KEEPER_REPAIRS_ENABLED). The caller checks
 *     the flag; this module also exposes the trigger test for it.
 *   - Time-boxed: the retrieval races a hard cap (default 25s) inside the
 *     scan's own collection deadline; a timeout, an error, or an empty
 *     result returns no reviews and leaves the scan exactly as it was.
 *   - Discovery drives the existing native retrieval engine (identifier-
 *     anchored cross-store search) — no new fetch machinery, no OpenAI.
 */
import {
  runNativeReviewRetrieval,
  type NativeReviewRetrievalInput,
  type NativeReviewRetrievalResult,
} from "./nativeReviewRetrieval";
import {
  extractProductFingerprint,
  matchListingToFingerprint,
  type FingerprintInput,
  type ProductFingerprint,
} from "./productFingerprint";
import {
  stampReviewProvenance,
  type LibraryReviewRecord,
} from "./productReviewLibrary";
import { amazonStableId } from "./storeCollectors";
import { captureStage } from "./devScanCapture";
import type { ScanCostTelemetry } from "./scanCostTelemetry";

export const REVIEW_HUNT_ENV_FLAG = "REVIEWINTEL_REVIEW_HUNT_ENABLED";
export const REVIEW_HUNT_DEFAULT_TIMEOUT_MS = 25_000;

export function isReviewHuntEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env[REVIEW_HUNT_ENV_FLAG] === "1";
}

export type ReviewHuntExclusion = {
  sourceUrl: string;
  host: string;
  verdict: "no_match" | "ambiguous";
  reason: string;
};

export type ReviewHuntMatchedListing = {
  sourceUrl: string;
  host: string;
  marketplace: string | null;
  reviews: number;
  reasons: string[];
};

export type ReviewHuntDiagnostics = {
  fired: boolean;
  /** Why the hunt fired, or the terminal state when it ran (ok/timeout/error/empty). */
  reason: string;
  fingerprintKey: string | null;
  sourcesChecked: string[];
  candidatesChecked: number;
  matchedListings: ReviewHuntMatchedListing[];
  excluded: ReviewHuntExclusion[];
  pooledCount: number;
  elapsedMs: number;
};

export type ReviewHuntInput = {
  brand?: string | null;
  model?: string | null;
  /** Best product title (the verified listing's own title when known). */
  productName: string;
  /** The verified primary listing URL (the Amazon listing that yielded zero). */
  listingUrl?: string | null;
  store?: string | null;
  categoryBreadcrumbs?: string[] | null;
  /** Precomputed fingerprint; extracted from the identity fields when omitted. */
  fingerprint?: ProductFingerprint;
  timeoutMs?: number;
  /** Injectable for tests; defaults to the native retrieval engine. */
  retrieval?: (
    input: NativeReviewRetrievalInput
  ) => Promise<NativeReviewRetrievalResult>;
  costTelemetry?: ScanCostTelemetry;
};

export type ReviewHuntResult = {
  diagnostics: ReviewHuntDiagnostics;
  /** Pooled collector records (provenance-stamped), ready to merge pre-adjudication. */
  reviews: NativeReviewRetrievalResult["reviews"];
};

type HuntRecord = NativeReviewRetrievalResult["reviews"][number];

function hostOf(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new URL(String(value)).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function emptyDiagnostics(reason: string, fingerprintKey: string | null): ReviewHuntDiagnostics {
  return {
    fired: true,
    reason,
    fingerprintKey,
    sourcesChecked: [],
    candidatesChecked: 0,
    matchedListings: [],
    excluded: [],
    pooledCount: 0,
    elapsedMs: 0,
  };
}

/**
 * The v1 trigger, kept conservative on purpose: the hunt fires only when
 * the scan accepted ZERO written reviews AND the product identity is
 * anchored (a fingerprint key exists — brand + model, or brand + a full
 * spec set) AND the kill switch is on. Everything else is today's scan.
 */
export function shouldRunReviewHunt(input: {
  enabled: boolean;
  acceptedRecordCount: number;
  fingerprint: ProductFingerprint;
}): { fire: boolean; reason: string } {
  if (!input.enabled) return { fire: false, reason: "flag_off" };
  if (input.acceptedRecordCount > 0)
    return { fire: false, reason: "amazon_reviews_accepted" };
  if (!input.fingerprint.fingerprintKey)
    return { fire: false, reason: "identity_not_anchored" };
  return { fire: true, reason: "zero_accepted_reviews" };
}

function groupBySourceUrl(records: HuntRecord[]): Map<string, HuntRecord[]> {
  const groups = new Map<string, HuntRecord[]>();
  for (const record of records) {
    const url = String(record.sourceUrl || "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    if (!groups.has(url)) groups.set(url, []);
    groups.get(url)!.push(record);
  }
  return groups;
}

/** A group belongs to the primary listing itself (same host + same stable Amazon id). */
function isPrimaryListingGroup(sourceUrl: string, listingUrl: string | null | undefined): boolean {
  if (!listingUrl) return false;
  if (hostOf(sourceUrl) !== hostOf(listingUrl)) return false;
  const groupId = amazonStableId(sourceUrl);
  const listingId = amazonStableId(listingUrl);
  if (groupId && listingId) return groupId === listingId;
  try {
    return (
      new URL(sourceUrl).pathname.replace(/\/$/, "") ===
      new URL(listingUrl).pathname.replace(/\/$/, "")
    );
  } catch {
    return sourceUrl === listingUrl;
  }
}

export async function runReviewHunt(input: ReviewHuntInput): Promise<ReviewHuntResult> {
  const startedAt = Date.now();
  const fingerprint =
    input.fingerprint ??
    extractProductFingerprint({
      brand: input.brand,
      productName: input.productName,
      model: input.model,
      categoryBreadcrumbs: input.categoryBreadcrumbs,
    });
  const diagnostics = emptyDiagnostics("ok", fingerprint.fingerprintKey);
  const retrieval = input.retrieval ?? runNativeReviewRetrieval;
  const timeoutMs = Math.max(
    250,
    Math.min(input.timeoutMs ?? REVIEW_HUNT_DEFAULT_TIMEOUT_MS, 60_000)
  );

  let result: NativeReviewRetrievalResult | null = null;
  try {
    const retrievalPromise = retrieval({
      productTitle: input.productName,
      brand: input.brand ?? null,
      model: input.model ?? null,
      store: input.store ?? null,
      listingUrl: input.listingUrl ?? null,
      maxQueries: 6,
      maxPages: 12,
      maxSnippets: 120,
      costTelemetry: input.costTelemetry,
    });
    // If the race is lost, the retrieval keeps running detached under the
    // scan deadline; swallow any late rejection so it can never surface.
    retrievalPromise.catch(() => undefined);
    result = await Promise.race([
      retrievalPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!result) diagnostics.reason = "timeout";
  } catch (error) {
    diagnostics.reason = `error: ${error instanceof Error ? error.message : String(error)}`;
  }

  const pooled: HuntRecord[] = [];
  if (result) {
    diagnostics.sourcesChecked = [...(result.sourcesChecked || [])].slice(0, 80);
    const groups = groupBySourceUrl(result.reviews || []);
    for (const [sourceUrl, records] of groups) {
      if (isPrimaryListingGroup(sourceUrl, input.listingUrl)) continue;
      diagnostics.candidatesChecked += 1;
      const host = hostOf(sourceUrl);
      const titled = records.find(
        (record) => String(record.reviewedProductName || "").trim().length > 0
      );
      if (!titled) {
        diagnostics.excluded.push({
          sourceUrl,
          host,
          verdict: "ambiguous",
          reason: "candidate_listing_title_unavailable",
        });
        continue;
      }
      const candidate: FingerprintInput = {
        brand: (titled.reviewedBrand as string | null) ?? null,
        productName: String(titled.reviewedProductName),
        title: String(titled.reviewedProductName),
      };
      const match = matchListingToFingerprint(fingerprint, candidate);
      if (match.verdict !== "match") {
        diagnostics.excluded.push({
          sourceUrl,
          host,
          verdict: match.verdict,
          reason: match.reasons[0] || match.verdict,
        });
        continue;
      }
      const stamped = records.map(
        (record) =>
          stampReviewProvenance(
            record as unknown as LibraryReviewRecord,
            ""
          ) as unknown as HuntRecord
      );
      pooled.push(...stamped);
      const marketplace =
        (stamped[0] as unknown as LibraryReviewRecord)?.sourceMarketplace != null
          ? String((stamped[0] as unknown as LibraryReviewRecord).sourceMarketplace)
          : host || null;
      diagnostics.matchedListings.push({
        sourceUrl,
        host,
        marketplace,
        reviews: stamped.length,
        reasons: match.reasons,
      });
    }
    if (!pooled.length && diagnostics.reason === "ok") diagnostics.reason = "no_match_anywhere";
  }

  diagnostics.pooledCount = pooled.length;
  diagnostics.elapsedMs = Date.now() - startedAt;
  captureStage("review-hunt", { diagnostics, pooledCount: pooled.length });
  return { diagnostics, reviews: pooled };
}
