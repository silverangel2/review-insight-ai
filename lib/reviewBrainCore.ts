export type ProductIdentity = {
  productName: string;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  listingUrl?: string | null;
  normalizedKey: string;
  confidence: "missing" | "low" | "medium" | "high";
};

export type ReviewSourceType =
  | "marketplace"
  | "retailer"
  | "manufacturer"
  | "professional_review"
  | "forum"
  | "ugc"
  | "unknown";

export type SourceReputation = "high" | "medium" | "low";

export type ReviewEvidenceRecord = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  sourceType: ReviewSourceType;
  sourceReputation: SourceReputation;
  reviewText: string;
  rating?: number | null;
  reviewDate?: string | null;
  author?: string | null;
  verifiedPurchase?: boolean | null;
  pageProductName?: string | null;
  productMatchScore: number;
  productMatchReason: string;
  contentHash: string;
};

export type EvidenceThresholdResult = {
  passed: boolean;
  status: "sufficient_evidence" | "insufficient_evidence";
  verdict: null;
  confidence: number | null;
  message: string;
  acceptedIndependentSourceCount: number;
  usableReviewCount: number;
  rejectedReason?: string;
};

export type DeterministicConfidenceInput = {
  acceptedIndependentSourceCount: number;
  usableReviewCount: number;
  averageProductMatchScore: number;
  averageSourceReputationScore: number;
  agreementScore: number;
  recencyScore: number;
  extractionCompletenessScore: number;
};

export type VerdictClaim = {
  id: string;
  claim: string;
  sourceIds: string[];
};

export type VerdictVerificationResult = {
  passed: boolean;
  unsupportedClaims: string[];
  reason: string;
};

const REVIEW_NOISE_PATTERNS = [
  /!\[[^\]]*\]\([^)]+\)/g,
  /\[([^\]]{1,180})\]\((?:https?:)?[^)]+\)/g,
  /\bbrief content visible,?\s*double tap to read full content\.?/gi,
  /\bfull content visible,?\s*double tap to read brief content\.?/gi,
  /\b\d+\s+people found this helpful\b/gi,
  /\btranslate review to english\b/gi,
  /\breviewed in [a-z\s]+ on [a-z]+\s+\d{1,2},?\s+\d{4}\b/gi,
  /\bhelpful\s+report\b/gi,
  /\bverified purchase\b/gi,
  /\breview\s+\d+\s*:\s*\|?/gi,
  /\bcustomer reviews?\b/gi,
  /\bstar rating\b/gi,
];

export function cleanEvidenceText(value: unknown): string {
  let text = String(value || "")
    .replace(/\\u0026/g, "&")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/<[^>]*>/g, " ");

  for (const pattern of REVIEW_NOISE_PATTERNS) {
    text = text.replace(pattern, (_match, label) => (typeof label === "string" ? ` ${label} ` : " "));
  }

  return text.replace(/\s+/g, " ").trim();
}

