type FirecrawlScrapeResponse = {
  success?: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      title?: string;
      sourceURL?: string;
      url?: string;
      description?: string;
    };
  };
  error?: string;
};

export type FirecrawlFallbackResult = {
  used: boolean;
  reason: string;
  sourcesChecked: number;
  reviewSnippets: string[];
  markdownPreview: string;
  sourceUrl?: string;
  title?: string;
};

const REVIEWISH_PATTERNS = [
  /\bverified purchase\b/i,
  /\bcustomer review\b/i,
  /\breviewed in\b/i,
  /\bstar rating\b/i,
  /\bstars?\b/i,
  /\bpros?\b/i,
  /\bcons?\b/i,
  /\bcomplaint\b/i,
  /\bcomplaints\b/i,
  /\bworth\b/i,
  /\bbroke\b/i,
  /\bquality\b/i,
  /\bworks?\b/i,
  /\beffective\b/i,
  /\breturn(ed)?\b/i,
];

function splitReviewishSnippets(markdown: string): string[] {
  const cleaned = markdown
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const chunks = cleaned
    .split(/\n{2,}|(?<=\.)\s+(?=[A-Z0-9])/)
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter((chunk) => chunk.length >= 60 && chunk.length <= 900);

  const reviewish = chunks.filter((chunk) =>
    REVIEWISH_PATTERNS.some((pattern) => pattern.test(chunk)),
  );

  return Array.from(new Set(reviewish)).slice(0, 20);
}

