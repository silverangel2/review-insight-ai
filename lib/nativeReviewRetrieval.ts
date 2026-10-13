import { reportReviewsFound } from "./scanProgress";
import { createHeadlessRenderer, headlessRenderEnabled } from "./headlessRender";
import { createPoliteFetcher, BROWSER_HEADERS } from "./politeFetch";
import { findSitemapCandidates, loadLocalSitemapIndexes } from "./sitemapProductIndex";
import { extractListingIdentifiers, identifiersMatch, identifiersConflict, identifierDiscoveryQueries, type ListingIdentifiers } from "./listingIdentifiers";
import { captureStage } from "./devScanCapture";
import { extractWrittenReviewsFromHtml, isBlockedOrSignInReviewPage } from "@/lib/reviewCollector";
import { verifyProductCandidate } from "./productSearchVerifier";
import { stableProductSearchTerms, type ProductIdentityTokenRoles } from "./productIdentityTokens";
import { extractProductEvidenceFromHtml, normalizeProductUrl, isProductUrl } from "./productUrlRetrieval";
import type { CollectedReview } from "@/lib/reviewCollector";
import type { ScanCostTelemetry } from "@/lib/scanCostTelemetry";
import { buildAmazonReviewPageUrls, discoverPublicReviewFollowups, reviewPaginationKey, buildRetailerReviewPageUrls, buildLocaleListingVariants, retailerStableProductId } from "./reviewRetrievalPolicy";
import { buildDirectReviewCandidateUrls } from "./exactProductSearch";

type SourceLink = { label: string; url: string; domain?: string };

export type NativeReviewRetrievalInput = {
  productTitle: string;
  brand?: string | null;
  model?: string | null;
  store?: string | null;
  listingUrl?: string | null;
  productId?: string | null;
  structuredIdentity?: ProductIdentityTokenRoles;
  sourceLinks?: Array<{ label?: string | null; url?: string | null; domain?: string | null }> | null;
  maxQueries?: number;
  maxPages?: number;
  maxSnippets?: number;
  politeDelayMs?: number;
  /** Test hook: inject a browser launcher (forces the headless fallback on). */
  headlessLaunch?: () => Promise<unknown>;
  costTelemetry?: ScanCostTelemetry;
};

export type NativeReviewRetrievalResult = {
  attempted: boolean;
  headlessRender?: Record<string, unknown>;
  politeFetch?: { accessStopped?: string[]; requests: number; robotsFetches: number; robotsBlocked: string[]; cacheHits: number; retries: number; byHost: Record<string, number> };
  queries: string[];
  sourcesChecked: string[];
  sourceLinks: SourceLink[];
  reviews: CollectedReview[];
  reviewsCollected: number;
  usableSnippetsExtracted: boolean;
  normalFetchAttempted: boolean;
  normalFetchFailed: boolean;
  playwrightAttempted: boolean;
  playwrightFailed: boolean;
  proxyConfigured: boolean;
  coverageNote: string;
  stopReason: "corpus_cap_reached" | "candidate_pages_exhausted" | "access_restricted" | "retrieval_budget_reached" | "duration_cap_reached" | "page_cap_reached";
  nativeScraperBlocked: boolean;
  diagnostics: {
    searchProviders: string[];
    attemptedSearches: number;
    attemptedPages: number;
    normalFetchSuccesses: number;
    normalFetchFailures: number;
    playwrightSuccesses: number;
    playwrightFailures: number;
    candidateUrlsDiscovered: number;
    fetchedPageUrls: string[];
    writtenReviewSources: string[];
    pagesBlocked: number;
    stopReason: string;
    rawReviewRecords: number;
    duplicatesRemoved: number;
    rejectedCandidates: number;
    pageResults: Array<{ url: string; status: number | null; error: string | null }>;
  };
};

type FetchInitWithDispatcher = RequestInit & { dispatcher?: unknown };
type PageFetchResult = {
  url: string;
  ok: boolean;
  text: string;
  status?: number;
  finalUrl?: string;
  method: "fetch" | "playwright";
  error?: string;
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
];

let cachedProxyDispatcher: Promise<unknown | null> | null = null;

function cleanText(value: unknown): string {
  return String(value || "")
    .replace(/\\u0026/g, "&")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\\n/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlDecodeLight(value: string): string {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function uniqueStrings(values: unknown[], limit = 60): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const text = String(value || "").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }

  return out;
}

function domainForUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function normalizeHttpUrl(value: unknown, base?: string): string | null {
  const raw = htmlDecodeLight(String(value || "")).trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw, base);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";

    if (parsed.hostname.includes("duckduckgo.com") && parsed.searchParams.get("uddg")) {
      return normalizeHttpUrl(parsed.searchParams.get("uddg"));
    }

    return /(?:^|\.)bing\.com$/i.test(parsed.hostname) ? normalizeProductUrl(parsed.toString()) : parsed.toString();
  } catch {
    return null;
  }
}

function configuredProxyUrl() {
  return (
    process.env.REVIEWINTEL_HTTP_PROXY ||
    process.env.REVIEWINTEL_HTTPS_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    ""
  ).trim();
}

