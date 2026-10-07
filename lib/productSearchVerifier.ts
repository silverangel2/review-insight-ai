import { captureStage } from "./devScanCapture";
import {
  enrichRetrievedProductCandidate,
  normalizeProductUrl,
  isProductUrl,
  type RetrievedProductUrl,
} from "./productUrlRetrieval";
import type { ScanCostTelemetry } from "@/lib/scanCostTelemetry";
import { extractProductIdentityTokenRoles, stableProductSearchTerms } from "./productIdentityTokens";

export type ProductSearchJob = {
  scanId: string;
  store?: string | null;
  brand?: string | null;
  productName?: string | null;
  productKey?: string | null;
  model?: string | null;
  color?: string | null;
  price?: string | number | null;
  rating?: string | number | null;
  reviewCount?: string | number | null;
  costTelemetry?: ScanCostTelemetry;
};

export type ProductCandidate = {
  url: string | null;
  title?: string | null;
  store?: string | null;
  domain?: string | null;
  price?: string | number | null;
  rating?: string | number | null;
  reviewCount?: string | number | null;
  source?: string | null;
  notes?: string[];
  identityFetched?: boolean;
  enrichmentAttempted?: boolean;
  enrichmentSucceeded?: boolean;
  asin?: string | null;
  brand?: string | null;
  model?: string | null;
};

export type EnrichedProductCandidate = ProductCandidate & {
  enrichmentAttempted: boolean;
  enrichmentSucceeded: boolean;
};

export type ProductVerifierDecision =
  | "verified_exact_match"
  | "possible_match_needs_more_search"
  | "rejected_similar_product"
  | "rejected_wrong_store"
  | "rejected_wrong_variant"
  | "rejected_rating_review_count_mismatch"
  | "rejected_missing_distinctive_terms"
  | "rejected_non_product_page";

export type ProductVerifierResult = {
  verifierStatus: ProductVerifierDecision;
  verifierConfidence: number;
  verifierReasons: string[];
  verifiedListingUrl: string | null;
  rejectedListingUrl: string | null;
  rejectedListingTitle: string | null;
  retrySearchQueries: string[];
  canCollectReviews: boolean;
  canScoreProduct: boolean;
  canonicalIdentifier?: string | null;
  canonicalMarketplace?: string | null;
};

function numberFrom(value: unknown) {
  const n = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/amazon'?s choice/g, " ")
    .replace(/[^a-z0-9.%+-]+/g, " ")
    .replace(/\b(quarts?|qts?)\b/g, "qt")
    .replace(/\b(pounds?)\b/g, "lb")
    .replace(/\btouch[\s-]*screen\b/g, "touchscreen")
    .replace(/\bair\s+fryer\b/g, "airfryer")
    .replace(/\s+/g, " ")
    .trim();
}

function amazonAsinFromUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value || ""));
    if (!url.hostname.toLowerCase().includes("amazon.")) return null;
    return url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|product-reviews)\/([A-Z0-9]{10})(?:[/?#]|$)/i)?.[1]?.toUpperCase() || null;
  } catch {
    return null;
  }
}

