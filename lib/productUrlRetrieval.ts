import { stableProductSearchTerms } from "./productIdentityTokens";
import { isBlockedOrSignInReviewPage } from "./reviewCollector";

export type RetrievedProductUrl = {
  url: string;
  title: string;
  domain: string;
  source: "openai-web-search" | "bing-html" | "amazon-direct" | "manual-pattern";
  query: string;
  notes: string[];
  identityFetched?: boolean;
  enrichmentAttempted?: boolean;
  enrichmentSucceeded?: boolean;
  brand?: string | null;
  model?: string | null;
};

export type ProductUrlRetrievalInput = {
  store?: string | null;
  brand?: string | null;
  productName?: string | null;
  productKey?: string | null;
  model?: string | null;
  rating?: string | number | null;
  reviewCount?: string | number | null;
  maxCandidates?: number;
  timeoutMs?: number;
  enrichmentAttemptedUrls?: Set<string>;
  costTelemetry?: ScanCostTelemetry;
  searchQueries?: string[];
};

function cleanText(value: unknown) {
  return String(value || "")
    .replace(/amazon'?s choice/gi, " ")
    .replace(/\bAmazon\s+s\b/gi, "Amazon")
    .replace(/\bcolor\s+Amazon\b/gi, "Amazon")
    .replace(/\bAmazon\s+Amazon\.ca\b/gi, "Amazon.ca")
    .replace(/\bAmazon\.ca\s+Amazon\.ca\b/gi, "Amazon.ca")
    .replace(/[^a-z0-9.%+"'/: -]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeWords(value: string) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const word of cleanText(value).match(/"[^"]+"|site:\S+|\S+/g) || []) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
  }

  return out.join(" ").trim();
}

function hostForUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    const normalized = cleanText(url).toLowerCase().replace(/^www\./, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized) ? normalized : "";
  }
}

export function normalizeProductUrl(url: string) {
  let decoded = url.replace(/&amp;/g, "&");
  for (let depth = 0; depth < 2; depth += 1) {
    try {
      const parsed = new URL(decoded);
      if (!/(?:^|\.)(?:bing\.com|google\.[a-z.]+|duckduckgo\.com)$/i.test(parsed.hostname)) break;
      const target = ["u", "url", "uddg", "dest", "destination", "target", "q"]
        .map((key) => parsed.searchParams.get(key))
        .map((value) => {
          if (value && /(?:^|\.)bing\.com$/i.test(parsed.hostname) && /^a1/.test(value)) {
            try { return Buffer.from(value.slice(2), "base64url").toString("utf8"); } catch { return null; }
          }
          return value;
        })
        .find((value) => value && /^https?:\/\//i.test(value));
      if (!target || target === decoded) break;
      decoded = target;
    } catch {
      break;
    }
  }

  try {
    const parsed = new URL(decoded);
    if (/^(?:www\.)?amazon\.[a-z.]+$/i.test(parsed.hostname)) {
      const asin = parsed.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|product-reviews)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1];
      if (asin) return `${parsed.origin}/dp/${asin.toUpperCase()}`;
    }
    // Tracking/search params do not change product identity. Strip them so
    // legitimate product pages with tracking params (e.g., ?q=track) are not
    // discarded before verification. Search-shaped PATHS are still rejected
    // by the candidate gate below.
    let stripped = false;
    for (const key of ["q", "k", "keyword", "search"]) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.delete(key);
        stripped = true;
      }
    }
    if (stripped) decoded = parsed.toString();
  } catch { /* An invalid URL is rejected by the candidate gate. */ }

  return decoded.split("#")[0].replace(/[)\].,;]+$/g, "");
}