async function getProxyDispatcher(): Promise<unknown | null> {
  const proxyUrl = configuredProxyUrl();
  if (!proxyUrl) return null;

  if (!cachedProxyDispatcher) {
    cachedProxyDispatcher = (async () => {
      try {
        const dynamicImport = new Function("specifier", "return import(specifier)") as (
          specifier: string
        ) => Promise<{ ProxyAgent?: new (url: string) => unknown }>;
        const undici = await dynamicImport("undici");
        return undici.ProxyAgent ? new undici.ProxyAgent(proxyUrl) : null;
      } catch {
        return null;
      }
    })();
  }

  return cachedProxyDispatcher;
}

function userAgentFor(index: number) {
  return USER_AGENTS[Math.abs(index) % USER_AGENTS.length];
}

async function politeDelay(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// One polite fetcher per scan (robots, pacing, 5xx retry, cache); set by runNativeReviewRetrieval.
let activePoliteFetcher: ReturnType<typeof createPoliteFetcher> | null = null;
function maxPagesForRender(input: { maxPages?: number }) { return typeof input.maxPages === "number" ? Math.max(1, input.maxPages) : 3; }

async function fetchText(url: string, index: number, timeoutMs = 9000, costTelemetry?: ScanCostTelemetry): Promise<PageFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const dispatcher = await getProxyDispatcher();
    const init: FetchInitWithDispatcher = {
      method: "GET",
      headers: { "user-agent": userAgentFor(index), ...BROWSER_HEADERS },
      cache: "no-store",
      signal: controller.signal,
    };

    if (dispatcher) init.dispatcher = dispatcher;

    if (costTelemetry && !costTelemetry.canStartRetrievalRequest()) {
      return { url, ok: false, text: "", method: "fetch", error: "Per-scan retrieval ceiling reached." };
    }
    costTelemetry?.recordRetrievalRequest(/(?:bing\.com\/search|duckduckgo\.com\/html)/i.test(url) ? "search" : "other");
    const fetcher = activePoliteFetcher || createPoliteFetcher({ minHostIntervalMs: 0 });
    const result = await fetcher.get(url, init as RequestInit);
    return { url, ok: result.ok, text: result.text, status: result.status ?? undefined, finalUrl: result.finalUrl, method: "fetch", error: result.error };
  } catch (error) {
    return {
      url,
      ok: false,
      text: "",
      method: "fetch",
      error: error instanceof Error ? error.message : "native fetch failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextWithPlaywright(url: string, index: number, timeoutMs = 12000, costTelemetry?: ScanCostTelemetry): Promise<PageFetchResult> {
  if (costTelemetry && !costTelemetry.canStartRetrievalRequest()) {
    return { url, ok: false, text: "", method: "playwright", error: "Per-scan retrieval ceiling reached." };
  }
  costTelemetry?.recordRetrievalRequest("other");
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string
    ) => Promise<{ chromium?: unknown }>;
    const mod = await dynamicImport("playwright");
    const chromium = mod.chromium as
      | {
          launch: (options?: Record<string, unknown>) => Promise<{
            newPage: (options?: Record<string, unknown>) => Promise<{
              goto: (target: string, options?: Record<string, unknown>) => Promise<unknown>;
              content: () => Promise<string>;
              url: () => string;
            }>;
            close: () => Promise<void>;
          }>;
        }
      | undefined;

    if (!chromium) {
      return {
        url,
        ok: false,
        text: "",
        method: "playwright",
        error: "Playwright chromium is not installed.",
      };
    }

    const proxyUrl = configuredProxyUrl();
    const browser = await chromium.launch({
      headless: true,
      args: proxyUrl ? [`--proxy-server=${proxyUrl}`] : [],
    });

    try {
      const page = await browser.newPage({
        userAgent: userAgentFor(index),
        locale: "en-CA",
      });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      const text = await page.content();
      return {
        url,
        ok: text.trim().length > 0,
        text,
        method: "playwright",
        finalUrl: page.url(),
      };
    } finally {
      await browser.close();
    }
  } catch (error) {
    return {
      url,
      ok: false,
      text: "",
      method: "playwright",
      error: error instanceof Error ? error.message : "Playwright scrape failed.",
    };
  }
}

function normalizedIdentity(input: NativeReviewRetrievalInput) {
  const stable = stableProductSearchTerms({ brand: input.brand, productName: input.productTitle, model: input.model });
  const title = [...stable.brands, ...stable.models, stable.family, ...stable.roles.capacityOrSize].filter(Boolean).join(" ").slice(0, 220);
  const brand = cleanText(input.brand).slice(0, 80);
  const model = stable.models.join(" ").slice(0, 80);
  const store = cleanText(input.store).slice(0, 80);

  const exactTitle = uniqueStrings([brand && !title.toLowerCase().includes(brand.toLowerCase()) ? brand : "", title, model && !title.toLowerCase().includes(model.toLowerCase()) ? model : ""], 3).join(" ").replace(/\s+/g, " ").trim();

  return {
    title,
    brand,
    model,
    store,
    exactTitle: exactTitle || title,
  };
}

