// Store-specific public URL plans behind one collector interface.
// Every URL here is a page or JSON document the storefront itself loads
// without a signed-in session. No credentials, no private APIs.

import { amazonHostFromUrl } from "./listingAuthority";
import type { FetchTier } from "./browserProfiles";

export type StoreAttempt = {
  url: string;
  tier: FetchTier;
  profileId: "chrome-win" | "chrome-mac" | "chrome-android";
};

export type StoreId = "amazon" | "walmart" | "bestbuy" | "target" | "homedepot";

export type StoreCollector = {
  id: StoreId;
  matches(url: string): boolean;
  productId(url: string): string | null;
  titleMarkers: RegExp;
  reviewMarkers: RegExp;
  plan(url: string, full: boolean): StoreAttempt[];
  extraFromHtml?(html: string, pageUrl: string): StoreAttempt[];
};

/**
 * Public key shipped in Target's own web client for the reviews summary the
 * product page requests. It is not an account credential.
 */
export const TARGET_PUBLIC_STOREFRONT_KEY = "9f36aeafbe60771e321a7cc95a78140772ab3e96";

export function amazonStableId(value: string): string | null {
  const path = String(value || "").match(/\/(?:dp|gp\/product|gp\/aw\/d|product-reviews)\/([A-Z0-9]{10})(?:[/?#]|$)/i)?.[1];
  if (path) return path.toUpperCase();
  try {
    const url = new URL(value);
    if (!/amazon\./i.test(url.hostname)) return null;
    const asin = url.searchParams.get("asin");
    if (asin && /^[A-Z0-9]{10}$/i.test(asin)) return asin.toUpperCase();
  } catch { /* not a URL */ }
  return null;
}

export function walmartItemId(value: string): string | null {
  try {
    const url = new URL(value);
    if (!/^walmart\.(?:com|ca)$/i.test(url.hostname.replace(/^www\./, ""))) return null;
    return url.pathname.match(/\/reviews\/product\/([A-Z0-9]{6,14})(?:\/|$)/i)?.[1]
      || url.pathname.match(/\/ip\/(?:.*\/)?([A-Z0-9]{6,14})(?:\/|$)/i)?.[1]
      || null;
  } catch { return null; }
}

export function bestBuyIdentity(value: string): { sku: string; slug: string | null; ca: boolean; origin: string } | null {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "bestbuy.com") {
      const match = url.pathname.match(/\/site\/(?:reviews\/)?([^/]+)\/(\d{5,9})(?:\.p)?(?:\/|$)/i);
      if (match) return { sku: match[2], slug: match[1], ca: false, origin: url.origin };
      const sku = url.searchParams.get("sku");
      if (sku && /^\d{5,9}$/.test(sku)) return { sku, slug: null, ca: false, origin: "https://www.bestbuy.com" };
    }
    if (host === "bestbuy.ca") {
      const match = url.pathname.match(/\/(?:product|produit)\/([^/]+)\/(\d{5,9})(?:\/|$)/i);
      if (match) return { sku: match[2], slug: match[1], ca: true, origin: url.origin };
      const api = url.pathname.match(/\/api\/reviews\/v2\/products\/(\d{5,9})\/reviews/i);
      if (api) return { sku: api[1], slug: null, ca: true, origin: url.origin };
    }
  } catch { /* not a URL */ }
  return null;
}

export function targetTcin(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "target.com" && !host.endsWith(".target.com")) return null;
    const fromPath = url.pathname.match(/\/A-(\d{6,12})(?:[/?#]|$)/i)?.[1];
    if (fromPath) return fromPath;
    const query = url.searchParams.get("reviewedId") || url.searchParams.get("tcin");
    if (query && /^\d{6,12}$/.test(query)) return query;
  } catch { /* not a URL */ }
  return null;
}

export function homeDepotIdentity(value: string): { id: string; slug: string | null; origin: string } | null {
  try {
    const url = new URL(value);
    if (!/^homedepot\.(?:com|ca)$/i.test(url.hostname.replace(/^www\./, ""))) return null;
    const match = url.pathname.match(/\/p\/(?:reviews\/)?(?:([a-z0-9-]+)\/)?(\d{6,12})(?:\/|$)/i);
    if (!match) return null;
    const slug = match[1] && !/^\d+$/.test(match[1]) ? match[1] : null;
    return { id: match[2], slug, origin: url.origin };
  } catch { return null; }
}

function dedupeAttempts(attempts: StoreAttempt[]): StoreAttempt[] {
  const seen = new Set<string>();
  const out: StoreAttempt[] = [];
  for (const attempt of attempts) {
    const key = `${attempt.profileId} ${attempt.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(attempt);
  }
  return out;
}

function originOf(url: string): string {
  return new URL(url).origin;
}

const amazonCollector: StoreCollector = {
  id: "amazon",
  matches: (url) => Boolean(amazonStableId(url)),
  productId: amazonStableId,
  titleMarkers: /id=["']productTitle["']/i,
  reviewMarkers: /data-hook=["']review(?:-body)?["']|"reviewBody"/i,
  plan(url, full) {
    const asin = amazonStableId(url);
    if (!asin) return [];
    const origin = originOf(url);
    const attempts: StoreAttempt[] = [
      { url, tier: "primary-profile", profileId: "chrome-win" },
      { url, tier: "alternate-profile", profileId: "chrome-mac" },
    ];
    if (!full) return dedupeAttempts(attempts);
    attempts.push(
      { url: `${origin}/dp/${asin}`, tier: "alternate-url", profileId: "chrome-win" },
      { url: `${origin}/gp/product/${asin}`, tier: "alternate-url", profileId: "chrome-mac" },
      { url: `${origin}/dp/${asin}?th=1&psc=1`, tier: "alternate-url", profileId: "chrome-win" },
      { url: `${origin}/gp/aw/d/${asin}`, tier: "mobile-url", profileId: "chrome-android" },
      { url: `${origin}/product-reviews/${asin}/?reviewerType=all_reviews&sortBy=recent`, tier: "reviews-endpoint", profileId: "chrome-win" },
      { url: `${origin}/hz/reviews-render/ajax/reviews/get/?asin=${asin}&reviewerType=all_reviews&sortBy=recent&pageNumber=1&filterByStar=all_stars&formatType=&mediaType=`, tier: "reviews-endpoint", profileId: "chrome-mac" },
    );
    const current = amazonHostFromUrl(url);
    for (const host of ["www.amazon.com", "www.amazon.ca", "www.amazon.co.uk"]) {
      if (host === current) continue;
      attempts.push(
        { url: `https://${host}/dp/${asin}`, tier: "sibling-domain", profileId: "chrome-win" },
        { url: `https://${host}/product-reviews/${asin}/?reviewerType=all_reviews&sortBy=recent`, tier: "sibling-domain", profileId: "chrome-mac" },
      );
    }
    return dedupeAttempts(attempts);
  },
};

