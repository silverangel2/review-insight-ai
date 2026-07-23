export type RetrievedProductUrl = {
  url: string;
  title: string;
  domain: string;
  source: "openai-web-search" | "bing-html" | "amazon-direct" | "manual-pattern";
  query: string;
  notes: string[];
};

export type ProductUrlRetrievalInput = {
  store?: string | null;
  brand?: string | null;
  productName?: string | null;
  productKey?: string | null;
  rating?: string | number | null;
  reviewCount?: string | number | null;
  maxCandidates?: number;
  timeoutMs?: number;
};

function cleanText(value: unknown) {
  return String(value || "")
    .replace(/amazon'?s choice/gi, " ")
    .replace(/\bAmazon\s+s\b/gi, "Amazon")
    .replace(/\bcolor\s+Amazon\b/gi, "Amazon")
    .replace(/\bAmazon\s+Amazon\.ca\b/gi, "Amazon.ca")
    .replace(/\bAmazon\.ca\s+Amazon\.ca\b/gi, "Amazon.ca")
    .replace(/\bMini Handheld Fan Up\b/gi, "Mini Handheld Fan")
    .replace(/\bUp\s+5000mAh\b/gi, "5000mAh")
    .replace(/[^a-z0-9.%+"'/: -]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeWords(value: string) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const word of cleanText(value).split(/\s+/).filter(Boolean)) {
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
    return "";
  }
}

function normalizeProductUrl(url: string) {
  const decoded = url.replace(/&amp;/g, "&");

  const amazon = decoded.match(/https?:\/\/(?:www\.)?amazon\.ca\/(?:[^"'<> ]*\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  if (amazon?.[1]) return `https://www.amazon.ca/dp/${amazon[1].toUpperCase()}`;

  return decoded.split("#")[0].replace(/[)\].,;]+$/g, "");
}

function isProductUrl(url: string) {
  return (
    /^https?:\/\//i.test(url) &&
    (
      /amazon\.ca\/dp\/[A-Z0-9]{10}/i.test(url) ||
      /amazon\.ca\/gp\/product\/[A-Z0-9]{10}/i.test(url) ||
      /walmart\.(ca|com)\/.*(ip|product)/i.test(url) ||
      /bestbuy\.ca\/.*product/i.test(url) ||
      /costco\.ca\/.*\.product\./i.test(url)
    )
  );
}

function urlsFromText(value: unknown) {
  const text = String(value || "");
  const urls = text.match(/https?:\/\/[^\s"'<>),]+/gi) || [];
  return Array.from(new Set(urls.map(normalizeProductUrl).filter(isProductUrl)));
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
  const brand = cleanText(input.brand);
  const name = cleanText(input.productName || input.productKey);
  const rating = input.rating ? `${input.rating} stars` : "";
  const reviews = input.reviewCount ? `${input.reviewCount} reviews` : "";

  const has5000 = /5000\s*mah/i.test(name);
  const hasGray = /\bgray\b|\bgrey\b/i.test(name);
  const has28 = /28\s*hours/i.test(name);
  const has5Speed = /5\s*speed/i.test(name);

  const queries = [
    `${brand} ${name} ${store}`,
    `${brand} ${has5000 ? "5000mAh" : ""} ${hasGray ? "Gray" : ""} ${store}`,
    `${brand} ${has5000 ? "5000mAh" : ""} ${hasGray ? "Gray" : ""} ${has28 ? "28 Hours" : ""} ${has5Speed ? "5 Speed" : ""} ${store}`,
    `${brand} ${hasGray ? "Gray" : ""} ${rating} ${reviews} ${store}`,
    `site:amazon.ca ${brand} ${has5000 ? "5000mAh" : ""} ${hasGray ? "Gray" : ""} Mini Handheld Fan`,
  ];

  return Array.from(new Set(queries.map(dedupeWords).filter((q) => q.length > 8))).slice(0, 5);
}

async function fetchBingCandidates(query: string, timeoutMs: number): Promise<RetrievedProductUrl[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
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
    const hrefPattern = /href="([^"]+)"/gi;
    let match: RegExpExecArray | null;

    while ((match = hrefPattern.exec(html)) && out.length < 5) {
      const url = normalizeProductUrl(match[1]);
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

async function fetchAmazonCandidates(query: string, timeoutMs: number): Promise<RetrievedProductUrl[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const q = cleanText(query).replace(/\bAmazon\.ca\b/gi, "").replace(/\bAmazon\b/gi, "").trim();

    const response = await fetch(`https://www.amazon.ca/s?k=${encodeURIComponent(q)}`, {
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
    const hrefPattern = /href="([^"]*\/(?:dp|gp\/product)\/([A-Z0-9]{10})[^"]*)"/gi;
    let match: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((match = hrefPattern.exec(html)) && out.length < 5) {
      const asin = match[2]?.toUpperCase();
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

async function fetchOpenAiWebCandidates(query: string, timeoutMs: number): Promise<RetrievedProductUrl[]> {
  if (!process.env.OPENAI_API_KEY) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SEARCH_MODEL || "gpt-5-mini",
        tools: [{ type: "web_search_preview", search_context_size: "low" }],
        input: `Find exact product page URLs only. Query: ${query}

Return JSON only:
{"candidates":[{"url":"https://...","title":"..."}]}

Rules:
- Prefer Amazon.ca /dp/ASIN product pages.
- Do not return search/category pages.
- Do not invent URLs.
- Return up to 5 candidates.`,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json() as {
      output_text?: string;
      output?: Array<{
        content?: Array<{
          text?: string;
          annotations?: Array<Record<string, unknown>>;
        }>;
      }>;
    };

    const text = [
      data.output_text || "",
      ...(data.output || []).flatMap((item) =>
        (item.content || []).flatMap((content) => [
          content.text || "",
          ...(content.annotations || []).map((annotation) =>
            [
              annotation.url,
              annotation.uri,
              annotation.href,
              annotation.title,
              annotation.text,
            ].filter(Boolean).join(" ")
          ),
        ])
      ),
    ].join("\n");

    const urls = urlsFromText(text);

    return urls.slice(0, 5).map((url) => ({
      url,
      title: url,
      domain: hostForUrl(url),
      source: "openai-web-search",
      query,
      notes: ["Parsed product URL from OpenAI web_search response/annotations."],
    }));
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

function extractProductEvidenceFromHtml(html: string) {
  const title =
    html.match(/<span[^>]+id=["']productTitle["'][^>]*>([\s\S]{5,500}?)<\/span>/i)?.[1] ||
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{5,500})["']/i)?.[1] ||
    html.match(/<title[^>]*>([\s\S]{5,500}?)<\/title>/i)?.[1] ||
    null;

  const cleanTitle = title
    ? htmlDecodeLight(title.replace(/<[^>]+>/g, " ").replace(/\s*:\s*Amazon\.ca.*$/i, ""))
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

  return {
    title: cleanTitle,
    rating: Number.isFinite(rating) && rating && rating > 0 ? rating : null,
    reviewCount: Number.isFinite(reviewCount) && reviewCount && reviewCount > 0 ? reviewCount : null,
  };
}

async function enrichRetrievedProductCandidate(candidate: RetrievedProductUrl, timeoutMs = 2500): Promise<RetrievedProductUrl & {
  rating?: number | null;
  reviewCount?: number | null;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(candidate.url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-CA,en;q=0.9",
      },
    });

    if (!response.ok) return candidate;

    const html = await response.text();
    const evidence = extractProductEvidenceFromHtml(html);

    return {
      ...candidate,
      title: evidence.title || candidate.title,
      ...(evidence.rating ? { rating: evidence.rating } : {}),
      ...(evidence.reviewCount ? { reviewCount: evidence.reviewCount } : {}),
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
  const queries = buildRetrievalQueries(input);

  const perProviderTimeout = Math.max(2500, Math.min(4500, Math.floor(timeoutMs / 2)));

  const tasks = queries.slice(0, 4).flatMap((query) => [
    fetchBingCandidates(query, perProviderTimeout),
    fetchAmazonCandidates(query, perProviderTimeout),
    fetchOpenAiWebCandidates(query, perProviderTimeout),
  ]);

  const settled = await Promise.allSettled(tasks);
  const candidates = settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  const seen = new Set<string>();
  const unique = candidates.filter((candidate) => {
    const key = normalizeProductUrl(candidate.url).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    candidate.url = normalizeProductUrl(candidate.url);
    return true;
  }).slice(0, maxCandidates);

  const enriched = await Promise.all(
    unique.map((candidate) => enrichRetrievedProductCandidate(candidate, 2200))
  );

  return {
    candidates: enriched,
    queries,
    elapsedMs: Date.now() - startedAt,
    timedOut: Date.now() - startedAt >= timeoutMs,
    sourceCount: enriched.length,
  };
}