export function normalizeEvidenceKey(value: unknown): string {
  return cleanEvidenceText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function stableEvidenceHash(value: unknown): string {
  const normalized = normalizeEvidenceKey(value);
  let hash = 2166136261;

  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildProductIdentity(input: {
  productName?: string | null;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  listingUrl?: string | null;
}): ProductIdentity {
  const productName = cleanEvidenceText(input.productName);
  const brand = cleanEvidenceText(input.brand) || null;
  const model = cleanEvidenceText(input.model) || null;
  const variant = cleanEvidenceText(input.variant) || null;
  const listingUrl = cleanEvidenceText(input.listingUrl) || null;
  const normalizedKey = [brand, productName, model, variant]
    .filter(Boolean)
    .map(normalizeEvidenceKey)
    .join(" ")
    .replace(/\b(with|for|and|the|a|an|set|pack|bundle|case|cover)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  const tokenCount = normalizedKey.split(/\s+/).filter(Boolean).length;
  const confidence =
    !productName || tokenCount < 2
      ? "missing"
      : brand && model
        ? "high"
        : brand || model || tokenCount >= 5
          ? "medium"
          : "low";

  return { productName, brand, model, variant, listingUrl, normalizedKey, confidence };
}

export function isSafeRetrievalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;

    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local")) return false;
    if (host === "::1" || host === "[::1]" || host.startsWith("0.")) return false;
    if (/^(127|10)\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^169\.254\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    if (/^(metadata|metadata\.google\.internal)$/i.test(host)) return false;

    return true;
  } catch {
    return false;
  }
}

export function sourceTypeForUrl(value: string): ReviewSourceType {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    if (/amazon|walmart|target|bestbuy|costco|sephora|ulta|etsy|ebay|shopify|homedepot|lowes|wayfair|temu|shein/.test(host)) {
      return "marketplace";
    }
    if (/reddit|quora|forum|community|discussions/.test(host)) return "forum";
    if (
      /trustpilot|reviews\.io|sitejabber|consumerreports|rtings|wirecutter|techradar|tomsguide|cnet|pcmag|advisor|journal|review/.test(host) ||
      /\/review|reviews|tested|hands-on|hands_on/.test(path)
    ) {
      return "professional_review";
    }
    if (/support|help|manufacturer|official/.test(host)) return "manufacturer";
    return "retailer";
  } catch {
    return "unknown";
  }
}

export function sourceReputationForUrl(value: string): SourceReputation {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    if (/consumerreports|rtings|wirecutter|bestbuy|costco|sephora|ulta|amazon|walmart|target|homedepot|lowes|trustpilot|reviews\.io/.test(host)) {
      return "high";
    }
    if (/reddit|forum|community|etsy|ebay|shopify|wayfair|cnet|pcmag|techradar|tomsguide|advisor|journal|review/.test(host) || /\/review|reviews|tested|hands-on|hands_on/.test(path)) return "medium";
    return "low";
  } catch {
    return "low";
  }
}

export function reputationScore(reputation: SourceReputation): number {
  if (reputation === "high") return 1;
  if (reputation === "medium") return 0.72;
  return 0.45;
}

export function isUsefulWrittenReview(value: string): boolean {
  const raw = String(value || "");
  const text = cleanEvidenceText(value);
  const lower = text.toLowerCase();
  const rawMarkdownLinkCount = (raw.match(/\[[^\]]+\]\((?:https?:)?[^)]+\)/g) || []).length;
  const hasNonEnglishReviewMarkers = [
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
  ].some((marker) => lower.includes(marker));

  if (text.length < 40 || text.length > 2200) return false;
  if (hasNonEnglishReviewMarkers || /translated from (french|italian|spanish|german|chinese|hindi) by/i.test(lower)) return false;
  if (/privacy policy|terms of use|cookie policy|add to cart|sponsored|advertisement|newsletter|sign in|log in|shipping policy|return policy|return this item for free|product description|product information|item details|best sellers rank|asin|warranty & support|tell us about a lower price/i.test(lower)) {
    return false;
  }
  if (/image unavailable|video player|hls playlist|see all buying options|no featured offers|deliver(?:ing)? to|click to play video|current time|stream type live|chapters descriptions|frequently asked questions|related articles|check lowest prices|order .*lowest price|quality price, reliable delivery option|skip to main content/i.test(lower)) {
    return false;
  }
  if (/visibility:\s*public|uploaded by|subscribers?|views?\s+views?|chapters descriptions|user rating\s+.*no rating|our rating\s+\d|rate this model|compare similar/i.test(lower)) {
    return false;
  }
  if (rawMarkdownLinkCount >= 3 && !/\b(i|we|my|our|used|tested|noticed|experienced|found|recommend|complaint|problem|issue)\b/i.test(lower)) {
    return false;
  }
  if (/^(our analysis and test results|compare similar|sound comfort.*battery.*features|sound battery microphone app connectivity bluetooth value|contents?|table of contents)/i.test(lower)) {
    return false;
  }
  if (/^(helpful|report|rating|stars?|reviews?)$/i.test(text)) return false;
  if (/^(table of contents|specifications?|features?|product information|frequently asked questions|you may also like)$/i.test(text)) return false;
  if (/^\$?\d+(?:\.\d+)?\s*(?:stars?|ratings?|reviews?)?$/i.test(text)) return false;

  const usageLanguage = /\b(i|we|my|our|me|us|bought|purchased|received|used|using|installed|wore|tried|tested|reviewed|evaluated|returned|broke|lasted|recommend|love|liked|disappointed|fit|fits|worked|works|found|noticed|experienced)\b/i.test(text);
  const productExperience = /\b(quality|battery|durable|durability|comfort|comfortable|price|value|delivery|packaging|seller|refund|return|material|defect|size|fit|instructions|support|replacement|leak|scratch|smell|taste|setup|performance|sound|audio|noise|charging|case|controls|reliability|warranty|design|build|skin|face|serum|reedle|exosome|pdrn|collagen|niacinamide|hydration|hydrated|glow|glowy|smooth|smoother|bright|brighter|tingle|tingling|irritation|redness|breakout|texture|absorbs|routine|skincare)\b/i.test(text);
  const verdictLanguage = /\b(review|verdict|pros?|cons?|tested|hands-on|recommend|worth|better than|drawback|complaint|issue|problem|excellent|poor|weak|strong)\b/i.test(text);

  return productExperience && (usageLanguage || verdictLanguage);
}