export function buildNativeReviewSearchQueries(input: NativeReviewRetrievalInput): string[] {
  const identity = normalizedIdentity(input);
  const exact = identity.exactTitle || identity.title;
  const quoted = exact ? `"${exact.replace(/"/g, "")}"` : "";
  const brandModel = [identity.brand, identity.model].filter(Boolean).join(" ").trim();
  const store = identity.store;

  return uniqueStrings(
    [
      // Short brand+model queries match retailer pages; long quoted phrases rarely do.
      brandModel ? `${brandModel} reviews` : "",
      quoted || exact,
      `${quoted || exact} reviews`,
      `${quoted || exact} Amazon.ca reviews`,
      `${quoted || exact} Walmart reviews`,
      `${quoted || exact} (site:bestbuy.com OR site:bestbuy.ca OR site:target.com) customer reviews`,
      `${quoted || exact} (site:homedepot.com OR site:lowes.com OR site:canadiantire.ca) customer reviews`,
      `${quoted || exact} (site:costco.com OR site:costco.ca) reviews`,
      `${quoted || exact} official customer reviews`,
      `${quoted || exact} complaints`,
      brandModel ? `${brandModel} reviews` : "",
      store ? `${quoted || exact} ${store} reviews` : "",
      `${quoted || exact} verified purchase`,
      `${quoted || exact} pros cons`,
      `${quoted || exact} worth it`,
      `${quoted || exact} problems`,
      brandModel ? `${brandModel} review reddit` : "",
      brandModel ? `${brandModel} hands-on review` : "",
      input.listingUrl ? `${brandModel || exact} ${input.listingUrl} reviews` : "",
    ],
    16
  );
}

function searchProviders() {
  const configured = String(process.env.REVIEWINTEL_NATIVE_SEARCH_PROVIDERS || "bing,duckduckgo")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const validProviders = uniqueStrings(configured, 3).filter(
    (provider) => provider === "bing" || provider === "duckduckgo"
  );

  return validProviders.length ? validProviders : ["bing", "duckduckgo"];
}

