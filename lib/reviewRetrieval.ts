import type { CollectedReview } from "@/lib/reviewCollector";
import { serverEnv, serverEnvFlag } from "@/lib/runtimeEnv";
import {
  buildProductIdentity,
  calculateDeterministicConfidence,
  cleanEvidenceText,
  dedupeEvidenceRecords,
  evidenceThreshold,
  isSafeRetrievalUrl,
  reputationScore,
  reviewTextMatchesProductIdentity,
  sourceReputationForUrl,
  sourceTypeForUrl,
  stableEvidenceHash,
  verifyProductMatch,
  type EvidenceThresholdResult,
  type ReviewEvidenceRecord,
  type ReviewSourceType,
  type SourceReputation,
  type VerdictVerificationResult,
} from "@/lib/reviewBrainCore";

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
  sourceType?: ReviewSourceType;
  sourceReputation?: SourceReputation;
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
  firecrawlCalled: boolean;
  searchQueries: string[];
  candidateUrls: string[];
  candidateUrlCount: number;
  retrievedUrls: string[];
  retrievedPageCount: number;
  extractedTextCharacters: number;
  acceptedEvidenceCount: number;
  acceptedIndependentSourceCount: number;
  extractedWrittenReviewCount: number;
  rejectedEvidenceReasons: string[];
  evidenceThresholdPassed: boolean;
  rejectedPages: Array<{ url: string; reason: string }>;
  sourceStatuses: Array<{
    id: string;
    url: string;
    status: RetrievedReviewSource["status"] | "rejected";
    characterCount?: number;
    reason?: string;
    sourceType?: ReviewSourceType;
    sourceReputation?: SourceReputation;
  }>;
  normalizedProductKey?: string;
  productIdentityConfidence?: "missing" | "low" | "medium" | "high";
  evidenceThreshold?: EvidenceThresholdResult;
  deterministicConfidence?: number | null;
  verdictVerifier?: VerdictVerificationResult;
  latencyMs: number;
  costEstimate: string;
};

export type LiveReviewRetrievalResult = {
  reviews: CollectedReview[];
  evidenceRecords: ReviewEvidenceRecord[];
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
  verify(input: NormalizedProductIdentity, source: RetrievedReviewSource): { accepted: boolean; reason?: string; score?: number };
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
  return cleanEvidenceText(value);
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

export function isWrittenReviewCandidateUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    const full = `${host}${path}`;

    if (/youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|pinterest\.com|x\.com|twitter\.com/.test(host)) {
      return false;
    }
    if (/apple\.com\/newsroom|press|press-release|newsroom|\/video\/|\/videos\/|\/watch/.test(full)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isNonWrittenSource(source: Pick<ReviewSourceCandidate, "url">): boolean {
  return !isWrittenReviewCandidateUrl(source.url);
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

async function resolveWithDeadline<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function amazonReviewCandidateUrls(value: string | null | undefined): string[] {
  if (!value) return [];

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!/amazon\./i.test(host)) return [];

    const match = url.pathname.match(/\/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})/i);
    const asin = match?.[1]?.toUpperCase();
    if (!asin) return [];

    return [
      `${url.origin}/product-reviews/${asin}/?reviewerType=all_reviews`,
      `${url.origin}/product-reviews/${asin}/?sortBy=recent&reviewerType=all_reviews`,
      `${url.origin}/product-reviews/${asin}/?filterByStar=critical&reviewerType=all_reviews`,
      `${url.origin}/dp/${asin}`,
    ];
  } catch {
    return [];
  }
}

function directReviewCandidateUrls(input: NormalizedProductIdentity): string[] {
  const urls = [
    input.listingUrl || "",
    ...amazonReviewCandidateUrls(input.listingUrl),
  ];

  return Array.from(new Set(urls.filter(Boolean))).filter(
    (url) => isSafeRetrievalUrl(url) && isWrittenReviewCandidateUrl(url)
  );
}

