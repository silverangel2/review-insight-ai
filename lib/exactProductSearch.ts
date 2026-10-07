import { retrieveProductUrls, isProductUrl, normalizeProductUrl } from "./productUrlRetrieval";
import {
  prepareCandidateForVerification,
  type ProductSearchJob,
} from "./productSearchVerifier";
import { stableProductSearchTerms } from "@/lib/productIdentityTokens";
import type { ScanCostTelemetry } from "@/lib/scanCostTelemetry";
type ExactProductSearchInput = {
  productName: string;
  brand?: string;
  model?: string;
  store?: string;
  listingUrl?: string | null;
  price?: number;
  rating?: number | null;
  reviewCount?: number | null;
  searchQueries?: string[];
  maxCandidates?: number;
  timeoutMs?: number;
  appendProductQuery?: boolean;
  searchRoundLabel?: string;
  enrichmentAttemptedUrls?: Set<string>;
  costTelemetry?: ScanCostTelemetry;
};

export type IdentityRecoveryInput = Pick<ExactProductSearchInput, "productName" | "brand" | "model" | "store" | "listingUrl" | "price" | "rating" | "reviewCount">;

export type ExactProductCandidate = {
  url: string | null;
  title: string | null;
  store: string | null;
  domain: string | null;
  price: number | null;
  rating: number | null;
  reviewCount: number | null;
  source: string | null;
  notes: string[];
  identityFetched?: boolean;
  enrichmentAttempted?: boolean;
  enrichmentSucceeded?: boolean;
  brand?: string | null;
  model?: string | null;
};

export type ExactProductCandidateSearchResult = {
  candidates: ExactProductCandidate[];
  queries: string[];
  sourcesChecked: string[];
  sourceLinks: Array<{ label: string; url: string; domain?: string }>;
  notes: string[];
  elapsedMs: number;
  timedOut: boolean;
  attemptCount: number;
};

export function buildIdentityRecoveryPrompt(input: IdentityRecoveryInput): string {
  const clues = {
    marketplace: input.store || null,
    brand: input.brand || null,
    model: input.model || null,
    title: input.productName || null,
    listingUrl: input.listingUrl || null,
    price: input.price ?? null,
    rating: input.rating ?? null,
    marketplaceReviewCount: input.reviewCount ?? null,
  };

  return `You are a product identity discovery assistant for ReviewIntel.
Find candidate public product listing URLs or marketplace identifiers using only these supplied clues:
${JSON.stringify(clues)}

This is discovery only. Do not claim that any candidate is exact or verified. Do not invent missing fields, reviews, evidence, or product facts. Return only JSON in this shape:
{"candidates":[{"url":null,"asin":null,"title":null,"store":null,"domain":null,"price":null,"rating":null,"reviewCount":null}]}

Prefer the supplied marketplace and exact title/brand/model clues. For Amazon, include an ASIN when it is visibly available. If no candidate is found, return {"candidates":[]}.`;
}

function marketplaceHostForStore(store: unknown): string | null {
  const value = String(store || "").toLowerCase();
  if (value.includes("amazon.ca")) return "www.amazon.ca";
  if (value.includes("amazon.com")) return "www.amazon.com";
  return null;
}

