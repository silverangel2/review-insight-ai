import { hasWrittenCustomerExperience, normalizeReviewCandidate } from "./reviewEvidenceAdjudication";
import { captureStage } from "./devScanCapture";
import { buildAmazonReviewPageUrls } from "./reviewRetrievalPolicy";
import type { ScanCostTelemetry } from "@/lib/scanCostTelemetry";


export function isBlockedOrSignInReviewPage(input: {
  requestedUrl?: string | null;
  finalUrl?: string | null;
  html?: string | null;
}): boolean {
  const requestedUrl = String(input.requestedUrl || "").toLowerCase();
  const finalUrl = String(input.finalUrl || "").toLowerCase();
  const html = String(input.html || "");

  // Amazon may return HTTP 200 while redirecting review requests to an
  // authentication/claim page. That response is NOT review evidence.
  if (
    /captcha|verify you are human|automated access|access denied/i.test(html) ||
    finalUrl.includes("/ax/claim") ||
    finalUrl.includes("/ap/signin") ||
    finalUrl.includes("/gp/sign-in") ||
    finalUrl.includes("/signin")
  ) {
    return true;
  }

  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase() || "";

  if (
    /^(?:amazon(?:\.[a-z.]+)?\s*[:|-]?\s*)?sign[ -]?in$/i.test(title) ||
    /amazon\s*[:|-]?\s*sign[ -]?in/i.test(title) ||
    title.includes("robot check")
  ) {
    return true;
  }

  if (
    /enter the characters you see below/i.test(html) ||
    /type the characters you see in this image/i.test(html) ||
    /sorry, we just need to make sure you're not a robot/i.test(html)
  ) {
    return true;
  }

  // If an Amazon review URL was requested but Amazon redirected somewhere
  // unrelated to product-reviews, treat it as blocked instead of parsing the
  // returned page as review HTML.
  if (
    /amazon\.[^/]+\/.*product-reviews/i.test(requestedUrl) &&
    finalUrl &&
    !/\/product-reviews\//i.test(finalUrl)
  ) {
    return true;
  }

  return false;
}

export type CollectedReview = {
  source: string;
  sourceUrl?: string;
  reviewId?: string | null;
  retrievedAt?: string;
  marketplaceProductId?: string | null;
  rating?: number | null;
  title?: string;
  body: string;
  date?: string | null;
  verified?: boolean | null;
  reviewStructureVerified?: boolean;
  reviewedProductName?: string | null;
  reviewedModel?: string | null;
  reviewedVariant?: string | null;
  sharedReviewPool?: boolean;
  reviewedBrand?: string | null;
  reviewedProductNameSource?: "page" | "review";
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
  return cleanText(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ");
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

function isLikelyWrittenReviewBody(value: string, structured = false): boolean {
  const text = cleanText(value);
  const lower = text.toLowerCase();

  if (text.length < (structured ? 12 : 25) || text.length > 5000) return false;
  if (
    /privacy policy|terms of use|add to cart|sponsored|advertisement|subscribe|cookie policy|write a review/i.test(
      lower
    )
  ) {
    return false;
  }

  return structured || hasWrittenCustomerExperience(text);
}

function collectFromJsonLdNode(node: unknown, sourceUrl: string, out: CollectedReview[], productName: string | null = null, productBrand: string | null = null, sharedReviewPool = false) {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const item of node) collectFromJsonLdNode(item, sourceUrl, out, productName, productBrand, sharedReviewPool);
    return;
  }

  const record = node as Record<string, unknown>;
  const type = record["@type"];
  const types = Array.isArray(type) ? type.map(String) : [String(type)];
  const sharedPool = types.some(value => value.toLowerCase() === "productgroup") || sharedReviewPool;
  const contextName = types.some((value) => value.toLowerCase() === "product") ? cleanText(record.name) || null : productName;
  const brandName = (value: unknown) => typeof value === "string" ? cleanText(value)
    : value && typeof value === "object" ? cleanText((value as Record<string, unknown>).name) : "";
  const contextBrand = types.some((value) => value.toLowerCase() === "product") ? brandName(record.brand) || null : productBrand;

  const isReview =
    type === "Review" ||
    (Array.isArray(type) && type.map(String).some((item) => item.toLowerCase() === "review"));

  if (isReview) {
    const body =
      cleanText(record.reviewBody) ||
      cleanText(record.description) ||
      cleanText(record.text) ||
      cleanText(record.name);

    if (isLikelyWrittenReviewBody(body, true)) {
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
        reviewStructureVerified: true,
        reviewedProductName: record.itemReviewed && typeof record.itemReviewed === "object"
          ? cleanText((record.itemReviewed as Record<string, unknown>).name) || null : sharedPool ? null : contextName,
        sharedReviewPool: sharedPool,
        reviewedModel: record.itemReviewed && typeof record.itemReviewed === "object" ? cleanText((record.itemReviewed as Record<string, unknown>).model) || null : null,
        reviewedVariant: record.itemReviewed && typeof record.itemReviewed === "object" ? ["color", "size", "capacity"].map(key => cleanText((record.itemReviewed as Record<string, unknown>)[key])).filter(Boolean).join(" ") || null : null,
        reviewedBrand: record.itemReviewed && typeof record.itemReviewed === "object"
          ? brandName((record.itemReviewed as Record<string, unknown>).brand) || contextBrand : contextBrand,
      });
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") collectFromJsonLdNode(value, sourceUrl, out, contextName, contextBrand, sharedPool);
  }
}

