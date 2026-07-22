import type { CollectedReview } from "@/lib/reviewCollector";

type SourceLink = { label: string; url: string; domain?: string };

export type NativeReviewRetrievalInput = {
  productTitle: string;
  brand?: string | null;
  model?: string | null;
  store?: string | null;
  listingUrl?: string | null;
  sourceLinks?: Array<{ label?: string | null; url?: string | null; domain?: string | null }> | null;
  maxQueries?: number;
  maxPages?: number;
  maxSnippets?: number;
  politeDelayMs?: number;
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
  diagnostics: {
    searchProviders: string[];
    attemptedSearches: number;
    attemptedPages: number;
    normalFetchSuccesses: number;
    normalFetchFailures: number;
    playwrightSuccesses: number;
    playwrightFailures: number;
  };
};

type FetchInitWithDispatcher = RequestInit & { dispatcher?: unknown };
type PageFetchResult = {
  url: string;
  ok: boolean;
  text: string;
  status?: number;
  method: "fetch" | "playwright";
  error?: string;
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
];

const REVIEWISH_PATTERNS = [
  /\bverified purchase\b/i,
  /\bcustomer reviews?\b/i,
  /\breviewed\b/i,
  /\b(?:\d(?:\.\d)?)\s*(?:out of|\/)\s*5\b/i,
  /\b[1-5]\s*stars?\b/i,
  /\bpros?\b/i,
  /\bcons?\b/i,
  /\bcomplaints?\b/i,
  /\bworth it\b/i,
  /\bbroke|broken|defective|returned|returning\b/i,
  /\bquality|durable|comfortable|battery|fit|size|taste|smell|sound|charge|delivery|packaging|material\b/i,
  /\breddit|youtube|forum|buyer|purchased|bought|used\b/i,
];

