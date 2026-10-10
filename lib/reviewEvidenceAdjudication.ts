import { captureStage } from "./devScanCapture";
import { createHash } from "node:crypto";
import { stableProductSearchTerms } from "./productIdentityTokens";

export type EvidenceSourceType =
  | "marketplace"
  | "retailer"
  | "manufacturer"
  | "professional_review"
  | "forum"
  | "ugc"
  | "unknown";

export type EvidenceReputation = "high" | "medium" | "low" | "unknown";

export type AdjudicationInputRecord = {
  body?: unknown;
  text?: unknown;
  snippet?: unknown;
  title?: unknown;
  source?: unknown;
  sourceUrl?: unknown;
  reviewId?: unknown;
  retrievedAt?: unknown;
  marketplaceProductId?: unknown;
  rating?: unknown;
  date?: unknown;
  verified?: unknown;
  [key: string]: unknown;
};

export type AdjudicatedEvidenceRecord = {
  id: string;
  body: string;
  source: string;
  sourceUrl: string | null;
  reviewId: string | null;
  retrievedAt: string | null;
  marketplaceProductId: string | null;
  sourceType: EvidenceSourceType;
  sourceReputation: EvidenceReputation;
  stableEvidenceHash: string;
  independentSourceId: string;
  exactProductAccepted: boolean;
  accepted: boolean;
  rejectionReason: string | null;
  duplicateOf: string | null;
  original: AdjudicationInputRecord;
};

export type ReviewEvidenceAdjudication = {
  records: AdjudicatedEvidenceRecord[];
  acceptedRecords: AdjudicatedEvidenceRecord[];
  rejectedRecords: AdjudicatedEvidenceRecord[];
  independentSourceIds: string[];
  independentSourceCount: number;
  deduplicatedRecordCount: number;
  acceptedRecordCount: number;
  rejectedRecordCount: number;
  evidenceSignals: number;
  exactProductAccepted: boolean;
  sufficientByExistingThreshold: boolean;
  claimVerification?: {
    passed: boolean;
    claims: Array<{ claim: unknown; sourceIds: string[]; verified: boolean }>;
  };
  deterministicConfidenceInputs: {
    acceptedIndependentSourceCount: number;
    usableReviewCount: number;
    averageProductMatchScore: number;
    averageSourceReputationScore: number;
  };
};

export type AdjudicationOptions = {
  productName?: string | null;
  brand?: string | null;
  model?: string | null;
  exactListingAccepted?: boolean | null;
  exactListingUrl?: string | null;
  exactListingTitle?: string | null;
};