function collectJsonLdReviews(html: string, sourceUrl: string): CollectedReview[] {
  const reviews: CollectedReview[] = [];
  const matches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of matches) {
    // Parse the serialized document before normalizing its text fields.
    // Unescaping quotes here corrupts valid JSON containing quoted review text.
    const raw = match[1].trim();
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
  // Parsed JSON is handled by the contextual extractors. A raw field regex
  // must not strip away a Product wrapper and turn its metadata into reviews.
  const unstructuredScripts = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (block) => {
    if (/type=["']application\/ld\+json["']/i.test(block)) return " ";
    const script = htmlDecodeLight(block.replace(/^<script[^>]*>|<\/script>$/gi, "")).trim();
    return safeJsonParse(script) || /"@type"\s*:\s*"Product"/i.test(script) ? " " : block;
  });
  const patterns = [
    /"reviewText"\s*:\s*"((?:\\.|[^"\\]){20,5000})"/gi,
    /"reviewBody"\s*:\s*"((?:\\.|[^"\\]){20,5000})"/gi,
    /"customerReviewText"\s*:\s*"((?:\\.|[^"\\]){20,5000})"/gi,
  ];

  for (const pattern of patterns) {
    for (const match of unstructuredScripts.matchAll(pattern)) {
      const body = cleanText(match[1]);
      if (
        isLikelyWrittenReviewBody(body, true) &&
        !/privacy policy|terms of use|add to cart|sponsored|advertisement/i.test(body)
      ) {
        reviews.push({
          source: "Listing embedded review data",
          sourceUrl,
          rating: null,
          body,
          date: null,
          verified: null,
          reviewStructureVerified: true,
        });
      }
    }
  }

  return reviews;
}