const BOILERPLATE_PATTERNS = [
  /\bprivacy policy\b/i,
  /\bterms of use\b/i,
  /\bcookie policy\b/i,
  /\ball rights reserved\b/i,
  /\bsubscribe\b/i,
  /\bsponsored\b/i,
  /\badvertisement\b/i,
  /\badd to cart\b/i,
  /\bselect a store\b/i,
  /\bskip to main content\b/i,
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

    return parsed.toString();
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

async function fetchText(url: string, index: number, timeoutMs = 9000): Promise<PageFetchResult> {
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

    const response = await fetch(url, init);
    const text = await response.text().catch(() => "");

    return {
      url,
      ok: response.ok && text.trim().length > 0,
      text,
      status: response.status,
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

async function fetchTextWithPlaywright(url: string, index: number, timeoutMs = 12000): Promise<PageFetchResult> {
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
  const title = cleanText(input.productTitle).slice(0, 220);
  const brand = cleanText(input.brand).slice(0, 80);
  const model = cleanText(input.model).slice(0, 80);
  const store = cleanText(input.store).slice(0, 80);

  const exactTitle = uniqueStrings([brand, title, model], 3).join(" ").replace(/\s+/g, " ").trim();

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
      input.listingUrl ? `${input.listingUrl} reviews` : "",
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

function isLikelyReviewSnippet(text: string) {
  const cleaned = cleanText(text);
  if (cleaned.length < 35 || cleaned.length > 1200) return false;
  if (BOILERPLATE_PATTERNS.some((pattern) => pattern.test(cleaned))) return false;
  return REVIEWISH_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function ratingFromText(text: string): number | null {
  const match =
    text.match(/\b([1-5](?:\.\d)?)\s*(?:out of|\/)\s*5\b/i) ||
    text.match(/\b([1-5](?:\.\d)?)\s*stars?\b/i);
  if (!match?.[1]) return null;
  const rating = Number(match[1]);
  return Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null;
}

function sourceLabelFor(url: string, fallback: string) {
  const domain = domainForUrl(url);
  if (!domain) return fallback;
  if (domain.includes("reddit.com")) return "Reddit buyer comment";
  if (domain.includes("youtube.com") || domain.includes("youtu.be")) return "YouTube review text";
  if (domain.includes("amazon.")) return "Amazon public review evidence";
  if (domain.includes("walmart.")) return "Walmart public review evidence";
  return domain;
}

function reviewFromSnippet(snippet: string, sourceUrl: string | undefined, source: string): CollectedReview | null {
  const body = cleanText(snippet).slice(0, 1200);
  if (!isLikelyReviewSnippet(body)) return null;

  return {
    source,
    sourceUrl,
    rating: ratingFromText(body),
    body,
    date: null,
    verified: /\bverified purchase\b/i.test(body) ? true : null,
  };
}

function extractSearchSnippets(html: string, provider: string, query: string): CollectedReview[] {
  const decoded = htmlDecodeLight(html);
  const reviews: CollectedReview[] = [];
  const blocks =
    provider === "duckduckgo"
      ? decoded.match(/<div[^>]+class=["'][^"']*result[^"']*["'][\s\S]*?(?=<div[^>]+class=["'][^"']*result|$)/gi) || []
      : decoded.match(/<li[^>]+class=["'][^"']*\bb_algo\b[^"']*["'][\s\S]*?<\/li>/gi) || [];

  for (const block of blocks) {
    const titleMatch =
      block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) ||
      block.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) ||
      block.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch =
      block.match(/<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) ||
      block.match(/<div[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
      block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const urlMatch = block.match(/<a[^>]+href=["']([^"']+)["']/i);
    const sourceUrl = normalizeHttpUrl(urlMatch?.[1], provider === "duckduckgo" ? "https://duckduckgo.com/" : undefined) || undefined;
    const body = [titleMatch ? cleanText(titleMatch[1]) : "", snippetMatch ? cleanText(snippetMatch[1]) : ""]
      .filter(Boolean)
      .join(" - ");
    const review = reviewFromSnippet(body, sourceUrl, `Native search snippet: ${query.slice(0, 80)}`);
    if (review) reviews.push(review);
  }

  return dedupeReviews(reviews, 20);
}

function extractJsonReviewFields(text: string, sourceUrl: string): CollectedReview[] {
  const reviews: CollectedReview[] = [];
  const decoded = htmlDecodeLight(text);
  const patterns = [
    /"reviewText"\s*:\s*"((?:\\.|[^"\\]){25,1400})"/gi,
    /"reviewBody"\s*:\s*"((?:\\.|[^"\\]){25,1400})"/gi,
    /"customerReviewText"\s*:\s*"((?:\\.|[^"\\]){25,1400})"/gi,
    /"comment"\s*:\s*"((?:\\.|[^"\\]){35,1400})"/gi,
    /"text"\s*:\s*"((?:\\.|[^"\\]){35,1400})"\s*,\s*"(?:rating|stars|score)"/gi,
  ];

  for (const pattern of patterns) {
    for (const match of decoded.matchAll(pattern)) {
      const review = reviewFromSnippet(match[1], sourceUrl, sourceLabelFor(sourceUrl, "Embedded review data"));
      if (review) reviews.push(review);
    }
  }

  const jsonLdBlocks = decoded.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdBlocks) {
    const block = htmlDecodeLight(match[1] || "");
    const bodyMatches = block.matchAll(/"reviewBody"\s*:\s*"((?:\\.|[^"\\]){25,1400})"/gi);
    for (const bodyMatch of bodyMatches) {
      const review = reviewFromSnippet(bodyMatch[1], sourceUrl, "Structured product review data");
      if (review) reviews.push(review);
    }
  }

  return dedupeReviews(reviews, 40);
}

function extractParagraphReviewSnippets(text: string, sourceUrl: string): CollectedReview[] {
  const decoded = htmlDecodeLight(text)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|section|article|h[1-6])>/gi, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const plain = decoded.replace(/<[^>]*>/g, " ");
  const chunks = plain
    .split(/\n+|(?<=\.)\s+(?=[A-Z0-9])/)
    .map((chunk) => cleanText(chunk))
    .filter((chunk) => chunk.length >= 45 && chunk.length <= 1000);

  const source = sourceLabelFor(sourceUrl, "Public review page");
  const reviews: CollectedReview[] = [];

  for (const chunk of chunks) {
    const review = reviewFromSnippet(chunk, sourceUrl, source);
    if (review) reviews.push(review);
  }

  return dedupeReviews(reviews, 40);
}

