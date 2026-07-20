import type { CollectedReview } from "@/lib/reviewCollector";

export type NormalizedProductIdentity = {
  productName: string;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  listingUrl?: string | null;
};

export type ReviewSourceCandidate = {
  id: string;
  url: string;
  sourceName: string;
  query?: string;
  title?: string;
  description?: string;
  rawText?: string;
};

export type RetrievedReviewSource = ReviewSourceCandidate & {
  status: "retrieved" | "blocked" | "failed" | "timeout" | "empty";
  text: string;
  characterCount: number;
  provider: string;
  error?: string;
};

export type ReviewRetrievalDiagnostics = {
  enabled: boolean;
  provider: string;
  cacheHit: boolean;
  candidateUrls: string[];
  retrievedUrls: string[];
  acceptedIndependentSourceCount: number;
  extractedWrittenReviewCount: number;
  rejectedPages: Array<{ url: string; reason: string }>;
  sourceStatuses: Array<{
    id: string;
    url: string;
    status: RetrievedReviewSource["status"] | "rejected";
    characterCount?: number;
    reason?: string;
  }>;
  latencyMs: number;
  costEstimate: string;
};

export type LiveReviewRetrievalResult = {
  reviews: CollectedReview[];
  diagnostics: ReviewRetrievalDiagnostics;
};

export interface ProductIdentifier {
  normalize(input: NormalizedProductIdentity): NormalizedProductIdentity;
}

export interface ReviewSourceDiscovery {
  discover(input: NormalizedProductIdentity, signal?: AbortSignal): Promise<ReviewSourceCandidate[]>;
}

export interface ReviewRetriever {
  readonly name: string;
  retrieve(source: ReviewSourceCandidate, signal?: AbortSignal): Promise<RetrievedReviewSource>;
}

export interface ProductMatchVerifier {
  verify(input: NormalizedProductIdentity, source: RetrievedReviewSource): { accepted: boolean; reason?: string };
}

export interface EvidenceAnalyzer {
  extractReviews(source: RetrievedReviewSource): CollectedReview[];
}

export interface DeterministicConfidenceCalculator {
  calculate(input: {
    independentSourceCount: number;
    usableReviewCount: number;
    rejectedCount: number;
    latencyMs: number;
  }): number | null;
}

const liveCache = new Map<string, LiveReviewRetrievalResult>();

function cleanText(value: unknown): string {
  return String(value || "")
    .replace(/\\u0026/g, "&")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function reviewKey(text: string) {
  return normalizeKey(text).slice(0, 220);
}

function hostFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown source";
  }
}

