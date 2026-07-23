import { storeSearchTarget } from "@/lib/reviewToolHelpers";
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

function cleanJsonText(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function clampRating(value: unknown) {
  const rating =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[^0-9.]/g, ""))
        : NaN;
  if (!Number.isFinite(rating)) return null;
  if (rating < 0 || rating > 5) return null;
  return Math.round(rating * 10) / 10;
}

function parsePositiveNumber(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[^0-9.]/g, ""))
        : NaN;
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}

function parsePositiveInteger(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[^0-9.]/g, ""))
        : NaN;
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number);
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

function readSourceLinks(value: unknown): Array<{ label: string; url: string; domain?: string }> {
  if (!Array.isArray(value)) return [];

  const links: Array<{ label: string; url: string; domain?: string }> = [];

  for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url.trim() : "";
      if (!url) continue;
      links.push({
        label: typeof record.label === "string" ? record.label.trim() : "",
        url,
        domain: typeof record.domain === "string" ? record.domain.trim() : undefined,
      });
  }

  return links;
}

function hostForUrl(url: string | null | undefined) {
  try {
    return new URL(String(url || "")).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isProductCandidateUrl(url: string) {
  return !/\/search|\/browse|\/category|\/brand(\/|$)|\/c\/|\/s(?:[/?#]|$)|[?&]k=|[?&]node=/i.test(url);
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

function cleanString(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function readCandidate(value: unknown): ExactProductCandidate | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const url =
    cleanString(record.url) ||
    cleanString(record.exactListingUrl) ||
    cleanString(record.link);

  if (!url || !isProductCandidateUrl(url)) return null;

  return {
    url,
    title:
      cleanString(record.title) ||
      cleanString(record.exactListingTitle) ||
      cleanString(record.label) ||
      null,
    store: cleanString(record.store) || cleanString(record.domain) || hostForUrl(url),
    domain: cleanString(record.domain) || hostForUrl(url),
    price: parsePositiveNumber(record.price),
    rating: clampRating(record.rating),
    reviewCount: parsePositiveInteger(record.reviewCount),
    source: cleanString(record.source) || "exact-product-search",
    notes: Array.isArray(record.notes)
      ? record.notes.map(String).filter(Boolean).slice(0, 6)
      : [],
  };
}

function fallbackCandidatesFromLinks(
  links: Array<{ label: string; url: string; domain?: string }>
): ExactProductCandidate[] {
  return links
    .map((link) =>
      readCandidate({
        url: link.url,
        title: link.label,
        domain: link.domain,
        source: "sourceLinks",
      })
    )
    .filter((candidate): candidate is ExactProductCandidate => Boolean(candidate));
}

function dedupeCandidates(candidates: ExactProductCandidate[], limit: number) {
  const seen = new Set<string>();
  const out: ExactProductCandidate[] = [];

  for (const candidate of candidates) {
    const url = String(candidate.url || "").trim();
    if (!url) continue;
    const key = url.toLowerCase().replace(/[?#].*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
    if (out.length >= limit) break;
  }

  return out;
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

export async function findExactProductCandidates(
  input: ExactProductSearchInput
): Promise<ExactProductCandidateSearchResult> {
  const startedAt = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return emptyCandidateSearchResult("OPENAI_API_KEY is missing.", startedAt);
  }

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

  const storeTarget = storeSearchTarget(input.store);
  const maxCandidates = Math.max(1, Math.min(input.maxCandidates || 5, 5));
  const timeoutMs = Math.max(3000, Math.min(input.timeoutMs || 12000, 30000));
  const searchQueries = Array.from(
    new Set(
      [
        ...(Array.isArray(input.searchQueries) ? input.searchQueries : []),
        product,
      ]
        .map((query) => String(query || "").replace(/\s+/g, " ").trim())
        .filter((query) => query.length >= 3)
    )
  ).slice(0, 6);

  const prompt = `
You are ReviewIntel's fast exact-product search retrieval tool.

Find up to ${maxCandidates} possible public product page candidates for:
"${product}"

Preferred store targeting:
${storeTarget || "No specific store target. Search broadly."}

Search queries to use:
${JSON.stringify(searchQueries, null, 2)}

Known screenshot/listing clues:
- Store: ${input.store || "not provided"}
- Price: ${input.price ?? "not provided"}
- Rating: ${input.rating ?? "not provided"}
- Review count: ${input.reviewCount ?? "not provided"}

Use these clues as identity signals. Prefer listings where title, store, price, rating, variant/color/capacity, and review count match. Do not invent missing rating or review count.

Priority:
1. Exact store listing if store is known, especially Amazon, Walmart, Best Buy, Costco, Sephora, Temu, Target.
2. Match brand, title, product type, price, rating, and review count.
3. Avoid broad category pages.
4. Avoid unrelated products.
5. Do not invent URLs, ratings, review counts, or prices.
6. For Amazon, do not accept a different color/variant/ASIN as exact evidence.
7. If the screenshot says Gray but the candidate is Pink, or the rating/review count differs materially, return low or none.
8. Marketplace search pages, browse pages, category pages, and keyword-result URLs are never exact product listings.

Return ONLY valid JSON. No markdown.

JSON shape:
{
  "candidates": [
    {
      "url": "https://example.com/product-page",
      "title": "visible product page title",
      "store": "Amazon.ca",
      "domain": "amazon.ca",
      "price": null,
      "rating": null,
      "reviewCount": null,
      "source": "web search result, marketplace, source link, etc",
      "notes": ["short visible clue"]
    }
  ],
  "sourcesChecked": [],
  "notes": [],
  "sourceLinks": [
    {
      "label": "source title",
      "url": "https://example.com",
      "domain": "example.com"
    }
  ]
}

Rules:
- Return 3 to ${maxCandidates} candidates when possible, not just one URL.
- If you find a listing with visible rating/review count, include them.
- If only search snippets are available, include values only if visible in evidence.
- If not confident it is the same product, confidence must be low or none.
- Do not guess rating or review count.
`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REVIEW_SEARCH_MODEL || "gpt-4.1-mini",
        tools: [{ type: "web_search" }],
        input: prompt,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return emptyCandidateSearchResult(
        `Exact listing search failed: ${response.status} ${errorText.slice(0, 180)}`,
        startedAt,
        searchQueries
      );
    }

    const data = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };

    const outputText =
      data.output_text ||
      data.output
        ?.flatMap((item) => item.content || [])
        .map((content) => content.text || "")
        .join("\n") ||
      "";

    if (!outputText.trim()) {
      return emptyCandidateSearchResult("Exact listing search returned no usable result.", startedAt, searchQueries);
    }

    const parsed = JSON.parse(cleanJsonText(outputText)) as Record<string, unknown>;

    const sourceLinks = readSourceLinks(parsed.sourceLinks);
    const rawCandidates = Array.isArray(parsed.candidates)
      ? parsed.candidates
      : parsed.exactListingUrl || parsed.url
        ? [parsed]
        : [];
    const candidates = dedupeCandidates(
      [
        ...rawCandidates
          .map(readCandidate)
          .filter((candidate): candidate is ExactProductCandidate => Boolean(candidate)),
        ...fallbackCandidatesFromLinks(sourceLinks),
      ],
      maxCandidates
    );

    return {
      candidates,
      queries: searchQueries,
      sourcesChecked: Array.isArray(parsed.sourcesChecked)
        ? parsed.sourcesChecked.map(String).slice(0, 12)
        : candidates.map((candidate) => String(candidate.url || "")).filter(Boolean),
      sourceLinks,
      notes: Array.isArray(parsed.notes) ? parsed.notes.map(String).slice(0, 8) : [],
      elapsedMs: Date.now() - startedAt,
      timedOut: false,
      attemptCount: 1,
    };
  } catch (error: unknown) {
    return emptyCandidateSearchResult(
      error instanceof Error ? error.message : "Exact listing search failed.",
      startedAt,
      searchQueries,
      error instanceof Error && error.name === "AbortError"
    );
  } finally {
    clearTimeout(timer);
  }
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
