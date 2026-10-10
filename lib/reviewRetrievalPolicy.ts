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

/** Follow only public links actually advertised by the verified product page. */
export function discoverPublicReviewFollowups(html: string, currentUrl: string, limit = 12): string[] {
  const current = new URL(currentUrl);
  const currentPath = current.pathname.replace(/\/$/, "");
  const asin = currentPath.match(/\/(?:dp|product-reviews)\/([A-Z0-9]{10})/i)?.[1];
  const productPath = currentPath.replace(/\/(?:reviews?|ratings)(?:\/.*)?$/i, "");
  const urls = new Set<string>();
  for (const match of html.matchAll(/<a\b([^>]*href=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (!/\bnext\b|review|rating|page|pagination/i.test(`${match[1]} ${match[3]}`)) continue;
    try {
      const url = new URL(match[2].replace(/&amp;/g, "&"), current);
      if (url.origin !== current.origin || url.username || url.password) continue;
      const path = url.pathname.replace(/\/$/, "");
      const sameProduct = asin
        ? new RegExp(`/(?:dp|product-reviews)/${asin}(?:/|$)`, "i").test(path)
        : path === currentPath || path === productPath || path === `${productPath}/reviews` || path.startsWith(`${productPath}/reviews/`) || path === `${productPath}/ratings` || path.startsWith(`${productPath}/ratings/`);
      if (!sameProduct || /signin|login|captcha|cart|checkout/i.test(path)) continue;
      if (!/review|rating/i.test(path) && !["page", "pageNumber", "cursor", "offset"].some(key => url.searchParams.has(key))) continue;
      url.hash = "";
      if (url.toString() !== current.toString()) urls.add(url.toString());
      if (urls.size >= limit) break;
    } catch { /* Malformed links do not justify a request. */ }
  }
  return [...urls];
}

/** Same endpoint, same non-pagination filters: one pagination stream. */
export function reviewPaginationKey(value: string): string {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/$/, "");
  for (const key of ["page", "pageNumber", "cursor", "offset"]) url.searchParams.delete(key);
  url.searchParams.sort();
  url.hash = "";
  return url.toString();
}


/**
 * Generic retailer adapters: public review pages derived from a verified
 * product URL's own stable id. No credentials, no private endpoints; fetched
 * pages still pass exact-product verification and sign-in stops the source.
 */
export function buildRetailerReviewPageUrls(productUrl: string): string[] {
  let url: URL;
  try { url = new URL(productUrl); } catch { return []; }
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.replace(/\/$/, "");
  const out: string[] = [];
  const walmart = /^walmart\.(?:com|ca)$/.test(host) && path.match(/\/ip\/(?:[^/]+\/)?([A-Z0-9]{6,14})$/i);
  if (walmart) out.push(`${url.origin}/reviews/product/${walmart[1]}`, `${url.origin}/reviews/product/${walmart[1]}?page=2`);
  const bestbuyUs = host === "bestbuy.com" && path.match(/^\/site\/([^/]+)\/(\d{5,9})\.p$/i);
  if (bestbuyUs) out.push(`${url.origin}/site/reviews/${bestbuyUs[1]}/${bestbuyUs[2]}`, `${url.origin}/site/reviews/${bestbuyUs[1]}/${bestbuyUs[2]}?page=2`);
  const bestbuyCa = host === "bestbuy.ca" && path.match(/^\/(en-ca|fr-ca)\/(?:product|produit)\/([^/]+)\/(\d{5,9})$/i);
  if (bestbuyCa) {
    out.push(`${url.origin}${path}/review`);
    // Public review JSON the product page itself loads (allowed by bestbuy.ca robots.txt).
    const lang = bestbuyCa[1].toLowerCase() === "fr-ca" ? "fr-CA" : "en-CA";
    for (const page of [1, 2, 3]) out.push(`${url.origin}/api/reviews/v2/products/${bestbuyCa[3]}/reviews?source=all&lang=${lang}&pageSize=25&page=${page}&sortBy=relevancy`);
  }
  return out;
}

/** Stable retailer product id (Walmart item id, Best Buy SKU) shared by a product page and its review URLs. */
export function retailerStableProductId(productUrl: string): string | null {
  let url: URL;
  try { url = new URL(productUrl); } catch { return null; }
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.replace(/\/$/, "");
  const walmart = /^walmart\.(?:com|ca)$/.test(host) && (path.match(/\/ip\/(?:[^/]+\/)?([A-Z0-9]{6,14})$/i) || path.match(/\/reviews\/product\/([A-Z0-9]{6,14})$/i));
  if (walmart) return `${host}:${walmart[1].toUpperCase()}`;
  const bbUs = host === "bestbuy.com" && (path.match(/^\/site\/(?:reviews\/)?[^/]+\/(\d{5,9})(?:\.p)?$/i));
  if (bbUs) return `${host}:${bbUs[1]}`;
  const bbCa = host === "bestbuy.ca" && (path.match(/\/(?:product|produit)\/[^/]+\/(\d{5,9})(?:\/review)?$/i) || path.match(/^\/api\/reviews\/v2\/products\/(\d{5,9})\/reviews$/i));
  if (bbCa) return `${host}:${bbCa[1]}`;
  return null;
}

/** Sibling marketplace locales sharing a stable listing id; identity must still verify by title. */
export function buildLocaleListingVariants(listingUrl: string): string[] {
  let url: URL;
  try { url = new URL(listingUrl); } catch { return []; }
  const id = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1];
  const host = url.hostname.replace(/^www\./, "");
  if (!id || !/^amazon\.(?:ca|com)$/.test(host)) return [];
  return [`https://www.${host === "amazon.ca" ? "amazon.com" : "amazon.ca"}/dp/${id}`];
}
