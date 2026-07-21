import {
  collectLiveReviewsForListing,
  type ReviewRetrievalDiagnostics,
} from "@/lib/reviewRetrieval";

export type CollectedReview = {
  source: string;
  sourceUrl?: string;
  rating?: number | null;
  title?: string;
  body: string;
  date?: string | null;
  verified?: boolean | null;
};

export type ReviewExtractorName = "amazon" | "walmart" | "generic" | "none";

export type ReviewCollectorResult = {
  sourceUrl: string | null;
  attempted: boolean;
  extractor: ReviewExtractorName;
  reviews: CollectedReview[];
  reviewsCollected: number;
  collectorHasWrittenReviews: boolean;
  coverageNote: string;
  fallbackUrlsTried?: string[];
  liveRetrieval?: ReviewRetrievalDiagnostics;
};

function cleanText(value: unknown): string {
  return String(value || "")
    .replace(/\\u0026/g, "&")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\bbrief content visible,?\s*double tap to read full content\.?/gi, " ")
    .replace(/\bfull content visible,?\s*double tap to read brief content\.?/gi, " ")
    .replace(/\b\d+\s+people found this helpful\b/gi, " ")
    .replace(/\btranslate review to english\b/gi, " ")
    .replace(/\breviewed in [a-z\s]+ on [a-z]+\s+\d{1,2},?\s+\d{4}\b/gi, " ")
    .replace(/\bhelpful\s+report\b/gi, " ")
    .replace(/\bverified purchase\b/gi, " ")
    .replace(/\breview\s+\d+\s*:\s*\|?/gi, " ")
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

function extractorForUrl(url: string | null | undefined): ReviewExtractorName {
  if (!url) return "none";

  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("amazon.")) return "amazon";
    if (host.includes("walmart.")) return "walmart";
  } catch {
    return "generic";
  }

  return "generic";
}