export function isProductUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    const path = decodeURIComponent(parsed.pathname).toLowerCase();
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.port) return false;
    if (!host.includes(".") || /^(?:localhost|.*\.localhost|.*\.local|.*\.internal|\[.*\]|\d+(?:\.\d+){3})$/i.test(host)) return false;

    // Search engines, social networks, communities, and generic discovery
    // pages must never become exact-product candidates.
    const blockedHosts = [
      "google.com",
      "bing.com",
      "yahoo.com",
      "duckduckgo.com",
      "facebook.com",
      "instagram.com",
      "tiktok.com",
      "youtube.com",
      "reddit.com",
      "x.com",
      "twitter.com",
      "pinterest.com",
    ];

    if (
      blockedHosts.some(
        (blocked) =>
          host === blocked ||
          host.endsWith(`.${blocked}`),
      )
    ) {
      return false;
    }

    if (
      /\/(?:s|search|search-results?|category|categories|collections?|blog|news|signin|login|ap\/signin|ax\/claim)(?:\/|$)/i.test(
        path,
      )
    ) {
      return false;
    }
    // Manufacturer and retailer product-page shapes may proceed to the
    // existing exact-product verifier. Passing this gate does NOT make
    // the page trusted evidence or prove exact identity.
    // Note: q/k/keyword/search PARAMS are stripped during URL normalization,
    // so only search-shaped PATHS are rejected here.
    return (
      /\/products?\/[^/?#]+/i.test(path) ||
      /\/product[-_/][^/?#]+/i.test(path) ||
      /\/p\/[^/?#]+/i.test(path) ||
      /\/item\/[^/?#]+/i.test(path) ||
      /\/c-p\/[^/?#]+/i.test(path) ||
      /\/dp\/[^/?#]+/i.test(path) ||
      /\/(?:gp\/product|gp\/aw\/d|product-reviews)\/[a-z0-9]{10}(?:\/|$)/i.test(path) ||
      /\.product\.[^/?#]+/i.test(path) ||
      /\/ip\/[^/?#]+/i.test(path) ||
      /\/site\/[^/?#]+\/[^/?#]+\.p$/i.test(path) ||
      /\/p\/[^/?#]+\/-\/A-\d+/i.test(path) ||
      /\/pd\/[^/?#]+\/\d+/i.test(path) ||
      // Manufacturer deep product-page conventions (e.g., samsung.com/us/
      // smartphones/galaxy-s24-ultra/, sony.com/electronics/...). Requires a
      // known product-category segment followed by a specific product slug,
      // so bare category listing pages do not pass. The verifier remains the
      // backstop for exact identity.
      /\/[a-z]{2}\/(?:smartphones?|mobile|tvs?|television|refrigerators?|appliances?|electronics?|computers?|laptops?|tablets?|headphones?|earbuds?|speakers?|cameras?|watches?)\/[^/?#]+\/?$/i.test(path) ||
      /\/(?:electronics?|appliances?)\/[^/?#]+\/[^/?#]+\/?$/i.test(path)
    );
  } catch {
    return false;
  }
}

function titleNear(html: string, index: number) {
  const chunk = html.slice(Math.max(0, index - 1200), Math.min(html.length, index + 1800));
  const h2 = chunk.match(/<h2[^>]*>([\s\S]{8,600}?)<\/h2>/i)?.[1];
  const title = h2
    ? h2.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
    : null;

  return title || null;
}

export function buildRetrievalQueries(input: ProductUrlRetrievalInput) {
  const store = cleanText(input.store || "Amazon.ca");
  const terms = stableProductSearchTerms(input);
  const brand = terms.roles.primaryBrand || terms.brands[0] || "";
  const parent = terms.roles.manufacturerOrParent && terms.roles.manufacturerOrParent !== brand
    ? terms.roles.manufacturerOrParent
    : "";
  const family = cleanText(terms.family);
  const modelTerms = terms.models.join(" ");
  const stableIdentity = dedupeWords([brand, parent, modelTerms, family].filter(Boolean).join(" "));
  const host = hostForUrl(store) || "amazon.ca";
  const queries = modelTerms
    ? [
        `site:${host} "${brand}" "${modelTerms}" "${family || modelTerms}"`,
        `site:${host} "${brand}" "${modelTerms}" "${family || "product"}"`,
        `"${brand} ${modelTerms} ${family || "product"}" ${store}`,
        `${parent} ${brand} ${modelTerms} ${family} ${store}`,
      ]
    : [
        `site:${host} "${brand}" ${terms.roles.capacityOrSize.map((size) => `"${size}"`).join(" ")} "${family}"`,
        `site:${host} "${brand}" "${family}"`,
        `"${stableIdentity}" ${store}`,
        `${brand} ${family} ${store}`,
      ];

  return Array.from(new Set(queries.map(dedupeWords).filter((q) => q.length > 8))).slice(0, 5);
}

async function fetchBingCandidates(query: string, timeoutMs: number, costTelemetry?: ScanCostTelemetry): Promise<RetrievedProductUrl[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    if (costTelemetry && !costTelemetry.reserveIdentitySearchUrl(searchUrl)) return [];
    costTelemetry?.recordIdentitySearchRequest("search");
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-CA,en;q=0.9",
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const out: RetrievedProductUrl[] = [];
    const hrefPattern = /href\s*=\s*(["'])(.*?)\1/gi;
    let match: RegExpExecArray | null;

    while ((match = hrefPattern.exec(html)) && out.length < 5) {
      const url = normalizeProductUrl(match[2]);
      if (!isProductUrl(url)) continue;

      const domain = hostForUrl(url);
      out.push({
        url,
        title: titleNear(html, match.index) || url,
        domain,
        source: "bing-html",
        query,
        notes: [`Parsed product URL from Bing HTML.`],
      });
    }

    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAmazonCandidates(query: string, timeoutMs: number, costTelemetry?: ScanCostTelemetry): Promise<RetrievedProductUrl[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const q = cleanText(query).replace(/\bAmazon\.ca\b/gi, "").replace(/\bAmazon\b/gi, "").trim();

    const searchUrl = `https://www.amazon.ca/s?k=${encodeURIComponent(q)}`;
    if (costTelemetry && !costTelemetry.reserveIdentitySearchUrl(searchUrl)) return [];
    costTelemetry?.recordIdentitySearchRequest("search");
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-CA,en;q=0.9",
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const out: RetrievedProductUrl[] = [];
    const hrefPattern = /href\s*=\s*(["'])([^"']*\/(?:dp|gp\/product|gp\/aw\/d|product-reviews)\/([A-Z0-9]{10})[^"']*)\1/gi;
    let match: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((match = hrefPattern.exec(html)) && out.length < 5) {
      const asin = match[3]?.toUpperCase();
      if (!asin || seen.has(asin)) continue;
      seen.add(asin);

      const url = `https://www.amazon.ca/dp/${asin}`;

      out.push({
        url,
        title: titleNear(html, match.index) || `Amazon.ca product ${asin}`,
        domain: "amazon.ca",
        source: "amazon-direct",
        query,
        notes: [`Parsed Amazon.ca ASIN from direct Amazon search.`],
      });
    }

    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function htmlDecodeLight(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractProductEvidenceFromHtml(html: string, baseUrl?: string) {
  const title =
    html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]{5,500}?)<\/span>/i)?.[1] ||
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{5,500})["']/i)?.[1] ||
    html.match(/<title[^>]*>([\s\S]{5,500}?)<\/title>/i)?.[1] ||
    null;

  const cleanTitle = title
    ? htmlDecodeLight(title.replace(/<[^>]+>/g, " ").replace(/\s*:\s*Amazon\.ca.*$/i, ""))
    : null;
  const usableTitle = cleanTitle && !/^(?:Amazon(?:\.[a-z]{2,})?|Amazon(?:\.[a-z]{2,})? product\s+[A-Z0-9]{10})$/i.test(cleanTitle)
    ? cleanTitle
    : null;

  const ratingText =
    html.match(/([0-5](?:\.\d)?)\s+out of\s+5\s+stars/i)?.[1] ||
    html.match(/"ratingValue"\s*:\s*"?([0-5](?:\.\d)?)"?/i)?.[1] ||
    null;

  const reviewText =
    html.match(/([\d,]+)\s+(?:ratings?|reviews?)/i)?.[1] ||
    html.match(/"reviewCount"\s*:\s*"?([\d,]+)"?/i)?.[1] ||
    null;

  const rating = ratingText ? Number(ratingText) : null;
  const reviewCount = reviewText ? Number(reviewText.replace(/,/g, "")) : null;

  const products: Record<string, unknown>[] = [];
  const visit = (node: unknown, depth = 0) => {
    if (!node || typeof node !== "object" || depth > 12) return;
    if (Array.isArray(node)) { node.forEach((value) => visit(value, depth + 1)); return; }
    const record = node as Record<string, unknown>;
    const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
    if (types.some((value) => String(value).toLowerCase() === "product")) products.push(record);
    for (const [key, value] of Object.entries(record)) {
      if (key !== "review" && key !== "itemReviewed") visit(value, depth + 1);
    }
  };
  for (const block of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(block[1])); } catch { /* Malformed JSON is not identity evidence. */ }
  }
  const product = (() => {
    if (!usableTitle) return products.length === 1 ? products[0] : undefined;
    const titleLower = usableTitle.toLowerCase();
    const matches = products.filter(
      (item) => typeof item.name === "string" && titleLower.includes((item.name as string).toLowerCase())
    );
    // Prefer the most specific (longest) product name contained in the title,
    // so "RingConn Gen 2 Air" wins over "RingConn Gen 2" when a page lists
    // multiple Product nodes (e.g., variant/recommended products).
    matches.sort((a, b) => String(b.name).length - String(a.name).length);
    return matches[0] || (products.length === 1 ? products[0] : undefined);
  })();
  const structuredBrand = product?.brand;
  const brand = (typeof structuredBrand === "string" ? structuredBrand
    : structuredBrand && typeof structuredBrand === "object" ? (structuredBrand as Record<string, unknown>).name : null) ||
    html.match(/<th[^>]*>\s*Brand\s*<\/th>[\s\S]{0,500}?<td[^>]*>\s*([^<]+)/i)?.[1] ||
    null;
  const model = (typeof product?.model === "string" ? product.model : null) ||
    html.match(/<th[^>]*>\s*(?:Model|Item model number)\s*<\/th>[\s\S]{0,500}?<td[^>]*>\s*([^<]+)/i)?.[1] ||
    null;

  const canonicalTag = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0] || html.match(/<link\b[^>]*href=["'][^"']+["'][^>]*rel=["']canonical["'][^>]*>/i)?.[0];
  const canonicalRaw = canonicalTag?.match(/href=["']([^"']+)["']/i)?.[1] || html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1] || null;
  let canonicalUrl: string | null = null;
  if (canonicalRaw) {
    try { canonicalUrl = normalizeProductUrl(new URL(htmlDecodeLight(canonicalRaw), baseUrl).toString()); } catch { /* Invalid canonical metadata is not identity evidence. */ }
  }
  return {
    canonicalUrl,
    title: usableTitle || (typeof product?.name === "string" ? htmlDecodeLight(product.name) : null),
    brand: brand ? htmlDecodeLight(String(brand)) : null,
    model: model ? htmlDecodeLight(model) : null,
    rating: Number.isFinite(rating) && rating && rating > 0 ? rating : null,
    reviewCount: Number.isFinite(reviewCount) && reviewCount && reviewCount > 0 ? reviewCount : null,
  };
}

export async function enrichRetrievedProductCandidate(candidate: RetrievedProductUrl, timeoutMs = 2500, costTelemetry?: ScanCostTelemetry): Promise<RetrievedProductUrl & {
  rating?: number | null;
  reviewCount?: number | null;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (!isProductUrl(candidate.url)) return { ...candidate, enrichmentAttempted: true, enrichmentSucceeded: false };
    const urls = [candidate.url];
    const amazon = candidate.url.match(/^(https?:\/\/(?:www\.)?amazon\.[^/]+)\/dp\/([A-Z0-9]{10})/i);
    if (amazon) {
      urls.push(`${amazon[1]}/gp/aw/d/${amazon[2]}`);
      urls.push(`${amazon[1]}/dp/${amazon[2]}?th=1&psc=1`);
    }

    let evidence = { canonicalUrl: null as string | null, title: null as string | null, brand: null as string | null, model: null as string | null, rating: null as number | null, reviewCount: null as number | null };
    for (const url of Array.from(new Set(urls))) {
      if (costTelemetry && !costTelemetry.canStartIdentitySearchRequest()) continue;
      costTelemetry?.recordIdentitySearchRequest("other");
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-CA,en;q=0.9",
        },
      });
      if (!response.ok) {
        if ([401, 403, 429].includes(response.status)) break;
        continue;
      }
      const html = await response.text();
      if (isBlockedOrSignInReviewPage({ requestedUrl: url, finalUrl: response.url, html })) break;
      if (response.url && !isProductUrl(response.url)) break;
      const finalUrl = normalizeProductUrl(response.url || url);
      if (hostForUrl(finalUrl) !== hostForUrl(candidate.url)
        || (amazon && !finalUrl.endsWith(`/dp/${amazon[2]}`))) break;
      evidence = extractProductEvidenceFromHtml(html, response.url || url);
      if (amazon && evidence.canonicalUrl && !evidence.canonicalUrl.endsWith(`/dp/${amazon[2]}`)) {
        evidence.title = null;
        break;
      }
      evidence.canonicalUrl ||= finalUrl;
      if (evidence.title) break;
    }

    if (!evidence.title) return { ...candidate, enrichmentAttempted: true, enrichmentSucceeded: false };

    return {
      ...candidate,
      url: evidence.canonicalUrl && isProductUrl(evidence.canonicalUrl) && hostForUrl(evidence.canonicalUrl) === hostForUrl(candidate.url)
        && (!amazon || evidence.canonicalUrl.endsWith(`/dp/${amazon[2]}`)) ? evidence.canonicalUrl : candidate.url,
      title: evidence.title || candidate.title,
      brand: evidence.brand || candidate.brand || null,
      model: evidence.model || candidate.model || null,
      ...(evidence.rating ? { rating: evidence.rating } : {}),
      ...(evidence.reviewCount ? { reviewCount: evidence.reviewCount } : {}),
      identityFetched: Boolean(evidence.title),
      enrichmentAttempted: true,
      enrichmentSucceeded: Boolean(evidence.title),
      notes: [
        ...candidate.notes,
        evidence.title
          ? "Enriched candidate from product page HTML."
          : "Product page opened but title evidence was limited.",
      ],
    };
  } catch {
    return {
      ...candidate,
      enrichmentAttempted: true,
      enrichmentSucceeded: false,
      notes: [...candidate.notes, "Product page enrichment failed or timed out."],
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function retrieveProductUrls(input: ProductUrlRetrievalInput) {
  const timeoutMs = input.timeoutMs || 9000;
  const maxCandidates = input.maxCandidates || 6;
  const startedAt = Date.now();
  const queries = Array.from(new Set([
    ...(input.searchQueries || []),
    ...buildRetrievalQueries(input),
  ].map(dedupeWords).filter((query) => query.length > 8))).slice(0, 8);

  const perProviderTimeout = Math.max(2500, Math.min(4500, Math.floor(timeoutMs / 2)));

  const searchedQueries = queries.slice(0, 4);
  const tasks = searchedQueries.flatMap((query) => [
    fetchBingCandidates(query, perProviderTimeout, input.costTelemetry),
    fetchAmazonCandidates(query, perProviderTimeout, input.costTelemetry),
  ]);

  const settled = await Promise.allSettled(tasks);
  const candidates = settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  const seen = new Set<string>();
  const identity = stableProductSearchTerms(input);
  const brand = identity.roles.primaryBrand?.toLowerCase();
  const ranked = candidates.sort((a, b) =>
    Number(Boolean(brand && b.title.toLowerCase().includes(brand))) - Number(Boolean(brand && a.title.toLowerCase().includes(brand))) ||
    Number(b.domain === (hostForUrl(input.store || "") || "amazon.ca")) - Number(a.domain === (hostForUrl(input.store || "") || "amazon.ca")));
  const unique = ranked.filter((candidate) => {
    const key = normalizeProductUrl(candidate.url).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    candidate.url = normalizeProductUrl(candidate.url);
    return true;
  }).slice(0, maxCandidates);

  const enriched = await Promise.all(
    unique.map((candidate) => {
      const normalizedUrl = normalizeProductUrl(candidate.url).toLowerCase();
      if (input.enrichmentAttemptedUrls?.has(normalizedUrl)) {
        // A previous round already attempted this URL. Do not assert a
        // succeeded/failed outcome we did not observe in this round; leave
        // the prior enrichment state unknown rather than inventing false.
        return {
          ...candidate,
          enrichmentAttempted: true,
        };
      }
      input.enrichmentAttemptedUrls?.add(normalizedUrl);
      return enrichRetrievedProductCandidate(candidate, 2200, input.costTelemetry);
    })
  );

  return {
    candidates: enriched,
    queries,
    elapsedMs: Date.now() - startedAt,
    timedOut: Date.now() - startedAt >= timeoutMs,
    sourceCount: enriched.length,
  };
}
import type { ScanCostTelemetry } from "@/lib/scanCostTelemetry";
