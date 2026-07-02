export type CollectedReview = {
  source: string;
  sourceUrl?: string;
  rating?: number | null;
  title?: string;
  body: string;
  date?: string | null;
  verified?: boolean | null;
};

export type ReviewCollectorResult = {
  sourceUrl: string | null;
  attempted: boolean;
  reviews: CollectedReview[];
  reviewsCollected: number;
  coverageNote: string;
};

function cleanText(value: unknown): string {
  return String(value || "")
    .replace(/\\u0026/g, "&")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRating(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

function reviewKey(text: string) {
  return cleanText(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 180);
}

function collectFromJsonLdNode(node: unknown, sourceUrl: string, out: CollectedReview[]) {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const item of node) collectFromJsonLdNode(item, sourceUrl, out);
    return;
  }

  const record = node as Record<string, unknown>;
  const type = record["@type"];

  const isReview =
    type === "Review" ||
    (Array.isArray(type) && type.map(String).some((item) => item.toLowerCase() === "review"));

  if (isReview) {
    const body =
      cleanText(record.reviewBody) ||
      cleanText(record.description) ||
      cleanText(record.text) ||
      cleanText(record.name);

    if (body.length >= 20) {
      const ratingValue =
        record.reviewRating && typeof record.reviewRating === "object"
          ? (record.reviewRating as Record<string, unknown>).ratingValue
          : record.ratingValue;

      out.push({
        source: "Listing structured review data",
        sourceUrl,
        rating: normalizeRating(ratingValue),
        title: cleanText(record.name) || undefined,
        body,
        date: cleanText(record.datePublished) || null,
        verified: null,
      });
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") collectFromJsonLdNode(value, sourceUrl, out);
  }
}

function collectJsonLdReviews(html: string, sourceUrl: string): CollectedReview[] {
  const reviews: CollectedReview[] = [];
  const matches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of matches) {
    const raw = cleanText(match[1]);
    if (!raw) continue;

    try {
      collectFromJsonLdNode(JSON.parse(raw), sourceUrl, reviews);
    } catch {
      // Ignore malformed structured data.
    }
  }

  return reviews;
}

function collectEmbeddedReviewText(html: string, sourceUrl: string): CollectedReview[] {
  const reviews: CollectedReview[] = [];
  const patterns = [
    /"reviewText"\s*:\s*"((?:\\.|[^"\\]){20,1200})"/gi,
    /"reviewBody"\s*:\s*"((?:\\.|[^"\\]){20,1200})"/gi,
    /"body"\s*:\s*"((?:\\.|[^"\\]){30,1200})"\s*,\s*"rating"/gi,
    /"text"\s*:\s*"((?:\\.|[^"\\]){30,1200})"\s*,\s*"rating"/gi,
    /"customerReviewText"\s*:\s*"((?:\\.|[^"\\]){20,1200})"/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const body = cleanText(match[1]);
      if (
        body.length >= 25 &&
        !/privacy policy|terms of use|add to cart|shipping|pickup|sponsored|advertisement/i.test(body)
      ) {
        reviews.push({
          source: "Listing embedded review data",
          sourceUrl,
          rating: null,
          body,
          date: null,
          verified: null,
        });
      }
    }
  }

  return reviews;
}

function dedupeReviews(reviews: CollectedReview[], maxReviews: number): CollectedReview[] {
  const seen = new Set<string>();
  const cleaned: CollectedReview[] = [];

  for (const review of reviews) {
    const body = cleanText(review.body);
    if (body.length < 25) continue;

    const key = reviewKey(body);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    cleaned.push({
      ...review,
      body: body.slice(0, 1200),
      title: review.title ? cleanText(review.title).slice(0, 160) : undefined,
    });

    if (cleaned.length >= maxReviews) break;
  }

  return cleaned;
}

export function formatCollectedReviewsForPrompt(result: ReviewCollectorResult): string {
  if (!result.reviews.length) {
    return `Review collector attempted: ${result.attempted ? "yes" : "no"}.
Written reviews collected: 0.
Coverage note: ${result.coverageNote}`;
  }

  return [
    `Review collector attempted: ${result.attempted ? "yes" : "no"}.`,
    `Written reviews collected: ${result.reviewsCollected}.`,
    `Coverage note: ${result.coverageNote}.`,
    "",
    ...result.reviews.map((review, index) => {
      const rating = typeof review.rating === "number" ? ` Rating: ${review.rating}/5.` : "";
      const date = review.date ? ` Date: ${review.date}.` : "";
      const verified =
        typeof review.verified === "boolean" ? ` Verified: ${review.verified ? "yes" : "no"}.` : "";

      return `Review ${index + 1}.${rating}${date}${verified} Source: ${review.source}. Text: ${review.body}`;
    }),
  ].join("\n");
}

export async function collectWrittenReviewsFromListing(input: {
  listingUrl?: string | null;
  productName?: string | null;
  marketplaceReviewCount?: number | null;
  maxReviews?: number;
}): Promise<ReviewCollectorResult> {
  const listingUrl = input.listingUrl || null;
  const maxReviews = Math.max(10, Math.min(input.maxReviews || 80, 120));

  if (!listingUrl) {
    return {
      sourceUrl: null,
      attempted: false,
      reviews: [],
      reviewsCollected: 0,
      coverageNote: "No exact listing URL was available for written-review collection.",
    };
  }

  try {
    const response = await fetch(listingUrl, {
      method: "GET",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; ReviewIntel/1.0; +https://getreviewintel.com)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-CA,en;q=0.9",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        sourceUrl: listingUrl,
        attempted: true,
        reviews: [],
        reviewsCollected: 0,
        coverageNote: `Listing page was reachable but returned HTTP ${response.status}; written review text could not be collected.`,
      };
    }

    const html = await response.text();
    const reviews = dedupeReviews(
      [...collectJsonLdReviews(html, listingUrl), ...collectEmbeddedReviewText(html, listingUrl)],
      maxReviews
    );

    const total = input.marketplaceReviewCount || null;
    const coverage =
      total && reviews.length
        ? `${reviews.length} of ${total} public marketplace reviews were accessible as written text.`
        : reviews.length
          ? `${reviews.length} written review texts were collected.`
          : total
            ? `${total} public marketplace reviews were visible, but written review text was not accessible from the listing HTML.`
            : "No written review text was accessible from the listing HTML.";

    return {
      sourceUrl: listingUrl,
      attempted: true,
      reviews,
      reviewsCollected: reviews.length,
      coverageNote: coverage,
    };
  } catch (error) {
    return {
      sourceUrl: listingUrl,
      attempted: true,
      reviews: [],
      reviewsCollected: 0,
      coverageNote: `Written review collection failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }
}