function withTimeout(parentSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    parentSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function enabledFlag(value: unknown): boolean {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function isLikelyReviewText(value: string): boolean {
  const text = cleanText(value);
  const lower = text.toLowerCase();

  if (text.length < 35 || text.length > 1400) return false;
  if (/^(helpful|report|translate review|verified purchase|customer reviews?|reviews?|rating|stars?)$/i.test(text)) {
    return false;
  }
  if (
    /privacy policy|terms of use|cookie policy|add to cart|sponsored|advertisement|subscribe|newsletter|share this|sign in|log in|view all reviews/i.test(
      lower
    )
  ) {
    return false;
  }
  if (/^\d+\s+people found this helpful/i.test(text)) return false;
  if (/review\s+\d+\s*:\s*\|\s*(translate review|reviewed in|people found this helpful)/i.test(text)) {
    return false;
  }

  const buyerLanguage =
    /\b(i|we|my|our|me|us|bought|purchased|received|used|using|installed|wore|tried|returned|broke|lasted|recommend|love|liked|disappointed)\b/i.test(
      text
    );
  const productExperience =
    /\b(quality|battery|fit|size|durable|comfortable|price|value|delivery|packaging|seller|refund|return|material|works|worked|easy|hard|broken|defect)\b/i.test(
      text
    );

  return buyerLanguage && productExperience;
}

function dedupeReviews(reviews: CollectedReview[], maxReviews: number): CollectedReview[] {
  const seen = new Set<string>();
  const output: CollectedReview[] = [];

  for (const review of reviews) {
    const body = cleanText(review.body);
    if (!isLikelyReviewText(body)) continue;
    const key = reviewKey(body);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push({
      ...review,
      body: body.slice(0, 1200),
      title: review.title ? cleanText(review.title).slice(0, 160) : undefined,
    });
    if (output.length >= maxReviews) break;
  }

  return output;
}

class DefaultProductIdentifier implements ProductIdentifier {
  normalize(input: NormalizedProductIdentity): NormalizedProductIdentity {
    return {
      productName: cleanText(input.productName),
      brand: input.brand ? cleanText(input.brand) : null,
      model: input.model ? cleanText(input.model) : null,
      variant: input.variant ? cleanText(input.variant) : null,
      listingUrl: input.listingUrl ? cleanText(input.listingUrl) : null,
    };
  }
}

function buildSearchQueries(identity: NormalizedProductIdentity): string[] {
  const parts = [identity.brand, identity.productName, identity.model, identity.variant]
    .filter(Boolean)
    .map((part) => cleanText(part));
  const exact = parts.join(" ").replace(/"/g, "");
  const compact = exact
    .replace(/\b(with|for|and|the|new|set|pack|bundle)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const queries = [
    `"${exact}" reviews`,
    `"${exact}" customer reviews`,
    `"${exact}" complaints`,
    compact ? `"${compact}" reviews` : "",
    identity.model ? `"${identity.model}" "${identity.brand || ""}" reviews` : "",
  ];

  return Array.from(new Set(queries.map(cleanText).filter(Boolean))).slice(0, 4);
}

class FirecrawlSourceDiscovery implements ReviewSourceDiscovery {
  constructor(private readonly apiKey: string) {}

  async discover(input: NormalizedProductIdentity, signal?: AbortSignal): Promise<ReviewSourceCandidate[]> {
    const candidates = new Map<string, ReviewSourceCandidate>();

    if (input.listingUrl) {
      candidates.set(input.listingUrl, {
        id: "source-1",
        url: input.listingUrl,
        sourceName: hostFor(input.listingUrl),
        title: input.productName,
      });
    }

    let index = candidates.size + 1;
    for (const query of buildSearchQueries(input)) {
      if (candidates.size >= 6) break;
      const timeout = withTimeout(signal, 12000);
      try {
        const response = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            limit: Math.max(1, 6 - candidates.size),
            sources: ["web"],
            timeout: 12000,
            scrapeOptions: {
              formats: ["markdown"],
              onlyMainContent: true,
              blockAds: true,
              removeBase64Images: true,
              timeout: 12000,
            },
          }),
          signal: timeout.signal,
        });

        if (!response.ok) continue;
        const data = (await response.json()) as {
          data?: { web?: Array<{ title?: string; description?: string; url?: string; markdown?: string }> };
        };
        for (const item of data.data?.web || []) {
          if (!item.url || candidates.has(item.url)) continue;
          candidates.set(item.url, {
            id: `source-${index++}`,
            url: item.url,
            sourceName: hostFor(item.url),
            query,
            title: cleanText(item.title),
            description: cleanText(item.description),
            rawText: cleanText(item.markdown),
          });
          if (candidates.size >= 6) break;
        }
      } catch {
        // Discovery is best-effort. Retrieval safeguards decide if evidence is enough.
      } finally {
        timeout.clear();
      }
    }

    return [...candidates.values()].slice(0, 6);
  }
}

class FirecrawlReviewRetriever implements ReviewRetriever {
  readonly name = "firecrawl";

  constructor(private readonly apiKey: string) {}