function domainFromUrl(url: string | null | undefined) {
  try {
    return new URL(String(url || "")).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export async function enrichProductCandidate(
  job: ProductSearchJob,
  candidate: ProductCandidate,
  timeoutMs = 2200,
  force = false,
  attemptedUrls?: Set<string>
): Promise<EnrichedProductCandidate> {
  const initial = {
    ...candidate,
    enrichmentAttempted: Boolean(candidate.enrichmentAttempted),
    enrichmentSucceeded: Boolean(candidate.enrichmentSucceeded),
  };
  const title = String(candidate.title || "").trim();
  const weakTitle = !title ||
    /^Amazon(?:\.[a-z]{2,})?(?:\s+product\s+[A-Z0-9]{10})?$/i.test(title) ||
    /^https?:\/\//i.test(title);
  const normalizedUrl = normalizeProductUrl(String(candidate.url || ""));
  if (!isProductUrl(normalizedUrl) || (!force && !weakTitle) || candidate.enrichmentAttempted) {
    return initial;
  }

  if (attemptedUrls?.has(normalizedUrl)) return initial;
  attemptedUrls?.add(normalizedUrl);

  const enriched = await enrichRetrievedProductCandidate({
    url: String(candidate.url),
    title: title || String(candidate.url),
    domain: candidate.domain || new URL(String(candidate.url)).hostname,
    source: "manual-pattern",
    query: "exact-product-identity-enrichment",
    notes: candidate.notes || [],
    ...(candidate.identityFetched ? { identityFetched: true } : {}),
  } as RetrievedProductUrl, timeoutMs, job.costTelemetry);

  return {
    ...candidate,
    url: enriched.url || candidate.url,
    title: enriched.title || candidate.title || null,
    brand: enriched.brand || candidate.brand || null,
    model: enriched.model || candidate.model || null,
    ...(enriched.rating !== undefined ? { rating: enriched.rating } : {}),
    ...(enriched.reviewCount !== undefined ? { reviewCount: enriched.reviewCount } : {}),
    notes: enriched.notes,
    identityFetched: Boolean(enriched.identityFetched),
    enrichmentAttempted: true,
    enrichmentSucceeded: Boolean(enriched.enrichmentSucceeded),
  };
}

export async function prepareCandidateForVerification(
  job: ProductSearchJob,
  candidate: ProductCandidate,
  attemptedUrls?: Set<string>
) {
  // Search-result metadata is frequently incomplete. A candidate can appear
  // to be missing brand/model/capacity simply because those fields were not
  // present in the discovery result. Do not reject it before the native
  // identity enrichment step has had one opportunity to inspect the actual
  // candidate.
  //
  // The enriched candidate is still passed through verifyProductCandidate()
  // immediately below, so genuinely wrong brands/models/sizes/bundles remain
  // rejected.
  const initiallyEnriched = await enrichProductCandidate(
    job,
    candidate,
    2200,
    false,
    attemptedUrls
  );
  const initialDecision = verifyProductCandidate(job, initiallyEnriched);

  // Search-result metadata can make a plausible Amazon listing look like a
  // bundle/variant before the canonical product page has been inspected. Give
  // that bounded suspicion one page-level identity check, then let the same
  // verifier make the final decision. Hard identity mismatches remain
  // rejected and are not rescued by this path.
  const needsFetchedIdentityVerification =
    (initialDecision.verifierStatus === "rejected_missing_distinctive_terms" &&
      (normalize(initiallyEnriched.title).includes(normalize(job.brand)) ||
        String(initiallyEnriched.title || "").split(/\s+/).length < 4)) ||
    initialDecision.verifierStatus === "rejected_rating_review_count_mismatch" ||
    initialDecision.verifierStatus === "rejected_wrong_variant" ||
    initialDecision.verifierReasons.some((reason) => /bundle|packaged variant/i.test(reason)) ||
    (() => {
      const requestedRating = numberFrom(job.rating);
      const candidateRating = numberFrom(initiallyEnriched.rating);
      const requestedReviews = numberFrom(job.reviewCount);
      const candidateReviews = numberFrom(initiallyEnriched.reviewCount);
      return (
        (requestedRating !== null && candidateRating !== null && Math.abs(requestedRating - candidateRating) > 0.15) ||
        (requestedReviews !== null && candidateReviews !== null && requestedReviews > 0 &&
          Math.abs(candidateReviews - requestedReviews) / requestedReviews > 0.35)
      );
    })();

  if (
    !needsFetchedIdentityVerification ||
    initiallyEnriched.enrichmentAttempted
  ) {
    return initiallyEnriched;
  }

  return enrichProductCandidate(job, initiallyEnriched, 2200, true, attemptedUrls);
}

function storeDomain(store: unknown) {
  const s = normalize(store);
  if (s.includes("amazon.ca")) return "amazon.ca";
  if (s.includes("amazon.com")) return "amazon.com";
  if (s.includes("walmart.ca")) return "walmart.ca";
  if (s.includes("walmart.com")) return "walmart.com";
  if (s.includes("bestbuy.ca")) return "bestbuy.ca";
  if (s.includes("costco.ca")) return "costco.ca";
  if (s.includes("sephora")) return "sephora";
  return s;
}

const COLOR_WORDS = new Set([
  "black",
  "white",
  "gray",
  "grey",
  "pink",
  "blue",
  "green",
  "red",
  "purple",
  "yellow",
  "orange",
  "silver",
  "gold",
  "beige",
  "brown",
  "navy",
  "cream",
  "clear",
]);

function colorsIn(value: unknown) {
  const colors = new Set<string>();
  for (const word of normalize(value).split(/\s+/)) {
    const color = word === "grey" ? "gray" : word;
    if (COLOR_WORDS.has(color)) colors.add(color);
  }
  return colors;
}

function importantTerms(job: ProductSearchJob) {
  const identity = stableProductSearchTerms(job);
  const text = normalize([
    ...identity.brands,
    identity.family,
    ...identity.models,
  ].filter(Boolean).join(" "));
  const terms = new Set<string>();

  for (const term of text.split(/\s+/)) {
    if (term.length < 3) continue;
    if (["the", "and", "for", "with", "from", "portable", "rechargeable", "amazon", "walmart"].includes(term)) continue;
    terms.add(term);
  }

  const rawText = [identity.family, ...identity.models].filter(Boolean).join(" ");
  for (const match of rawText.matchAll(/\b\d+(?:\.\d+)?\s*(?:mah|ml|oz|inch|inches|cm|mm|w|v|gb|tb|pack|pcs|piece|speed|hours?)\b/gi)) {
    terms.add(match[0].replace(/\s+/g, ""));
  }
  for (const match of rawText.matchAll(/\b[A-Z0-9]{4,}(?:-[A-Z0-9]+)?\b/g)) {
    terms.add(match[0].toLowerCase());
  }

  return Array.from(terms).slice(0, 18);
}

function cleanRetryQuery(value: unknown) {
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
    if (!key) continue;
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

function cleanDisplayToken(value: unknown) {
  return String(value || "")
    .replace(/[^\p{L}\p{N}.%+-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function withoutDuplicateTerms(values: unknown[], limit = 12) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const text = cleanDisplayToken(value);
    if (!text) continue;
    for (const part of text.split(/\s+/)) {
      const key = part.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(part);
      if (out.length >= limit) return out;
    }
  }

  return out;
}

function colorForJob(job: ProductSearchJob) {
  const direct = cleanDisplayToken(job.color);
  if (direct) return direct;
  const text = [job.productName, job.productKey].filter(Boolean).join(" ");
  const match = text.match(/\b(black|white|gray|grey|pink|blue|green|red|purple|yellow|orange|silver|gold|beige|brown|navy|cream|clear)\b/i)?.[1] || "";
  return match.replace(/^grey$/i, "Gray").replace(/^gray$/i, "Gray");
}

function featureTermsForJob(job: ProductSearchJob) {
  const rawText = [job.productName, job.productKey].filter(Boolean).join(" ");
  const terms: string[] = [];

  for (const match of rawText.matchAll(/\b\d+(?:\.\d+)?\s*(?:mah|ml|oz|inch|inches|cm|mm|w|v|gb|tb)\b/gi)) {
    terms.push(match[0].replace(/\s+/g, ""));
  }
  for (const match of rawText.matchAll(/\b\d+(?:\.\d+)?\s*(?:hours?|speed|pack|pcs|pieces?)\b/gi)) {
    terms.push(match[0].replace(/\s+/g, " "));
  }

  return Array.from(new Set(terms.map(cleanDisplayToken).filter(Boolean))).slice(0, 6);
}

function meaningfulSizeTokens(value: unknown) {
  const normalized = normalize(value);
  const tokens = new Set<string>();
  for (const match of normalized.matchAll(/\b(\d+(?:\.\d+)?)\s*(lb|qt|oz|ml|mah|gb|tb|w|v|cm|mm|in|inch|inches)\b/gi)) {
    tokens.add(`${match[1]}${match[2].replace(/inches?/i, "in")}`.toLowerCase());
  }
  return tokens;
}

function productTypeTermsForJob(job: ProductSearchJob) {
  const brandKey = normalize(job.brand);
  const colorKey = normalize(colorForJob(job));
  const storeKey = normalize(job.store);
  const featureKeys = new Set(featureTermsForJob(job).map(normalize));
  const stop = new Set([
    "amazon",
    "amazon.ca",
    "amazon.com",
    "walmart",
    "walmart.ca",
    "walmart.com",
    "color",
    "variant",
    "for",
    "with",
    "and",
    "the",
    "a",
    "an",
    "usb",
    "mah",
    "ml",
    "oz",
    "inch",
    "inches",
    "cm",
    "mm",
    "hour",
    "hours",
    "speed",
    "speeds",
    "pack",
    "packs",
    "pcs",
    "piece",
    "pieces",
    "rechargeable",
    "portable",
    "battery",
    "operated",
    "personal",
  ]);
  const words = cleanDisplayToken(job.productName)
    .split(/\s+/)
    .filter((word) => {
      const key = normalize(word);
      if (!key || key === brandKey || key === colorKey || key === storeKey) return false;
      if (stop.has(key) || featureKeys.has(key)) return false;
      if (/^\d/.test(key) || /\d/.test(key)) return false;
      return true;
    });

  return withoutDuplicateTerms(words, 4);
}

export function buildProductRetryQueries(job: ProductSearchJob, reason?: string) {
  void reason;
  const identity = stableProductSearchTerms(job);
  const brand = identity.roles.primaryBrand || identity.brands[0] || "";
  const parent = identity.roles.manufacturerOrParent && identity.roles.manufacturerOrParent !== brand
    ? identity.roles.manufacturerOrParent
    : "";
  const store = cleanDisplayToken(job.store || storeDomain(job.store) || "Amazon.ca");
  const modelTokens = identity.models;
  const productType = identity.family ? [identity.family] : productTypeTermsForJob(job);
  const variant = identity.variants.join(" ");
  const siteTarget = storeDomain(store) || store.toLowerCase();

  const effectiveModelTokens = primaryModelSearchTokens(job, modelTokens);

  const queries = effectiveModelTokens.length > 0
    ? [
        `site:${siteTarget} "${brand}" "${effectiveModelTokens.join(" ")}" "${productType.join(" ")}"`,
        `site:${siteTarget} "${brand}" "${effectiveModelTokens.join(" ")}" ${identity.roles.capacityOrSize.map((size) => `"${size}"`).join(" ")} "${productType.join(" ")}"`,
        `"${brand} ${effectiveModelTokens.join(" ")} ${productType.join(" ")}" ${store}`,
        `${parent} "${brand}" "${effectiveModelTokens.join(" ")}" ${productType.join(" ")} ${variant} ${store}`,
      ]
    : [
        `site:${siteTarget} "${brand}" ${identity.roles.capacityOrSize.map((size) => `"${size}"`).join(" ")} "${productType.join(" ")}"`,
        `site:${siteTarget} "${brand}" "${productType.join(" ")}"`,
        `"${brand} ${productType.join(" ")}" ${store}`,
        `${brand} ${productType.join(" ")} ${variant} ${store}`,
      ];

  return Array.from(
    new Set(
      queries
        .map(cleanRetryQuery)
        .filter((q) => q.length > 8)
    )
  ).slice(0, 8);
}


function primaryModelSearchTokens(
  job: ProductSearchJob,
  suppliedTokens: string[]
): string[] {
  void suppliedTokens;
  return stableProductSearchTerms(job).models;
}

function verifyProductCandidateImpl(job: ProductSearchJob, candidate: ProductCandidate): ProductVerifierResult {
  const reasons: string[] = [];
  const jobText = normalize([job.brand, job.productName, job.productKey, job.color].filter(Boolean).join(" "));
  const candidateText = normalize([candidate.title, candidate.brand, candidate.model].filter(Boolean).join(" "));
  const candidateUrl = candidate.url ? normalizeProductUrl(candidate.url) : null;
  const candidateDomain = domainFromUrl(candidateUrl);
  const expectedDomain = storeDomain(job.store);
  const preferredStoreMismatch = Boolean(expectedDomain && candidateDomain && !candidateDomain.includes(expectedDomain));
  const candidateAsin = amazonAsinFromUrl(candidateUrl);

  if (!candidateUrl || !isProductUrl(candidateUrl)) {
    return {
      verifierStatus: "rejected_non_product_page",
      verifierConfidence: 0,
      verifierReasons: ["Candidate is missing or appears to be a search/category page, not an exact product page."],
      verifiedListingUrl: null,
      rejectedListingUrl: candidateUrl,
      rejectedListingTitle: candidate.title || null,
      retrySearchQueries: buildProductRetryQueries(job, "exact product page"),
      canCollectReviews: false,
      canScoreProduct: false,
      canonicalIdentifier: null,
      canonicalMarketplace: candidateDomain || null,
    };
  }

  if (candidateDomain.includes("amazon.") && !candidateAsin) {
    return {
      verifierStatus: "rejected_non_product_page",
      verifierConfidence: 0,
      verifierReasons: ["Amazon candidate does not expose a canonical ASIN."],
      verifiedListingUrl: null,
      rejectedListingUrl: candidateUrl,
      rejectedListingTitle: candidate.title || null,
      retrySearchQueries: buildProductRetryQueries(job, "canonical Amazon ASIN"),
      canCollectReviews: false,
      canScoreProduct: false,
      canonicalIdentifier: null,
      canonicalMarketplace: candidateDomain,
    };
  }

  const stableIdentity = stableProductSearchTerms(job);
  const brand = normalize(stableIdentity.roles.primaryBrand);
  const identityText = candidateText;
  if (brand && !new RegExp(`(?:^|\\s)${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "i").test(identityText)) {
    reasons.push(`Candidate does not contain the known brand identity: ${brand}.`);
  }
  if (candidate.brand && brand && normalize(candidate.brand) !== brand) reasons.push("Fetched candidate brand conflicts with the authoritative requested brand.");
  for (const size of stableIdentity.roles.capacityOrSize) {
    const canonicalSize = (value: string) => normalize(value).replace(/cubic feet|cu\.?\s*ft\.?/g, "cuft").replace(/\d+(?:\.\d+)?/g, (number) => String(Number(number))).replace(/\s+/g, "");
    if (!canonicalSize(identityText).includes(canonicalSize(size))) reasons.push(`Candidate has missing or conflicting capacity identity: ${size}.`);
  }
  const pageEnrichmentFailed = candidate.enrichmentAttempted && !candidate.enrichmentSucceeded && !candidate.identityFetched;

  const requestedColors = colorsIn(jobText);
  const candidateColors = colorsIn(candidateText);
  const requestedBundleTerms = normalize(jobText).match(/\b(bundle|kit|set|pack|pieces?|count)\b/g) || [];
  const candidateBundleTerms = normalize(candidateText).match(/\b(bundle|kit|set|pack|pieces?|count)\b/g) || [];
  if (candidateBundleTerms.length > 0 && requestedBundleTerms.length === 0) {
    reasons.push("Candidate appears to be a bundle or packaged variant not requested by the product identity.");
  }
  if (requestedColors.size > 0 && candidateColors.size > 0) {
    const hasRequestedColor = Array.from(requestedColors).some((color) => candidateColors.has(color));
    const hasDifferentColor = Array.from(candidateColors).some((color) => !requestedColors.has(color));
    if (!hasRequestedColor && hasDifferentColor) {
      reasons.push(
        `Requested color/variant ${Array.from(requestedColors).join(", ")}, but candidate appears to be ${Array.from(candidateColors).join(", ")}.`
      );
    }
  }

  const requestedSizes = meaningfulSizeTokens(stableIdentity.roles.capacityOrSize.join(" "));
  const candidateSizes = meaningfulSizeTokens(candidateText);
  const missingSizes = Array.from(requestedSizes).filter((size) => !candidateSizes.has(size));
  if (missingSizes.length > 0) {
    reasons.push(`Candidate is missing requested size/capacity identity: ${missingSizes.join(", ")}.`);
  }
  const requestedModel = primaryModelSearchTokens(
    job,
    stableProductSearchTerms(job).models
  ).map((value) => normalize(value));

  if (candidate.model && requestedModel.length) {
    const fetchedModel = normalize(candidate.model).replace(/^(?:model|sku|item model number)\s+/, "").replace(/[^a-z0-9]/g, "");
    if (!requestedModel.some((model) => model.replace(/[^a-z0-9]/g, "") === fetchedModel)) {
      reasons.push("Fetched candidate model conflicts with the requested primary model.");
    }
  }

  if (requestedModel.length > 0) {
    const missingModelTokens = requestedModel.filter(
      (model) => {
        const pattern = model.split(/[\s_/-]+/).filter(Boolean)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s_/-]*");
        return !new RegExp(`(?:^|\\s)${pattern}(?:\\s|$)`, "i").test(candidateText);
      }
    );

    if (missingModelTokens.length > 0) {
      reasons.push(
        `Candidate is missing the requested product family/model marker: ${missingModelTokens.join(", ")}.`
      );
    }
  }
  const primaryTitle = normalize(String(candidate.title || "").split(/\b(?:compatible\s+with|works\s+with|for\s+use\s+with)\b/i)[0]);
  const categories = [
    /\b(?:airfryer|air fryer)\b/i, /\b(?:vacuum|vacuum cleaner)\b/i,
    /\b(?:smart ring|ring)\b/i, /\b(?:dryer)\b/i, /\b(?:washer)\b/i,
    /\b(?:pressure cooker)\b/i, /\b(?:doorbell)\b/i, /\b(?:speaker)\b/i,
    /\b(?:power station|generator)\b/i, /\b(?:headphones?|earbuds?)\b/i,
  ];
  const requestedCategories = categories.filter((category) => category.test(normalize(job.productName)));
  const candidateCategories = categories.filter((category) => category.test(primaryTitle));
  if (requestedCategories.length && candidateCategories.length && !requestedCategories.some((category) => category.test(primaryTitle))) {
    reasons.push("Candidate identifies a conflicting product category.");
  }
  if (/\b(?:case|cover|replacement|accessory|protector|strap|charger|filter)\b/i.test(primaryTitle)
    && !/\b(?:case|cover|replacement|accessory|protector|strap|charger|filter)\b/i.test(normalize(job.productName))) {
    reasons.push("Candidate is an accessory or replacement, not the requested primary product.");
  }
  if (stableIdentity.models.some((model) => /\s/.test(model))) {
    const candidateModels = extractProductIdentityTokenRoles({ brand: job.brand, productName: candidate.title }).primaryModels;
    if (candidateModels.length && !candidateModels.some((model) => normalize(model).replace(/[^a-z0-9]/g, "") === requestedModel.join(" ").replace(/[^a-z0-9]/g, ""))) {
      reasons.push("Candidate has a conflicting named product model/family.");
    }
  }

  const terms = importantTerms(job);
  const matchedTerms = terms.filter((term) => candidateText.includes(term));
  const termCoverage = terms.length ? matchedTerms.length / terms.length : 0;
  const requiredTermCoverage = preferredStoreMismatch ? 0.82 : 0.55;

  if (termCoverage < requiredTermCoverage) {
    reasons.push(
      `Candidate is missing distinctive requested terms. Matched ${matchedTerms.length}/${terms.length}: ${matchedTerms.join(", ")}.`
    );
  }

  if (preferredStoreMismatch && termCoverage < 0.82) {
    reasons.push(
      `Preferred store was ${expectedDomain}, but candidate domain is ${candidateDomain || "missing"} and exact-product term coverage is not strong enough for fallback.`
    );
  }

  if (reasons.length > 0) {
    const variantProblem = reasons.some((r) => /color\/variant/i.test(r));
    const ratingProblem = reasons.some((r) => /rating|review count/i.test(r));

    return {
      verifierStatus: variantProblem
        ? "rejected_wrong_variant"
        : ratingProblem
          ? "rejected_rating_review_count_mismatch"
          : "rejected_missing_distinctive_terms",
      verifierConfidence: Math.max(0, Math.round(termCoverage * 45)),
      verifierReasons: reasons,
      verifiedListingUrl: null,
      rejectedListingUrl: candidateUrl,
      rejectedListingTitle: candidate.title || null,
      retrySearchQueries: buildProductRetryQueries(job, reasons[0]),
      canCollectReviews: false,
      canScoreProduct: false,
      canonicalIdentifier: null,
      canonicalMarketplace: candidateDomain || null,
    };
  }

  return {
    verifierStatus: "verified_exact_match",
    verifierConfidence: Math.max(75, Math.round(termCoverage * 100)),
    verifierReasons: [
      preferredStoreMismatch
        ? "Candidate is outside the preferred store, but passed strict exact-product fallback checks."
        : candidate.identityFetched
          ? "Fetched candidate passed store, variant, size, and distinctive-term identity checks; mutable aggregate metadata is ignored for identity."
          : pageEnrichmentFailed
            ? "Tier B candidate passed canonical Amazon ASIN, discovery metadata, store, variant, size, and distinctive-term checks; page enrichment was unavailable."
            : "Candidate passed store, variant, size, and distinctive-term checks; mutable aggregate metadata is ignored for identity.",
    ],
    verifiedListingUrl: normalizeProductUrl(candidateUrl),
    rejectedListingUrl: null,
    rejectedListingTitle: null,
    retrySearchQueries: [],
    canCollectReviews: true,
    canScoreProduct: true,
    canonicalIdentifier: candidateAsin,
    canonicalMarketplace: candidateDomain || null,
  };
}

export function verifyProductCandidate(...args: Parameters<typeof verifyProductCandidateImpl>): ReturnType<typeof verifyProductCandidateImpl> {
  const result = verifyProductCandidateImpl(...args);
  captureStage("verification", () => ({
    args,
    parsedProductIdentity: extractProductIdentityTokenRoles({
      brand: args[0].brand,
      productName: args[1].title,
      model: args[1].model ?? null,
    }),
    result,
  }));
  return result;
}
