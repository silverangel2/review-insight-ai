import { retrieveProductUrls } from "./productUrlRetrieval";
type ExactProductSearchInput = {
  productName: string;
  brand?: string;
  store?: string;
  price?: number;
  rating?: number | null;
  reviewCount?: number | null;
  searchQueries?: string[];
  maxCandidates?: number;
  timeoutMs?: number;
  appendProductQuery?: boolean;
  searchRoundLabel?: string;
};

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

export type ExactProductSearchResult = {
  exactListingUrl: string | null;
  exactListingTitle: string | null;
  store: string | null;
  price: number | null;
  rating: number | null;
  reviewCount: number | null;
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

function uniqueIdentityTokens(values: unknown[], limit = 36) {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const value of values) {
    const words = String(value || "")
      .replace(/https?:\/\/[^\s]+/g, " ")
      .replace(/[^a-z0-9.%+-]+/gi, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    for (const word of words) {
      const key = word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push(word);
      if (tokens.length >= limit) return tokens.join(" ");
    }
  }

  return tokens.join(" ").replace(/\s+/g, " ").trim();
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
    if (!key || key === "s") continue;
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

async function fetchAmazonSearchCandidates(query: string, maxCandidates = 4, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const searchUrl = amazonSearchUrlForQuery(query);
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
    const hrefPattern = /href="([^"]*\/(?:dp|gp\/product)\/([A-Z0-9]{10})[^"]*)"/gi;
    let match: RegExpExecArray | null;

    while ((match = hrefPattern.exec(html)) && candidates.length < maxCandidates) {
      const asin = match[2];
      if (!asin || seen.has(asin)) continue;
      seen.add(asin);

      const title = amazonTitleFromHtmlAround(html, match.index) || `Amazon.ca product ${asin}`;

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


function decodeSearchRedirectUrl(url: string) {
  try {
    const parsed = new URL(url);
    const target = parsed.searchParams.get("u") || parsed.searchParams.get("url");
    return target && /^https?:\/\//i.test(target) ? target : url;
  } catch {
    return url;
  }
}

function isLikelyProductUrl(url: string) {
  const lower = url.toLowerCase();
  return (
    /^https?:\/\//i.test(url) &&
    (
      /amazon\.ca\/(?:.*\/)?(?:dp|gp\/product)\/[a-z0-9]{10}/i.test(lower) ||
      /walmart\.(?:ca|com)\/.*(?:ip|product)/i.test(lower) ||
      /bestbuy\.ca\/.*\/product/i.test(lower) ||
      /costco\.ca\/.*\.product\./i.test(lower)
    )
  );
}

function normalizeProductCandidateUrl(url: string) {
  const decoded = decodeSearchRedirectUrl(url).replace(/&amp;/g, "&");

  const amazon = decoded.match(/https?:\/\/(?:www\.)?amazon\.ca\/(?:[^"'<> ]*\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  if (amazon?.[1]) return `https://www.amazon.ca/dp/${amazon[1].toUpperCase()}`;

  return decoded.split("#")[0];
}

function titleNearUrl(html: string, index: number) {
  const chunk = html.slice(Math.max(0, index - 900), Math.min(html.length, index + 1200));
  const h2 = chunk.match(/<h2[^>]*>([\s\S]{8,500}?)<\/h2>/i)?.[1];
  const title = h2
    ? h2.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
    : null;
  return title || null;
}

async function fetchFastProductUrlCandidates(queries: string[], maxCandidates = 5, timeoutMs = 4500) {
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

        const hrefPattern = /href="([^"]+)"/gi;
        let match: RegExpExecArray | null;

        while ((match = hrefPattern.exec(html)) && out.length < maxCandidates) {
          const rawUrl = match[1];
          const url = normalizeProductCandidateUrl(rawUrl);

          if (!isLikelyProductUrl(url)) continue;

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

  const product = uniqueIdentityTokens([
    input.store,
    input.brand,
    input.productName,
    input.price ? `$${input.price}` : "",
    input.rating ? `${input.rating} rating` : "",
    input.reviewCount ? `${input.reviewCount} reviews` : "",
  ], 36);

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
    productName: input.productName,
    productKey: product,
    rating: input.rating,
    reviewCount: input.reviewCount,
    maxCandidates,
    timeoutMs: 8500,
  }).catch(() => null);

  if (retrievalFirst?.candidates?.length) {
    console.log("[ReviewIntel DEBUG productUrlRetrieval]", {
      queries: retrievalFirst.queries,
      elapsedMs: retrievalFirst.elapsedMs,
      timedOut: retrievalFirst.timedOut,
      candidateCount: retrievalFirst.candidates.length,
      candidateUrls: retrievalFirst.candidates.map((candidate) => candidate.url),
      candidateSources: retrievalFirst.candidates.map((candidate) => candidate.source),
    });

    return {
      candidates: retrievalFirst.candidates.map((candidate) => ({
        url: candidate.url,
        title: candidate.title,
        domain: candidate.domain,
        store: candidate.domain,
        price: null,
        rating: "rating" in candidate ? candidate.rating ?? null : null,
        reviewCount: "reviewCount" in candidate ? candidate.reviewCount ?? null : null,
        source: candidate.source,
        notes: candidate.notes,
      })),
      queries: retrievalFirst.queries,
      sourcesChecked: retrievalFirst.candidates.map((candidate) => candidate.url),
      sourceLinks: retrievalFirst.candidates.map((candidate) => ({
        label: candidate.title,
        url: candidate.url,
        domain: candidate.domain,
      })),
      notes: [
        `Retrieved ${retrievalFirst.candidates.length} real product URL candidate(s) from native product URL retrieval.`,
      ],
      elapsedMs: retrievalFirst.elapsedMs,
      timedOut: retrievalFirst.timedOut,
      attemptCount: 1,
    };
  }



  const fastInitialCandidates = await fetchFastProductUrlCandidates(searchQueries, maxCandidates, 4500).catch(() => []);
  if (fastInitialCandidates.length > 0) {
    return {
      candidates: fastInitialCandidates,
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
      ? await fetchAmazonSearchCandidates(searchQueries[0], maxCandidates)
      : [];

  if (amazonFallbackCandidates.length > 0) {
    return {
      candidates: amazonFallbackCandidates,
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
    .replace(/\bup\s+5000mah\b/gi, "5000mAh")
    .replace(/\bup\s+gray\b/gi, "Gray")
    .replace(/\s+/g, " ")
    .trim();

  const seen = new Set<string>();
  const words: string[] = [];

  for (const word of raw.split(/\s+/).filter(Boolean)) {
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