  async retrieve(source: ReviewSourceCandidate, signal?: AbortSignal): Promise<RetrievedReviewSource> {
    if (source.rawText && source.rawText.length >= 80) {
      return {
        ...source,
        status: "retrieved",
        text: source.rawText,
        characterCount: source.rawText.length,
        provider: this.name,
      };
    }

    const timeout = withTimeout(signal, 14000);
    try {
      const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: source.url,
          formats: ["markdown"],
          onlyMainContent: true,
          blockAds: true,
          removeBase64Images: true,
          timeout: 14000,
        }),
        signal: timeout.signal,
      });

      if (!response.ok) {
        return {
          ...source,
          status: response.status === 403 || response.status === 429 ? "blocked" : "failed",
          text: "",
          characterCount: 0,
          provider: this.name,
          error: `HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as {
        data?: { markdown?: string; html?: string; rawHtml?: string; metadata?: { title?: string } };
      };
      const text = cleanText(data.data?.markdown || data.data?.html || data.data?.rawHtml || "");

      return {
        ...source,
        title: source.title || cleanText(data.data?.metadata?.title),
        status: text.length >= 80 ? "retrieved" : "empty",
        text,
        characterCount: text.length,
        provider: this.name,
      };
    } catch (error) {
      return {
        ...source,
        status: timeout.signal.aborted ? "timeout" : "failed",
        text: "",
        characterCount: 0,
        provider: this.name,
        error: error instanceof Error ? error.message : "retrieval failed",
      };
    } finally {
      timeout.clear();
    }
  }
}

class HeuristicProductMatchVerifier implements ProductMatchVerifier {
  verify(input: NormalizedProductIdentity, source: RetrievedReviewSource) {
    if (source.status !== "retrieved" || source.characterCount < 80) {
      return { accepted: false, reason: source.error || source.status };
    }

    const haystack = normalizeKey(`${source.title || ""} ${source.description || ""} ${source.text.slice(0, 4000)}`);
    const productTokens = normalizeKey(input.productName)
      .split(" ")
      .filter((token) => token.length >= 4)
      .slice(0, 10);
    const brandToken = input.brand ? normalizeKey(input.brand).split(" ").find((token) => token.length >= 3) : "";
    const modelToken = input.model ? normalizeKey(input.model).split(" ").find((token) => token.length >= 3) : "";

    const productHits = productTokens.filter((token) => haystack.includes(token)).length;
    const hasBrand = !brandToken || haystack.includes(brandToken);
    const hasModel = !modelToken || haystack.includes(modelToken);
    const enoughTitleOverlap = productTokens.length === 0 || productHits >= Math.min(3, productTokens.length);

    if (!hasBrand) return { accepted: false, reason: "brand mismatch" };
    if (!hasModel) return { accepted: false, reason: "model mismatch" };
    if (!enoughTitleOverlap) return { accepted: false, reason: "product title overlap too low" };
    if (/\b(refurbished|renewed|used)\b/i.test(source.text) && !/\b(refurbished|renewed|used)\b/i.test(input.productName)) {
      return { accepted: false, reason: "refurbished/used listing mismatch" };
    }

    return { accepted: true };
  }
}

class TextEvidenceAnalyzer implements EvidenceAnalyzer {
  extractReviews(source: RetrievedReviewSource): CollectedReview[] {
    const lines = source.text
      .split(/\n+|(?<=\.)\s{2,}/)
      .map(cleanText)
      .filter(Boolean);
    const reviewBlocks: string[] = [];

    for (let i = 0; i < lines.length; i += 1) {
      const current = lines[i];
      const next = lines[i + 1] || "";
      const combined = `${current} ${next}`.trim();
      if (isLikelyReviewText(current)) reviewBlocks.push(current);
      else if (combined.length <= 1400 && isLikelyReviewText(combined)) reviewBlocks.push(combined);
    }

    return dedupeReviews(
      reviewBlocks.map((body) => ({
        source: source.sourceName || hostFor(source.url),
        sourceUrl: source.url,
        rating: null,
        title: source.title,
        body,
        date: null,
        verified: null,
      })),
      25
    );
  }
}

class SimpleConfidenceCalculator implements DeterministicConfidenceCalculator {
  calculate(input: {
    independentSourceCount: number;
    usableReviewCount: number;
    rejectedCount: number;
    latencyMs: number;
  }): number | null {
    if (input.independentSourceCount < 1 || input.usableReviewCount < 1) return null;
    const sourceScore = Math.min(40, input.independentSourceCount * 12);
    const reviewScore = Math.min(35, input.usableReviewCount * 2);
    const rejectionPenalty = Math.min(20, input.rejectedCount * 4);
    const latencyPenalty = input.latencyMs > 25000 ? 8 : 0;
    return Math.max(10, Math.min(95, sourceScore + reviewScore + 20 - rejectionPenalty - latencyPenalty));
  }
}

async function runBounded<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const output: R[] = [];
  let index = 0;

  async function next() {
    while (index < items.length) {
      const item = items[index++];
      output.push(await worker(item));
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return output;
}

export async function collectLiveReviewsForListing(input: {
  productName: string;
  brand?: string | null;
  model?: string | null;
  listingUrl?: string | null;
  maxReviews?: number;
  deadlineMs?: number;
}): Promise<LiveReviewRetrievalResult> {
  const started = Date.now();
  const provider = String(process.env.REVIEWINTEL_RETRIEVAL_PROVIDER || "").toLowerCase() || "disabled";
  const enabled =
    enabledFlag(process.env.REVIEWINTEL_LIVE_RETRIEVAL_ENABLED) &&
    provider === "firecrawl" &&
    Boolean(process.env.FIRECRAWL_API_KEY);
  const baseDiagnostics = (overrides: Partial<ReviewRetrievalDiagnostics> = {}): ReviewRetrievalDiagnostics => ({
    enabled,
    provider,
    cacheHit: false,
    candidateUrls: [],
    retrievedUrls: [],
    acceptedIndependentSourceCount: 0,
    extractedWrittenReviewCount: 0,
    rejectedPages: [],
    sourceStatuses: [],
    latencyMs: Date.now() - started,
    costEstimate: "0 Firecrawl credits; live retrieval disabled or unavailable.",
    ...overrides,
  });

  if (!enabled) {
    return { reviews: [], diagnostics: baseDiagnostics() };
  }

  const identifier = new DefaultProductIdentifier();
  const identity = identifier.normalize(input);
  const cacheKey = normalizeKey([identity.brand, identity.productName, identity.model, identity.listingUrl].filter(Boolean).join(" "));
  const cached = liveCache.get(cacheKey);

  if (cached) {
    return {
      reviews: cached.reviews.slice(0, input.maxReviews || 50),
      diagnostics: {
        ...cached.diagnostics,
        cacheHit: true,
        latencyMs: Date.now() - started,
      },
    };
  }

  const apiKey = process.env.FIRECRAWL_API_KEY || "";
  const controller = new AbortController();
  const hardTimer = setTimeout(() => controller.abort(), Math.min(input.deadlineMs || 25000, 25000));
  const discovery = new FirecrawlSourceDiscovery(apiKey);
  const retriever = new FirecrawlReviewRetriever(apiKey);
  const verifier = new HeuristicProductMatchVerifier();
  const analyzer = new TextEvidenceAnalyzer();
  const confidence = new SimpleConfidenceCalculator();

  try {
    const candidates = (await discovery.discover(identity, controller.signal)).slice(0, 6);
    const retrieved = await runBounded(candidates, 3, (candidate) =>
      retriever.retrieve(candidate, controller.signal)
    );
    const rejectedPages: Array<{ url: string; reason: string }> = [];
    const acceptedReviews: CollectedReview[] = [];
    const acceptedHosts = new Set<string>();
    const sourceStatuses: ReviewRetrievalDiagnostics["sourceStatuses"] = [];

    for (const source of retrieved) {
      const match = verifier.verify(identity, source);
      if (!match.accepted) {
        rejectedPages.push({ url: source.url, reason: match.reason || "product mismatch" });
        sourceStatuses.push({
          id: source.id,
          url: source.url,
          status: source.status === "retrieved" ? "rejected" : source.status,
          characterCount: source.characterCount,
          reason: match.reason || source.error,
        });
        continue;
      }

      const reviews = analyzer.extractReviews(source);
      if (!reviews.length) {
        rejectedPages.push({ url: source.url, reason: "no written review bodies extracted" });
        sourceStatuses.push({
          id: source.id,
          url: source.url,
          status: "rejected",
          characterCount: source.characterCount,
          reason: "no written review bodies extracted",
        });
        continue;
      }

      acceptedHosts.add(hostFor(source.url));
      acceptedReviews.push(...reviews);
      sourceStatuses.push({
        id: source.id,
        url: source.url,
        status: source.status,
        characterCount: source.characterCount,
      });

      if (acceptedReviews.length >= (input.maxReviews || 50) || acceptedHosts.size >= 3) {
        controller.abort();
        break;
      }
    }

    const reviews = dedupeReviews(acceptedReviews, input.maxReviews || 50);
    const latencyMs = Date.now() - started;
    const diagnostics = baseDiagnostics({
      candidateUrls: candidates.map((candidate) => candidate.url),
      retrievedUrls: retrieved.filter((source) => source.status === "retrieved").map((source) => source.url),
      acceptedIndependentSourceCount: acceptedHosts.size,
      extractedWrittenReviewCount: reviews.length,
      rejectedPages,
      sourceStatuses,
      latencyMs,
      costEstimate: `Estimated ${Math.max(1, candidates.length)} Firecrawl search/scrape operations; exact credits depend on plan and cache.`,
    });
    const result = { reviews, diagnostics };
    liveCache.set(cacheKey, result);

    console.log("[ReviewIntel DEBUG liveReviewRetrieval]", {
      provider,
      candidateCount: diagnostics.candidateUrls.length,
      retrievedCount: diagnostics.retrievedUrls.length,
      acceptedIndependentSourceCount: diagnostics.acceptedIndependentSourceCount,
      extractedWrittenReviewCount: diagnostics.extractedWrittenReviewCount,
      rejectedPages: diagnostics.rejectedPages.map((page) => ({
        url: page.url,
        reason: page.reason,
      })),
      latencyMs,
      confidence: confidence.calculate({
        independentSourceCount: diagnostics.acceptedIndependentSourceCount,
        usableReviewCount: diagnostics.extractedWrittenReviewCount,
        rejectedCount: diagnostics.rejectedPages.length,
        latencyMs,
      }),
      cacheHit: false,
    });

    return result;
  } catch (error) {
    return {
      reviews: [],
      diagnostics: baseDiagnostics({
        rejectedPages: [
          {
            url: input.listingUrl || "review source discovery",
            reason: error instanceof Error ? error.message : "live retrieval failed",
          },
        ],
        latencyMs: Date.now() - started,
        costEstimate: "Firecrawl request failed before usable evidence was collected.",
      }),
    };
  } finally {
    clearTimeout(hardTimer);
  }
}
