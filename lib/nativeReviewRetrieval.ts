import { captureStage } from "./devScanCapture";
import { extractWrittenReviewsFromHtml, isBlockedOrSignInReviewPage } from "@/lib/reviewCollector";
import { verifyProductCandidate } from "./productSearchVerifier";
import { stableProductSearchTerms, type ProductIdentityTokenRoles } from "./productIdentityTokens";
import { normalizeProductUrl } from "./productUrlRetrieval";
import type { CollectedReview } from "@/lib/reviewCollector";
import type { ScanCostTelemetry } from "@/lib/scanCostTelemetry";
import { buildAmazonReviewPageUrls } from "./reviewRetrievalPolicy";
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
  costTelemetry?: ScanCostTelemetry;
};

export type NativeReviewRetrievalResult = {
  attempted: boolean;
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

async function fetchText(url: string, index: number, timeoutMs = 9000, costTelemetry?: ScanCostTelemetry): Promise<PageFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const dispatcher = await getProxyDispatcher();
    const init: FetchInitWithDispatcher = {
      method: "GET",
      headers: {
        "user-agent": userAgentFor(index),
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,text/plain,*/*;q=0.8",
        "accept-language": "en-CA,en-US;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
      },
      cache: "no-store",
      signal: controller.signal,
    };

    if (dispatcher) init.dispatcher = dispatcher;

    if (costTelemetry && !costTelemetry.canStartRetrievalRequest()) {
      return { url, ok: false, text: "", method: "fetch", error: "Per-scan retrieval ceiling reached." };
    }
    costTelemetry?.recordRetrievalRequest(/(?:bing\.com\/search|duckduckgo\.com\/html)/i.test(url) ? "search" : "other");
    const response = await fetch(url, init);
    const text = await response.text().catch(() => "");

    return {
      url,
      ok: response.ok && text.trim().length > 0,
      text,
      status: response.status,
      finalUrl: response.url || url,
      method: "fetch",
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
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
      quoted || exact,
      `${quoted || exact} reviews`,
      `${quoted || exact} Amazon.ca reviews`,
      `${quoted || exact} Walmart reviews`,
      `${quoted || exact} Reddit`,
      `${quoted || exact} YouTube review`,
      `${quoted || exact} complaints`,
      brandModel ? `${brandModel} reviews` : "",
      store ? `${quoted || exact} ${store} reviews` : "",
      `${quoted || exact} verified purchase`,
      `${quoted || exact} pros cons`,
      `${quoted || exact} worth it`,
      `${quoted || exact} problems`,
      input.listingUrl ? `${brandModel || exact} ${input.listingUrl} reviews` : "",
    ],
    14
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
    brand: input.brand, model: input.model, store: input.store,
  }, { url: link.url, title: link.label }).canCollectReviews;
}

function reviewKey(review: CollectedReview) {
  return cleanText(review.body).toLowerCase().replace(/[^a-z0-9]+/g, " ");
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

function candidateLinksFromInput(input: NativeReviewRetrievalInput): SourceLink[] {
  const links: SourceLink[] = [];
  const listingUrl = normalizeHttpUrl(input.listingUrl || "");

  if (listingUrl) {
    links.push({
      label: cleanText(input.productTitle) || "Exact product listing",
      url: listingUrl,
      domain: domainForUrl(listingUrl),
    });
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
  const maxDurationMs = envNumber("REVIEWINTEL_NATIVE_MAX_DURATION_MS", 180000, 1000, 300000);
  const withinDuration = () => Date.now() - startedAt < maxDurationMs;
  const maxQueries = Math.max(1, Math.min(input.maxQueries || envNumber("REVIEWINTEL_MAX_REVIEW_QUERIES", 8, 1, 12), 12));
  const maxPages = Math.max(1, Math.min(input.maxPages || envNumber("REVIEWINTEL_MAX_REVIEW_PAGES", 24, 1, 48), 48));
  const maxSnippets = Math.max(5, Math.min(input.maxSnippets || envNumber("REVIEWINTEL_MAX_RAW_REVIEW_RECORDS", 240, 5, 500), 500));
  const delayMs =
    typeof input.politeDelayMs === "number"
      ? Math.max(0, Math.min(input.politeDelayMs, 2000))
      : envNumber("REVIEWINTEL_RETRIEVAL_DELAY_MS", 250, 0, 2000);

  const queries = buildNativeReviewSearchQueries(input).slice(0, maxQueries);
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
  const failedFetchUrls: string[] = [];
  let rejectedCandidates = 0;
  let blockedProductPages = 0;
  let playwrightPageAttempts = 0;
  const pageResults: Array<{ url: string; status: number | null; error: string | null }> = [];
  const exhaustedPagination = new Set<string>();
  const stagnantPages = new Map<string, number>();
  async function collectPage(link: SourceLink) {
    const pagination = new URL(link.url);
    const paginationKey = `${pagination.origin}${pagination.pathname.replace(/\/$/, "")}`;
    if (pagination.searchParams.has("pageNumber") && exhaustedPagination.has(paginationKey)) return;
    if (!withinDuration() || dedupeReviews(reviews, maxSnippets).length >= maxSnippets || attemptedPageUrls.size >= maxPages || attemptedPageUrls.has(link.url)) return;
    attemptedPageUrls.add(link.url);
    sourcesChecked.push(link.url);
    const page = await fetchText(link.url, attemptedSearches + attemptedPageUrls.size, 9000, input.costTelemetry);
    pageResults.push({ url: link.url, status: page.status || null, error: page.error || null });
    captureStage("page", () => ({ sourceUrl: link.url, httpStatus: page.status ?? null, blockedOrChallenged: !page.ok || /captcha|robot check|verify you are human|automated access|access denied/i.test(page.text), page: attemptedPageUrls.size, cursor: new URL(link.url).searchParams.get("pageNumber"), sourceTitle: link.label, records: [] }));
    const restricted = isBlockedOrSignInReviewPage({ requestedUrl: link.url, finalUrl: page.finalUrl, html: page.text }) || page.status === 401 || page.status === 403 || page.status === 429;
    const blocked = !page.ok || restricted;
    captureStage("page", { sourceUrl: link.url, finalUrl: page.finalUrl, httpStatus: page.status ?? null, blockedOrChallenged: blocked, records: [] });
    if (!blocked && nativeSourceMatchesProduct(input, { ...link, url: page.finalUrl || link.url })) {
      normalFetchSuccesses += 1;
      fetchedPageUrls.push(link.url);
      const before = dedupeReviews(reviews, maxSnippets).length;
      reviews.push(...extractReviewsFromText(page.text, page.finalUrl || link.url));
      if (pagination.searchParams.has("pageNumber")) {
        const stagnant = dedupeReviews(reviews, maxSnippets).length === before ? (stagnantPages.get(paginationKey) || 0) + 1 : 0;
        stagnantPages.set(paginationKey, stagnant);
        if (stagnant >= 2) exhaustedPagination.add(paginationKey);
      }
    } else {
      normalFetchFailures += 1;
      // Authentication/challenge restrictions are terminal for this URL,
      // not an invitation to retry through a browser or proxy.
      if (!restricted && !page.ok && (!page.status || page.status >= 500)) failedFetchUrls.push(link.url);
      blockedProductPages += 1;
      if (pagination.searchParams.has("pageNumber") && blocked) exhaustedPagination.add(paginationKey);
    }
    console.log("[ReviewIntel PIPELINE] native-page", JSON.stringify({ url: link.url, status: page.status || "error", rawReviews: reviews.length, attemptedPages: attemptedPageUrls.size, paginationContinued: attemptedPageUrls.size < maxPages && withinDuration() && dedupeReviews(reviews, maxSnippets).length < maxSnippets }));
    await politeDelay(delayMs);
  }
  // Start with the verified listing and its direct review pages before research.
  const eligibleInputLinks = inputLinks.filter((link) => {
    const accepted = nativeSourceMatchesProduct(input, link);
    if (!accepted) rejectedCandidates += 1;
    return accepted;
  });
  for (const link of eligibleInputLinks) await collectPage(link);

  for (const query of queries) {
    for (const provider of providers) {
      if (dedupeReviews(reviews, maxSnippets).length >= maxSnippets || !withinDuration() || attemptedPageUrls.size >= maxPages) break;

      const searchUrl = searchUrlFor(provider, query);
      sourcesChecked.push(`native-search:${provider}:${query}`);
      attemptedSearches += 1;

      const searchPage = await fetchText(searchUrl, attemptedSearches, 8000, input.costTelemetry);
      if (searchPage.ok) {
        normalFetchSuccesses += 1;
        searchLinks.push(...extractSearchResultLinks(searchPage.text, provider));
        console.log("[ReviewIntel PIPELINE] retrieval", JSON.stringify({ layer: "native-search", provider, url: searchUrl, page: attemptedSearches, status: searchPage.status || 200, reviewsFound: 0, candidateUrlsDiscovered: searchLinks.length, nextPageDiscovered: true, paginationContinued: true, stopReason: null }));
      } else {
        normalFetchFailures += 1;
        console.log("[ReviewIntel PIPELINE] retrieval", JSON.stringify({ layer: "native-search", provider, url: searchUrl, page: attemptedSearches, status: searchPage.status || "error", reviewsFound: 0, nextPageDiscovered: true, paginationContinued: true, stopReason: "search page unavailable; continued" }));
      }

      await politeDelay(delayMs);
    }
  }

  const eligibleSearchLinks = searchLinks.filter((link) => {
    const accepted = nativeSourceMatchesProduct(input, link);
    if (!accepted) rejectedCandidates += 1;
    return accepted;
  });
  const candidateLinks = prioritizeLinks(eligibleInputLinks, eligibleSearchLinks, maxPages);
  for (const link of candidateLinks) await collectPage(link);

  const playwrightUrls = failedFetchUrls.slice(0, Math.min(4, maxPages));
  let playwrightAttempted = false;

  if (playwrightUrls.length > 0 && reviews.length < maxSnippets) {
    playwrightAttempted = true;

    for (const [index, url] of playwrightUrls.entries()) {
      if (!withinDuration()) break;
      if (dedupeReviews(reviews, maxSnippets).length >= maxSnippets || !withinDuration() || attemptedPageUrls.size >= maxPages) break;

      playwrightPageAttempts += 1;
      const page = await fetchTextWithPlaywright(url, index + attemptedSearches + candidateLinks.length + 1, 12000, input.costTelemetry);
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
      : dedupedReviews.length === 0 && pagesBlocked >= attemptedPages && attemptedPages > 0
        ? "access_restricted"
        : "candidate_pages_exhausted";
  console.log("[ReviewIntel PIPELINE] retrieval-summary", JSON.stringify({ layer: "native-review-retrieval", rawReviewsDiscovered: reviews.length, dedupedReviews: dedupedReviews.length, pagesFetched: fetchedPageUrls.length, sourcesUsed: uniqueStrings(dedupedReviews.map((review) => review.sourceUrl || review.source), 80), stopReason: dedupedReviews.length >= maxSnippets ? "configured corpus cap reached" : "candidate searches/pages exhausted or access restricted" }));
  const normalFetchAttempted = attemptedSearches + attemptedPages > 0;
  const normalFetchFailed = normalFetchAttempted && normalFetchSuccesses <= 0;
  const playwrightFailed = playwrightAttempted && playwrightSuccesses <= 0;
  const coverageNote = dedupedReviews.length
    ? `Native retrieval collected ${dedupedReviews.length} review-like snippets from public search/pages without an external fallback scraper.`
    : `Native retrieval checked ${uniqueSourcesChecked.length} search/page sources but did not extract usable review-like snippets.`;

  return {
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