const GENERIC_REVIEW_IDENTITY_TOKENS = new Set([
  "product",
  "review",
  "reviews",
  "customer",
  "customers",
  "verified",
  "purchase",
  "rating",
  "ratings",
  "amazon",
  "walmart",
  "target",
  "price",
  "store",
  "shop",
  "official",
  "bundle",
  "pack",
  "with",
  "from",
  "that",
  "this",
]);

function distinctiveIdentityTokens(input: {
  productName?: string | null;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
}) {
  return Array.from(
    new Set(
      normalizeEvidenceKey([input.brand, input.productName, input.model, input.variant].filter(Boolean).join(" "))
        .split(/\s+/)
        .filter((token) => token.length >= 4 || /\d/.test(token))
        .filter((token) => !GENERIC_REVIEW_IDENTITY_TOKENS.has(token))
    )
  ).slice(0, 16);
}

export function reviewTextMatchesProductIdentity(
  value: string,
  input: {
    productName?: string | null;
    brand?: string | null;
    model?: string | null;
    variant?: string | null;
    sourceUrl?: string | null;
    sourceType?: ReviewSourceType | null;
  }
): { accepted: boolean; reason: string } {
  const text = cleanEvidenceText(value);
  if (!isUsefulWrittenReview(text)) return { accepted: false, reason: "not useful written review text" };

  const normalizedText = normalizeEvidenceKey(text);
  const identityTokens = distinctiveIdentityTokens(input);
  const identityHits = identityTokens.filter((token) => normalizedText.includes(token));
  if (identityHits.length >= 1) {
    return { accepted: true, reason: `review mentions product token: ${identityHits.slice(0, 2).join(", ")}` };
  }

  if (
    /\b(write website review|share your experience|platform'?s service|service quality|trust score for this website|is this website legit)\b/i.test(
      text
    )
  ) {
    return { accepted: false, reason: "generic website/service review text" };
  }

  const sourceType = input.sourceType || (input.sourceUrl ? sourceTypeForUrl(input.sourceUrl) : "unknown");
  const sourceLooksProductScoped = sourceType === "marketplace" || sourceType === "retailer" || sourceType === "manufacturer";
  const usageLanguage = /\b(i|we|my|our|me|us|bought|purchased|received|used|using|tried|tested|returned|recommend|love|liked|disappointed|worked|works|noticed|felt|feels)\b/i.test(
    text
  );
  const serviceTerms = (
    text.match(/\b(delivery|shipping|packaging|package|seller|support|refund|return|customer service|order|website|platform)\b/gi) || []
  ).length;
  const productExperienceTerms = (
    text.match(
      /\b(quality|durable|durability|fit|fits|size|material|works|worked|defect|broken|performance|value|comfortable|battery|charging|sound|screen|skin|face|serum|reedle|exosome|pdrn|collagen|niacinamide|hydration|hydrated|glow|glowy|smooth|bright|tingle|irritation|redness|breakout|texture|absorbs|routine|acne|wrinkle)\b/gi
    ) || []
  ).length;

  if (serviceTerms > 0 && productExperienceTerms === 0) {
    return { accepted: false, reason: "service-only text without product experience" };
  }

  const identityLooksSkincare = /\b(skin|skincare|serum|reedle|exosome|pdrn|collagen|niacinamide|cream|acne|beauty)\b/i.test(
    [input.productName, input.brand, input.model, input.variant].filter(Boolean).join(" ")
  );
  const skincareExperienceTerms = (
    text.match(/\b(skin|face|serum|texture|hydration|hydrated|glow|glowy|smooth|bright|tingle|irritation|redness|breakout|absorbs|routine|acne|wrinkle)\b/gi) || []
  ).length;
  if (identityLooksSkincare && sourceLooksProductScoped && usageLanguage && skincareExperienceTerms >= 1) {
    return { accepted: true, reason: "product-scoped skincare experience text" };
  }

  if (sourceLooksProductScoped && usageLanguage && productExperienceTerms >= 2) {
    return { accepted: true, reason: "product-scoped user experience text" };
  }

  return { accepted: false, reason: "written text is not specific enough to the requested product" };
}