function isLikelyReviewText(value: string): boolean {
  const raw = String(value || "");
  const text = cleanText(value);
  const lower = text.toLowerCase();
  const rawMarkdownLinkCount = (raw.match(/\[[^\]]+\]\((?:https?:)?[^)]+\)/g) || []).length;

  if (text.length < 35 || text.length > 2200) return false;
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
  if (/image unavailable|video player|hls playlist|see all buying options|no featured offers|deliver(?:ing)? to|click to play video|current time|stream type live|chapters descriptions|frequently asked questions|related articles|check lowest prices|order .*lowest price|quality price, reliable delivery option|skip to main content/i.test(lower)) {
    return false;
  }
  if (/^description\b|visibility:\s*public|uploaded by|subscribers?|views?\s+views?|chapters descriptions|user rating\s+.*no rating|our rating\s+\d|rate this model|compare similar/i.test(lower)) {
    return false;
  }
  if (rawMarkdownLinkCount >= 3 && !/\b(i|we|my|our|used|tested|noticed|experienced|found|recommend|complaint|problem|issue)\b/i.test(lower)) {
    return false;
  }
  if (/^(our analysis and test results|compare similar|sound comfort.*battery.*features|sound battery microphone app connectivity bluetooth value|contents?|table of contents)/i.test(lower)) {
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
    /\b(quality|battery|fit|size|durable|durability|comfortable|comfort|price|value|delivery|packaging|seller|refund|return|material|works|worked|easy|hard|broken|defect|sound|audio|noise|charging|case|controls|design|build|warranty|performance)\b/i.test(
      text
    );
  const professionalReviewLanguage =
    /\b(review|reviewed|tested|testing|verdict|recommend|worth|excellent|weak|strong|drawback|complaint|issue|problem|pros?|cons?|hands-on|performance)\b/i.test(
      text
    );

  return productExperience && (buyerLanguage || professionalReviewLanguage);
}

function hasCommerceChrome(value: string): boolean {
  return /add(?:ed|ing)? to cart|proceed to checkout|view cart|not added|subscribe\s*&?\s*save|cancel anytime|choose how often|skip or cancel|delivery to|deliver(?:ing)? to|payment method|coupon|limited time deal|bought in past month|frequently bought together|customers also|compare with similar|from the manufacturer|product information|item details|warranty & support|return policy|return this item for free|free returns|how to return the item|select your preferred free shipping option|drop off and leave|report an issue with this product|shop products from small business brands|climate pledge friendly|videos for this product|important information|legal disclaimer|top brand|tell us about a lower price|found a lower price|although we can't match every price|before after use the left and right arrow keys|our products are loved by|write a review search reviews|ratingall ratings|sort by sort by/i.test(
    value
  );
}

function looksMostlyNonEnglish(value: string): boolean {
  const text = cleanText(value).toLowerCase();
  return [
    "j’ai",
    "j'ai",
    "très",
    "peau",
    "après",
    "plusieurs",
    "légère",
    "agréable",
    "pénètre",
    "collant",
    "souple",
    "hydratée",
    "sono",
    "pelle",
    "dopo",
    "diverse applicazioni",
    "posso dire",
    "leggera",
    "rapidamente",
    "morbida",
    "liscia",
    "luminosa",
  ].some((marker) => text.includes(marker));
}