function clean(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/<[^>]*>/g, " ")
    .replace(/\\u0026/g, "&")
    .replace(/\\n/g, " ")
    .replace(/Brief content visible, double tap to read full content\. Full content visible, double tap to read brief content\./gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bodyOf(record: AdjudicationInputRecord): string {
  return clean(
    record.body ?? record.text ?? record.snippet ?? record.content ?? record.review ?? record.reviewText
  );
}

function normalized(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: unknown): string[] {
  const generic = new Set(["test", "product", "review", "reviews", "brand", "model", "item"]);
  return Array.from(
    new Set(
      normalized(value)
        .split(" ")
        .filter((token) => (token.length >= 4 || /\d/.test(token)) && !generic.has(token))
    )
  );
}

function hostOf(value: string | null): string {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sourceUrlOf(record: AdjudicationInputRecord): string | null {
  const explicit = clean(record.sourceUrl);
  if (/^https?:\/\//i.test(explicit)) return explicit;
  const source = clean(record.source);
  return /^https?:\/\//i.test(source) ? source : null;
}

function sourceTypeOf(url: string | null, source: string): EvidenceSourceType {
  const value = `${hostOf(url)} ${source}`.toLowerCase();
  if (/amazon\.|walmart\.|bestbuy\.|costco\.|target\.|ebay\./.test(value)) return "marketplace";
  if (/retailer|shop|store|buy/.test(value)) return "retailer";
  if (/manufacturer|official|brand/.test(value)) return "manufacturer";
  if (/reddit\.|forum|community|quora/.test(value)) return "forum";
  if (/youtube\.|tiktok\.|instagram\.|ugc/.test(value)) return "ugc";
  if (/professional|editorial|wirecutter|rtings|cnet|tom'?s hardware/.test(value)) return "professional_review";
  return "unknown";
}

function reputationOf(type: EvidenceSourceType, url: string | null): EvidenceReputation {
  const host = hostOf(url);
  if (type === "marketplace" || type === "retailer") return "high";
  if (type === "manufacturer" || type === "professional_review") return "medium";
  if (type === "forum" || type === "ugc") return "low";
  return host ? "unknown" : "low";
}

function reputationScore(value: EvidenceReputation): number {
  if (value === "high") return 1;
  if (value === "medium") return 0.7;
  if (value === "low") return 0.35;
  return 0;
}

function hash(value: string): string {
  return createHash("sha256").update(normalized(value)).digest("hex");
}

export function hasWrittenCustomerExperience(body: string): boolean {
  return /\b(i|we|my|our|me|us|bought|purchased|received|used|using|works?|worked|love|liked|easy|good|great|bad|poor|reliable|durable|comfortable|lasts?|lasted|failed|cracked|broke|returned|refund|recommend|happy|disappointed|excellent|expensive|stopped|waste of money)\b/i.test(body)
    || /\b(?:j['\u2019](?:ai|adore|aime|utilise)|je|nous|mon|ma|mes|ich|mein|meine|gekauft|benutzt|yo|compr[e\u00e9]|us[e\u00e9])\b/iu.test(body);
}

function identityAccepted(body: string, record: AdjudicationInputRecord, options: AdjudicationOptions): { accepted: boolean; reason: string | null } {
  if (record.blockedPage === true || record.blockedOrChallenged === true || record.challenged === true || Number(record.httpStatus ?? record.status ?? 0) >= 400) {
    return { accepted: false, reason: "blocked or challenged page cannot supply review evidence" };
  }
  if (!body || body.length < 12) return { accepted: false, reason: "missing or unusable written review text" };
  if (!record.body && !record.text && record.snippet) return { accepted: false, reason: "search snippet is not extracted written review evidence" };
  if (/specification|metadata|search.snippet|aggregate|ai.summary|model.summary|product.description/i.test(clean(record.evidenceType || record.evidenceKind))) {
    return { accepted: false, reason: "specification or discovery metadata is not written review evidence" };
  }
  if ((!hasWrittenCustomerExperience(body) && /\b(?:specifications?|technical specs|product description)\b/i.test(body)) || (record.reviewStructureVerified !== true && !hasWrittenCustomerExperience(body))) {
    return { accepted: false, reason: "text has no written customer review structure or experience" };
  }

  // Listing chrome (the product title itself) is not a customer's words.
  const titleWordsSet = new Set(normalized([options.exactListingTitle, options.productName].filter(Boolean).join(" ")).split(" ").filter(Boolean));
  const bodyWords = normalized(body).split(" ").filter(Boolean);
  if (bodyWords.length >= 4 && titleWordsSet.size >= 4 && bodyWords.filter(word => titleWordsSet.has(word)).length / bodyWords.length >= 0.9) {
    return { accepted: false, reason: "text repeats the product title rather than a customer review" };
  }
  const sourceUrl = sourceUrlOf(record);
  if (!sourceUrl || !hostOf(sourceUrl)) return { accepted: false, reason: "written review has no traceable source URL" };
  const source = clean(record.source);
  const haystack = normalized([body, record.title, record.reviewStructureVerified === true ? record.reviewedProductName : null, source, sourceUrl].filter(Boolean).join(" "));
  const identityTokens = tokens([options.brand, options.productName, options.model, options.exactListingTitle].filter(Boolean).join(" "));
  const requestedBrand = normalized(options.brand);
  const modelTokens = stableProductSearchTerms({ brand: options.brand, productName: options.productName, model: options.model }).models;
  const distinctive = identityTokens.filter((token) => token.length >= 5 || /\d/.test(token));
  const identityHits = distinctive.filter((token) => haystack.includes(token));
  const host = hostOf(sourceUrl);
  const exactHost = hostOf(options.exactListingUrl ? clean(options.exactListingUrl) : null);

  const asinOf = (value: unknown) => clean(value).match(/\/(?:dp|gp\/product|gp\/aw\/d|product-reviews)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1]?.toUpperCase() || null;
  const exactAsin = asinOf(options.exactListingUrl);
  const sourceAsin = asinOf(sourceUrl) || clean(record.marketplaceProductId).toUpperCase() || null;
  if (exactAsin && sourceAsin && exactAsin !== sourceAsin) {
    return { accepted: false, reason: "review source identifies a different product ID" };
  }
  const sourcePath = (value: unknown) => {
    try { return new URL(clean(value)).pathname.replace(/\/$/, ""); } catch { return null; }
  };
  const listingAssociation = options.exactListingAccepted === true && exactHost && host === exactHost
    && ((exactAsin && sourceAsin && exactAsin === sourceAsin)
      || sourcePath(sourceUrl) === sourcePath(options.exactListingUrl));
  // On the verified listing (same host + same stable id/path), a product name
  // inherited from the page title is listing identity, not a per-review claim
  // of a different model; per-review variants are still checked below.
  const pageInheritedName = (record as { reviewedProductNameSource?: unknown }).reviewedProductNameSource === "page";
  if (record.reviewedProductName && !(listingAssociation && pageInheritedName && !record.reviewedModel)) {
    const reviewed = normalized(record.reviewedProductName).replace(/\s/g, "");
    if (modelTokens.some((model) => !reviewed.includes(normalized(model).replace(/\s/g, "")))) {
      return { accepted: false, reason: "structured review identifies a different product model" };
    }
  }
  if (record.reviewedBrand && requestedBrand && normalized(record.reviewedBrand) !== requestedBrand) {
    return { accepted: false, reason: "structured review identifies a different product brand" };
  }

  const requestedRoles = stableProductSearchTerms({brand: options.brand, productName: options.productName, model: options.model}).roles;
  // Owner policy (2026-10-10): colour/finish is cosmetic. A review of the same
  // model in another colour counts; size, capacity, model, generation, bundle and
  // accessory differences are still rejected. Limitation: categories where colour
  // changes function are not special-cased.
  const requestedVariants = [...requestedRoles.capacityOrSize,
    ...requestedRoles.primaryVariants.filter(value => /^size\s+\d|^(?:xl|xxl)$/i.test(value))];
  const explicitVariant = clean([record.reviewedVariant || record.variant, record.reviewedColor,
    record.reviewedSize ? `size ${record.reviewedSize}` : null, record.reviewedCapacity].filter(Boolean).join(" "));
  const reviewedRoles = stableProductSearchTerms({brand: options.brand,
    productName: [record.reviewedProductName, explicitVariant].filter(Boolean).join(" "),
    model: typeof record.reviewedModel === "string" ? record.reviewedModel : null}).roles;
  const canonicalVariant = (value: string) => normalized(value).replace(/grey/g, "gray").replace(/quarts?|qts?/g, "qt").replace(/litres?|liters?/g, "l").replace(/\s+/g, "");
  if (record.sharedReviewPool === true && !record.reviewedProductName && !(record.reviewedModel && modelTokens.length)) {
    return {accepted: false, reason: "shared parent review pool lacks explicit child product identity"};
  }
  if (record.reviewedModel && modelTokens.length && !modelTokens.some(model => normalized(model) === normalized(record.reviewedModel))) {
    return {accepted: false, reason: "structured review identifies a different product model"};
  }
  if (explicitVariant) {
    const explicitRoles = stableProductSearchTerms({productName: explicitVariant}).roles;
    const requestedSize = normalized(options.productName).match(/\bsize\s+(\d+(?:\.\d+)?)/)?.[1];
    const explicitSize = normalized(explicitVariant).match(/\bsize\s+(\d+(?:\.\d+)?)/)?.[1];
    if (requestedSize && explicitSize && requestedSize !== explicitSize) {
      return {accepted: false, reason: "structured review identifies a different size variant"};
    }
    if (requestedRoles.capacityOrSize.length && explicitRoles.capacityOrSize.some(size => !requestedRoles.capacityOrSize.some(requested => canonicalVariant(requested) === canonicalVariant(size)))) {
      return {accepted: false, reason: "structured review identifies a different capacity variant"};
    }
  }
  if (explicitVariant || record.sharedReviewPool === true) {
    const explicitContext = normalized([record.reviewedProductName, explicitVariant].filter(Boolean).join(" "));
    if (requestedVariants.some(variant => !canonicalVariant(explicitContext).includes(canonicalVariant(variant)))) {
      return {accepted: false, reason: "shared or variant review lacks the requested child size or capacity"};
    }
  }
  const reviewedColors = reviewedRoles.colors;
  void reviewedColors; // colour differences are cosmetic and never reject

  // A verified listing association is strong product context, but it must not
  // automatically bless text that explicitly reviews a separate sizing-kit
  // accessory. Marketplaces can expose accessory/parent-child review content
  // under the same listing context.
  const reviewSubjectText = normalized([
    body,
    record.title,
    record.reviewedProductName,
  ].filter(Boolean).join(" "));

  const accessory = /\b(?:sizing kit|size kit|kit de tailles?|kit de mesures?|replacement filter|replacement part|charging case|(?:the|wall|car|replacement) charger|mount|accessory)\b/i;
  const requestedIsAccessory = accessory.test(normalized([options.productName, options.model].join(" ")));
  const accessoryMention = accessory.test(reviewSubjectText);
  // Derive product anchors from the requested identity, rather than a list
  // of previously seen product categories. Accessory compatibility alone is
  // not primary-product use; a primary anchor needs its own experience verb.
  const excludedAnchors = new Set(normalized([options.brand, ...modelTokens, ...requestedVariants, "smart new premium personal ultra thin health fitness tracking for with and the"].join(" ")).split(" "));
  const anchors = normalized(options.productName).split(" ").filter(token => token.length >= 3 && !excludedAnchors.has(token) && !/\d/.test(token));
  const anchorPattern = [...anchors, "device", "product", "unit"].map(token => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const productExperience = new RegExp(`\\b(?:${anchorPattern})\\b.{0,65}\\b(?:works?|worked|using|used|comfortable|battery|charge|failed|died|broke|clean|cooks?|cooked|performance)\\b|\\b(?:using|used|wear|wore|bought|purchased)\\b.{0,20}\\b(?:${anchorPattern})\\b`, "i").test(reviewSubjectText)
    || /\b(?:this|current|new)\s+(?:version|one|unit|product)\b.{0,180}\b(?:works?|used|use|power|keeps?|charge)\b/i.test(reviewSubjectText);
  const accessorySubject = accessory.test(normalized(record.reviewedProductName));
  // The reviewer's own words (not the listing title) naming the requested
  // product's category/identity words (singular or plural) show the review is about it; an incidental accessory mention
  // (e.g. "I have a ceiling mount") must not discard that review.
  const anchorMention = anchors.length > 0 && new RegExp(`\\b(?:${anchors.map(token => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?:s|es)?\\b`, "i").test(normalized([body, record.title].filter(Boolean).join(" ")));
  if (!requestedIsAccessory && accessoryMention && (accessorySubject || (!productExperience && !anchorMention))) {
    return { accepted: false, reason: /sizing|size kit|kit de/.test(reviewSubjectText)
      ? "review text identifies a sizing-kit accessory rather than the requested product"
      : "review text identifies an accessory rather than the requested product" };
  }
  // Explicit contradictory generation/model text overrides a shared listing.
  const generations = normalized(options.model || options.productName).match(/\bgen(?:eration)?\s+(\d+)\b/);
  const bodyGeneration = normalized(body).match(/\bgen(?:eration)?\s+(\d+)\b/);
  const explicitComparison = /\b(?:upgraded?|switched|compared)\s+(?:from|to|with)|\b(?:previous|before)\b/i.test(body);
  if (generations && bodyGeneration && generations[1] !== bodyGeneration[1] && !explicitComparison) {
    return { accepted: false, reason: "review text identifies a different product generation or variant" };
  }

  if (listingAssociation) {
    return { accepted: true, reason: null };
  }

  if (requestedBrand && !new RegExp(`(?:^|\\s)${requestedBrand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "i").test(haystack)) {
    return { accepted: false, reason: "brand identity not present in evidence context" };
  }

  if (modelTokens.length && !modelTokens.every((model) => haystack.replace(/\s/g, "").includes(normalized(model).replace(/\s/g, "")))) {
    return { accepted: false, reason: "model identity not present in evidence context" };
  }

  if (identityHits.length === 0) {
    return { accepted: false, reason: "evidence does not identify the requested product" };
  }

  if (identityHits.length === 1 && distinctive.length > 3 && !sourceUrl) {
    return { accepted: false, reason: "ambiguous product identity without a source URL" };
  }

  return { accepted: true, reason: null };
}

function adjudicateReviewEvidenceImpl(
  inputRecords: AdjudicationInputRecord[],
  options: AdjudicationOptions = {}
): ReviewEvidenceAdjudication {
  const records: AdjudicatedEvidenceRecord[] = [];
  const byHash = new Map<string, AdjudicatedEvidenceRecord>();
  const byReviewId = new Map<string, AdjudicatedEvidenceRecord>();

  const orderedInputs = [...inputRecords].sort((a, b) =>
    bodyOf(b).length - bodyOf(a).length || hash(bodyOf(a)).localeCompare(hash(bodyOf(b))) ||
    (sourceUrlOf(a) || "").localeCompare(sourceUrlOf(b) || "") || clean(a.reviewId).localeCompare(clean(b.reviewId)));
  for (const original of orderedInputs) {
    const body = bodyOf(original);
    const source = clean(original.source) || "Unknown evidence source";
    const sourceUrl = sourceUrlOf(original);
    const sourceType = sourceTypeOf(sourceUrl, source);
    const sourceReputation = reputationOf(sourceType, sourceUrl);
    const stableEvidenceHash = hash(body);
    const id = `evidence-${stableEvidenceHash.slice(0, 24)}`;
    const reviewKey = clean(original.reviewId) && hostOf(sourceUrl) ? `${hostOf(sourceUrl)}:${clean(original.reviewId)}` : null;
    const duplicate = byHash.get(stableEvidenceHash) || (reviewKey ? byReviewId.get(reviewKey) : null) || null;
    const identity = identityAccepted(body, original, options);
    const accepted = identity.accepted && !duplicate;
    const record: AdjudicatedEvidenceRecord = {
      id,
      body,
      source,
      sourceUrl,
      reviewId: clean(original.reviewId) || null,
      retrievedAt: clean(original.retrievedAt) || null,
      marketplaceProductId: clean(original.marketplaceProductId) || null,
      sourceType,
      sourceReputation,
      stableEvidenceHash,
      independentSourceId: hostOf(sourceUrl) || `source:${normalized(source) || "unknown"}`,
      exactProductAccepted: identity.accepted,
      accepted,
      rejectionReason: duplicate
        ? "duplicate of previously accepted evidence"
        : identity.reason,
      duplicateOf: duplicate?.id || null,
      original,
    };
    records.push(record);
    if (accepted) {
      byHash.set(stableEvidenceHash, record);
      if (reviewKey) byReviewId.set(reviewKey, record);
    }
  }

  const acceptedRecords = records.filter((record) => record.accepted);
  const rejectedRecords = records.filter((record) => !record.accepted);
  const independentSourceIds = Array.from(new Set(acceptedRecords.map((record) => record.independentSourceId)));
  const exactListingAccepted = options.exactListingAccepted === true;
  const averageProductMatchScore = acceptedRecords.length ? acceptedRecords.filter((record) => record.exactProductAccepted).length / acceptedRecords.length : 0;
  const averageSourceReputationScore = acceptedRecords.length
    ? acceptedRecords.reduce((sum, record) => sum + reputationScore(record.sourceReputation), 0) / acceptedRecords.length
    : 0;

  return {
    records,
    acceptedRecords,
    rejectedRecords,
    independentSourceIds,
    independentSourceCount: independentSourceIds.length,
    deduplicatedRecordCount: records.filter((record) => Boolean(record.duplicateOf)).length,
    acceptedRecordCount: acceptedRecords.length,
    rejectedRecordCount: rejectedRecords.length,
    evidenceSignals: acceptedRecords.length,
    exactProductAccepted: exactListingAccepted,
    sufficientByExistingThreshold: exactListingAccepted && acceptedRecords.length >= 3 && acceptedRecords.length >= 3,
    deterministicConfidenceInputs: {
      acceptedIndependentSourceCount: independentSourceIds.length,
      usableReviewCount: acceptedRecords.length,
      averageProductMatchScore,
      averageSourceReputationScore,
    },
  };
}

export function claimSourceIds(
  claim: unknown,
  acceptedRecords: AdjudicatedEvidenceRecord[]
): string[] {
  const text = normalized(claim);
  if (!text) return [];
  const claimTokens = new Set(tokens(text));
  return acceptedRecords
    .filter((record) => {
      const body = normalized(record.body);
      if (body.includes(text) || text.includes(body)) return true;
      const overlap = tokens(body).filter((token) => claimTokens.has(token)).length;
      return overlap >= Math.min(3, Math.max(1, claimTokens.size));
    })
    .map((record) => record.id);
}

export function verifyEvidenceClaims(
  claims: Array<{ claim: unknown; sourceIds?: unknown[] }>,
  adjudication: ReviewEvidenceAdjudication
) {
  const acceptedIds = new Set(adjudication.acceptedRecords.map((record) => record.id));
  const verified = claims.map((item) => {
    const derivedSourceIds = claimSourceIds(item.claim, adjudication.acceptedRecords);
    const providedSourceIds = Array.isArray(item.sourceIds)
      ? item.sourceIds.map(String).filter((id) => acceptedIds.has(id))
      : [];
    // A valid citation ID does not establish that its review supports a claim.
    const sourceIds = derivedSourceIds.filter((id) => !providedSourceIds.length || providedSourceIds.includes(id));
    return { claim: item.claim, sourceIds, verified: sourceIds.length > 0 };
  });
  return {
    passed: verified.every((item) => item.verified),
    claims: verified,
  };
}

export function adjudicateReviewEvidence(...args: Parameters<typeof adjudicateReviewEvidenceImpl>): ReturnType<typeof adjudicateReviewEvidenceImpl> {
  const result = adjudicateReviewEvidenceImpl(...args);
  captureStage("adjudication", { args, result });
  return result;
}

export function normalizeReviewCandidate(record: AdjudicationInputRecord) {
  const body = bodyOf(record);
  return { normalizedBody: body, normalizedReviewHash: hash(body) };
}