// schema.org microdata: only reviewBody inside an itemscope typed Review counts;
// product descriptions and other itemprops are never promoted to reviews.
function collectMicrodataReviews(html: string, sourceUrl: string): CollectedReview[] {
  const reviews: CollectedReview[] = [];
  const opener = /<[a-z]+\b[^>]*\bitemtype=["']https?:\/\/schema\.org\/Review["'][^>]*>/gi;
  const starts = [...html.matchAll(opener)].map((m) => m.index || 0);
  starts.forEach((start, i) => {
    const block = html.slice(start, starts[i + 1] ?? Math.min(html.length, start + 20000));
    const bodyMatch = block.match(/<([a-z]+)\b[^>]*\bitemprop=["']reviewBody["'][^>]*?(?:content=["']([^"']+)["'][^>]*)?>([\s\S]*?)<\/\1>/i);
    const body = bodyMatch ? cleanText(htmlDecodeLight(bodyMatch[2] || bodyMatch[3] || "")) : "";
    if (!isLikelyWrittenReviewBody(body, true)) return;
    const rating = Number(block.match(/itemprop=["']ratingValue["'][^>]*?(?:content=["']([\d.]+)["']|>\s*([\d.]+))/i)?.slice(1).find(Boolean));
    const date = block.match(/itemprop=["']datePublished["'][^>]*?(?:content=["']([^"']+)["']|>([^<]+))/i)?.slice(1).find(Boolean) || null;
    reviews.push({ source: "Listing microdata review", sourceUrl, rating: Number.isFinite(rating) ? normalizeRating(rating) : null, body, date: date ? cleanText(date) : null, verified: null, reviewStructureVerified: true });
  });
  return reviews;
}

function dedupeReviews(reviews: CollectedReview[], maxReviews: number): CollectedReview[] {
  const seen = new Set<string>();
  const cleaned: CollectedReview[] = [];

  for (const review of reviews) {
    const body = cleanText(review.body);
    if (body.length < (review.reviewStructureVerified ? 12 : 25)) continue;

    const key = reviewKey(body);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    cleaned.push({
      ...review,
      body: body.slice(0, 5000),
      title: review.title ? cleanText(review.title).slice(0, 160) : undefined,
      retrievedAt: review.retrievedAt || new Date().toISOString(),
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
    keys.some((key) => ["reviewtext", "reviewbody", "review", "comment", "comments", "customerreviewtext", "reviewdescription", "reviewid", "reviewtitle", "reviewer", "submissiontime", "submissionid"].includes(key));

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

  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  if (!types.some((type) => String(type).toLowerCase() === "product") && hasReviewShape && isLikelyWrittenReviewBody(body, true)) {
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
      sourceUrl: source,
      reviewStructureVerified: true,
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
  // A public review endpoint that answers with JSON (no HTML wrapper).
  const trimmed = html.trim();
  if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && /review|rating|comment/i.test(trimmed.slice(0, 200000))) {
    const parsed = safeJsonParse(trimmed);
    if (parsed) collectReviewLikeObjects(parsed, source, reviews);
  }
  const scriptMatches = html.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, " ")
    .matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);

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
    if (/m\.media-amazon\.com|\.(?:css|js|jpg|jpeg|png|gif|webp|avif|mp4)(?:[?,#]|$)/i.test(url)) continue;
    if (/review|bazaarvoice|ugc|ratings|product-reviews/i.test(url)) {
      urls.add(url);
    }
  }

  const relativeMatches = decoded.matchAll(/["'](\/[^"']*(?:review|ratings|ugc|bazaarvoice)[^"']*)["']/gi);
  for (const match of relativeMatches) {
    try {
      const url = new URL(match[1], listingUrl).toString();
      if (!/\.(?:css|js|jpg|jpeg|png|gif|webp|avif|mp4)(?:[?,#]|$)/i.test(url)) urls.add(url);
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

  // The verified listing identity is authoritative. Amazon product HTML can
  // contain recommendation widgets, alternate variants, or unrelated ASINs;
  // scanning that HTML before the canonical URL can silently paginate the
  // wrong product.
  const listingMatch = listingUrl.match(patterns[0]);
  if (listingMatch?.[1]) return listingMatch[1].toUpperCase();

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
    return buildAmazonReviewPageUrls(listingUrl, asin);
  } catch {
    return [];
  }
}

function collectAmazonHtmlReviews(html: string, sourceUrl: string): CollectedReview[] {
  const decoded = htmlDecodeLight(html);
  const reviews: CollectedReview[] = [];
  // Review containers are identified by the data-hook attribute, not the tag:
  // marketplace product pages render top reviews as <li>, list pages as <div>.
  const blocks = decoded.match(/<(?:div|li|article|section)\b[^>]*\bdata-hook=["']review["'][\s\S]*?(?=<(?:div|li|article|section)\b[^>]*\bdata-hook=["']review["']|$)/gi) || [];

  for (const block of blocks) {
    // The body element nests spans/divs/<br>; read until the next non-body
    // review hook instead of the first </span>, which truncates multi-part text.
    // Both legacy (review-body) and current (reviewText / reviewRichContentContainer)
    // body containers; read every paragraph until the next non-body hook.
    const bodyHook = /data-hook=["'](?:review-body|reviewTextContainer|reviewText|reviewRichContentContainer)["'][^>]*>/i;
    const bodyStart = block.search(bodyHook);
    const nestedBody = bodyStart >= 0 ? (() => {
      const rest = block.slice(bodyStart).replace(bodyHook, "");
      const end = rest.search(/data-hook=["'](?!review-collapsed|review-body|reviewTextContainer|reviewText|reviewRichContentContainer)[^"']+["']/i);
      return (end >= 0 ? rest.slice(0, rest.lastIndexOf("<", end)) : rest).replace(/<br\s*\/?>|<\/p>/gi, " ")
        .replace(/<div[^>]*a-teaser-describedby[^>]*>[\s\S]*?<\/div>/gi, " ");
    })() : null;
    const bodyMatch = (nestedBody !== null ? [nestedBody, nestedBody] as unknown as RegExpMatchArray : null) ||
      block.match(/class=["'][^"']*review-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    // Accessibility expander prompts are interface text, not the reviewer's words.
    const body = bodyMatch ? cleanText(bodyMatch[1])
      .replace(/(?:brief|full) content visible,? double tap to read (?:full|brief) content\.?/gi, " ")
      .replace(/\b(?:read more|read less|see more|see less|translate review to english|see original)\s*$/i, " ")
      .replace(/\s+/g, " ").trim() : "";

    if (!isLikelyWrittenReviewBody(body, true)) continue;

    const titleMatch =
      block.match(/data-hook=["']review-title["'][^>]*>([\s\S]*?)<\/a>/i) ||
      block.match(/data-hook=["']review-title["'][^>]*>([\s\S]*?)<\/span>/i);
    const ratingMatch = block.match(/(\d(?:\.\d)?)\s+out of\s+5\s+stars/i);
    const dateMatch = block.match(/data-hook=["']review-date["'][^>]*>([\s\S]*?)<\/span>/i);

    reviews.push({
      source: "Amazon written review",
      reviewStructureVerified: true,
      sourceUrl,
      reviewedVariant: block.match(/data-hook=["']format-strip["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] ? cleanText(block.match(/data-hook=["']format-strip["'][^>]*>([\s\S]*?)<\/a>/i)![1]) : null,
      reviewId: block.match(/data-(?:review-id|hook-review-id)=["']([^"']+)/i)?.[1] || null,
      marketplaceProductId: extractAmazonAsin(sourceUrl, decoded),
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
    // Amazon product pages contain recommendation widgets and SSPA links for
    // other ASINs. The direct marketplace collector must stay on the verified
    // ASIN; public discovery belongs to the separately gated fallback layer.
    return amazonReviewUrls(listingUrl, html);
  }

  if (extractor === "walmart") {
    return discovered.filter((url) => /review|ratings|bazaarvoice|ugc/i.test(url));
  }

  return discovered;
}

async function fetchDiscoveredReviewUrls(urls: string[], maxReviews: number, costTelemetry?: ScanCostTelemetry, initialReviews: CollectedReview[] = []): Promise<{ reviews: CollectedReview[]; requestAttempts: number; pagesFetched: number; rawReviewCount: number }> {
  const reviews: CollectedReview[] = [...initialReviews];

  let requestAttempts = 0;
  let pagesFetched = 0;
  let stopReason = "candidate review URLs exhausted";
  for (const [index, url] of urls.entries()) {
    if (dedupeReviews(reviews, maxReviews).length >= maxReviews) {
      stopReason = "configured corpus cap reached";
      break;
    }

    try {
      if (costTelemetry && !costTelemetry.canStartRetrievalRequest()) break;
      costTelemetry?.recordRetrievalRequest("other");
      requestAttempts += 1;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept: "application/json,text/plain,text/html,*/*",
          "accept-language": "en-CA,en;q=0.9",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(9000),
      });

      pagesFetched += 1;
      captureStage("page", () => ({ sourceUrl: url, httpStatus: response.status, page: index + 1, blockedOrChallenged: !response.ok, records: [] }));
      if (!response.ok) {
        console.log("[ReviewIntel PIPELINE] retrieval", JSON.stringify({ layer: "discovered-review-url", url, page: index + 1, status: response.status, reviewsFound: 0, nextPageDiscovered: index + 1 < urls.length, paginationContinued: index + 1 < urls.length, stopReason: "HTTP response not usable" }));
        continue;
      }

      const text = await response.text();
      const before = reviews.length;
      const decoded = htmlDecodeLight(text);
      const parsed = safeJsonParse(decoded);
      const contentType = response.headers.get("content-type") || "unknown";
      const blockedOrChallenged = isBlockedOrSignInReviewPage({
        requestedUrl: url,
        finalUrl: response.url,
        html: decoded,
      });

      // HTTP 200 is not sufficient proof of usable review content.
      // Amazon and other marketplaces may redirect a public review request
      // to a sign-in/claim/challenge page while still returning 200.
      if (blockedOrChallenged) {
        captureStage("extraction", () => ({
          sourceUrl: url,
          httpStatus: response.status,
          page: index + 1,
          blockedOrChallenged: true,
          records: [],
        }));

        console.log(
          "[ReviewIntel PIPELINE] retrieval",
          JSON.stringify({
            layer: "discovered-review-url",
            url,
            finalUrl: response.url || null,
            page: index + 1,
            status: response.status,
            contentType,
            reviewNodesFound: 0,
            validReviewTexts: 0,
            nextPageFound: index + 1 < urls.length,
            nextPageUrl: urls[index + 1] || null,
            blockedOrChallenged: true,
            selectorMismatch: false,
            paginationContinued:
              index + 1 < urls.length && dedupeReviews(reviews, maxReviews).length < maxReviews,
            stopReason: "sign-in/challenge response rejected",
          })
        );

        continue;
      }

      if (parsed) {
        collectReviewLikeObjects(parsed, response.url || url, reviews);
      } else {
        reviews.push(...collectAmazonHtmlReviews(decoded, response.url || url));
        reviews.push(...collectJsonLdReviews(decoded, response.url || url));
        reviews.push(...collectEmbeddedReviewText(decoded, response.url || url));
        reviews.push(...collectEmbeddedJsonReviews(decoded, response.url || url));
      }
      captureStage("extraction", () => ({ sourceUrl: url, httpStatus: response.status, page: index + 1, blockedOrChallenged, records: reviews.slice(before).map(record => ({ ...record, ...normalizeReviewCandidate(record), sourceDomain: new URL(url).hostname })) }));
      console.log("[ReviewIntel PIPELINE] retrieval", JSON.stringify({ layer: "discovered-review-url", url, page: index + 1, status: response.status, contentType, reviewNodesFound: reviews.length - before, validReviewTexts: reviews.length - before, nextPageFound: index + 1 < urls.length, nextPageUrl: urls[index + 1] || null, blockedOrChallenged, selectorMismatch: /html/i.test(contentType) && reviews.length === before, paginationContinued: index + 1 < urls.length && dedupeReviews(reviews, maxReviews).length < maxReviews, stopReason: index + 1 < urls.length && dedupeReviews(reviews, maxReviews).length < maxReviews ? null : dedupeReviews(reviews, maxReviews).length >= maxReviews ? "configured corpus cap reached" : "candidate review URLs exhausted" }));
    } catch {
      console.log("[ReviewIntel PIPELINE] retrieval", JSON.stringify({ layer: "discovered-review-url", url, page: index + 1, status: "error", reviewsFound: 0, nextPageDiscovered: index + 1 < urls.length, paginationContinued: index + 1 < urls.length, stopReason: "fetch error; continued" }));
    }
  }

  const deduped = dedupeReviews(reviews, maxReviews);
  console.log("[ReviewIntel PIPELINE] retrieval-summary", JSON.stringify({ layer: "discovered-review-url", pagesFetched, rawReviewsDiscovered: reviews.length, dedupedReviews: deduped.length, maxReviews, stopReason }));
  return { reviews: deduped, requestAttempts, pagesFetched, rawReviewCount: reviews.length - initialReviews.length };
}



function reviewCorpusCap(value: unknown) {
  const configured = Number(process.env.REVIEWINTEL_MAX_ACCEPTED_REVIEW_CORPUS || 240);
  const cap = Number.isFinite(configured) ? Math.max(10, Math.min(Math.floor(configured), 500)) : 240;
  const requested = Number(value);
  return Number.isFinite(requested) ? Math.max(10, Math.min(Math.floor(requested), cap)) : cap;
}

function normalizeCandidateReviewUrl(value: unknown): string | null {
  const raw = htmlDecodeLight(String(value || "")).trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function collectWrittenReviewsFromUrls(input: {
  urls: string[];
  productName?: string | null;
  maxReviews?: number;
  costTelemetry?: ScanCostTelemetry;
}): Promise<ReviewCollectorResult> {
  const maxReviews = reviewCorpusCap(input.maxReviews);
  const urls = Array.from(
    new Set(
      (input.urls || [])
        .map(normalizeCandidateReviewUrl)
        .filter((url): url is string => Boolean(url))
    )
  ).slice(0, 8);

  if (!urls.length) {
    return {
      sourceUrl: null,
      attempted: false,
      extractor: "generic",
      reviews: [],
      reviewsCollected: 0,
      collectorHasWrittenReviews: false,
      coverageNote: "No OpenAI-discovered review URLs were available for ReviewIntel scraping.",
      fallbackUrlsTried: [],
    };
  }

  const discoveredRetrieval = await fetchDiscoveredReviewUrls(urls, maxReviews, input.costTelemetry);
  const reviews = discoveredRetrieval.reviews;

  return {
    sourceUrl: urls[0],
    attempted: true,
    extractor: "generic",
    reviews,
    reviewsCollected: reviews.length,
    collectorHasWrittenReviews: reviews.length > 0,
    coverageNote: reviews.length
      ? `ReviewIntel scraped ${reviews.length} written review texts from OpenAI-discovered candidate review URLs.`
      : `ReviewIntel fetched ${urls.length} OpenAI-discovered candidate review URL(s), but did not extract usable written review text.`,
    fallbackUrlsTried: urls,
  };
}


export function formatCollectedReviewsForPrompt(result: ReviewCollectorResult): string {
  if (!result.reviews.length) {
    return `Review collector attempted: ${result.attempted ? "yes" : "no"}.
Extractor: ${result.extractor}.
Written reviews collected: 0.
Collector has written reviews: no.
Coverage note: ${result.coverageNote}`;
  }

  // Retrieval may retain up to 240 records for deterministic scoring, but the
  // model receives a bounded evidence packet. Numeric scoring never uses this
  // packet; it uses the complete adjudicated corpus locally.
  const modelReviews = result.reviews
    .filter((review) => review.body.trim().length >= 25)
    .slice(0, 24);

  return [
    `Review collector attempted: ${result.attempted ? "yes" : "no"}.`,
    `Extractor: ${result.extractor}.`,
    `Written reviews collected: ${result.reviewsCollected}.`,
    `Collector has written reviews: ${result.collectorHasWrittenReviews ? "yes" : "no"}.`,
    `Coverage note: ${result.coverageNote}.`,
    "",
    `Compact model evidence packet: ${modelReviews.length} of ${result.reviews.length} retained reviews.`,
    ...modelReviews.map((review, index) => {
      const rating = typeof review.rating === "number" ? ` Rating: ${review.rating}/5.` : "";
      const date = review.date ? ` Date: ${review.date}.` : "";
      const verified =
        typeof review.verified === "boolean" ? ` Verified: ${review.verified ? "yes" : "no"}.` : "";

      return `Review ${index + 1}.${rating}${date}${verified} Source: ${review.source}. Text: ${review.body.slice(0, 700)}`;
    }),
  ].join("\n");
}

// Shared written-review selectors; descriptions and generic paragraphs are not evidence.
export function extractWrittenReviewsFromHtml(html: string, sourceUrl: string, maxReviews = 240): CollectedReview[] {
  if (isBlockedOrSignInReviewPage({ requestedUrl: sourceUrl, finalUrl: sourceUrl, html })) return [];
  const rawRecords = [
    ...(extractorForUrl(sourceUrl) === "amazon" ? collectAmazonHtmlReviews(html, sourceUrl) : []),
    ...collectJsonLdReviews(html, sourceUrl),
    ...collectEmbeddedReviewText(html, sourceUrl),
    ...collectEmbeddedJsonReviews(html, sourceUrl),
    ...collectMicrodataReviews(html, sourceUrl),
  ];
  captureStage("extraction", () => ({ sourceUrl, records: rawRecords.map(record => ({ ...record, ...normalizeReviewCandidate(record), sourceDomain: new URL(sourceUrl).hostname })) }));
  return dedupeReviews(rawRecords, maxReviews);
}

export async function collectWrittenReviewsFromListing(input: {
  listingUrl?: string | null;
  productName?: string | null;
  marketplaceReviewCount?: number | null;
  maxReviews?: number;
  costTelemetry?: ScanCostTelemetry;
}): Promise<ReviewCollectorResult> {
  const listingUrl = input.listingUrl || null;
  const maxReviews = reviewCorpusCap(input.maxReviews);
  const extractor = extractorForUrl(listingUrl);

  if (!listingUrl) {
    return {
      sourceUrl: null,
      attempted: true,
      extractor: "generic",
      reviews: [],
      reviewsCollected: 0,
      collectorHasWrittenReviews: false,
      coverageNote: "No exact listing URL was available; search discovery cannot be counted as written review evidence.",
      fallbackUrlsTried: [],
    };
  }

  try {
    if (input.costTelemetry && !input.costTelemetry.canStartRetrievalRequest()) {
      return {
        sourceUrl: listingUrl,
        attempted: true,
        extractor,
        reviews: [],
        reviewsCollected: 0,
        collectorHasWrittenReviews: false,
        coverageNote: "Per-scan retrieval ceiling reached before the listing request.",
      };
    }
    input.costTelemetry?.recordRetrievalRequest("other");
    const response = await fetch(listingUrl, {
      method: "GET",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; ReviewIntel/1.0; +https://getreviewintel.com)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-CA,en;q=0.9",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });

    captureStage("page", () => ({ sourceUrl: listingUrl, httpStatus: response.status, page: 1, blockedOrChallenged: !response.ok, records: [] }));
    if (!response.ok) {
      return {
        sourceUrl: listingUrl,
        attempted: true,
        extractor,
        reviews: [],
        reviewsCollected: 0,
        collectorHasWrittenReviews: false,
        coverageNote: `Listing page was reachable but returned HTTP ${response.status}; written review text could not be collected.`,
      };
    }

    const html = await response.text();
    const listingBlockedOrChallenged = isBlockedOrSignInReviewPage({
      requestedUrl: listingUrl,
      finalUrl: response.url,
      html,
    });

    if (listingBlockedOrChallenged) {
      captureStage("page", () => ({
        sourceUrl: listingUrl,
        httpStatus: response.status,
        page: 1,
        blockedOrChallenged: true,
        records: [],
      }));

      console.log(
        "[ReviewIntel PIPELINE] retrieval",
        JSON.stringify({
          layer: "listing-page",
          url: listingUrl,
          finalUrl: response.url || null,
          page: 1,
          status: response.status,
          reviewNodesFound: 0,
          validReviewTexts: 0,
          blockedOrChallenged: true,
          stopReason: "sign-in/challenge response rejected",
        })
      );

      return {
        sourceUrl: listingUrl,
        attempted: true,
        extractor,
        reviews: [],
        reviewsCollected: 0,
        collectorHasWrittenReviews: false,
        coverageNote:
          "The marketplace redirected the public review request to a sign-in or challenge page, so no review text from that response was accepted.",
      };
    }

    const responseUrl = response.url || listingUrl;
    const discoveredReviewUrls = marketplaceReviewUrls(extractor, html, responseUrl);

    const listingRawReviews = [
      ...(extractor === "amazon" ? collectAmazonHtmlReviews(html, responseUrl) : []),
      ...collectJsonLdReviews(html, responseUrl),
      ...collectEmbeddedReviewText(html, responseUrl),
      ...collectEmbeddedJsonReviews(html, responseUrl),
    ];
    const listingReviews = dedupeReviews(listingRawReviews, maxReviews);

    captureStage("extraction", () => ({ sourceUrl: listingUrl, httpStatus: response.status, page: 1, blockedOrChallenged: listingBlockedOrChallenged, records: listingRawReviews.map(record => ({ ...record, ...normalizeReviewCandidate(record), sourceDomain: new URL(listingUrl).hostname })) }));
    console.log("[ReviewIntel PIPELINE] normalization", JSON.stringify({ layer: "listing-page", rawCount: listingReviews.length, malformedRemoved: 0, duplicatesRemoved: 0, remainingUnique: listingReviews.length }));

    const discoveredRetrieval = await fetchDiscoveredReviewUrls(
      discoveredReviewUrls,
      maxReviews,
      input.costTelemetry,
      listingReviews,
    );

    const reviews = discoveredRetrieval.reviews;
    const discoveredReviewCount = Math.max(0, reviews.length - listingReviews.length);
    const rawReviewsDiscovered = listingReviews.length + discoveredRetrieval.rawReviewCount;

    console.log("[ReviewIntel PIPELINE] normalization", JSON.stringify({ layer: "listing-plus-pagination", rawCount: rawReviewsDiscovered, malformedRemoved: 0, duplicatesRemoved: Math.max(0, rawReviewsDiscovered - reviews.length), remainingUnique: reviews.length }));

    console.log("[ReviewIntel DEBUG reviewCollector]", {
      listingUrl,
      extractor,
      discoveredReviewUrls: discoveredReviewUrls.length,
      listingReviews: listingReviews.length,
      discoveredReviews: discoveredReviewCount,
      publicFallbackReviews: 0,
      reviewsCollected: reviews.length,
      rawReviewsDiscovered,
      discoveredReviewUrlCount: discoveredReviewUrls.length,
      discoveredReviewRequestAttempts: discoveredRetrieval.requestAttempts,
      discoveredReviewResponsesReceived: discoveredRetrieval.pagesFetched,
      sourcesUsed: Array.from(new Set(reviews.map((review) => review.sourceUrl || review.source))),
    });

    const total = input.marketplaceReviewCount || null;
    const coverage =
      total && reviews.length
        ? `${reviews.length} of ${total} public marketplace reviews were accessible as written text.`
        : reviews.length
          ? `${reviews.length} written review texts were collected.`
          : total
            ? `${total} public marketplace reviews were visible, but written review text was not accessible from the listing HTML or fetched public review pages.`
            : "No written review text was accessible from the listing HTML or fetched public review pages.";

    return {
      sourceUrl: listingUrl,
      attempted: true,
      extractor,
      reviews,
      reviewsCollected: reviews.length,
      collectorHasWrittenReviews: reviews.length > 0,
      coverageNote: coverage,
      fallbackUrlsTried: discoveredReviewUrls.slice(0, 12),
    };
  } catch (error) {
    return {
      sourceUrl: listingUrl,
      attempted: true,
      extractor,
      reviews: [],
      reviewsCollected: 0,
      collectorHasWrittenReviews: false,
      coverageNote: `Written review collection failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }
}