export function verifyProductMatch(
  identity: ProductIdentity,
  input: {
    pageTitle?: string | null;
    pageProductName?: string | null;
    pageText?: string | null;
    sourceUrl?: string | null;
  }
): { accepted: boolean; score: number; reason: string } {
  if (identity.confidence === "missing") {
    return { accepted: false, score: 0, reason: "product identity missing" };
  }

  const haystack = normalizeEvidenceKey(
    [input.pageTitle, input.pageProductName, input.pageText, input.sourceUrl].filter(Boolean).join(" ")
  );
  const titleHaystack = normalizeEvidenceKey(
    [input.pageTitle, input.pageProductName, input.sourceUrl].filter(Boolean).join(" ")
  );
  const openingHaystack = normalizeEvidenceKey(
    [input.pageTitle, input.pageProductName, String(input.pageText || "").slice(0, 700), input.sourceUrl]
      .filter(Boolean)
      .join(" ")
  );
  const productTokens = normalizeEvidenceKey(identity.productName)
    .split(" ")
    .filter((token) => token.length >= 4)
    .slice(0, 12);
  const rawModelTokens = normalizeEvidenceKey(identity.model || "")
    .split(" ")
    .filter((token) => token.length >= 1);
  const modelTokens = rawModelTokens.filter((token) => token.length >= 2);
  const brandTokens = normalizeEvidenceKey(identity.brand || "")
    .split(" ")
    .filter((token) => token.length >= 3);

  const productHits = productTokens.filter((token) => haystack.includes(token)).length;
  const brandHits = brandTokens.filter((token) => haystack.includes(token)).length;
  const modelHits = modelTokens.filter((token) => haystack.includes(token)).length;
  const numericModelTokens = rawModelTokens.filter((token) => /\d/.test(token));
  const missingNumericModelTokens = numericModelTokens.filter((token) => !haystack.split(" ").includes(token));

  if (brandTokens.length > 0 && brandHits === 0) {
    return { accepted: false, score: 0.2, reason: "brand mismatch" };
  }
  if (modelTokens.length > 0 && modelHits === 0) {
    return { accepted: false, score: 0.25, reason: "model mismatch" };
  }
  if (missingNumericModelTokens.length > 0) {
    return { accepted: false, score: 0.25, reason: "model mismatch" };
  }
  const refurbishedListingSignal =
    /\b(refurbished|renewed|open box|pre owned|preowned)\b/.test(titleHaystack) ||
    /\b(used condition|buy used|used like new|used acceptable|used very good)\b/.test(titleHaystack) ||
    (/\b(refurbished|renewed|open box|pre owned|preowned)\b/.test(openingHaystack) &&
      /\b(price|deal|buy|seller|condition|listing|available)\b/.test(openingHaystack));
  if (refurbishedListingSignal && !/refurbished|renewed|used|open box|pre owned|preowned/i.test(identity.productName)) {
    return { accepted: false, score: 0.3, reason: "refurbished/used listing mismatch" };
  }
  const accessorySignal =
    /\b(accessory|replacement|charger|cover|parts?|adapter|screen protector)\b/.test(titleHaystack) ||
    /\b(replacement|protective|phone|laptop|tablet)\s+case\b/.test(titleHaystack) ||
    /\bcase\s+(cover|protector|replacement|accessory)\b/.test(titleHaystack);
  if (accessorySignal) {
    const identityAllowsAccessory = /\b(accessory|replacement|charger|case|cover|parts?|adapter|screen protector)\b/i.test(
      identity.productName
    );
    if (!identityAllowsAccessory && productHits < Math.max(3, Math.ceil(productTokens.length * 0.45))) {
      return { accepted: false, score: 0.28, reason: "accessory mistaken for product" };
    }
  }

  const productScore = productTokens.length
    ? productHits / Math.max(1, Math.min(productTokens.length, 8))
    : 0;
  const brandScore = brandTokens.length ? Math.min(1, brandHits / brandTokens.length) : 0.9;
  const modelScore = modelTokens.length ? Math.min(1, modelHits / modelTokens.length) : 0.85;
  const score = Math.max(0, Math.min(1, productScore * 0.55 + brandScore * 0.25 + modelScore * 0.2));

  const titleOrUrlLooksLikeReview = /\b(review|reviews|tested|hands on|hands-on)\b/.test(titleHaystack);
  const titleOrUrlModelHits = modelTokens.filter((token) => titleHaystack.includes(token)).length;
  const titleOrUrlProductHits = productTokens.filter((token) => titleHaystack.includes(token)).length;
  const exactReviewUrlMatch =
    titleOrUrlLooksLikeReview &&
    (brandTokens.length === 0 || brandTokens.some((token) => titleHaystack.includes(token))) &&
    (
      titleOrUrlModelHits >= Math.min(2, Math.max(1, modelTokens.length)) ||
      titleOrUrlProductHits >= Math.min(3, Math.max(1, productTokens.length))
    );
  if (exactReviewUrlMatch && score >= 0.36) {
    return {
      accepted: true,
      score: Math.max(score, 0.72),
      reason: "same product review URL/title match accepted",
    };
  }

  if (score < 0.48) return { accepted: false, score, reason: "product title overlap too low" };
  return { accepted: true, score, reason: "same product match accepted" };
}