export async function runFirecrawlFallback(params: {
  url?: string;
  reason: string;
  timeoutMs?: number;
}): Promise<FirecrawlFallbackResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const provider = process.env.REVIEWINTEL_RETRIEVAL_PROVIDER;

  if (!apiKey) {
    return {
      used: false,
      reason: "Firecrawl skipped because FIRECRAWL_API_KEY is missing.",
      sourcesChecked: 0,
      reviewSnippets: [],
      markdownPreview: "",
    };
  }

  if (provider && provider !== "firecrawl" && provider !== "fallback" && provider !== "openai_firecrawl") {
    return {
      used: false,
      reason: `Firecrawl skipped because REVIEWINTEL_RETRIEVAL_PROVIDER=${provider}.`,
      sourcesChecked: 0,
      reviewSnippets: [],
      markdownPreview: "",
    };
  }

  if (!params.url) {
    return {
      used: false,
      reason: "Firecrawl skipped because no product URL was available.",
      sourcesChecked: 0,
      reviewSnippets: [],
      markdownPreview: "",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 12000);

  try {
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: params.url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: params.timeoutMs ?? 12000,
        waitFor: 1500,
      }),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => null)) as FirecrawlScrapeResponse | null;

    if (!response.ok || !data?.data?.markdown) {
      return {
        used: true,
        reason: `Firecrawl returned no usable markdown. ${data?.error || response.statusText || params.reason}`,
        sourcesChecked: 1,
        reviewSnippets: [],
        markdownPreview: "",
        sourceUrl: params.url,
      };
    }

    const markdown = data.data.markdown;
    const reviewSnippets = splitReviewishSnippets(markdown);

    return {
      used: true,
      reason: reviewSnippets.length > 0
        ? "Firecrawl fallback found possible written review evidence."
        : "Firecrawl fallback ran but did not find written review-like snippets.",
      sourcesChecked: 1,
      reviewSnippets,
      markdownPreview: markdown.slice(0, 4000),
      sourceUrl: data.data.metadata?.sourceURL || data.data.metadata?.url || params.url,
      title: data.data.metadata?.title,
    };
  } catch (error) {
    return {
      used: true,
      reason: `Firecrawl fallback failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      sourcesChecked: 1,
      reviewSnippets: [],
      markdownPreview: "",
      sourceUrl: params.url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

type FirecrawlSearchResultItem = {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
  content?: string;
};

type FirecrawlSearchResponse = {
  success?: boolean;
  data?: FirecrawlSearchResultItem[];
  error?: string;
};

export type FirecrawlSearchFallbackResult = FirecrawlFallbackResult & {
  attemptedQueries: string[];
  sourceUrls: string[];
};

export async function runFirecrawlSearchFallback(params: {
  queries: string[];
  reason: string;
  timeoutMs?: number;
  limitPerQuery?: number;
}): Promise<FirecrawlSearchFallbackResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const provider = process.env.REVIEWINTEL_RETRIEVAL_PROVIDER;
  const attemptedQueries = Array.from(new Set(params.queries.map((query) => query.trim()).filter(Boolean))).slice(0, 8);

  if (!apiKey) {
    return {
      used: false,
      reason: "Firecrawl search skipped because FIRECRAWL_API_KEY is missing.",
      sourcesChecked: 0,
      reviewSnippets: [],
      markdownPreview: "",
      attemptedQueries,
      sourceUrls: [],
    };
  }

  if (provider && provider !== "firecrawl" && provider !== "fallback" && provider !== "openai_firecrawl") {
    return {
      used: false,
      reason: `Firecrawl search skipped because REVIEWINTEL_RETRIEVAL_PROVIDER=${provider}.`,
      sourcesChecked: 0,
      reviewSnippets: [],
      markdownPreview: "",
      attemptedQueries,
      sourceUrls: [],
    };
  }

  if (!attemptedQueries.length) {
    return {
      used: false,
      reason: "Firecrawl search skipped because no search queries were available.",
      sourcesChecked: 0,
      reviewSnippets: [],
      markdownPreview: "",
      attemptedQueries,
      sourceUrls: [],
    };
  }

  const allSnippets: string[] = [];
  const markdownParts: string[] = [];
  const sourceUrls: string[] = [];
  let sourcesChecked = 0;
  let lastReason = params.reason;

  for (const query of attemptedQueries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 12000);

    try {
      const response = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          limit: params.limitPerQuery ?? 5,
          scrapeOptions: {
            formats: [{ type: "markdown" }],
            onlyMainContent: true,
            timeout: params.timeoutMs ?? 12000,
          },
        }),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => null)) as FirecrawlSearchResponse | null;

      if (!response.ok || !Array.isArray(data?.data)) {
        lastReason = `Firecrawl search returned no usable results for "${query}". ${data?.error || response.statusText || params.reason}`;
        continue;
      }

      for (const item of data.data) {
        const url = item.url;
        const markdown = item.markdown || item.content || item.description || "";
        if (url) sourceUrls.push(url);
        if (!markdown.trim()) continue;

        sourcesChecked += 1;
        markdownParts.push(`Source: ${item.title || url || query}\n${markdown.slice(0, 2500)}`);

        const snippets = splitReviewishSnippets(markdown);
        allSnippets.push(...snippets);
      }

      if (allSnippets.length >= 5) {
        lastReason = "Firecrawl search fallback found possible written review evidence.";
        break;
      }
    } catch (error) {
      lastReason = `Firecrawl search failed for "${query}": ${error instanceof Error ? error.message : "Unknown error"}`;
    } finally {
      clearTimeout(timeout);
    }
  }

  const uniqueSnippets = Array.from(new Set(allSnippets)).slice(0, 30);
  const uniqueUrls = Array.from(new Set(sourceUrls)).slice(0, 20);

  return {
    used: true,
    reason: uniqueSnippets.length > 0
      ? "Firecrawl search fallback found possible written review evidence."
      : lastReason,
    sourcesChecked,
    reviewSnippets: uniqueSnippets,
    markdownPreview: markdownParts.join("\n\n---\n\n").slice(0, 6000),
    sourceUrl: uniqueUrls[0],
    title: uniqueUrls.length ? "Firecrawl search fallback" : undefined,
    attemptedQueries,
    sourceUrls: uniqueUrls,
  };
}