function searchUrlFor(provider: string, query: string) {
  if (provider === "duckduckgo") {
    return `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  }

  return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
}

function extractSearchResultLinks(html: string, provider: string): SourceLink[] {
  const decoded = htmlDecodeLight(html);
  const links: SourceLink[] = [];

  if (provider === "duckduckgo") {
    const resultLinks = decoded.matchAll(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
    for (const match of resultLinks) {
      const url = normalizeHttpUrl(match[1], "https://duckduckgo.com/");
      if (!url) continue;
      links.push({
        label: cleanText(match[2]).slice(0, 140) || domainForUrl(url) || url,
        url,
        domain: domainForUrl(url),
      });
    }
  } else {
    const resultBlocks = decoded.match(/<li[^>]+class=["'][^"']*\bb_algo\b[^"']*["'][\s\S]*?<\/li>/gi) || [];
    for (const block of resultBlocks) {
      const urlMatch = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/i);
      const titleMatch = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || block.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
      const url = normalizeHttpUrl(urlMatch?.[1]);
      if (!url) continue;
      links.push({
        label: titleMatch ? cleanText(titleMatch[1]).slice(0, 140) : domainForUrl(url) || url,
        url,
        domain: domainForUrl(url),
      });
    }
  }

  // Preserve the anchor's identity context even when result markup changes.
  // It is discovery context only; fetched product identity is checked later.
  for (const match of decoded.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = normalizeHttpUrl(match[1], provider === "duckduckgo" ? "https://duckduckgo.com/" : "https://www.bing.com/");
    if (url) links.push({ url, label: cleanText(match[2]) || domainForUrl(url) || url, domain: domainForUrl(url) });
  }

  const rawUrls = decoded.matchAll(/https?:\/\/[^"' <>)\\]+/gi);
  for (const match of rawUrls) {
    const url = normalizeHttpUrl(match[0]);
    if (!url) continue;
    links.push({
      label: domainForUrl(url) || url,
      url,
      domain: domainForUrl(url),
    });
  }

  return dedupeSourceLinks(links).slice(0, 12);
}

function extractReviewsFromText(text: string, sourceUrl: string): CollectedReview[] {
  return extractWrittenReviewsFromHtml(text, sourceUrl);
}

function nativeSourceMatchesProductImpl(input: NativeReviewRetrievalInput, link: SourceLink) {
  const asinOf = (url: string) => url.match(/\/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1]?.toUpperCase();
  const expected = asinOf(input.listingUrl || "");
  const found = asinOf(link.url);
  if (expected && found) return expected === found && domainForUrl(link.url) === domainForUrl(input.listingUrl || "");
  return verifyProductCandidate({
    scanId: "native-source-adjudication", productName: input.productTitle,
    brand: input.brand, model: input.model,
  }, { url: link.url, title: link.label }).canCollectReviews;
}

function reviewKey(review: CollectedReview) {
  return cleanText(review.body).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ");
}

function dedupeReviews(reviews: CollectedReview[], limit: number): CollectedReview[] {
  const seen = new Set<string>();
  const out: CollectedReview[] = [];

  for (const review of reviews) {
    const body = cleanText(review.body);
    if (!body) continue;
    const key = reviewKey({ ...review, body });
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...review,
      body: body.slice(0, 5000),
      title: review.title ? cleanText(review.title).slice(0, 160) : undefined,
    });
    if (out.length >= limit) break;
  }

  return out;
}

function dedupeSourceLinks(links: SourceLink[]): SourceLink[] {
  const seen = new Set<string>();
  const out: SourceLink[] = [];

  for (const link of links) {
    const url = normalizeHttpUrl(link.url);
    if (!url) continue;
    const domain = link.domain || domainForUrl(url);

    if (
      !domain ||
      /(?:^|\.)google\.|(?:^|\.)bing\.com$|(?:^|\.)duckduckgo\.com$|facebook\.com\/sharer|twitter\.com\/share/i.test(
        url
      )
    ) {
      continue;
    }

    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      label: cleanText(link.label) || domain || url,
      url,
      domain,
    });
  }

  return out;
}

const LOCALE_OR_ADAPTER_LABEL = "Public review source adapter";

function candidateLinksFromInput(input: NativeReviewRetrievalInput): SourceLink[] {
  const links: SourceLink[] = [];
  const listingUrl = normalizeHttpUrl(input.listingUrl || "");

  if (listingUrl) {
    links.push({
      label: cleanText(input.productTitle) || "Exact product listing",
      url: listingUrl,
      domain: domainForUrl(listingUrl),
    });
    // Real public sources (retailer review pages, verified locale siblings)
    // precede synthetic pagination guesses so the page budget reaches them.
    for (const url of [...buildRetailerReviewPageUrls(listingUrl), ...buildLocaleListingVariants(listingUrl)]) {
      links.push({ label: LOCALE_OR_ADAPTER_LABEL, url, domain: domainForUrl(url) });
    }
    const asin = listingUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1];
    const directUrls = asin ? [...buildDirectReviewCandidateUrls(listingUrl), ...buildAmazonReviewPageUrls(listingUrl, asin)] : buildDirectReviewCandidateUrls(listingUrl);
    for (const url of directUrls) {
      links.push({
        label: "Direct marketplace review candidate",
        url,
        domain: domainForUrl(url),
      });
    }
  }

  for (const link of input.sourceLinks || []) {
    const url = normalizeHttpUrl(link.url || "");
    if (!url) continue;
    links.push({
      label: cleanText(link.label) || domainForUrl(url) || url,
      url,
      domain: cleanText(link.domain) || domainForUrl(url),
    });
  }

  return dedupeSourceLinks(links);
}

function prioritizeLinks(inputLinks: SourceLink[], searchLinks: SourceLink[], maxPages: number) {
  const reviewishLinks = searchLinks.filter((link) =>
    /review|reviews|customer|complaint|reddit|youtube|forum|product|dp\/|walmart|amazon|bestbuy|costco|target|sephora|homedepot/i.test(
      `${link.url} ${link.label}`
    )
  );

  return dedupeSourceLinks([...inputLinks, ...reviewishLinks, ...searchLinks]).slice(0, maxPages);
}

function envNumber(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

export async function runNativeReviewRetrieval(
  input: NativeReviewRetrievalInput
): Promise<NativeReviewRetrievalResult> {
  const startedAt = Date.now();
  activePoliteFetcher = createPoliteFetcher({ minHostIntervalMs: typeof input.politeDelayMs === "number" ? Math.min(input.politeDelayMs, 2000) : 400 });
  const politeStats = activePoliteFetcher.stats;
  // Free local headless render fallback (verified pages with client-side reviews only).
  const renderer = (input.headlessLaunch || headlessRenderEnabled()) ? createHeadlessRenderer({
    gate: activePoliteFetcher, launch: input.headlessLaunch as Parameters<typeof createHeadlessRenderer>[0]["launch"],
    maxPages: Math.min(3, maxPagesForRender(input)), minHostIntervalMs: typeof input.politeDelayMs === "number" ? Math.min(input.politeDelayMs * 4, 3000) : 3000,
  }) : null;
  const maxDurationMs = envNumber("REVIEWINTEL_NATIVE_MAX_DURATION_MS", 180000, 1000, 300000);
  const withinDuration = () => Date.now() - startedAt < maxDurationMs;
  const maxQueries = Math.max(1, Math.min(input.maxQueries || envNumber("REVIEWINTEL_MAX_REVIEW_QUERIES", 10, 1, 12), 12));
  const maxPages = Math.max(1, Math.min(input.maxPages || envNumber("REVIEWINTEL_MAX_REVIEW_PAGES", 24, 1, 48), 48));
  const maxSnippets = Math.max(5, Math.min(input.maxSnippets || envNumber("REVIEWINTEL_MAX_RAW_REVIEW_RECORDS", 240, 5, 500), 500));
  const delayMs =
    typeof input.politeDelayMs === "number"
      ? Math.max(0, Math.min(input.politeDelayMs, 2000))
      : envNumber("REVIEWINTEL_RETRIEVAL_DELAY_MS", 250, 0, 2000);

  let queries = buildNativeReviewSearchQueries(input).slice(0, maxQueries);
  // Identifiers read from the verified listing itself (GTIN/UPC, model/part number).
  const verifiedIds: ListingIdentifiers = { gtins: [], models: [] };
  const disabledProviders = new Set<string>();
  // Query-insensitive result sets (same organic URLs for unrelated queries)
  // mean the provider is serving a degraded/bot page, not real results.
  const providerResultSets = new Map<string, Array<Set<string>>>();
  const providerRepeats = new Map<string, number>();
  const providers = searchProviders();
  const sourcesChecked: string[] = [];
  const searchLinks: SourceLink[] = [];
  const inputLinks = candidateLinksFromInput(input);
  const reviews: CollectedReview[] = [];
  let attemptedSearches = 0;
  let normalFetchSuccesses = 0;
  let normalFetchFailures = 0;
  let playwrightSuccesses = 0;
  let playwrightFailures = 0;
  const fetchedPageUrls: string[] = [];
  const attemptedPageUrls = new Set<string>();
  const verifiedRetailerPages = new Map<string, { title: string; brand: string | null }>();
  const failedFetchUrls: string[] = [];
  let rejectedCandidates = 0;
  let blockedProductPages = 0;
  // Genuinely access-restricted pages (sign-in/challenge/401/403/429) are
  // tracked separately from wrong-product rejections and transient errors,
  // so the stop reason does not mislabel a wrong-product run as restricted.
  let restrictedProductPages = 0;
  let playwrightPageAttempts = 0;
  const pageResults: Array<{ url: string; status: number | null; error: string | null }> = [];
  const exhaustedPagination = new Set<string>();
  const stagnantPages = new Map<string, number>();
  const restrictedReviewPaths = new Set<string>();
  const discoveredFollowups: SourceLink[] = [];
  async function collectPage(link: SourceLink) {
    const pagination = new URL(link.url);
    const restrictionKey = `${pagination.origin}${pagination.pathname.replace(/\/$/, "")}`;
    const paginationKey = reviewPaginationKey(link.url);
    const isPagination = ["pageNumber", "page", "cursor", "offset"].some(key => pagination.searchParams.has(key));
    if (restrictedReviewPaths.has(restrictionKey) || (isPagination && exhaustedPagination.has(paginationKey))) return;
    if (!withinDuration() || dedupeReviews(reviews, maxSnippets).length >= maxSnippets || attemptedPageUrls.size >= maxPages || attemptedPageUrls.has(link.url)) return;
    attemptedPageUrls.add(link.url);
    sourcesChecked.push(link.url);
    const page = await fetchText(link.url, attemptedSearches + attemptedPageUrls.size, 9000, input.costTelemetry);
    pageResults.push({ url: link.url, status: page.status || null, error: page.error || null });
    captureStage("page", () => ({ sourceUrl: link.url, httpStatus: page.status ?? null, blockedOrChallenged: !page.ok || /captcha|robot check|verify you are human|automated access|access denied/i.test(page.text), page: attemptedPageUrls.size, cursor: new URL(link.url).searchParams.get("pageNumber"), sourceTitle: link.label, records: [] }));
    const restricted = isBlockedOrSignInReviewPage({ requestedUrl: link.url, finalUrl: page.finalUrl, html: page.text }) || page.status === 401 || page.status === 403 || page.status === 429;
    const blocked = !page.ok || restricted;
    if (restricted) {
      restrictedProductPages += 1;
      restrictedReviewPaths.add(restrictionKey);
    }
    // Development captures keep the fetched body so extraction defects are provable offline.
    captureStage("page", { sourceUrl: link.url, finalUrl: page.finalUrl, httpStatus: page.status ?? null, blockedOrChallenged: blocked, records: [], html: typeof page.text === "string" ? page.text.slice(0, 8_000_000) : null });
    const pageIdentity = extractProductEvidenceFromHtml(page.text, page.finalUrl || link.url);
    const requestedHost = domainForUrl(input.listingUrl || "");
    const isPrimaryListing = domainForUrl(page.finalUrl || link.url) === requestedHost && nativeSourceMatchesProduct(input, { ...link, url: page.finalUrl || link.url });
    // A same-marketplace page whose stable product id equals the verified
    // listing's id is the verified product; fuzzy title re-verification of
    // that page must not discard its reviews. Different ids never pass here.
    const stableIdOf = (url: string) => url.match(/\/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1]?.toUpperCase();
    const verifiedStableId = stableIdOf(input.listingUrl || "");
    const sameStableListing = Boolean(verifiedStableId) && stableIdOf(page.finalUrl || link.url) === verifiedStableId &&
      domainForUrl(page.finalUrl || link.url) === requestedHost;
    const pageIds = extractListingIdentifiers(page.text || "");
    if (sameStableListing && !blocked) {
      for (const gtin of pageIds.gtins) if (!verifiedIds.gtins.includes(gtin)) verifiedIds.gtins.push(gtin);
      for (const model of pageIds.models) if (!verifiedIds.models.includes(model)) verifiedIds.models.push(model);
    }
    // Another store's page is the exact product when it shares a valid GTIN or
    // discriminative model id with the verified listing; a conflicting GTIN
    // (other variant/product) is never accepted on fuzzy title similarity.
    const crossStoreIdMatch = !sameStableListing && identifiersMatch(verifiedIds, pageIds);
    const crossStoreIdConflict = !sameStableListing && identifiersConflict(verifiedIds, pageIds);
    if (!sameStableListing) captureStage("verification", () => ({ stage: "cross-store-identifiers", url: page.finalUrl || link.url, pageIds, verifiedIds, match: crossStoreIdMatch, conflict: crossStoreIdConflict }));
    // A review URL WE built from an identity-verified retailer page with the same stable product id
    // (same host + SKU/item id) inherits that page's verified identity (e.g. a JSON review endpoint).
    const retailerId = retailerStableProductId(page.finalUrl || link.url);
    const inheritedIdentity = retailerId ? verifiedRetailerPages.get(retailerId) : undefined;
    const fetchedIdentityAccepted = sameStableListing || crossStoreIdMatch || (inheritedIdentity && !crossStoreIdConflict) ? true : crossStoreIdConflict ? false : pageIdentity.title ? verifyProductCandidate({
      scanId: "native-fetched-identity", productName: input.productTitle,
      brand: input.brand, model: input.model,
    }, { url: page.finalUrl || link.url, title: pageIdentity.title, brand: pageIdentity.brand, model: pageIdentity.model }).canCollectReviews : isPrimaryListing;
    if (!blocked && fetchedIdentityAccepted) {
      if (retailerId && pageIdentity.title && !verifiedRetailerPages.has(retailerId)) verifiedRetailerPages.set(retailerId, { title: pageIdentity.title, brand: pageIdentity.brand || null });
      if (inheritedIdentity && !pageIdentity.title) { pageIdentity.title = inheritedIdentity.title; if (!pageIdentity.brand) pageIdentity.brand = inheritedIdentity.brand as typeof pageIdentity.brand; }
      normalFetchSuccesses += 1;
      fetchedPageUrls.push(link.url);
      const before = dedupeReviews(reviews, maxSnippets).length;
      let extracted = extractReviewsFromText(page.text, page.finalUrl || link.url);
      // Reviews rendered client-side: same verified URL, rendered once in a local browser,
      // then the SAME collector and identity-labelled records. Same-host only.
      if (!extracted.length && renderer && !isPagination) {
        const rendered = await renderer.render(page.finalUrl || link.url);
        captureStage("page", { sourceUrl: link.url, finalUrl: rendered.finalUrl, httpStatus: rendered.status, method: "headless-render", blockedOrChallenged: Boolean(rendered.blocked), error: rendered.error || null, waitedFor: rendered.waitedFor || null, records: [], html: rendered.html ? rendered.html.slice(0, 8_000_000) : null });
        if (rendered.blocked) restrictedProductPages += 1;
        if (rendered.ok && domainForUrl(rendered.finalUrl) === domainForUrl(page.finalUrl || link.url)) {
          playwrightPageAttempts += 1;
          const renderedIds = extractListingIdentifiers(rendered.html);
          if (!identifiersConflict(verifiedIds, renderedIds)) {
            extracted = extractReviewsFromText(rendered.html, rendered.finalUrl).map(record => ({ ...record, retrievalMethod: "headless-render" }));
            if (extracted.length) playwrightSuccesses += 1;
          }
        }
      }
      reviews.push(...extracted.map(record => ({
        ...record, reviewedProductName: record.reviewedProductName || pageIdentity.title,
        // Distinguishes listing-page identity from a per-review structured product name.
        ...(record.reviewedProductName ? {} : pageIdentity.title ? { reviewedProductNameSource: "page" as const } : {}),
        reviewedBrand: record.reviewedBrand || pageIdentity.brand,
      })));
      for (const url of [...discoverPublicReviewFollowups(page.text, page.finalUrl || link.url), ...buildRetailerReviewPageUrls(page.finalUrl || link.url)]) {
        if (!attemptedPageUrls.has(url) && !discoveredFollowups.some(link => link.url === url)) {
          discoveredFollowups.push({ url, label: pageIdentity.title || link.label, domain: domainForUrl(url) });
        }
      }
      if (isPagination) {
        const stagnant = dedupeReviews(reviews, maxSnippets).length === before ? (stagnantPages.get(paginationKey) || 0) + 1 : 0;
        stagnantPages.set(paginationKey, stagnant);
        if (stagnant >= 2) exhaustedPagination.add(paginationKey);
      }
    } else {
      normalFetchFailures += 1;
      // Authentication/challenge restrictions are terminal for this URL,
      // not an invitation to retry through a browser or proxy.
      if (!restricted && !page.ok && (!page.status || page.status >= 500)) failedFetchUrls.push(link.url);
      if (blocked) blockedProductPages += 1;
      else rejectedCandidates += 1;
      if (isPagination && blocked) exhaustedPagination.add(paginationKey);
    }
    reportReviewsFound(dedupeReviews(reviews, maxSnippets).length);
    console.log("[ReviewIntel PIPELINE] native-page", JSON.stringify({ url: link.url, status: page.status || "error", rawReviews: reviews.length, attemptedPages: attemptedPageUrls.size, paginationContinued: attemptedPageUrls.size < maxPages && withinDuration() && dedupeReviews(reviews, maxSnippets).length < maxSnippets }));
    await politeDelay(delayMs);
  }
  // Sparse discovery metadata may authorize an identity fetch, never reviews.
  const candidateMayBeInspected = (link: SourceLink) => {
    if (nativeSourceMatchesProduct(input, link)) return true;
    // Adapter/locale pages may be fetched for identity; reviews still require
    // fetched-title verification (different host never uses stable-id trust).
    if (link.label === LOCALE_OR_ADAPTER_LABEL) return true;
    // A product URL whose label or path carries a verified model id may be
    // fetched for identity; acceptance still requires identifier/title verification.
    const compactLink = `${link.label || ""} ${link.url}`.toUpperCase().replace(/[\s_./-]+/g, "");
    if (verifiedIds.models.some(model => model.length >= 5 && compactLink.includes(model)) && isProductUrl(normalizeProductUrl(link.url))) return true;
    const sparse = !link.label || /^https?:\/\//i.test(link.label) || link.label === link.domain ||
      /^(?:product|reviews?|details?|view product|shop)$/i.test(link.label.trim());
    return sparse && isProductUrl(normalizeProductUrl(link.url));
  };
  // Start with the verified listing and its direct review pages before research.
  const eligibleInputLinks = inputLinks.filter((link) => {
    const accepted = candidateMayBeInspected(link);
    if (!accepted) rejectedCandidates += 1;
    return accepted;
  });
  // Reserve capacity for discovery across stores instead of spending the entire
  // page budget on the first listing's synthetic pagination URLs.
  const initialPageBudget = Math.max(1, Math.min(4, Math.floor(maxPages / 3)));
  for (const link of eligibleInputLinks.slice(0, initialPageBudget)) await collectPage(link);
  // Robots-compliant sitemap discovery (local index; no search engine needed).
  const sitemapCandidates = findSitemapCandidates(input.brand ? loadLocalSitemapIndexes(undefined, { brand: input.brand }) : [], {
    brand: input.brand, models: [...verifiedIds.models, ...(input.model ? [input.model] : [])],
  });
  captureStage("search", () => ({ provider: "sitemap-index", candidates: sitemapCandidates }));
  for (const url of sitemapCandidates) discoveredFollowups.push({ url, label: LOCALE_OR_ADAPTER_LABEL, domain: domainForUrl(url) });
  const idQueries = identifierDiscoveryQueries(input.brand, verifiedIds, input.model ? [input.model] : []);
  if (idQueries.length) queries = [...new Set([...idQueries, ...queries])].slice(0, maxQueries);

  for (const query of queries) {
    for (const provider of providers) {
      if (dedupeReviews(reviews, maxSnippets).length >= maxSnippets || !withinDuration() || attemptedPageUrls.size >= maxPages) break;

      if (disabledProviders.has(provider)) continue;
      const searchUrl = searchUrlFor(provider, query);
      sourcesChecked.push(`native-search:${provider}:${query}`);
      attemptedSearches += 1;

      const searchPage = await fetchText(searchUrl, attemptedSearches, 8000, input.costTelemetry);
      const providerLinks = searchPage.ok ? extractSearchResultLinks(searchPage.text, provider) : [];
      const organicLinks = providerLinks.filter(item => !/(?:^|\.)(?:bing\.com|duckduckgo\.com|microsoft\.com|w3\.org|go\.microsoft\.com)$/i.test(item.domain || ""));
      // A 202/anomaly page or a page with no organic results is a throttle,
      // not "no results": stop spending requests on that provider this scan.
      const throttled = searchPage.status === 202 || /anomaly-modal|challenge-form|unusual traffic|are you a robot/i.test(searchPage.text || "") || (provider === "duckduckgo" && searchPage.ok && organicLinks.length === 0);
      captureStage("search", () => ({ provider, query, httpStatus: searchPage.status ?? null, organicResults: organicLinks.length, retailerResults: organicLinks.filter(item => /walmart|bestbuy|homedepot|canadiantire|costco|target|lowes|rona|staples|newegg/i.test(item.domain || "")).map(item => item.url).slice(0, 10), throttled }));
      const organicKeys = new Set(organicLinks.map(item => { try { const u = new URL(item.url); return `${u.hostname}${u.pathname}`; } catch { return item.url; } }));
      const previousSets = providerResultSets.get(provider) || [];
      const repeated = organicKeys.size >= 3 && previousSets.some(prev => [...organicKeys].filter(key => prev.has(key)).length / organicKeys.size >= 0.8);
      if (repeated) providerRepeats.set(provider, (providerRepeats.get(provider) || 0) + 1);
      previousSets.push(organicKeys); providerResultSets.set(provider, previousSets);
      const degraded = (providerRepeats.get(provider) || 0) >= 2;
      captureStage("search", () => ({ provider, query, organicUrls: [...organicKeys].slice(0, 10), repeatedResultSet: repeated, degraded }));
      if (throttled || degraded) disabledProviders.add(provider);
      if (searchPage.ok && !throttled) {
        normalFetchSuccesses += 1;
        searchLinks.push(...organicLinks);
        console.log("[ReviewIntel PIPELINE] retrieval", JSON.stringify({ layer: "native-search", provider, url: searchUrl, page: attemptedSearches, status: searchPage.status || 200, reviewsFound: 0, candidateUrlsDiscovered: searchLinks.length, nextPageDiscovered: true, paginationContinued: true, stopReason: null }));
      } else {
        normalFetchFailures += 1;
        console.log("[ReviewIntel PIPELINE] retrieval", JSON.stringify({ layer: "native-search", provider, url: searchUrl, page: attemptedSearches, status: searchPage.status || "error", reviewsFound: 0, nextPageDiscovered: true, paginationContinued: true, stopReason: "search page unavailable; continued" }));
      }

      await politeDelay(delayMs);
    }
  }

  const eligibleSearchLinks = searchLinks.filter((link) => {
    const accepted = candidateMayBeInspected(link);
    if (!accepted) rejectedCandidates += 1;
    return accepted;
  });
  const diverseLinks: SourceLink[] = [];
  const seenHosts = new Set<string>();
  for (const link of eligibleSearchLinks) {
    const host = domainForUrl(link.url) || "";
    if (!seenHosts.has(host)) { diverseLinks.push(link); seenHosts.add(host); }
  }
  const candidateLinks = prioritizeLinks(diverseLinks, [...eligibleSearchLinks, ...eligibleInputLinks], maxPages);
  for (const link of diverseLinks) await collectPage(link);
  // Actual advertised followups take priority over synthetic pagination.
  for (const link of discoveredFollowups) await collectPage(link);
  for (const link of candidateLinks) await collectPage(link);
  // The queue can grow from actual next-page links, but collectPage enforces
  // URL uniqueness, duration and total page/corpus budgets on every request.
  for (const link of discoveredFollowups) await collectPage(link);

  const playwrightUrls = failedFetchUrls.slice(0, Math.min(4, maxPages));
  let playwrightAttempted = false;

  if (renderer && playwrightUrls.length > 0 && reviews.length < maxSnippets) {
    playwrightAttempted = true;

    for (const [index, url] of playwrightUrls.entries()) {
      if (!withinDuration()) break;
      if (dedupeReviews(reviews, maxSnippets).length >= maxSnippets || !withinDuration() || attemptedPageUrls.size >= maxPages) break;

      playwrightPageAttempts += 1;
      void index;
      if (!renderer) break;
      const rendered = await renderer.render(url);
      const page = { ok: rendered.ok, text: rendered.html, finalUrl: rendered.finalUrl, status: rendered.status ?? undefined };
      captureStage("page", () => ({ sourceUrl: url, httpStatus: page.status ?? null, blockedOrChallenged: !page.ok || /captcha|robot check|verify you are human|automated access|access denied/i.test(page.text), page: index + 1, method: "playwright", records: [] }));

      if (page.ok && !isBlockedOrSignInReviewPage({ requestedUrl: url, finalUrl: page.finalUrl, html: page.text })
        && nativeSourceMatchesProduct(input, { url: page.finalUrl || url, label: input.productTitle })) {
        fetchedPageUrls.push(url);
        playwrightSuccesses += 1;
        reviews.push(...extractReviewsFromText(page.text, page.finalUrl || url));
      } else {
        playwrightFailures += 1;
      }

      await politeDelay(delayMs);
    }
  }

  const dedupedReviews = dedupeReviews(reviews, maxSnippets);
  const allSourceLinks = dedupeSourceLinks([...eligibleInputLinks, ...candidateLinks, ...eligibleSearchLinks]).slice(0, 24);
  const uniqueSourcesChecked = uniqueStrings(sourcesChecked, 80);
  const attemptedPages = attemptedPageUrls.size;
  const pagesBlocked = blockedProductPages + playwrightFailures;
  const stopReason = !withinDuration() ? "duration_cap_reached" : dedupedReviews.length >= maxSnippets
    ? "corpus_cap_reached"
    : attemptedPageUrls.size >= maxPages
      ? "page_cap_reached"
    : input.costTelemetry && !input.costTelemetry.canStartRetrievalRequest()
      ? "retrieval_budget_reached"
      : dedupedReviews.length === 0 && restrictedProductPages > 0 && restrictedProductPages >= attemptedPages && attemptedPages > 0
        ? "access_restricted"
        : "candidate_pages_exhausted";
  console.log("[ReviewIntel PIPELINE] retrieval-summary", JSON.stringify({ layer: "native-review-retrieval", rawReviewsDiscovered: reviews.length, dedupedReviews: dedupedReviews.length, pagesFetched: fetchedPageUrls.length, sourcesUsed: uniqueStrings(dedupedReviews.map((review) => review.sourceUrl || review.source), 80), stopReason: dedupedReviews.length >= maxSnippets ? "configured corpus cap reached" : "candidate searches/pages exhausted or access restricted" }));
  const normalFetchAttempted = attemptedSearches + attemptedPages > 0;
  const normalFetchFailed = normalFetchAttempted && normalFetchSuccesses <= 0;
  const playwrightFailed = playwrightAttempted && playwrightSuccesses <= 0;
  const coverageNote = dedupedReviews.length
    ? `Native retrieval collected ${dedupedReviews.length} written review texts from public pages without an external fallback scraper.`
    : `Native retrieval checked ${uniqueSourcesChecked.length} search/page sources but did not extract usable written review texts.`;

  await renderer?.close();
  activePoliteFetcher = null;
  return {
    headlessRender: renderer ? { ...renderer.stats } : { disabled: true },
    politeFetch: politeStats,
    attempted: queries.length > 0 || inputLinks.length > 0,
    queries,
    sourcesChecked: uniqueSourcesChecked,
    sourceLinks: allSourceLinks,
    reviews: dedupedReviews,
    reviewsCollected: dedupedReviews.length,
    usableSnippetsExtracted: dedupedReviews.length > 0,
    normalFetchAttempted,
    normalFetchFailed,
    playwrightAttempted,
    playwrightFailed,
    proxyConfigured: Boolean(configuredProxyUrl()),
    coverageNote,
    diagnostics: {
      pageResults,
      rawReviewRecords: reviews.length,
      duplicatesRemoved: reviews.length - dedupedReviews.length,
      rejectedCandidates,
      searchProviders: providers,
      attemptedSearches,
      attemptedPages: attemptedPages + playwrightPageAttempts,
      normalFetchSuccesses,
      normalFetchFailures,
      playwrightSuccesses,
      playwrightFailures,
      candidateUrlsDiscovered: candidateLinks.length,
      fetchedPageUrls,
      writtenReviewSources: uniqueStrings(
        dedupedReviews.map((review) => review.sourceUrl || review.source),
        80
      ),
      pagesBlocked,
      stopReason,
    },
    stopReason,
    nativeScraperBlocked: stopReason === "access_restricted",
  };
}

export function nativeSourceMatchesProduct(...args: Parameters<typeof nativeSourceMatchesProductImpl>) {
  const result = nativeSourceMatchesProductImpl(...args);
  captureStage("source-match", { args, result });
  return result;
}
