// Pure: adopt the native collector's verified primary-page identity into the
// listing evidence when the listing carries no usable title of its own.
//
// The collector already parsed the real product title (and the page's
// aggregate rating, review count, and main image) from the same HTML it read
// the reviews from. Without this adoption, a fully-read page still renders as
// "Amazon product" because the result's title chain only reads listingEvidence.
//
// Guards: only from the exact same stable listing (ASIN equality is enforced
// inside the collector before the identity is captured), never overwrites a
// usable existing title, never invents a title.

import { isUnusableListingTitle } from "./listingAuthority";
import { isPlaceholderProductName } from "./linkIdentity";
import type { ExactProductSearchResult } from "./exactProductSearch";
import type { NativeReviewRetrievalResult } from "./nativeReviewRetrieval";

export type PrimaryPageIdentity = NonNullable<
  NativeReviewRetrievalResult["primaryPageIdentity"]
>;

function usableTitle(value: unknown): boolean {
  const text = String(value || "").trim();
  return (
    Boolean(text) &&
    !isUnusableListingTitle(text) &&
    !isPlaceholderProductName(text)
  );
}

export function adoptPrimaryPageIdentity(
  evidence: ExactProductSearchResult | null | undefined,
  identity: PrimaryPageIdentity | null | undefined,
): ExactProductSearchResult | null | undefined {
  if (!evidence || !identity?.title) return evidence;
  const next = { ...evidence } as ExactProductSearchResult & { imageUrl?: string | null };
  if (!usableTitle(next.exactListingTitle)) next.exactListingTitle = identity.title;
  if (
    typeof identity.rating === "number" &&
    identity.rating > 0 &&
    (typeof next.rating !== "number" || !Number.isFinite(next.rating) || next.rating <= 0)
  ) {
    next.rating = identity.rating;
  }
  if (
    typeof identity.reviewCount === "number" &&
    identity.reviewCount > 0 &&
    (typeof next.reviewCount !== "number" ||
      !Number.isFinite(next.reviewCount) ||
      next.reviewCount <= 0)
  ) {
    next.reviewCount = identity.reviewCount;
  }
  if (identity.image && !next.imageUrl) next.imageUrl = identity.image;
  return next;
}