export function dedupeEvidenceRecords(records: ReviewEvidenceRecord[], maxRecords = 80): ReviewEvidenceRecord[] {
  const seen = new Set<string>();
  const output: ReviewEvidenceRecord[] = [];

  for (const record of records) {
    const reviewText = cleanEvidenceText(record.reviewText);
    if (!isUsefulWrittenReview(reviewText)) continue;

    const contentHash = record.contentHash || stableEvidenceHash(reviewText);
    const nearDuplicateKey = normalizeEvidenceKey(reviewText).slice(0, 260);
    const key = `${record.sourceUrl}::${contentHash}`;
    if (seen.has(key) || seen.has(nearDuplicateKey)) continue;

    seen.add(key);
    seen.add(nearDuplicateKey);
    output.push({
      ...record,
      reviewText: reviewText.slice(0, 1200),
      contentHash,
    });

    if (output.length >= maxRecords) break;
  }

  return output;
}

export function evidenceThreshold(
  records: ReviewEvidenceRecord[],
  options: { minIndependentSources?: number; minUsableReviews?: number } = {}
): EvidenceThresholdResult {
  const minIndependentSources = Math.max(1, options.minIndependentSources ?? 3);
  const minUsableReviews = Math.max(1, options.minUsableReviews ?? 6);
  const acceptedSources = new Set(
    records
      .filter((record) => isUsefulWrittenReview(record.reviewText) && record.productMatchScore >= 0.48)
      .map((record) => {
        try {
          return new URL(record.sourceUrl).hostname.replace(/^www\./, "");
        } catch {
          return record.sourceId;
        }
      })
  );
  const usableReviewCount = records.filter((record) => isUsefulWrittenReview(record.reviewText)).length;
  const acceptedIndependentSourceCount = acceptedSources.size;
  const standardPassed =
    acceptedIndependentSourceCount >= minIndependentSources &&
    usableReviewCount >= minUsableReviews;
  const highReputationWrittenSourcePassed =
    acceptedIndependentSourceCount >= 1 &&
    usableReviewCount >= Math.max(5, minUsableReviews) &&
    records.some(
      (record) =>
        isUsefulWrittenReview(record.reviewText) &&
        record.productMatchScore >= 0.55 &&
        (record.sourceReputation === "high" || record.sourceType === "marketplace")
    );
  const highVolumeWrittenEvidencePassed =
    minIndependentSources >= 3 &&
    acceptedIndependentSourceCount >= 2 &&
    usableReviewCount >= Math.max(20, minUsableReviews * 3);
  const passed = standardPassed || highReputationWrittenSourcePassed || highVolumeWrittenEvidencePassed;

  return {
    passed,
    status: passed ? "sufficient_evidence" : "insufficient_evidence",
    verdict: null,
    confidence: null,
    message: passed
      ? "Sufficient written review evidence was retrieved."
      : "The product was identified, but sufficient written reviews could not be retrieved.",
    acceptedIndependentSourceCount,
    usableReviewCount,
    rejectedReason: passed
      ? undefined
      : `Need ${minIndependentSources} independent accepted source(s) and ${minUsableReviews} usable written review(s), one reputable source with at least ${Math.max(5, minUsableReviews)} usable written reviews, or 2 independent written sources with at least ${Math.max(20, minUsableReviews * 3)} usable written review signals.`,
  };
}