function isLikelyWrittenReviewBody(value: string): boolean {
  const text = cleanText(value);
  const lower = text.toLowerCase();

  if (text.length < 25 || text.length > 5000) return false;
  if (/privacy policy|terms of use|add to cart|shipping policy|pickup options|sponsored|advertisement|subscribe|cookie policy|write a review/i.test(lower)) {
    return false;
  }
  if (/image unavailable|video player|hls playlist|see all buying options|no featured offers|deliver(?:ing)? to|click to play video|current time|stream type live|chapters descriptions|frequently asked questions|related articles|check lowest prices|order .*lowest price|quality price, reliable delivery option/i.test(lower)) {
    return false;
  }

  const firstPersonOrUsage =
    /\b(i|we|my|our|me|us|bought|purchased|received|used|using|works|worked|love|liked|disappointed|returned|broke|lasted|recommend)\b/i.test(
      text
    );
  const productExperience =
    /\b(quality|battery|fit|size|price|value|durable|comfortable|taste|smell|sound|charge|delivery|seller|return|packaging|material|review|stars?)\b/i.test(
      text
    );

  const ratingReview =
    /\b\d(?:\.\d)?\s*out of\s*5|stars?|recommend|disappointed|worked|broke|returned|love|liked\b/i.test(text) &&
    text.length >= 55;

  return productExperience && (firstPersonOrUsage || ratingReview);
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

    if (isLikelyWrittenReviewBody(body)) {
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
        isLikelyWrittenReviewBody(body) &&
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
    if (!isLikelyWrittenReviewBody(body)) continue;

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


function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function htmlDecodeLight(value: string): string {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function collectReviewLikeObjects(value: unknown, source: string, reviews: CollectedReview[], depth = 0) {
  if (depth > 10 || value === null || value === undefined) return;

  if (Array.isArray(value)) {
    for (const item of value) collectReviewLikeObjects(item, source, reviews, depth + 1);
    return;
  }

  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).map((key) => key.toLowerCase());

  const textKeys = [
    "reviewtext",
    "reviewbody",
    "review",
    "body",
    "comment",
    "comments",
    "content",
    "text",
    "customerreviewtext",
    "reviewdescription",
  ];

  const ratingKeys = ["rating", "ratingvalue", "overallrating", "score", "stars"];
  const titleKeys = ["title", "reviewtitle", "headline", "summary"];
  const dateKeys = ["date", "submissiontime", "created", "createdat", "reviewdate", "lastmodificationtime"];
  const verifiedKeys = ["verified", "isverified", "verifiedpurchase", "isverifiedpurchaser", "badges"];

  const hasExplicitReviewKey =
    keys.some((key) => key.includes("review")) ||
    keys.some((key) => key.includes("comment")) ||
    keys.some((key) => key.includes("submission"));

  const hasReviewShape =
    hasExplicitReviewKey &&
    (keys.some((key) => ratingKeys.includes(key)) ||
      keys.some((key) =>
        ["reviewtext", "reviewbody", "customerreviewtext", "reviewdescription"].includes(key)
      ) ||
      keys.some((key) => key.includes("recommend")) ||
      keys.some((key) => key.includes("verified")) ||
      keys.some((key) => key.includes("badge")) ||
      keys.some((key) => key.includes("submission")));

  let body = "";

  for (const key of textKeys) {
    const originalKey = Object.keys(record).find((candidate) => candidate.toLowerCase() === key);
    const raw = originalKey ? record[originalKey] : null;

    if (typeof raw === "string" && cleanText(raw).length > body.length) {
      body = cleanText(raw);
    }
  }

  if (hasReviewShape && isLikelyWrittenReviewBody(body)) {
    const ratingKey = Object.keys(record).find((candidate) =>
      ratingKeys.includes(candidate.toLowerCase())
    );
    const titleKey = Object.keys(record).find((candidate) =>
      titleKeys.includes(candidate.toLowerCase())
    );
    const dateKey = Object.keys(record).find((candidate) =>
      dateKeys.includes(candidate.toLowerCase())
    );
    const verifiedKey = Object.keys(record).find((candidate) =>
      verifiedKeys.includes(candidate.toLowerCase())
    );

    const ratingValue = ratingKey ? Number(record[ratingKey]) : NaN;
    const titleValue = titleKey && typeof record[titleKey] === "string" ? record[titleKey] : undefined;
    const dateValue = dateKey && typeof record[dateKey] === "string" ? record[dateKey] : null;
    const verifiedValue =
      verifiedKey && typeof record[verifiedKey] === "boolean" ? record[verifiedKey] : null;

    reviews.push({
      source,
      title: titleValue ? cleanText(titleValue) : undefined,
      rating: Number.isFinite(ratingValue) ? ratingValue : null,
      body,
      date: dateValue ? cleanText(dateValue) : null,
      verified: verifiedValue,
    });
  }

  for (const child of Object.values(record)) {
    collectReviewLikeObjects(child, source, reviews, depth + 1);
  }
}

function collectEmbeddedJsonReviews(html: string, source: string): CollectedReview[] {
  const reviews: CollectedReview[] = [];
  const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of scriptMatches) {
    const script = htmlDecodeLight(match[1] || "").trim();
    if (!script || !/review|rating|bazaarvoice|ugc|customer/i.test(script)) continue;

    const jsonCandidates: string[] = [];

    if (script.startsWith("{") || script.startsWith("[")) {
      jsonCandidates.push(script);
    }

    const nextData = script.match(/self\.__next_f\.push\(\s*(\[[\s\S]*?\])\s*\)/);
    if (nextData?.[1]) jsonCandidates.push(nextData[1]);

    const assignmentJson = script.match(/(?:__NEXT_DATA__|window\.__PRELOADED_STATE__|window\.__INITIAL_STATE__)\s*=\s*({[\s\S]*?});/);
    if (assignmentJson?.[1]) jsonCandidates.push(assignmentJson[1]);

    for (const candidate of jsonCandidates) {
      const parsed = safeJsonParse(candidate);
      if (parsed) collectReviewLikeObjects(parsed, source, reviews);
    }

    // Also pull JSON-looking review fragments when the app state is escaped text.
    const fragments = script.matchAll(/\{[^{}]{0,2000}(?:reviewText|reviewBody|customerReviewText|ratingValue|submissionTime)[^{}]{0,3000}\}/gi);
    for (const fragment of fragments) {
      const parsed = safeJsonParse(fragment[0]);
      if (parsed) collectReviewLikeObjects(parsed, source, reviews);
    }
  }

  return reviews;
}

function discoverReviewUrls(html: string, listingUrl: string): string[] {
  const decoded = htmlDecodeLight(html);
  const urls = new Set<string>();

  const absoluteMatches = decoded.matchAll(/https?:\/\/[^"' <>)\\]+/gi);
  for (const match of absoluteMatches) {
    const url = match[0];
    if (/review|bazaarvoice|ugc|ratings|product-reviews/i.test(url)) {
      urls.add(url);
    }
  }

  const relativeMatches = decoded.matchAll(/["'](\/[^"']*(?:review|ratings|ugc|bazaarvoice)[^"']*)["']/gi);
  for (const match of relativeMatches) {
    try {
      urls.add(new URL(match[1], listingUrl).toString());
    } catch {
      // ignore malformed URLs
    }
  }

  return [...urls].slice(0, 12);
}

function extractAmazonAsin(listingUrl: string, html: string): string | null {
  const patterns = [
    /\/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})(?:[/?#]|$)/i,
    /["']asin["']\s*:\s*["']([A-Z0-9]{10})["']/i,
    /data-asin=["']([A-Z0-9]{10})["']/i,
  ];

  const haystack = `${listingUrl}\n${html}`;
  for (const pattern of patterns) {
    const match = haystack.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }

  return null;
}

function amazonReviewUrls(listingUrl: string, html: string): string[] {
  const asin = extractAmazonAsin(listingUrl, html);
  if (!asin) return [];

  try {
    const base = new URL(listingUrl);
    return [
      `${base.origin}/product-reviews/${asin}/?reviewerType=all_reviews`,
      `${base.origin}/product-reviews/${asin}/?sortBy=recent&reviewerType=all_reviews`,
    ];
  } catch {
    return [];
  }
}

function collectAmazonHtmlReviews(html: string, sourceUrl: string): CollectedReview[] {
  const decoded = htmlDecodeLight(html);
  const reviews: CollectedReview[] = [];
  const blocks = decoded.match(/<div[^>]+data-hook=["']review["'][\s\S]*?(?=<div[^>]+data-hook=["']review["']|$)/gi) || [];

  for (const block of blocks) {
    const bodyMatch =
      block.match(/data-hook=["']review-body["'][^>]*>([\s\S]*?)<\/span>/i) ||
      block.match(/class=["'][^"']*review-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    const body = bodyMatch ? cleanText(bodyMatch[1]) : "";

    if (!isLikelyWrittenReviewBody(body)) continue;

    const titleMatch =
      block.match(/data-hook=["']review-title["'][^>]*>([\s\S]*?)<\/a>/i) ||
      block.match(/data-hook=["']review-title["'][^>]*>([\s\S]*?)<\/span>/i);
    const ratingMatch = block.match(/(\d(?:\.\d)?)\s+out of\s+5\s+stars/i);
    const dateMatch = block.match(/data-hook=["']review-date["'][^>]*>([\s\S]*?)<\/span>/i);

    reviews.push({
      source: "Amazon written review",
      sourceUrl,
      rating: ratingMatch?.[1] ? normalizeRating(Number(ratingMatch[1])) : null,
      title: titleMatch ? cleanText(titleMatch[1]) : undefined,
      body,
      date: dateMatch ? cleanText(dateMatch[1]) : null,
      verified: /verified purchase/i.test(block) ? true : null,
    });
  }

  return reviews;
}

function marketplaceReviewUrls(extractor: ReviewExtractorName, html: string, listingUrl: string): string[] {
  const discovered = discoverReviewUrls(html, listingUrl);

  if (extractor === "amazon") {
    return Array.from(new Set([...amazonReviewUrls(listingUrl, html), ...discovered]));
  }

  if (extractor === "walmart") {
    return discovered.filter((url) => /review|ratings|bazaarvoice|ugc/i.test(url));
  }

  return discovered;
}

async function fetchDiscoveredReviewUrls(urls: string[], maxReviews: number): Promise<CollectedReview[]> {
  const reviews: CollectedReview[] = [];

  for (const url of urls) {
    if (reviews.length >= maxReviews) break;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept: "application/json,text/plain,text/html,*/*",
          "accept-language": "en-CA,en;q=0.9",
        },
        cache: "no-store",
      });

      if (!response.ok) continue;

      const text = await response.text();
      const decoded = htmlDecodeLight(text);
      const parsed = safeJsonParse(decoded);

      if (parsed) {
        collectReviewLikeObjects(parsed, url, reviews);
      } else {
        reviews.push(...collectEmbeddedReviewText(decoded, url));
        reviews.push(...collectEmbeddedJsonReviews(decoded, url));
      }
    } catch {
      // continue trying other discovered review URLs
    }
  }

  return dedupeReviews(reviews, maxReviews);
}



function buildPublicReviewSearchQueries(productName: string, listingUrl: string): string[] {
  const normalized = cleanText(productName).slice(0, 180);
  const quoted = normalized ? `"${normalized.replace(/"/g, "")}"` : "";
  const compactTitle = cleanText(
    normalized
      .replace(/\b(with|for|and|the|set|bag|bags|travel|lightweight|hardshell|spinner|wheels|lock)\b/gi, " ")
      .replace(/\s+/g, " ")
  );
  const shortTitle = normalized.split(/\s+/).slice(0, 8).join(" ");
  const quotedShortTitle = shortTitle ? `"${shortTitle.replace(/"/g, "")}"` : "";
  const quotedCompactTitle = compactTitle ? `"${compactTitle.replace(/"/g, "")}"` : "";
  const listingIdentifiers = Array.from(
    new Set(
      [listingUrl.match(/\/([A-Z0-9]{8,})(?:[/?#]|$)/i)?.[1], listingUrl]
        .filter(Boolean)
        .map((value) => cleanText(value))
    )
  ).slice(0, 3);
  let host = "";

  try {
    host = new URL(listingUrl).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }

  const marketplaceFallbacks = [
    ...listingIdentifiers.flatMap((identifier) => [
      `"${identifier}" reviews`,
      `"${identifier}" customer reviews`,
      `"${identifier}" complaints`,
    ]),
    `${quoted} ${host} reviews`,
    `${quoted} customer reviews`,
    `${quoted} complaints`,
    `${quoted} buyer reviews`,
    `${quotedShortTitle} ${host} reviews`,
    `${quotedShortTitle} customer reviews`,
    `${quotedShortTitle} Walmart reviews`,
    `${quotedCompactTitle} reviews`,
    `${quotedCompactTitle} customer reviews`,
    `${quoted} Amazon reviews`,
    `${quoted} site:amazon.ca reviews`,
    `${quoted} site:amazon.com reviews`,
    `${quotedShortTitle} Amazon reviews`,
    `${quotedShortTitle} site:amazon.ca reviews`,
    `${quotedShortTitle} site:amazon.com reviews`,
    `${quoted} Walmart reviews`,
    `${quoted} site:walmart.ca reviews`,
    `${quoted} Best Buy reviews`,
    `${quoted} Costco reviews`,
    `${quoted} Target reviews`,
    `${quoted} manufacturer reviews`,
    `${quoted} Reddit`,
    `${quoted} forum`,
    `${normalized} Amazon customer reviews`,
    `${normalized} marketplace reviews`,
  ];

  return Array.from(
    new Set(marketplaceFallbacks.map((query) => cleanText(query)).filter(Boolean))
  ).slice(0, 18);
}

function collectSearchResultLinks(html: string, listingUrl: string): string[] {
  const decoded = htmlDecodeLight(html);
  const links = new Set<string>();

  const urlMatches = decoded.matchAll(/https?:\/\/[^"' <>)\\]+/gi);
  for (const match of urlMatches) {
    const url = match[0];

    if (
      /google\.|bing\.|duckduckgo\.|yahoo\.|facebook\.com\/sharer|twitter\.com\/share/i.test(url)
    ) {
      continue;
    }

    if (/review|reviews|complaint|customer|product/i.test(url)) {
      links.add(url);
    }
  }

  try {
    links.add(listingUrl);
  } catch {
    // ignore
  }

  return [...links].slice(0, 10);
}

async function fetchSearchPage(query: string): Promise<string | null> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-CA,en;q=0.9",
      },
      cache: "no-store",
    });

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function fetchPublicReviewFallback(input: {
  productName: string;
  listingUrl: string;
  maxReviews: number;
}): Promise<CollectedReview[]> {
  const reviews: CollectedReview[] = [];
  const queries = buildPublicReviewSearchQueries(input.productName, input.listingUrl);

  for (const query of queries) {
    if (reviews.length >= input.maxReviews) break;

    const searchHtml = await fetchSearchPage(query);
    if (!searchHtml) continue;

    const resultLinks = collectSearchResultLinks(searchHtml, input.listingUrl);

    for (const url of resultLinks) {
      if (reviews.length >= input.maxReviews) break;

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            accept: "application/json,text/plain,text/html,*/*",
            "accept-language": "en-CA,en;q=0.9",
          },
          cache: "no-store",
        });

        if (!response.ok) continue;

        const text = await response.text();
        const decoded = htmlDecodeLight(text);

        reviews.push(...collectJsonLdReviews(decoded, url));
        reviews.push(...collectEmbeddedReviewText(decoded, url));
        reviews.push(...collectEmbeddedJsonReviews(decoded, url));
      } catch {
        // continue with next result
      }
    }
  }

  return dedupeReviews(reviews, input.maxReviews);
}


export function formatCollectedReviewsForPrompt(result: ReviewCollectorResult): string {
  const liveSummary = result.liveRetrieval
    ? [
        `Live retrieval enabled: ${result.liveRetrieval.enabled ? "yes" : "no"}.`,
        `Live retrieval provider: ${result.liveRetrieval.provider}.`,
        `Live retrieval cache hit: ${result.liveRetrieval.cacheHit ? "yes" : "no"}.`,
        `Live candidate sources: ${result.liveRetrieval.candidateUrls.length}.`,
        `Live retrieved sources: ${result.liveRetrieval.retrievedUrls.length}.`,
        `Live accepted independent sources: ${result.liveRetrieval.acceptedIndependentSourceCount}.`,
        `Live extracted written reviews: ${result.liveRetrieval.extractedWrittenReviewCount}.`,
        result.liveRetrieval.rejectedPages.length
          ? `Live rejected pages: ${result.liveRetrieval.rejectedPages
              .slice(0, 6)
              .map((page) => `${page.url} (${page.reason})`)
              .join("; ")}.`
          : "Live rejected pages: none.",
      ].join("\n")
    : "";

  if (!result.reviews.length) {
    return `Review collector attempted: ${result.attempted ? "yes" : "no"}.
Extractor: ${result.extractor}.
Written reviews collected: 0.
Collector has written reviews: no.
Coverage note: ${result.coverageNote}${liveSummary ? `\n${liveSummary}` : ""}`;
  }

  return [
    `Review collector attempted: ${result.attempted ? "yes" : "no"}.`,
    `Extractor: ${result.extractor}.`,
    `Written reviews collected: ${result.reviewsCollected}.`,
    `Collector has written reviews: ${result.collectorHasWrittenReviews ? "yes" : "no"}.`,
    `Coverage note: ${result.coverageNote}.`,
    liveSummary,
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
  brand?: string | null;
  model?: string | null;
  marketplaceReviewCount?: number | null;
  maxReviews?: number;
  forceRefresh?: boolean;
}): Promise<ReviewCollectorResult> {
  const listingUrl = input.listingUrl || null;
  const maxReviews = Math.max(10, Math.min(input.maxReviews || 80, 120));
  const extractor = extractorForUrl(listingUrl);

  if (!listingUrl) {
    const liveResult = await collectLiveReviewsForListing({
      productName: input.productName || "",
      brand: input.brand || null,
      model: input.model || null,
      listingUrl: null,
      maxReviews,
      deadlineMs: 25000,
      forceRefresh: input.forceRefresh,
    });
    const reviews = dedupeReviews(liveResult.reviews, maxReviews);

    return {
      sourceUrl: null,
      attempted: liveResult.diagnostics.enabled,
      extractor: "none",
      reviews,
      reviewsCollected: reviews.length,
      collectorHasWrittenReviews: reviews.length > 0,
      coverageNote: reviews.length
        ? `No exact listing URL was available; live retrieval collected ${reviews.length} written review text(s) from discovered sources.`
        : "No exact listing URL was available, and live retrieval did not collect enough written review text.",
      liveRetrieval: liveResult.diagnostics,
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
      const liveResult = await collectLiveReviewsForListing({
        productName: input.productName || listingUrl,
        brand: input.brand || null,
        model: input.model || null,
        listingUrl,
        maxReviews,
        deadlineMs: 25000,
        forceRefresh: input.forceRefresh,
      });
      const reviews = dedupeReviews(liveResult.reviews, maxReviews);

      return {
        sourceUrl: listingUrl,
        attempted: true,
        extractor,
        reviews,
        reviewsCollected: reviews.length,
        collectorHasWrittenReviews: reviews.length > 0,
        coverageNote: reviews.length
          ? `Listing page returned HTTP ${response.status}; live retrieval collected ${reviews.length} written review text(s).`
          : `Listing page was reachable but returned HTTP ${response.status}; written review text could not be collected from direct listing fetch or live retrieval.`,
        liveRetrieval: liveResult.diagnostics,
      };
    }

    const html = await response.text();
    const discoveredReviewUrls = marketplaceReviewUrls(extractor, html, listingUrl);

    const listingReviews = dedupeReviews(
      [
        ...(extractor === "amazon" ? collectAmazonHtmlReviews(html, listingUrl) : []),
        ...collectJsonLdReviews(html, listingUrl),
        ...collectEmbeddedReviewText(html, listingUrl),
        ...collectEmbeddedJsonReviews(html, listingUrl),
      ],
      maxReviews
    );

    const discoveredReviews = await fetchDiscoveredReviewUrls(
      discoveredReviewUrls,
      Math.max(0, maxReviews - listingReviews.length)
    );

    let reviews = dedupeReviews([...listingReviews, ...discoveredReviews], maxReviews);
    const liveResult =
      reviews.length < maxReviews
        ? await collectLiveReviewsForListing({
            productName: input.productName || listingUrl,
            brand: input.brand || null,
            model: input.model || null,
            listingUrl,
            maxReviews: maxReviews - reviews.length,
            deadlineMs: 25000,
            forceRefresh: input.forceRefresh,
          })
        : {
            reviews: [],
            diagnostics: {
              enabled: false,
              provider: "skipped",
              cacheHit: false,
              firecrawlCalled: false,
              searchQueries: [],
              candidateUrls: [],
              candidateUrlCount: 0,
              retrievedUrls: [],
              retrievedPageCount: 0,
              extractedTextCharacters: 0,
              acceptedEvidenceCount: 0,
              acceptedIndependentSourceCount: 0,
              extractedWrittenReviewCount: 0,
              rejectedEvidenceReasons: [],
              evidenceThresholdPassed: false,
              rejectedPages: [],
              sourceStatuses: [],
              latencyMs: 0,
              costEstimate: "0 Firecrawl credits; existing collector already reached max reviews.",
            },
          };

    if (liveResult.reviews.length) {
      reviews = dedupeReviews([...reviews, ...liveResult.reviews], maxReviews);
    }

    let publicFallbackReviews: CollectedReview[] = [];

    if (reviews.length === 0) {
      publicFallbackReviews = await fetchPublicReviewFallback({
        productName: input.productName || listingUrl,
        listingUrl,
        maxReviews,
      });

      reviews = dedupeReviews([...reviews, ...publicFallbackReviews], maxReviews);
    }

    console.log("[ReviewIntel DEBUG reviewCollector]", {
      listingUrl,
      extractor,
      discoveredReviewUrls: discoveredReviewUrls.length,
      listingReviews: listingReviews.length,
      discoveredReviews: discoveredReviews.length,
      liveRetrievalEnabled: liveResult.diagnostics.enabled,
      liveRetrievalProvider: liveResult.diagnostics.provider,
      liveCandidateUrls: liveResult.diagnostics.candidateUrls.length,
      liveRetrievedUrls: liveResult.diagnostics.retrievedUrls.length,
      liveAcceptedIndependentSources: liveResult.diagnostics.acceptedIndependentSourceCount,
      liveExtractedWrittenReviews: liveResult.diagnostics.extractedWrittenReviewCount,
      liveRejectedPages: liveResult.diagnostics.rejectedPages.map((page) => ({
        url: page.url,
        reason: page.reason,
      })),
      publicFallbackReviews: publicFallbackReviews.length,
      reviewsCollected: reviews.length,
    });

    const total = input.marketplaceReviewCount || null;
    const liveCoverage =
      liveResult.diagnostics.enabled && liveResult.diagnostics.candidateUrls.length
        ? ` Live retrieval checked ${liveResult.diagnostics.candidateUrls.length} candidate source(s), accepted ${liveResult.diagnostics.acceptedIndependentSourceCount} independent source(s), and extracted ${liveResult.diagnostics.extractedWrittenReviewCount} written review(s).`
        : "";
    const coverage =
      total && reviews.length
        ? `${reviews.length} of ${total} public marketplace reviews were accessible as written text.${liveCoverage}`
        : reviews.length
          ? `${reviews.length} written review texts were collected.${liveCoverage}`
          : total
            ? `${total} public marketplace reviews were visible, but written review text was not accessible from the listing HTML, discovered review URLs, live retrieval, or public review search fallback.${liveCoverage}`
            : `No written review text was accessible from the listing HTML, discovered review URLs, live retrieval, or public review search fallback.${liveCoverage}`;

    return {
      sourceUrl: listingUrl,
      attempted: true,
      extractor,
      reviews,
      reviewsCollected: reviews.length,
      collectorHasWrittenReviews: reviews.length > 0,
      coverageNote: coverage,
      fallbackUrlsTried: discoveredReviewUrls.slice(0, 12),
      liveRetrieval: liveResult.diagnostics,
    };
  } catch (error) {
    const liveResult = await collectLiveReviewsForListing({
      productName: input.productName || listingUrl,
      brand: input.brand || null,
      model: input.model || null,
      listingUrl,
      maxReviews,
      deadlineMs: 25000,
      forceRefresh: input.forceRefresh,
    });
    const reviews = dedupeReviews(liveResult.reviews, maxReviews);

    return {
      sourceUrl: listingUrl,
      attempted: true,
      extractor,
      reviews,
      reviewsCollected: reviews.length,
      collectorHasWrittenReviews: reviews.length > 0,
      coverageNote: reviews.length
        ? `Direct written review collection failed, but live retrieval collected ${reviews.length} written review text(s).`
        : `Written review collection failed: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
      liveRetrieval: liveResult.diagnostics,
    };
  }
}