export function parseIdentityRecoveryCandidates(
  outputText: string,
  store?: string | null,
  maxCandidates = 5
): ExactProductCandidate[] {
  const rawText = String(outputText || "");
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  if (!cleaned) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const fencedJson = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    const embeddedJson = fencedJson || (() => {
      const start = rawText.indexOf("{");
      const end = rawText.lastIndexOf("}");
      return start >= 0 && end > start ? rawText.slice(start, end + 1).trim() : "";
    })();
    if (embeddedJson) {
      try {
        parsed = JSON.parse(embeddedJson);
      } catch {
        parsed = null;
      }
    }
  }

  const root = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  const values = Array.isArray(root.candidates)
    ? root.candidates
    : [root];
  const amazonHost = marketplaceHostForStore(store);
  const output: ExactProductCandidate[] = [];
  const seen = new Set<string>();

  const appendCandidate = (candidate: ExactProductCandidate) => {
    const candidateUrl = candidate.url || "";
    const key = candidateUrl.toLowerCase().replace(/[?#].*$/, "");
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(candidate);
  };

  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    const asin = String(record.asin || record.productId || record.listingId || "").trim().match(/^[A-Z0-9]{10}$/i)?.[0] || null;
    const rawUrl = String(record.url || record.exactListingUrl || record.listingUrl || "").trim();
    const url = rawUrl || (asin && amazonHost ? `https://${amazonHost}/dp/${asin.toUpperCase()}` : "");
    if (!/^https?:\/\//i.test(url)) continue;
    const candidate = identityCandidateFromUrl(url, store, "openai-identity-discovery");
    if (!candidate) continue;
    appendCandidate({
      ...candidate,
      title: String(record.title || record.productName || "").trim() || null,
      price: typeof record.price === "number" ? record.price : null,
      rating: typeof record.rating === "number" ? record.rating : null,
      reviewCount: typeof record.reviewCount === "number" ? record.reviewCount : null,
      notes: [
        ...candidate.notes,
        "Candidate discovered by bounded OpenAI identity search; exact identity still requires verifier acceptance.",
      ],
    });
    if (output.length >= Math.max(1, Math.min(maxCandidates, 5))) break;
  }

  if (output.length < Math.max(1, Math.min(maxCandidates, 5))) {
    const discoveredUrls = rawText.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    for (const candidate of parseIdentityCandidatesFromUrls(
      discoveredUrls,
      store,
      maxCandidates,
      "openai-identity-discovery"
    )) {
      appendCandidate(candidate);
      if (output.length >= Math.max(1, Math.min(maxCandidates, 5))) break;
    }
  }

  if (output.length < Math.max(1, Math.min(maxCandidates, 5))) {
    const amazonHost = marketplaceHostForStore(store);
    const asinClues = rawText.match(/\b(?:asin|productId|listingId)\s*[:=]?\s*["']?([A-Z0-9]{10})\b/gi) || [];
    for (const clue of asinClues) {
      const asin = clue.match(/([A-Z0-9]{10})/i)?.[1];
      if (!asin || !amazonHost) continue;
      const candidate = identityCandidateFromUrl(
        `https://${amazonHost}/dp/${asin.toUpperCase()}`,
        store,
        "openai-identity-discovery"
      );
      if (!candidate) continue;
      appendCandidate({
        ...candidate,
        notes: [
          ...candidate.notes,
          "ASIN clue recovered from bounded OpenAI identity search output; exact identity still requires verifier acceptance.",
        ],
      });
      if (output.length >= Math.max(1, Math.min(maxCandidates, 5))) break;
    }
  }

  return output;
}

export type ExactProductSearchResult = {
  exactListingUrl: string | null;
  exactListingTitle: string | null;
  store: string | null;
  price: number | null;
  rating: number | null;
  reviewCount: number | null;
  asin?: string | null;
  canonicalMarketplace?: string | null;
  normalizedBrand?: string | null;
  normalizedProduct?: string | null;
  capacity?: string | null;
  color?: string | null;
  confidence: "none" | "low" | "medium" | "high";
  sourcesChecked: string[];
  sourceLinks?: Array<{ label: string; url: string; domain?: string }>;
  notes: string[];
};

function emptyExactResult(reason: string): ExactProductSearchResult {
  return {
    exactListingUrl: null,
    exactListingTitle: null,
    store: null,
    price: null,
    rating: null,
    reviewCount: null,
    confidence: "none",
    sourcesChecked: [],
    sourceLinks: [],
    notes: [reason],
  };
}

function acceptedExactDomainForStore(store: unknown): string | null {
  const value = String(store || "").toLowerCase();

  if (value.includes("walmart.ca") || value.includes("walmart canada")) return "walmart.ca";
  if (value.includes("walmart.com") || value === "walmart") return "walmart.com";
  if (value.includes("amazon.ca")) return "amazon.ca";
  if (value.includes("amazon.com")) return "amazon.com";
  if (value.includes("bestbuy.ca") || value.includes("best buy canada")) return "bestbuy.ca";
  if (value.includes("bestbuy.com")) return "bestbuy.com";
  if (value.includes("costco.ca") || value.includes("costco canada")) return "costco.ca";
  if (value.includes("costco.com")) return "costco.com";
  if (value.includes("sephora.ca") || value.includes("sephora canada")) return "sephora.ca";
  if (value.includes("sephora.com")) return "sephora.com";
  if (value.includes("temu.com") || value === "temu") return "temu.com";
  if (value.includes("target.com") || value === "target") return "target.com";
  if (value.includes("homedepot.ca") || value.includes("home depot canada")) return "homedepot.ca";
  if (value.includes("homedepot.com")) return "homedepot.com";

  return null;
}

function urlHostMatchesAcceptedDomain(url: string | null, acceptedDomain: string | null): boolean {
  if (!acceptedDomain) return true;
  if (!url) return false;

  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host === acceptedDomain || host.endsWith(`.${acceptedDomain}`);
  } catch {
    return false;
  }
}

function hostForUrl(url: string | null | undefined) {
  try {
    return new URL(String(url || "")).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function canonicalAmazonListingUrl(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (!/amazon\./i.test(url.hostname)) return null;
    const asin = url.pathname.match(/\/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})(?:[/?#]|$)/i)?.[1];
    return asin ? `${url.origin}/dp/${asin.toUpperCase()}` : null;
  } catch {
    return null;
  }
}

export function buildDirectReviewCandidateUrls(listingUrl: string | null | undefined): string[] {
  const canonical = canonicalAmazonListingUrl(listingUrl);
  if (!canonical) return [];

  const url = new URL(canonical);
  const asin = url.pathname.match(/\/dp\/([A-Z0-9]{10})/i)?.[1];
  if (!asin) return [];

  return [
    `${url.origin}/product-reviews/${asin}/?reviewerType=all_reviews`,
    `${url.origin}/product-reviews/${asin}/?sortBy=recent&reviewerType=all_reviews`,
    `${url.origin}/product-reviews/${asin}/?filterByStar=critical&reviewerType=all_reviews`,
    `${url.origin}/product-reviews/${asin}/?pageNumber=2&reviewerType=all_reviews`,
    `${url.origin}/product-reviews/${asin}/?pageNumber=3&reviewerType=all_reviews`,
    canonical,
  ];
}

function cleanSearchQuery(value: unknown) {
  const parts =
    String(value || "")
      .replace(/\bAmazon\s+s\b/gi, "Amazon")
      .replace(/\bAmazon's\b/gi, "Amazon")
      .replace(/\s+/g, " ")
      .trim()
      .match(/"[^"]+"|site:\S+|\S+/g) || [];
  const hasAmazonDomain = parts.some((part) => /^"?amazon\.(?:ca|com)"?$/i.test(part) || /^site:amazon\.(?:ca|com)$/i.test(part));
  const hasWalmartDomain = parts.some((part) => /^"?walmart\.(?:ca|com)"?$/i.test(part) || /^site:walmart\.(?:ca|com)$/i.test(part));
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const part of parts) {
    const key = part.replace(/^"|"$/g, "").toLowerCase();
    if (!key) continue;
    if (["color", "variant", "requested", "candidate", "appears", "product", "page"].includes(key)) continue;
    if (hasAmazonDomain && key === "amazon") continue;
    if (hasWalmartDomain && key === "walmart") continue;
    if (cleaned.length && cleaned[cleaned.length - 1].replace(/^"|"$/g, "").toLowerCase() === key) continue;
    if (!key.startsWith("site:") && seen.has(key)) continue;
    seen.add(key);
    cleaned.push(part);
  }

  return cleaned.join(" ").replace(/\s+/g, " ").trim();
}

function emptyCandidateSearchResult(
  reason: string,
  startedAt: number,
  queries: string[] = [],
  timedOut = false
): ExactProductCandidateSearchResult {
  return {
    candidates: [],
    queries,
    sourcesChecked: [],
    sourceLinks: [],
    notes: [reason],
    elapsedMs: Date.now() - startedAt,
    timedOut,
    attemptCount: 1,
  };
}

function searchJobFor(input: ExactProductSearchInput, product: string): ProductSearchJob {
  return {
    scanId: input.productName,
    costTelemetry: input.costTelemetry,
    store: input.store,
    brand: input.brand,
    productName: input.productName,
    model: input.model,
    productKey: product,
    price: input.price,
    rating: input.rating,
    reviewCount: input.reviewCount,
  };
}


function amazonSearchUrlForQuery(query: string) {
  return `https://www.amazon.ca/s?k=${encodeURIComponent(
    cleanExactSearchQuery(query)
      .replace(/\bAmazon\.ca\b/gi, "")
      .replace(/\bAmazon\b/gi, "")
      .trim()
  )}`;
}

function amazonTitleFromHtmlAround(html: string, hrefIndex: number) {
  const start = Math.max(0, hrefIndex - 1800);
  const end = Math.min(html.length, hrefIndex + 2400);
  const chunk = html.slice(start, end);

  const aria = chunk.match(/aria-label="([^"]{12,260})"/i)?.[1];
  if (aria && !/stars|ratings?|sponsored|add to cart/i.test(aria)) {
    return aria.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  }

  const span = chunk.match(/<span[^>]*class="[^"]*a-text-normal[^"]*"[^>]*>([\s\S]{12,400}?)<\/span>/i)?.[1];
  if (span) {
    return span
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  }

  return null;
}

async function fetchAmazonSearchCandidates(query: string, maxCandidates = 4, timeoutMs = 3500, costTelemetry?: ScanCostTelemetry) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const searchUrl = amazonSearchUrlForQuery(query);
    if (costTelemetry && !costTelemetry.canStartIdentitySearchRequest()) return [];
    costTelemetry?.recordIdentitySearchRequest("search");
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-CA,en;q=0.9",
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const candidates: Array<{
      url: string;
      title: string;
      domain: string;
      store: string;
      price: null;
      rating: null;
      reviewCount: null;
      source: string;
      notes: string[];
    }> = [];

    const seen = new Set<string>();
    const hrefPattern = /href\s*=\s*(["'])([^"']*\/(?:dp|gp\/product|gp\/aw\/d|product-reviews)\/([A-Z0-9]{10})[^"']*)\1/gi;
    let match: RegExpExecArray | null;

    while ((match = hrefPattern.exec(html)) && candidates.length < maxCandidates) {
      const asin = match[3];
      if (!asin || seen.has(asin)) continue;
      seen.add(asin);

      const title = amazonTitleFromHtmlAround(html, match.index) || `Amazon product ${asin}`;

      candidates.push({
        url: `https://www.amazon.ca/dp/${asin}`,
        title,
        domain: "amazon.ca",
        store: "Amazon.ca",
        price: null,
        rating: null,
        reviewCount: null,
        source: "amazon-search-fallback",
        notes: [`Parsed from Amazon.ca search page for query: ${cleanExactSearchQuery(query)}`],
      });
    }

    return candidates;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}


function isLikelyProductUrl(url: string) {
  return isProductUrl(url);
}

export function normalizeProductCandidateUrl(url: string) {
  const decoded = normalizeProductUrl(url);

  try {
    const parsed = new URL(decoded);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const amazon = host.match(/^amazon\.([a-z.]+)$/i);
    const asin = parsed.pathname.match(
      /\/(?:[^/]+\/)?(?:dp|gp\/product|gp\/aw\/d|product-reviews)\/([A-Z0-9]{10})(?:[/?#]|$)/i
    )?.[1];

    if (amazon && asin) {
      return `https://www.amazon.${amazon[1].toLowerCase()}/dp/${asin.toUpperCase()}`;
    }

    parsed.hash = "";
    return parsed.toString().replace(/[?&]$/, "");
  } catch {
    return decoded.split("#")[0];
  }
}

function identityCandidateFromUrl(
  rawUrl: string,
  store?: string | null,
  source = "identity-url-discovery"
): ExactProductCandidate | null {
  const url = normalizeProductCandidateUrl(rawUrl);
  if (!isProductUrl(url)) return null;

  const domain = hostForUrl(url);
  if (["google.com", "bing.com", "duckduckgo.com", "search.yahoo.com"].some(
    (blocked) => domain === blocked || Boolean(domain && domain.endsWith(`.${blocked}`))
  )) return null;

  const amazonAsin = url.match(/^https?:\/\/www\.amazon\.[^/]+\/dp\/([A-Z0-9]{10})$/i)?.[1] || null;
  return {
    url,
    title: null,
    store: domain || String(store || "").trim() || null,
    domain,
    price: null,
    rating: null,
    reviewCount: null,
    source,
    notes: [
      "Identity-bearing URL discovered; exact identity still requires fetched verification.",
      ...(amazonAsin ? [`Recovered Amazon ASIN ${amazonAsin} from an identity-bearing URL.`] : []),
    ],
  };
}

export function parseIdentityCandidatesFromUrls(
  urls: string[],
  store?: string | null,
  maxCandidates = 5,
  source = "identity-url-discovery"
): ExactProductCandidate[] {
  const output: ExactProductCandidate[] = [];
  const seen = new Set<string>();

  for (const rawUrl of urls) {
    const candidate = identityCandidateFromUrl(rawUrl, store, source);
    if (!candidate) continue;
    const key = candidate.url?.toLowerCase() || "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
    if (output.length >= Math.max(1, Math.min(maxCandidates, 8))) break;
  }

  return output;
}

function titleNearUrl(html: string, index: number) {
  const chunk = html.slice(Math.max(0, index - 900), Math.min(html.length, index + 1200));
  const h2 = chunk.match(/<h2[^>]*>([\s\S]{8,500}?)<\/h2>/i)?.[1];
  const title = h2
    ? h2.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
    : null;
  return title || null;
}


export function isVerifiableManufacturerProductUrl(value: string): boolean {
  return isProductUrl(value);
}

async function fetchFastProductUrlCandidates(queries: string[], maxCandidates = 5, timeoutMs = 4500, costTelemetry?: ScanCostTelemetry) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const cleanQueries = Array.from(new Set(
      queries
        .map((query) => cleanExactSearchQuery(query))
        .filter(Boolean)
        .slice(0, 4)
    ));

    const searches = cleanQueries.map(async (query) => {
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
      try {
        if (costTelemetry && !costTelemetry.reserveIdentitySearchUrl(searchUrl)) return [];
        costTelemetry?.recordIdentitySearchRequest("search");
        const response = await fetch(searchUrl, {
          signal: controller.signal,
          headers: {
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en-CA,en;q=0.9",
          },
        });

        if (!response.ok) return [];

        const html = await response.text();
        const out: Array<{
          url: string;
          title: string;
          domain: string | null;
          store: string | null;
          price: null;
          rating: null;
          reviewCount: null;
          source: string;
          notes: string[];
        }> = [];

        const hrefPattern = /href\s*=\s*(["'])(.*?)\1/gi;
        let match: RegExpExecArray | null;

        while ((match = hrefPattern.exec(html)) && out.length < maxCandidates) {
          const rawUrl = match[2];
          const url = normalizeProductCandidateUrl(rawUrl);

          if (
            !isLikelyProductUrl(url) &&
            !isVerifiableManufacturerProductUrl(url)
          ) {
            continue;
          }

          const domain = hostForUrl(url);
          out.push({
            url,
            title: titleNearUrl(html, match.index) || url,
            domain,
            store: domain,
            price: null,
            rating: null,
            reviewCount: null,
            source: "fast-search-fallback",
            notes: [`Parsed from fast search query: ${query}`],
          });
        }

        return out;
      } catch {
        return [];
      }
    });

    const settled = await Promise.allSettled(searches);
    const candidates = settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );

    const seen = new Set<string>();
    return candidates.filter((candidate) => {
      const key = candidate.url.toLowerCase().replace(/[?#].*$/, "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, maxCandidates);
  } finally {
    clearTimeout(timer);
  }
}

export async function findExactProductCandidates(
  input: ExactProductSearchInput
): Promise<ExactProductCandidateSearchResult> {
  const startedAt = Date.now();

  const directListing = canonicalAmazonListingUrl(input.listingUrl);
  if (directListing) {
    const domain = hostForUrl(directListing);
    const candidate = await prepareCandidateForVerification(searchJobFor(input, input.productName), {
        url: directListing,
        title: directListing,
        store: domain,
        domain,
        price: null,
        rating: null,
        reviewCount: null,
        source: "supplied-listing-identity",
        notes: ["Canonical product URL recovered from supplied marketplace listing identity."],
      }, input.enrichmentAttemptedUrls);
    return {
      candidates: [{ ...candidate, url: candidate.url || null, title: candidate.title || null, store: candidate.store || null, domain: candidate.domain || null, price: typeof candidate.price === "number" ? candidate.price : null, rating: typeof candidate.rating === "number" ? candidate.rating : null, reviewCount: typeof candidate.reviewCount === "number" ? candidate.reviewCount : null, source: candidate.source || null, notes: candidate.notes || [] }],
      queries: ["supplied listing identity"],
      sourcesChecked: [directListing],
      sourceLinks: [{ label: input.productName || directListing, url: directListing, ...(domain ? { domain } : {}) }],
      notes: ["Used supplied listing identity before broader product search."],
      elapsedMs: Date.now() - startedAt,
      timedOut: false,
      attemptCount: 0,
    };
  }

  const stableTerms = stableProductSearchTerms(input);
  const product = [
    input.store,
    ...stableTerms.brands,
    ...stableTerms.models,
    stableTerms.family,
    ...stableTerms.roles.capacityOrSize,
  ].filter(Boolean).join(" ");

  if (!product || product.length < 3) {
    return emptyCandidateSearchResult("Product identity was not clear enough for exact listing search.", startedAt);
  }

  const maxCandidates = Math.max(1, Math.min(input.maxCandidates || 5, 5));
  const providedSearchQueries = Array.isArray(input.searchQueries) ? input.searchQueries : [];
  const appendProductQuery = input.appendProductQuery !== false || providedSearchQueries.length === 0;
  const searchQueries = Array.from(
    new Set(
      [
        ...providedSearchQueries,
        ...(appendProductQuery ? [product] : []),
      ]
        .map(cleanSearchQuery)
        .filter((query) => query.length >= 3)
    )
  ).slice(0, 6);

  const retrievalFirst = await retrieveProductUrls({
    store: input.store,
    brand: input.brand,
    model: input.model,
    productName: input.productName,
    productKey: product,
    rating: input.rating,
    reviewCount: input.reviewCount,
    maxCandidates,
    timeoutMs: 8500,
    enrichmentAttemptedUrls: input.enrichmentAttemptedUrls,
    costTelemetry: input.costTelemetry,
    searchQueries,
  }).catch(() => null);

  const searchJob = searchJobFor(input, product);

  if (retrievalFirst?.candidates?.length) {
    const enrichedCandidates = await Promise.all(
      retrievalFirst.candidates.slice(0, maxCandidates).map((candidate) =>
        prepareCandidateForVerification(searchJob, {
          url: candidate.url,
          title: candidate.title || null,
          domain: candidate.domain || null,
          store: candidate.domain || null,
          rating: "rating" in candidate && typeof candidate.rating === "number" ? candidate.rating : null,
          reviewCount: "reviewCount" in candidate && typeof candidate.reviewCount === "number" ? candidate.reviewCount : null,
          source: candidate.source || null,
          notes: candidate.notes || [],
          enrichmentAttempted: candidate.enrichmentAttempted,
          enrichmentSucceeded: candidate.enrichmentSucceeded,
          identityFetched: candidate.identityFetched,
          brand: candidate.brand,
          model: candidate.model,
        }, input.enrichmentAttemptedUrls)
      )
    );

    console.log("[ReviewIntel DEBUG productUrlRetrieval]", {
      queries: retrievalFirst.queries,
      elapsedMs: retrievalFirst.elapsedMs,
      timedOut: retrievalFirst.timedOut,
      candidateCount: retrievalFirst.candidates.length,
      candidateUrls: retrievalFirst.candidates.map((candidate) => candidate.url),
      candidateSources: retrievalFirst.candidates.map((candidate) => candidate.source),
    });

    return {
      candidates: enrichedCandidates.map((candidate) => ({
        url: candidate.url,
        title: candidate.title || null,
        domain: candidate.domain || null,
        store: candidate.domain || null,
        price: null,
        rating: typeof candidate.rating === "number" ? candidate.rating : null,
        reviewCount: typeof candidate.reviewCount === "number" ? candidate.reviewCount : null,
        source: candidate.source || null,
        notes: candidate.notes || [],
        identityFetched: candidate.identityFetched,
        brand: candidate.brand,
        model: candidate.model,
        enrichmentAttempted: candidate.enrichmentAttempted,
        enrichmentSucceeded: candidate.enrichmentSucceeded,
      })),
      queries: retrievalFirst.queries,
      sourcesChecked: enrichedCandidates.map((candidate) => candidate.url || "").filter(Boolean),
      sourceLinks: enrichedCandidates.map((candidate) => ({
        label: candidate.title || candidate.url || "Product candidate",
        url: candidate.url || "",
        ...(candidate.domain ? { domain: candidate.domain } : {}),
      })),
      notes: [
        `Retrieved ${enrichedCandidates.length} real product URL candidate(s) from native product URL retrieval; metadata-poor Amazon candidates were bounded-enriched before verification.`,
      ],
      elapsedMs: retrievalFirst.elapsedMs,
      timedOut: retrievalFirst.timedOut,
      attemptCount: 1,
    };
  }



  const fastInitialCandidates = await fetchFastProductUrlCandidates(searchQueries, maxCandidates, 4500, input.costTelemetry).catch(() => []);
  if (fastInitialCandidates.length > 0) {
    const enrichedCandidates = await Promise.all(
      fastInitialCandidates.map((candidate) => prepareCandidateForVerification(searchJob, candidate, input.enrichmentAttemptedUrls))
    );
    return {
      candidates: enrichedCandidates.map((candidate) => ({
        url: candidate.url,
        title: candidate.title || null,
        store: candidate.store || candidate.domain || null,
        domain: candidate.domain || null,
        price: typeof candidate.price === "number" ? candidate.price : null,
        rating: typeof candidate.rating === "number" ? candidate.rating : null,
        reviewCount: typeof candidate.reviewCount === "number" ? candidate.reviewCount : null,
        source: candidate.source || null,
        notes: candidate.notes || [],
          identityFetched: candidate.identityFetched,
          brand: candidate.brand,
          model: candidate.model,
        enrichmentAttempted: candidate.enrichmentAttempted,
        enrichmentSucceeded: candidate.enrichmentSucceeded,
      })),
      queries: searchQueries.map((query) => cleanExactSearchQuery(query)),
      sourcesChecked: fastInitialCandidates.map((candidate) => candidate.url),
      sourceLinks: fastInitialCandidates.map((candidate) => ({
        label: candidate.title || candidate.url,
        url: candidate.url,
        ...(candidate.domain ? { domain: candidate.domain } : {}),
      })),
      notes: [`Parsed ${fastInitialCandidates.length} product candidate URL(s) from fast native search.`],
      elapsedMs: Date.now() - startedAt,
      timedOut: false,
      attemptCount: 1,
    };
  }

  const amazonFallbackCandidates =
    /amazon\.ca/i.test(searchQueries.join(" "))
      ? await fetchAmazonSearchCandidates(searchQueries[0], maxCandidates, 3500, input.costTelemetry)
      : [];

  if (amazonFallbackCandidates.length > 0) {
    const enrichedCandidates = await Promise.all(
      amazonFallbackCandidates.map((candidate) => prepareCandidateForVerification(searchJob, candidate, input.enrichmentAttemptedUrls))
    );
    return {
      candidates: enrichedCandidates.map((candidate) => ({
        url: candidate.url,
        title: candidate.title || null,
        store: candidate.store || candidate.domain || null,
        domain: candidate.domain || null,
        price: typeof candidate.price === "number" ? candidate.price : null,
        rating: typeof candidate.rating === "number" ? candidate.rating : null,
        reviewCount: typeof candidate.reviewCount === "number" ? candidate.reviewCount : null,
        source: candidate.source || null,
        notes: candidate.notes || [],
        identityFetched: candidate.identityFetched,
        enrichmentAttempted: candidate.enrichmentAttempted,
        enrichmentSucceeded: candidate.enrichmentSucceeded,
        brand: candidate.brand,
        model: candidate.model,
      })),
      queries: searchQueries.map((query) => cleanExactSearchQuery(query)),
      sourcesChecked: amazonFallbackCandidates.map((candidate) => candidate.url),
      sourceLinks: amazonFallbackCandidates.map((candidate) => ({
        label: candidate.title || candidate.url,
        url: candidate.url,
        domain: candidate.domain,
      })),
      notes: [`Parsed ${amazonFallbackCandidates.length} Amazon.ca candidate URL(s) from direct native search fallback.`],
      elapsedMs: Date.now() - startedAt,
      timedOut: false,
      attemptCount: 1,
    };
  }

  return emptyCandidateSearchResult(
    "Native exact listing search returned no usable product candidates before last-resort review URL discovery.",
    startedAt,
    searchQueries
  );
}


function cleanExactSearchQuery(value: unknown) {
  const raw = String(value || "")
    .replace(/amazon\s+s\b/gi, "Amazon")
    .replace(/\bcolor\s+amazon\b/gi, "Amazon")
    .replace(/\bamazon\s+amazon\.ca\b/gi, "Amazon.ca")
    .replace(/\bamazon\.ca\s+amazon\.ca\b/gi, "Amazon.ca")
    .replace(/\s+/g, " ")
    .trim();

  const seen = new Set<string>();
  const words: string[] = [];

  for (const word of raw.match(/"[^"]+"|site:\S+|\S+/g) || []) {
    const key = word.toLowerCase();
    if (seen.has(key) && !/^"?.*"$/.test(word)) continue;
    seen.add(key);
    words.push(word);
  }

  return words
    .join(" ")
    .replace(/\bAmazon Amazon\.ca\b/gi, "Amazon.ca")
    .replace(/\bAmazon\.ca Amazon\b/gi, "Amazon.ca")
    .replace(/\s+/g, " ")
    .trim();
}

export async function findExactProductListing(
  input: ExactProductSearchInput
): Promise<ExactProductSearchResult> {
  const searchResult = await findExactProductCandidates({
    ...input,
    maxCandidates: Math.max(1, Math.min(input.maxCandidates || 3, 5)),
  });
  const acceptedDomain = acceptedExactDomainForStore(input.store);
  const candidate =
    searchResult.candidates.find((item) => urlHostMatchesAcceptedDomain(item.url, acceptedDomain)) ||
    searchResult.candidates[0] ||
    null;

  if (!candidate) {
    return {
      ...emptyExactResult(searchResult.notes[0] || "Exact listing search returned no product candidates."),
      sourcesChecked: searchResult.sourcesChecked,
      sourceLinks: searchResult.sourceLinks,
    };
  }

  const confidence = candidate.url && urlHostMatchesAcceptedDomain(candidate.url, acceptedDomain)
    ? "medium"
    : "low";

  return {
    exactListingUrl: confidence === "low" ? null : candidate.url,
    exactListingTitle: candidate.title,
    store: candidate.store || candidate.domain,
    price: candidate.price,
    rating: candidate.rating,
    reviewCount: candidate.reviewCount,
    confidence,
    sourcesChecked: searchResult.sourcesChecked.length
      ? searchResult.sourcesChecked
      : candidate.url
        ? [candidate.url]
        : [],
    sourceLinks: searchResult.sourceLinks,
    notes: [
      ...searchResult.notes,
      ...(candidate.notes || []),
    ].slice(0, 10),
  };
}
