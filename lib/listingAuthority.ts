/**
 * The shopper's product link is the listing. Rating/count differences versus a
 * screenshot are a note. Search queries that are only a store name or a star
 * line are drift and must not be sent to a marketplace search.
 */

const MARKETPLACE_TOKEN = /^(?:amazon(?:\.(?:ca|com|co\.uk))?|walmart(?:\.(?:ca|com))?|bestbuy(?:\.(?:ca|com))?|ebay|target|costco(?:\.(?:ca|com))?)$/i;
const RATING_TOKEN = /^(?:stars?|ratings?|reviews?|out|of|global|customer|customers|complaints?|problems?|pros?|cons?|worth|it|official|verified|purchase|hands|on|reddit|or)$/i;

const UNUSABLE_TITLE = /robot check|captcha|not a robot|enter the characters|api-services-support|click the button below|access denied|page not found|sorry[,. ]+we just need to make sure/i;

export function canonicalAmazonListingUrl(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!url.hostname.toLowerCase().includes("amazon.")) return null;
    const asin = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|product-reviews)\/([A-Z0-9]{10})(?:[/?#]|$)/i)?.[1];
    return asin ? `${url.origin}/dp/${asin.toUpperCase()}` : null;
  } catch {
    return null;
  }
}

export function amazonAsinFromListingUrl(value: unknown): string | null {
  return canonicalAmazonListingUrl(value)?.match(/\/dp\/([A-Z0-9]{10})$/i)?.[1]?.toUpperCase() || null;
}

/** www.amazon.com / www.amazon.ca / www.amazon.co.uk, or null when the value is not an Amazon host. */
export function amazonHostFromUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "amazon.com" || host.endsWith(".amazon.com")) return "www.amazon.com";
    if (host === "amazon.ca" || host.endsWith(".amazon.ca")) return "www.amazon.ca";
    if (host === "amazon.co.uk" || host.endsWith(".amazon.co.uk")) return "www.amazon.co.uk";
    return null;
  } catch {
    return null;
  }
}

export function amazonStoreLabel(value: unknown): string {
  const host = amazonHostFromUrl(value);
  if (host === "www.amazon.com") return "Amazon.com";
  if (host === "www.amazon.ca") return "Amazon.ca";
  if (host === "www.amazon.co.uk") return "Amazon.co.uk";
  return "";
}

/**
 * Amazon host to fetch first. The shopper's link wins over the screenshot store
 * and over any later sibling marketplace.
 */
export function preferredAmazonHost(input: { store?: string | null; listingUrl?: string | null; query?: string | null }): string | null {
  const fromLink = amazonHostFromUrl(input.listingUrl);
  if (fromLink) return fromLink;
  const site = String(input.query || "").match(/site:(?:www\.)?(amazon\.(?:ca|com|co\.uk))/i);
  if (site) return `www.${site[1].toLowerCase()}`;
  const store = String(input.store || "").toLowerCase();
  if (store.includes("amazon.com")) return "www.amazon.com";
  if (store.includes("amazon.co.uk")) return "www.amazon.co.uk";
  if (store.includes("amazon.ca") || store.trim() === "amazon") return "www.amazon.ca";
  return null;
}

export function isUnusableListingTitle(value: unknown): boolean {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return true;
  if (/^https?:\/\//i.test(text)) return true;
  if (UNUSABLE_TITLE.test(text)) return true;
  if (/^(?:amazon(?:\.[a-z.]+)?)(?:\s+product\s+[A-Z0-9]{10})?$/i.test(text)) return true;
  return false;
}

/** A query with no product words (bare "Amazon.ca", "4.7 stars … Amazon.ca"). */
export function isDriftSearchQuery(value: unknown): boolean {
  const raw = String(value || "").replace(/[()"]/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) return true;
  const tokens = raw.split(/\s+/).filter((token) => !/^site:/i.test(token));
  const meaningful = tokens.filter((token) => {
    const key = token.toLowerCase().replace(/[^a-z0-9.]/g, "");
    if (!key || !/[a-z0-9]/i.test(key)) return false;
    if (MARKETPLACE_TOKEN.test(key)) return false;
    if (RATING_TOKEN.test(key)) return false;
    if (/^(?:unknown|product|products|item|items)$/i.test(key)) return false;
    if (/^\d+(?:\.\d+)?$/.test(key)) return false;
    return key.length > 1;
  });
  return meaningful.length === 0;
}

export function withoutDriftQueries(queries: string[]): string[] {
  return queries.filter((query) => !isDriftSearchQuery(query));
}

/** http(s) product page. Homepage and search URLs are not enough to analyze. */
export function isAnalyzableProductUrl(value: unknown): boolean {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!host.includes(".")) return false;
    const path = url.pathname || "/";
    if (/\/(?:s|search|search-results?|ap\/signin|ax\/claim)(?:\/|$)/i.test(path)) return false;
    if (host.includes("amazon.")) return /\/(?:dp|gp\/product|gp\/aw\/d|product-reviews)\/[A-Z0-9]{10}/i.test(path);
    return path.length > 1;
  } catch {
    return false;
  }
}

/**
 * When the shopper's link and the verified candidate share an ASIN, collect
 * reviews from the link's own Amazon domain.
 */
export function collectorListingForAuthoritativeAsin(input: {
  listingUrl?: string | null;
  verifiedListingUrl?: string | null;
  canonicalIdentifier?: string | null;
  canCollectReviews?: boolean;
}): string | null {
  const supplied = canonicalAmazonListingUrl(input.listingUrl);
  const suppliedAsin = amazonAsinFromListingUrl(supplied);
  if (
    supplied &&
    suppliedAsin &&
    input.canCollectReviews &&
    String(input.canonicalIdentifier || "").toUpperCase() === suppliedAsin
  ) {
    return supplied;
  }
  const verified = String(input.verifiedListingUrl || "").trim();
  return verified || null;
}
