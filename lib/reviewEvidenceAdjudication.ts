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
    .replace(/[^a-z0-9]+/g, " ")
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
  if (/review|wirecutter|rtings|cnet|tom'?s hardware/.test(value)) return "professional_review";
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
  if (/specification|metadata|search.snippet|aggregate/i.test(clean(record.evidenceType || record.evidenceKind))) {
    return { accepted: false, reason: "specification or discovery metadata is not written review evidence" };
  }
  if (!hasWrittenCustomerExperience(body)) {
    return { accepted: false, reason: "text has no written customer review structure or experience" };
  }

  const sourceUrl = sourceUrlOf(record);
  const source = clean(record.source);
  const haystack = normalized([body, record.title, source, sourceUrl].filter(Boolean).join(" "));
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
  if (record.reviewedProductName) {
    const reviewed = normalized(record.reviewedProductName).replace(/\s/g, "");
    if (modelTokens.some((model) => !reviewed.includes(normalized(model).replace(/\s/g, "")))) {
      return { accepted: false, reason: "structured review identifies a different product model" };
    }
  }
  if (record.reviewedBrand && requestedBrand && normalized(record.reviewedBrand) !== requestedBrand) {
    return { accepted: false, reason: "structured review identifies a different product brand" };
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

  for (const original of inputRecords) {
    const body = bodyOf(original);
    const source = clean(original.source) || "Unknown evidence source";
    const sourceUrl = sourceUrlOf(original);
    const sourceType = sourceTypeOf(sourceUrl, source);
    const sourceReputation = reputationOf(sourceType, sourceUrl);
    const stableEvidenceHash = hash(body);
    const id = `evidence-${stableEvidenceHash.slice(0, 24)}`;
    const duplicate = stableEvidenceHash ? byHash.get(stableEvidenceHash) || null : null;
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
    if (accepted) byHash.set(stableEvidenceHash, record);
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