function isLikelyCustomerReviewText(value: string): boolean {
  const raw = String(value || "");
  const text = cleanText(value);
  const lower = text.toLowerCase();
  const rawMarkdownLinkCount = (raw.match(/\[[^\]]+\]\((?:https?:)?[^)]+\)/g) || []).length;
  const pipeCount = (raw.match(/\|/g) || []).length;

  if (text.length < 45 || text.length > 1800) return false;
  if (pipeCount >= 5 || /\|\s*price\s*\||\|\s*key ingredients\s*\||\|\s*main benefits\s*\|/i.test(raw)) return false;
  if (hasCommerceChrome(lower)) return false;
  if (looksMostlyNonEnglish(text)) return false;
  if (/^(helpful|report|translate review|verified purchase|customer reviews?|reviews?|rating|stars?)$/i.test(text)) {
    return false;
  }
  if (
    /privacy policy|terms of use|cookie policy|sponsored|advertisement|newsletter|share this|sign in|log in|view all reviews/i.test(
      lower
    )
  ) {
    return false;
  }
  if (/image unavailable|video player|hls playlist|see all buying options|no featured offers|click to play video|current time|stream type live|chapters descriptions|skip to main content/i.test(lower)) {
    return false;
  }
  if (/^(\W|\s)*(›|skin care|face|treatments|masks|serums|visit the .* store|available in|package includes|specifications|dimensions|ingredients|directions|best sellers rank|asin|measurements|materials & care|active ingredients|special ingredients|item volume|item dimensions|unit count|recommended uses|manufacturer)\b/i.test(text)) {
    return false;
  }
  if (/^\d+(\.\d+)?\s+_?\d+(\.\d+)? out of 5 stars/i.test(text)) return false;
  if (/^\d+\s+people found this helpful/i.test(text)) return false;
  if (/review\s+\d+\s*:\s*\|\s*(translate review|reviewed in|people found this helpful)/i.test(text)) {
    return false;
  }
  if (rawMarkdownLinkCount >= 2) return false;

  const firstPersonExperience =
    /\b(i|we|my|our|me|us|bought|purchased|received|used|using|tried|returned|recommend|love|liked|disappointed|works for me|on my skin|my skin|helped my|made my|noticed|felt|feels)\b/i.test(
      text
    );
  const explicitReviewContext = /\breviewed in\b.+\bon\b|\bverified purchase\b/i.test(text);
  const productExperience =
    /\b(quality|texture|skin|face|serum|reedle|exosome|pdrn|collagen|niacinamide|irritation|redness|breakout|hydration|smooth|bright|firm|wrinkle|price|value|delivery|packaging|seller|refund|return|material|works|worked|easy|hard|broken|defect|design|build|performance)\b/i.test(
      text
    );

  return productExperience && (firstPersonExperience || explicitReviewContext);
}