function extractReviewsFromText(text: string, sourceUrl: string): CollectedReview[] {
  return dedupeReviews(
    [
      ...extractJsonReviewFields(text, sourceUrl),
      ...extractParagraphReviewSnippets(text, sourceUrl),
    ],
    60
  );
}

function reviewKey(review: CollectedReview) {
  return cleanText(review.body).toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 200);
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
      body: body.slice(0, 1200),
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
  const maxQueries = Math.max(1, Math.min(input.maxQueries || 8, 12));
  const maxPages = Math.max(1, Math.min(input.maxPages || 12, 24));
  const maxSnippets = Math.max(5, Math.min(input.maxSnippets || 80, 120));
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

  for (const query of queries) {
    for (const provider of providers) {
      if (reviews.length >= maxSnippets) break;

      const searchUrl = searchUrlFor(provider, query);
      sourcesChecked.push(`native-search:${provider}:${query}`);
      attemptedSearches += 1;

      const searchPage = await fetchText(searchUrl, attemptedSearches, 8000);
      if (searchPage.ok) {
        normalFetchSuccesses += 1;
        reviews.push(...extractSearchSnippets(searchPage.text, provider, query));
        searchLinks.push(...extractSearchResultLinks(searchPage.text, provider));
      } else {
        normalFetchFailures += 1;
      }

      await politeDelay(delayMs);
    }
  }

  const candidateLinks = prioritizeLinks(inputLinks, searchLinks, maxPages);
  const failedFetchUrls: string[] = [];

  for (const [index, link] of candidateLinks.entries()) {
    if (reviews.length >= maxSnippets) break;

    sourcesChecked.push(link.url);
    const page = await fetchText(link.url, index + attemptedSearches + 1);

    if (page.ok) {
      normalFetchSuccesses += 1;
      reviews.push(...extractReviewsFromText(page.text, link.url));
    } else {
      normalFetchFailures += 1;
      failedFetchUrls.push(link.url);
    }

    await politeDelay(delayMs);
  }

  const playwrightUrls = failedFetchUrls.slice(0, Math.min(4, maxPages));
  let playwrightAttempted = false;

  if (playwrightUrls.length > 0 && reviews.length < maxSnippets) {
    playwrightAttempted = true;

    for (const [index, url] of playwrightUrls.entries()) {
      if (reviews.length >= maxSnippets) break;

      const page = await fetchTextWithPlaywright(url, index + attemptedSearches + candidateLinks.length + 1);

      if (page.ok) {
        playwrightSuccesses += 1;
        reviews.push(...extractReviewsFromText(page.text, url));
      } else {
        playwrightFailures += 1;
      }

      await politeDelay(delayMs);
    }
  }

  const dedupedReviews = dedupeReviews(reviews, maxSnippets);
  const allSourceLinks = dedupeSourceLinks([...inputLinks, ...candidateLinks, ...searchLinks]).slice(0, 24);
  const uniqueSourcesChecked = uniqueStrings(sourcesChecked, 80);
  const attemptedPages = candidateLinks.length;
  const normalFetchAttempted = attemptedSearches + attemptedPages > 0;
  const normalFetchFailed = normalFetchAttempted && normalFetchSuccesses <= 0;
  const playwrightFailed = playwrightAttempted && playwrightSuccesses <= 0;
  const coverageNote = dedupedReviews.length
    ? `Native retrieval collected ${dedupedReviews.length} review-like snippets from public search/pages before any Firecrawl fallback.`
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
      searchProviders: providers,
      attemptedSearches,
      attemptedPages,
      normalFetchSuccesses,
      normalFetchFailures,
      playwrightSuccesses,
      playwrightFailures,
    },
  };
}