const walmartCollector: StoreCollector = {
  id: "walmart",
  matches: (url) => Boolean(walmartItemId(url)),
  productId: walmartItemId,
  titleMarkers: /data-testid=["']product-title["']|data-automation-id=["']product-title["']|id=["']main-title["']/i,
  reviewMarkers: /data-testid=["'][^"']*review|itemprop=["']reviewBody["']|"reviewBody"|"reviewText"/i,
  plan(url, full) {
    const id = walmartItemId(url);
    if (!id) return [];
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const attempts: StoreAttempt[] = [
      { url, tier: "primary-profile", profileId: "chrome-win" },
      { url, tier: "alternate-profile", profileId: "chrome-mac" },
    ];
    if (!full) return dedupeAttempts(attempts);
    attempts.push(
      { url: `${parsed.origin}/ip/${id}`, tier: "alternate-url", profileId: "chrome-win" },
      { url: `${parsed.origin}/reviews/product/${id}?sort=submission-desc&page=1`, tier: "reviews-endpoint", profileId: "chrome-mac" },
      { url: `${parsed.origin}/ip/${id}`, tier: "mobile-url", profileId: "chrome-android" },
    );
    if (host === "walmart.com") {
      attempts.push(
        { url: `https://www.walmart.ca/en/ip/${id}`, tier: "sibling-domain", profileId: "chrome-win" },
        { url: `https://www.walmart.ca/reviews/product/${id}?sort=submission-desc&page=1`, tier: "sibling-domain", profileId: "chrome-mac" },
      );
    } else if (host === "walmart.ca") {
      attempts.push(
        { url: `https://www.walmart.com/ip/${id}`, tier: "sibling-domain", profileId: "chrome-win" },
        { url: `https://www.walmart.com/reviews/product/${id}?sort=submission-desc&page=1`, tier: "sibling-domain", profileId: "chrome-mac" },
      );
    }
    return dedupeAttempts(attempts);
  },
};

const bestBuyCollector: StoreCollector = {
  id: "bestbuy",
  matches: (url) => Boolean(bestBuyIdentity(url)),
  productId: (url) => bestBuyIdentity(url)?.sku || null,
  titleMarkers: /sku-title|data-testid=["']product-title["']|class=["'][^"']*productName/i,
  reviewMarkers: /"reviewBody"|"comment"|"reviewText"|data-testid=["'][^"']*review/i,
  plan(url, full) {
    const identity = bestBuyIdentity(url);
    if (!identity) return [];
    const attempts: StoreAttempt[] = [
      { url, tier: "primary-profile", profileId: "chrome-win" },
      { url, tier: "alternate-profile", profileId: "chrome-mac" },
    ];
    if (!full) return dedupeAttempts(attempts);
    if (identity.ca) {
      const lang = /\/fr-ca\//i.test(url) ? "fr-CA" : "en-CA";
      const product = identity.slug ? `${identity.origin}/${lang === "fr-CA" ? "fr-ca/produit" : "en-ca/product"}/${identity.slug}/${identity.sku}` : url;
      attempts.push(
        { url: `${product.replace(/\/$/, "")}/review`, tier: "alternate-url", profileId: "chrome-win" },
        { url: `${identity.origin}/api/reviews/v2/products/${identity.sku}/reviews?source=all&lang=${lang}&pageSize=20&page=1&sortBy=relevancy`, tier: "reviews-endpoint", profileId: "chrome-mac" },
        { url: product, tier: "mobile-url", profileId: "chrome-android" },
      );
    } else {
      const slug = identity.slug || "site";
      attempts.push(
        { url: `https://www.bestbuy.com/site/${slug}/${identity.sku}.p`, tier: "alternate-url", profileId: "chrome-win" },
        { url: `https://www.bestbuy.com/site/reviews/${slug}/${identity.sku}`, tier: "alternate-url", profileId: "chrome-mac" },
        { url: `https://www.bestbuy.com/ugc/v2/reviews?sku=${identity.sku}&page=1&pageSize=20&sort=MOST_RECENT`, tier: "reviews-endpoint", profileId: "chrome-win" },
        { url: `https://www.bestbuy.com/site/${slug}/${identity.sku}.p`, tier: "mobile-url", profileId: "chrome-android" },
      );
    }
    // Best Buy SKUs are not shared between .com and .ca, so there is no sibling-domain tier.
    return dedupeAttempts(attempts);
  },
};

const targetCollector: StoreCollector = {
  id: "target",
  matches: (url) => Boolean(targetTcin(url)),
  productId: targetTcin,
  titleMarkers: /data-test=["']@web\/ProductTitle["']|data-testid=["']product-title["']/i,
  reviewMarkers: /"reviewBody"|"reviewText"|data-test=["'][^"']*review/i,
  plan(url, full) {
    const tcin = targetTcin(url);
    if (!tcin) return [];
    const product = `https://www.target.com/p/-/A-${tcin}`;
    const attempts: StoreAttempt[] = [
      { url, tier: "primary-profile", profileId: "chrome-win" },
      { url, tier: "alternate-profile", profileId: "chrome-mac" },
    ];
    if (!full) return dedupeAttempts(attempts);
    attempts.push(
      { url: product, tier: "alternate-url", profileId: "chrome-win" },
      { url: product, tier: "mobile-url", profileId: "chrome-android" },
      {
        url: `https://r2d2.target.com/ggc/v2/summary?key=${TARGET_PUBLIC_STOREFRONT_KEY}&hasOnlyPhotos=false&includes=reviews&page=0&reviewedId=${tcin}&reviewType=PRODUCT&size=20&sortBy=most_recent&verifiedOnly=false`,
        tier: "reviews-endpoint",
        profileId: "chrome-mac",
      },
    );
    return dedupeAttempts(attempts);
  },
};

const homeDepotCollector: StoreCollector = {
  id: "homedepot",
  matches: (url) => Boolean(homeDepotIdentity(url)),
  productId: (url) => homeDepotIdentity(url)?.id || null,
  titleMarkers: /data-component=["'][^"']*product-title|product-details__title|class=["'][^"']*product-title/i,
  reviewMarkers: /"reviewBody"|"ReviewText"|itemprop=["']reviewBody["']/i,
  plan(url, full) {
    const identity = homeDepotIdentity(url);
    if (!identity) return [];
    const product = identity.slug
      ? `${identity.origin}/p/${identity.slug}/${identity.id}`
      : `${identity.origin}/p/${identity.id}`;
    const reviews = identity.slug
      ? `${identity.origin}/p/reviews/${identity.slug}/${identity.id}`
      : `${identity.origin}/p/reviews/${identity.id}`;
    const attempts: StoreAttempt[] = [
      { url, tier: "primary-profile", profileId: "chrome-win" },
      { url, tier: "alternate-profile", profileId: "chrome-mac" },
    ];
    if (!full) return dedupeAttempts(attempts);
    attempts.push(
      { url: product, tier: "alternate-url", profileId: "chrome-win" },
      { url: reviews, tier: "reviews-endpoint", profileId: "chrome-mac" },
      { url: product, tier: "mobile-url", profileId: "chrome-android" },
    );
    return dedupeAttempts(attempts);
  },
  extraFromHtml(html, pageUrl) {
    const identity = homeDepotIdentity(pageUrl);
    const key = html.match(/["']?passkey["']?\s*[:=]\s*["']([A-Za-z0-9]{8,})["']/i)?.[1];
    if (!identity || !key) return [];
    return [{
      url: `https://api.bazaarvoice.com/data/reviews.json?apiversion=5.5&passkey=${encodeURIComponent(key)}&Filter=ProductId:${encodeURIComponent(identity.id)}&Sort=SubmissionTime:desc&Limit=20`,
      tier: "reviews-endpoint",
      profileId: "chrome-win",
    }];
  },
};

export const STORE_COLLECTORS: StoreCollector[] = [
  amazonCollector,
  walmartCollector,
  bestBuyCollector,
  targetCollector,
  homeDepotCollector,
];

export function collectorForUrl(value: string): StoreCollector | null {
  try { new URL(value); } catch { return null; }
  return STORE_COLLECTORS.find((collector) => collector.matches(value)) || null;
}

export function buildAttemptPlan(url: string, full = true): StoreAttempt[] {
  return collectorForUrl(url)?.plan(url, full) || [];
}

const TEXT_KEYS = ["reviewtext", "reviewbody", "reviewdescription", "comment", "text", "body"];
const EXPLICIT_TEXT_KEYS = ["reviewtext", "reviewbody", "reviewdescription", "comment"];
const RATING_KEYS = ["rating", "ratingvalue", "overallrating", "starrating"];
const TITLE_KEYS = ["title", "reviewtitle", "headline"];
const DATE_KEYS = ["date", "submissiontime", "submitted_at", "submittedat", "reviewdate", "lastmodificationtime"];

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const [key, value] of Object.entries(record)) {
    if (keys.includes(key.toLowerCase().replace(/_/g, ""))) return value;
    if (keys.includes(key.toLowerCase())) return value;
  }
  return undefined;
}

/**
 * Rename public review JSON into the reviewBody shape the existing collector
 * already accepts. Review text is copied, never written.
 */
export function normalizeReviewPayload(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return raw;
  let parsed: unknown;
  try { parsed = JSON.parse(trimmed); } catch { return raw; }
  const found: Array<Record<string, unknown>> = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 8 || node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const text = pick(record, TEXT_KEYS);
    const explicit = pick(record, EXPLICIT_TEXT_KEYS);
    const rating = pick(record, RATING_KEYS);
    const date = pick(record, DATE_KEYS);
    const reviewId = pick(record, ["reviewid", "submissionid"]);
    const body = typeof text === "string" ? text.trim() : "";
    const genericText = !explicit && body.length > 0;
    const reviewLike = body.length >= 12 && (!genericText || date != null || reviewId != null || rating != null);
    if (reviewLike && (explicit || date != null || reviewId != null)) {
      const title = pick(record, TITLE_KEYS);
      const verified = pick(record, ["verified", "isverified", "isverifiedpurchaser", "verifiedpurchase"]);
      found.push({
        reviewBody: body,
        ...(typeof title === "string" ? { title } : {}),
        ...(rating != null && Number.isFinite(Number(rating)) ? { rating: Number(rating) } : {}),
        ...(typeof date === "string" ? { date } : {}),
        ...(reviewId != null ? { reviewId: String(reviewId) } : {}),
        ...(typeof verified === "boolean" ? { verified } : {}),
      });
    }
    for (const value of Object.values(record)) visit(value, depth + 1);
  };
  visit(parsed, 0);
  if (!found.length) return raw;
  return JSON.stringify({ reviews: found });
}