export function calculateDeterministicConfidence(input: DeterministicConfidenceInput): number | null {
  if (input.acceptedIndependentSourceCount < 1 || input.usableReviewCount < 1) return null;

  const sourceScore = Math.min(24, input.acceptedIndependentSourceCount * 8);
  const volumeScore = Math.min(18, input.usableReviewCount * 1.5);
  const matchScore = Math.max(0, Math.min(18, input.averageProductMatchScore * 18));
  const reputation = Math.max(0, Math.min(12, input.averageSourceReputationScore * 12));
  const agreement = Math.max(0, Math.min(10, input.agreementScore * 10));
  const recency = Math.max(0, Math.min(8, input.recencyScore * 8));
  const completeness = Math.max(0, Math.min(10, input.extractionCompletenessScore * 10));

  return Math.round(Math.max(20, Math.min(96, sourceScore + volumeScore + matchScore + reputation + agreement + recency + completeness)));
}

export function verifyVerdictClaims(
  claims: VerdictClaim[],
  allowedSourceIds: Iterable<string>,
  thresholdPassed: boolean
): VerdictVerificationResult {
  const allowed = new Set(allowedSourceIds);
  const unsupportedClaims = claims
    .filter((claim) => !claim.sourceIds.length || claim.sourceIds.some((sourceId) => !allowed.has(sourceId)))
    .map((claim) => claim.id || claim.claim);

  if (!thresholdPassed) {
    return {
      passed: false,
      unsupportedClaims: unsupportedClaims.length ? unsupportedClaims : ["evidence_threshold_not_met"],
      reason: "Verdict blocked because written-review evidence threshold was not met.",
    };
  }

  if (unsupportedClaims.length) {
    return {
      passed: false,
      unsupportedClaims,
      reason: "One or more verdict claims were not backed by accepted source IDs.",
    };
  }

  return {
    passed: true,
    unsupportedClaims: [],
    reason: "All verdict claims include accepted source IDs.",
  };
}