function splitEvidenceParagraphs(text: string): string[] {
  const raw = String(text || "")
    .replace(/\r/g, "\n")
    .replace(/#{1,6}\s+/g, "\n")
    .replace(/\s[-*]\s+/g, "\n")
    .replace(/\|\s*/g, " ")
    .split(/\n{2,}|\n|(?<=\.)\s{2,}/);

  const paragraphs: string[] = [];
  let carry = "";

  for (const item of raw) {
    const cleaned = cleanText(item);
    if (!cleaned) continue;
    const candidate = carry ? `${carry} ${cleaned}` : cleaned;

    if (candidate.length < 90) {
      carry = candidate;
      continue;
    }

    paragraphs.push(candidate);
    carry = "";
  }

  if (carry.length >= 90) paragraphs.push(carry);
  return paragraphs;
}

function extractStructuredCustomerReviewBlocks(text: string): string[] {
  const prepared = String(text || "")
    .replace(/\\\s*\\/g, "\n")
    .replace(/_Previous slide_|_Next slide_|See all photos|Translate all reviews to English|See original/gi, "\n")
    .replace(/MoreHide|Read more|Show less/gi, "\n");
  const markerPattern = /(?:^|\n|\s)(?:[A-Z][A-Za-z0-9 ._'’-]{1,80}\s+)?_?[1-5](?:\.\d)?\s+out of\s+5\s+stars_?/gi;
  const matches = [...prepared.matchAll(markerPattern)];
  const blocks: string[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index ?? 0;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? prepared.length : prepared.length;
    let block = prepared.slice(start, end);

    block = block
      .replace(/Top reviews from(?: the United States| other countries)?/gi, " ")
      .replace(/Images in this review|Reviews with images|All photos|Customer Reviews/gi, " ")
      .replace(/_?[1-5](?:\.\d)?\s+out of\s+5\s+stars_?/gi, " ")
      .replace(/\bScent:\s*[^.\n]{1,80}/gi, " ")
      .replace(/\bVine of Free Product\b/gi, " ")
      .split(/Helpful\s+Report|Report\s+Translate review|Was this helpful|One person found this helpful|\d+\s+people found this helpful/i)[0];

    const cleaned = cleanText(block);
    if (isLikelyCustomerReviewText(cleaned)) blocks.push(cleaned);
  }

  return blocks;
}

function isProfessionalReviewSource(source: RetrievedReviewSource): boolean {
  const sourceType = source.sourceType || sourceTypeForUrl(source.url);
  return sourceType === "professional_review" || /review|tested|hands-on|advisor|journal/i.test(source.url);
}

function isLikelyProfessionalEvidence(value: string): boolean {
  const raw = String(value || "");
  const text = cleanText(value);
  const lower = text.toLowerCase();
  const rawMarkdownLinkCount = (raw.match(/\[[^\]]+\]\((?:https?:)?[^)]+\)/g) || []).length;

  if (text.length < 120 || text.length > 2200) return false;
  if (
    /privacy policy|terms of use|cookie policy|newsletter|advertisement|sponsored|affiliate disclosure|table of contents|related articles|you may also like|add to cart|buy now/i.test(
      lower
    )
  ) {
    return false;
  }
  if (/image unavailable|video player|hls playlist|see all buying options|no featured offers|deliver(?:ing)? to|click to play video|current time|stream type live|chapters descriptions|frequently asked questions|check lowest prices|order .*lowest price|quality price, reliable delivery option|skip to main content/i.test(lower)) {
    return false;
  }
  if (/^description\b|visibility:\s*public|uploaded by|subscribers?|views?\s+views?|user rating\s+.*no rating|our rating\s+\d|rate this model|compare similar/i.test(lower)) {
    return false;
  }
  if (rawMarkdownLinkCount >= 3 && !/\b(i|we|my|our|used|tested|noticed|experienced|found|recommend|complaint|problem|issue)\b/i.test(lower)) {
    return false;
  }
  if (/^(our analysis and test results|compare similar|sound comfort.*battery.*features|sound battery microphone app connectivity bluetooth value|contents?|table of contents)/i.test(lower)) {
    return false;
  }

  const reviewLanguage =
    /\b(review|reviewed|testing|tested|hands-on|verdict|recommend|worth|pros?|cons?|drawback|issue|complaint|problem|excellent|weak|strong|performance)\b/i.test(
      text
    );
  const productExperience =
    /\b(sound|audio|noise|battery|charging|case|controls|fit|comfort|quality|durability|design|build|price|value|setup|performance|warranty|support|delivery|packaging)\b/i.test(
      text
    );
  const productDescriptionOnly =
    /\b(available in|choose from|comes in colors|package includes|specifications|dimensions|where to buy|check price)\b/i.test(
      lower
    ) && !/\b(tested|reviewed|found|noticed|experienced|recommend|complaint|problem|issue)\b/i.test(lower);

  return reviewLanguage && productExperience && !productDescriptionOnly;
}

function dedupeReviews(reviews: CollectedReview[], maxReviews: number, allowProfessional = false): CollectedReview[] {
  const seen = new Set<string>();
  const output: CollectedReview[] = [];

  for (const review of reviews) {
    const body = cleanText(review.body);
    if (!(allowProfessional ? isLikelyReviewText(body) : isLikelyCustomerReviewText(body))) continue;
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
  const productName = cleanText(identity.productName).replace(/"/g, "");
  const brand = identity.brand ? cleanText(identity.brand).replace(/"/g, "") : "";
  const model = identity.model ? cleanText(identity.model).replace(/"/g, "") : "";
  const variant = identity.variant ? cleanText(identity.variant).replace(/"/g, "") : "";
  const productAlreadyHasBrand =
    Boolean(brand) && new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(productName);
  const parts = [
    productAlreadyHasBrand ? "" : brand,
    productName,
    model && !new RegExp(`\\b${model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(productName) ? model : "",
    variant && !new RegExp(`\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(productName) ? variant : "",
  ]
    .filter(Boolean)
    .map((part) => cleanText(part));
  const exact = parts.join(" ").replace(/\s+/g, " ").trim();
  const compact = exact
    .replace(/\b(with|for|and|the|new|set|pack|bundle)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const brandModel = [brand, model]
    .filter(Boolean)
    .map((part) => cleanText(part))
    .join(" ")
    .replace(/"/g, "");
  const queries = [
    `${exact} reviews`,
    `${exact} customer reviews`,
    `${exact} complaints`,
    `${exact} verified purchase reviews`,
    `${exact} before after reviews`,
    `${exact} amazon reviews`,
    `${exact} retailer reviews`,
    `${exact} beauty review`,
    `${exact} skincare review`,
    `"${exact}" reviews`,
    `"${exact}" customer reviews`,
    `"${exact}" customer complaints`,
    `"${exact}" complaints`,
    `"${exact}" site:amazon.com`,
    `"${exact}" site:amazon.ca`,
    `"${exact}" site:plantifique.com`,
    `"${exact}" site:reddit.com`,
    `"${exact}" site:trustpilot.com`,
    brandModel && brandModel !== brand ? `"${brandModel}" reviews` : "",
    model ? `"${model}" reviews` : "",
    compact ? `"${compact}" reviews` : "",
  ];

  return Array.from(new Set(queries.map(cleanText).filter(Boolean))).slice(0, 12);
}

class FirecrawlSourceDiscovery implements ReviewSourceDiscovery {
  constructor(private readonly apiKey: string) {}

  async discover(input: NormalizedProductIdentity, signal?: AbortSignal): Promise<ReviewSourceCandidate[]> {
    const candidates = new Map<string, ReviewSourceCandidate>();

    let index = 1;
    for (const url of directReviewCandidateUrls(input)) {
      if (candidates.size >= 6) break;
      candidates.set(url, {
        id: `source-${index++}`,
        url,
        sourceName: hostFor(url),
        sourceType: sourceTypeForUrl(url),
        sourceReputation: sourceReputationForUrl(url),
        query: input.listingUrl && url !== input.listingUrl ? "direct marketplace review URL" : "direct listing URL",
        title: input.productName,
      });
    }

    for (const query of buildSearchQueries(input)) {
      if (candidates.size >= 6) break;
      const timeout = withTimeout(signal, 8000);
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
            timeout: 8000,
            scrapeOptions: {
              formats: ["markdown"],
              onlyMainContent: true,
              blockAds: true,
              removeBase64Images: true,
              timeout: 8000,
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
          if (!isSafeRetrievalUrl(item.url)) continue;
          if (!isWrittenReviewCandidateUrl(item.url)) continue;
          candidates.set(item.url, {
            id: `source-${index++}`,
            url: item.url,
            sourceName: hostFor(item.url),
            sourceType: sourceTypeForUrl(item.url),
            sourceReputation: sourceReputationForUrl(item.url),
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
    if (!isSafeRetrievalUrl(source.url)) {
      return {
        ...source,
        status: "failed",
        text: "",
        characterCount: 0,
        provider: this.name,
        error: "unsafe or unsupported URL",
      };
    }

    if (source.rawText && source.rawText.length >= 80) {
      return {
        ...source,
        status: "retrieved",
        text: source.rawText,
        characterCount: source.rawText.length,
        provider: this.name,
      };
    }

    const timeout = withTimeout(signal, 10000);
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
          timeout: 10000,
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
      return { accepted: false, reason: source.error || source.status, score: 0 };
    }
    const match = verifyProductMatch(buildProductIdentity(input), {
      pageTitle: source.title,
      pageProductName: source.title,
      pageText: source.text.slice(0, 6000),
      sourceUrl: source.url,
    });

    return { accepted: match.accepted, reason: match.reason, score: match.score };
  }
}

class TextEvidenceAnalyzer implements EvidenceAnalyzer {
  extractEvidenceRecords(
    source: RetrievedReviewSource,
    identity: NormalizedProductIdentity,
    productMatchScore: number
  ): ReviewEvidenceRecord[] {
    const sourceType = source.sourceType || sourceTypeForUrl(source.url);
    const sourceReputation = source.sourceReputation || sourceReputationForUrl(source.url);
    const identityName = buildProductIdentity(identity).productName;
    return this.extractReviews(source)
      .map((review) => {
        const reviewText = cleanText(review.body);
        const relevance = reviewTextMatchesProductIdentity(reviewText, {
          ...identity,
          sourceUrl: source.url,
          sourceType,
        });
        return { review, reviewText, relevance };
      })
      .filter((item) => item.relevance.accepted)
      .map(({ review, reviewText, relevance }, index) => {
        return {
          id: `${source.id}-review-${index + 1}`,
          sourceId: source.id,
          sourceName: source.sourceName || hostFor(source.url),
          sourceUrl: source.url,
          sourceType,
          sourceReputation,
          reviewText,
          rating: review.rating ?? null,
          reviewDate: review.date ?? null,
          author: null,
          verifiedPurchase: review.verified ?? null,
          pageProductName: source.title || identityName,
          productMatchScore,
          productMatchReason: relevance.reason,
          contentHash: stableEvidenceHash(reviewText),
        };
      });
  }

  extractReviews(source: RetrievedReviewSource): CollectedReview[] {
    const lines = splitEvidenceParagraphs(source.text);
    const reviewBlocks: string[] = [];
    const professionalSource = isProfessionalReviewSource(source);

    for (const structured of extractStructuredCustomerReviewBlocks(source.text)) {
      reviewBlocks.push(structured);
    }

    for (let i = 0; i < lines.length; i += 1) {
      const current = lines[i];
      const next = lines[i + 1] || "";
      const combined = `${current} ${next}`.trim();
      if (isLikelyCustomerReviewText(current)) reviewBlocks.push(current);
      else if (combined.length <= 1400 && isLikelyCustomerReviewText(combined)) reviewBlocks.push(combined);
      else if (professionalSource && isLikelyProfessionalEvidence(current)) reviewBlocks.push(current);
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
      25,
      professionalSource
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
  forceRefresh?: boolean;
}): Promise<LiveReviewRetrievalResult> {
  const started = Date.now();
  const provider = serverEnv("REVIEWINTEL_RETRIEVAL_PROVIDER").toLowerCase() || "disabled";
  const enabled =
    serverEnvFlag("REVIEWINTEL_LIVE_RETRIEVAL_ENABLED") &&
    provider === "firecrawl" &&
    Boolean(serverEnv("FIRECRAWL_API_KEY"));
  const identityPreview = buildProductIdentity(input);
  const baseDiagnostics = (overrides: Partial<ReviewRetrievalDiagnostics> = {}): ReviewRetrievalDiagnostics => ({
    enabled,
    provider,
    cacheHit: false,
    firecrawlCalled: false,
    searchQueries: [],
    candidateUrls: [],
    candidateUrlCount: 0,
    retrievedUrls: [],
    retrievedPageCount: 0,
    extractedTextCharacters: 0,
    acceptedEvidenceCount: 0,
    acceptedIndependentSourceCount: 0,
    extractedWrittenReviewCount: 0,
    rejectedEvidenceReasons: [],
    evidenceThresholdPassed: false,
    rejectedPages: [],
    sourceStatuses: [],
    normalizedProductKey: identityPreview.normalizedKey,
    productIdentityConfidence: identityPreview.confidence,
    latencyMs: Date.now() - started,
    costEstimate: "0 Firecrawl credits; live retrieval disabled or unavailable.",
    ...overrides,
  });

  if (!enabled) {
    return { reviews: [], evidenceRecords: [], diagnostics: baseDiagnostics() };
  }

  const identifier = new DefaultProductIdentifier();
  const identity = identifier.normalize(input);
  const attemptedSearchQueries = buildSearchQueries(identity);
  const cacheKey = normalizeKey([identity.brand, identity.productName, identity.model, identity.listingUrl].filter(Boolean).join(" "));
  const cached = liveCache.get(cacheKey);

  if (cached && !input.forceRefresh) {
    return {
      reviews: cached.reviews.slice(0, input.maxReviews || 50),
      evidenceRecords: cached.evidenceRecords.slice(0, input.maxReviews || 50),
      diagnostics: {
        ...cached.diagnostics,
        cacheHit: true,
        searchQueries: cached.diagnostics.searchQueries?.length
          ? cached.diagnostics.searchQueries
          : attemptedSearchQueries,
        latencyMs: Date.now() - started,
      },
    };
  }

  const apiKey = serverEnv("FIRECRAWL_API_KEY");
  const controller = new AbortController();
  const hardTimer = setTimeout(() => controller.abort(), Math.min(input.deadlineMs || 25000, 25000));
  const discovery = new FirecrawlSourceDiscovery(apiKey);
  const retriever = new FirecrawlReviewRetriever(apiKey);
  const verifier = new HeuristicProductMatchVerifier();
  const analyzer = new TextEvidenceAnalyzer();
  const confidence = new SimpleConfidenceCalculator();

  try {
    const candidates = (await discovery.discover(identity, controller.signal).catch(() => [])).slice(0, 6);
    const retrieved = await runBounded(candidates, 3, (candidate) =>
      resolveWithDeadline(
        retriever.retrieve(candidate, controller.signal),
        11000,
        () => ({
          ...candidate,
          status: "timeout" as const,
          text: "",
          characterCount: 0,
          provider: retriever.name,
          error: "source retrieval timed out",
        })
      )
    );
    const rejectedPages: Array<{ url: string; reason: string }> = [];
    const acceptedReviews: CollectedReview[] = [];
    const evidenceRecords: ReviewEvidenceRecord[] = [];
    const acceptedHosts = new Set<string>();
    const sourceStatuses: ReviewRetrievalDiagnostics["sourceStatuses"] = [];

    for (const source of retrieved) {
      if (isNonWrittenSource(source)) {
        rejectedPages.push({ url: source.url, reason: "source is not a written review page" });
        sourceStatuses.push({
          id: source.id,
          url: source.url,
          status: "rejected",
          characterCount: source.characterCount,
          reason: "source is not a written review page",
          sourceType: source.sourceType || sourceTypeForUrl(source.url),
          sourceReputation: source.sourceReputation || sourceReputationForUrl(source.url),
        });
        continue;
      }

      const match = verifier.verify(identity, source);
      if (!match.accepted) {
        rejectedPages.push({ url: source.url, reason: match.reason || "product mismatch" });
        sourceStatuses.push({
          id: source.id,
          url: source.url,
          status: source.status === "retrieved" ? "rejected" : source.status,
          characterCount: source.characterCount,
          reason: match.reason || source.error,
          sourceType: source.sourceType || sourceTypeForUrl(source.url),
          sourceReputation: source.sourceReputation || sourceReputationForUrl(source.url),
        });
        continue;
      }

      const records = analyzer.extractEvidenceRecords(source, identity, match.score || 0.55);
      const reviews = records.map((record) => ({
        source: record.sourceName,
        sourceUrl: record.sourceUrl,
        rating: record.rating ?? null,
        title: source.title,
        body: record.reviewText,
        date: record.reviewDate ?? null,
        verified: record.verifiedPurchase ?? null,
      }));
      if (!records.length) {
        rejectedPages.push({ url: source.url, reason: "no product-specific written review bodies extracted" });
        sourceStatuses.push({
          id: source.id,
          url: source.url,
          status: "rejected",
          characterCount: source.characterCount,
          reason: "no product-specific written review bodies extracted",
          sourceType: source.sourceType || sourceTypeForUrl(source.url),
          sourceReputation: source.sourceReputation || sourceReputationForUrl(source.url),
        });
        continue;
      }

      acceptedHosts.add(hostFor(source.url));
      acceptedReviews.push(...reviews);
      evidenceRecords.push(...records);
      sourceStatuses.push({
        id: source.id,
        url: source.url,
        status: source.status,
        characterCount: source.characterCount,
        sourceType: source.sourceType || sourceTypeForUrl(source.url),
        sourceReputation: source.sourceReputation || sourceReputationForUrl(source.url),
      });

      if (acceptedReviews.length >= (input.maxReviews || 50) || acceptedHosts.size >= 3) {
        controller.abort();
        break;
      }
    }

    const reviews = dedupeReviews(acceptedReviews, input.maxReviews || 50);
    const dedupedEvidenceRecords = dedupeEvidenceRecords(evidenceRecords, input.maxReviews || 50);
    const threshold = evidenceThreshold(dedupedEvidenceRecords, {
      minIndependentSources: Number(process.env.REVIEWINTEL_MIN_ACCEPTED_SOURCES || 3),
      minUsableReviews: Number(process.env.REVIEWINTEL_MIN_USABLE_REVIEWS || 6),
    });
    const averageMatch =
      dedupedEvidenceRecords.length
        ? dedupedEvidenceRecords.reduce((sum, record) => sum + record.productMatchScore, 0) / dedupedEvidenceRecords.length
        : 0;
    const averageReputation =
      dedupedEvidenceRecords.length
        ? dedupedEvidenceRecords.reduce((sum, record) => sum + reputationScore(record.sourceReputation), 0) / dedupedEvidenceRecords.length
        : 0;
    const deterministicConfidence = threshold.passed
      ? calculateDeterministicConfidence({
          acceptedIndependentSourceCount: threshold.acceptedIndependentSourceCount,
          usableReviewCount: threshold.usableReviewCount,
          averageProductMatchScore: averageMatch,
          averageSourceReputationScore: averageReputation,
          agreementScore: 0.74,
          recencyScore: 0.55,
          extractionCompletenessScore: Math.min(1, threshold.usableReviewCount / 30),
        })
      : null;
    const latencyMs = Date.now() - started;
    const diagnostics = baseDiagnostics({
      firecrawlCalled: true,
      searchQueries: attemptedSearchQueries,
      candidateUrls: candidates.map((candidate) => candidate.url),
      candidateUrlCount: candidates.length,
      retrievedUrls: retrieved.filter((source) => source.status === "retrieved").map((source) => source.url),
      retrievedPageCount: retrieved.filter((source) => source.status === "retrieved").length,
      extractedTextCharacters: retrieved.reduce((sum, source) => sum + Math.max(0, source.characterCount || 0), 0),
      acceptedEvidenceCount: dedupedEvidenceRecords.length,
      acceptedIndependentSourceCount: threshold.acceptedIndependentSourceCount,
      extractedWrittenReviewCount: reviews.length,
      rejectedEvidenceReasons: Array.from(new Set(rejectedPages.map((page) => page.reason).filter(Boolean))).slice(0, 12),
      evidenceThresholdPassed: threshold.passed,
      rejectedPages,
      sourceStatuses,
      evidenceThreshold: threshold,
      deterministicConfidence,
      verdictVerifier: {
        passed: threshold.passed,
        unsupportedClaims: threshold.passed ? [] : ["evidence_threshold_not_met"],
        reason: threshold.passed
          ? "Written-review evidence threshold passed before verdict generation."
          : "Verdict blocked until enough accepted written review sources are collected.",
      },
      latencyMs,
      costEstimate: `Estimated ${Math.max(1, candidates.length)} Firecrawl search/scrape operations; exact credits depend on plan and cache.`,
    });
    const result = { reviews, evidenceRecords: dedupedEvidenceRecords, diagnostics };
    liveCache.set(cacheKey, result);

    console.log("[ReviewIntel DEBUG liveReviewRetrieval]", {
      provider,
      candidateCount: diagnostics.candidateUrls.length,
      searchQueries: diagnostics.searchQueries,
      retrievedCount: diagnostics.retrievedUrls.length,
      extractedTextCharacters: diagnostics.extractedTextCharacters,
      acceptedIndependentSourceCount: diagnostics.acceptedIndependentSourceCount,
      acceptedEvidenceCount: diagnostics.acceptedEvidenceCount,
      extractedWrittenReviewCount: diagnostics.extractedWrittenReviewCount,
      evidenceThresholdPassed: diagnostics.evidenceThresholdPassed,
      rejectedPages: diagnostics.rejectedPages.map((page) => ({
        url: page.url,
        reason: page.reason,
      })),
      latencyMs,
      deterministicConfidence,
      legacyConfidence: confidence.calculate({
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
      evidenceRecords: [],
      diagnostics: baseDiagnostics({
        firecrawlCalled: true,
        searchQueries: attemptedSearchQueries,
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
