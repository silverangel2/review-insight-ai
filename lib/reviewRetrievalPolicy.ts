export const REVIEW_CORPUS_CAP = 240;

export function shouldContinueReviewRetrieval(input: {
  uniqueReviews: number;
  corpusCap?: number;
  candidatePagesRemain: boolean;
  accessRestricted?: boolean;
  timedOut?: boolean;
}): boolean {
  if (input.uniqueReviews >= (input.corpusCap || REVIEW_CORPUS_CAP)) return false;
  if (input.accessRestricted || input.timedOut) return false;
  return input.candidatePagesRemain;
}

export function buildAmazonReviewPageUrls(listingUrl: string, asin: string, pages = 22): string[] {
  const base = new URL(listingUrl);
  return [
    `${base.origin}/product-reviews/${asin}/?reviewerType=all_reviews`,
    `${base.origin}/product-reviews/${asin}/?sortBy=recent&reviewerType=all_reviews`,
    ...Array.from({ length: pages }, (_, index) => `${base.origin}/product-reviews/${asin}/?pageNumber=${index + 2}&reviewerType=all_reviews`),
  ];
}
