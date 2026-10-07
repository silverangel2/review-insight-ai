import { captureStage } from "./devScanCapture";
import { createHash } from "node:crypto";
import type { AdjudicatedEvidenceRecord } from "./reviewEvidenceAdjudication";

export const DETERMINISTIC_SCORER_VERSION = "deterministic-evidence-scorer-v5";
export const VERDICT_POLICY_VERSION = "buyer-verdict-policy-v1";
export const EVIDENCE_PROVENANCE_VERSION = "accepted-review-provenance-v2";

export type ReviewClaimProvenance = {
  claim: string;
  supportCount: number;
  sourceIds: string[];
  sourceHashes: string[];
  provenance: "ACCEPTED_WRITTEN_REVIEW";
};

export type DeterministicEvidenceResult = {
  buyScore: number | null;
  valueForMoney: "Good" | "Fair" | "Poor" | "Unknown";
  customerVerdict: "BUY" | "AVOID" | "DO NOT BUY YET";
  evidenceState: "SUFFICIENT" | "NOT_ENOUGH";
  acceptedReviewHashes: string[];
  acceptedCorpusHash: string | null;
  marketplaceMetadataSnapshot: Record<string, unknown>;
  deterministicScoringInputs: Record<string, unknown>;
  strengths: ReviewClaimProvenance[];
  complaints: ReviewClaimProvenance[];
  scorerVersion: string;
  verdictPolicyVersion: string;
  finalResultHash: string;
  bottomLine: string;
};

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

function sha(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
}

const positive = /\b(love|great|good|excellent|works|working|reliable|durable|easy|useful|worth|recommend|recommended|stable|bright|fast|portable|lasts|lasting|solid|happy|satisfied)\b/gi;
const negative = /\b(crack|cracked|cracking|bad|poor|broken|failed|fails|stopped|dead|refund|return|returned|disappointed|weak|slow|hard|difficult|unusable|useless|overheat|overheats|unsafe|defective|problem|problems|complaint|complaints|not enough)\b/gi;
const severe = /\b(broken|failed|stopped|dead|defective|unsafe|overheat|overheats|refund|return)\b/gi;

function reviewClauses(body: string) {
  return body.split(/[!?;]|\.(?!\d)|\bbut\b/i);
}

function negatedAt(clause: string, index: number) {
  const prefix = clause.slice(0, index).replace(/[,]/g, " ");
  return /\b(?:no|not|never|without|isn't|isnt|doesn't|doesnt|won't|wont|can't|cant|wasn't|wasnt|aren't|arent|cannot)\b(?:\s+[a-z]+){0,3}\s*$/i.test(prefix)
    && !/\bnot\s+(?:only|just)\b[^.!?;]*$/i.test(prefix);
}

function expectationAt(clause: string, index: number) {
  return /\b(?:supposed to|expected to|advertised as|claimed to|promised to|should be|would be|might be|could be)\b(?:\s+[a-z]+){0,3}\s*$/i.test(clause.slice(0, index));
}

function reviewSentiment(body: string) {
  let praise = 0;
  let complaints = 0;
  let hasSevereComplaint = false;
  for (const clause of reviewClauses(body)) {
    for (const match of clause.matchAll(positive)) {
      if (expectationAt(clause, match.index || 0)) continue;
      if (negatedAt(clause, match.index || 0)) complaints += 1;
      else praise += 1;
    }
    for (const match of clause.matchAll(negative)) {
      if (negatedAt(clause, match.index || 0)) praise += 1;
      else complaints += 1;
    }
    for (const match of clause.matchAll(severe)) {
      if (!negatedAt(clause, match.index || 0)) hasSevereComplaint = true;
    }
    if (/\b(?:doesn't|doesnt|does not|won't|wont|will not|can't|cannot)\s+(?:work|charge|turn on|last|fit)\b/i.test(clause)) {
      complaints += 1;
      hasSevereComplaint = true;
    }
  }
  return { praise, complaints, hasSevereComplaint };
}

type ReviewClaimRule = {
  kind: "strength" | "complaint";
  claim: string;
  pattern: RegExp;
};

const claimRules: ReviewClaimRule[] = [
  // Strengths: every displayed claim still requires support from an
  // accepted exact-product written review. These rules only improve the
  // customer-facing taxonomy; they do not affect scoring.
  {
    kind: "strength",
    claim: "reliable or durable performance",
    pattern: /\b(reliable|durable|lasts|lasting|stable|solid)\b/i,
  },
  {
    kind: "strength",
    claim: "easy to use or set up",
    pattern: /\b(easy|simple|straightforward)\b.{0,50}\b(use|using|setup|set up|operate|operation|controls?|instructions?)\b|\b(use|using|setup|set up|operate|operation|controls?|instructions?)\b.{0,50}\b(easy|simple|straightforward)\b/i,
  },
  {
    kind: "strength",
    claim: "works well or performs as expected",
    pattern: /\b(works|working|reliable|stable)\b/i,
  },
  {
    kind: "strength",
    claim: "good value for the price",
    pattern: /\b(?:good|great|excellent|fair|reasonable|affordable)\b(?:\s+[a-z]+){0,3}\s+(?:value|price|pricing)\b|\b(?:value|price|pricing)\b(?:\s+[a-z]+){0,3}\s+(?:good|great|excellent|fair|reasonable|affordable)\b|\bworth\s+(?:(?:the|my|our|every|extra)\s+)?(?:it|money|price|cost|penny|dollar|paying)\b/i,
  },
  {
    kind: "strength",
    claim: "good cooking results",
    pattern: /\b(cook|cooked|cooking|chicken|steak|roast|roasting)\b.{0,90}\b(perfect|perfection|juicy|delicious|excellent|great|best|nice|right)\b|\b(perfect|perfection|juicy|delicious|excellent|great|best|nice|right)\b.{0,90}\b(cook|cooked|cooking|chicken|steak|roast|roasting)\b/i,
  },
  {
    kind: "strength",
    claim: "fast or efficient performance",
    pattern: /\b(fast|quick|quickly|speedy)\b/i,
  },
  {
    kind: "strength",
    claim: "easy to clean or maintain",
    pattern: /\b(easy|simple|straightforward)\b.{0,50}\b(clean|cleaning|cleanup|maintain|maintenance)\b|\b(clean|cleaning|cleanup|maintain|maintenance)\b.{0,50}\b(easy|simple|straightforward)\b/i,
  },
  {
    kind: "strength",
    claim: "solid build or product quality",
    pattern: /\b(?:sturdy|well[- ]built)\b|\b(?:solid|durable|reliable)\b.{0,30}\b(?:build|body|materials?|housing|quality|plastic|construction|metal|unit)\b|\b(?:build|body|materials?|housing|quality|plastic|construction|metal|unit)\b.{0,30}\b(?:solid|durable|reliable)\b/i,
  },
  {
    kind: "strength",
    claim: "attractive design or appearance",
    pattern: /\b(looks?|colour|color|pink|counter|kitchen)\b.{0,60}\b(nice|great|beautiful|love|matches?|awesome)\b|\b(nice|great|beautiful|love|matches?|awesome)\b.{0,60}\b(looks?|colour|color|pink|counter|kitchen)\b/i,
  },
  {
    kind: "strength",
    claim: "useful features or functions",
    pattern: /\b(useful|love|great|game[- ]changer|game changer)\b.{0,60}\b(feature|features|function|functions|mode|modes|option|options|container|containers|glass)\b|\b(feature|features|function|functions|mode|modes|option|options|container|containers|glass)\b.{0,60}\b(useful|love|great|game[- ]changer|game changer|size options?)\b/i,
  },

  // Complaints. Low-frequency accepted-review observations may remain in
  // the result with supportCount=1 instead of disappearing merely because
  // they are not recurring.
  {
    kind: "complaint",
    claim: "reliability or failure problems",
    pattern: /\b(broken|failed|fails|stopped|dead|defective|unusable|doesn't|doesnt|won't|wont)\b/i,
  },
  {
    kind: "complaint",
    claim: "weak, slow, or overheating performance",
    pattern: /\b(weak|slow|not enough|overheat|overheats|problem|problems)\b/i,
  },
  {
    kind: "complaint",
    claim: "return or refund problems",
    pattern: /\b(refund|return|returned|complaint|complaints)\b/i,
  },
  {
    kind: "complaint",
    claim: "difficult or confusing use or setup",
    pattern: /\b(hard|difficult|unusable|problem|problems)\b.{0,50}\b(use|using|setup|set up|instructions?|manual)\b|\b(use|using|setup|set up|instructions?|manual)\b.{0,50}\b(hard|difficult|unusable|problem|problems)\b/i,
  },
  {
    kind: "complaint",
    claim: "cracking or material durability problems",
    pattern: /\b(crack|cracked|cracking)\b.{0,80}\b(plastic|material|housing|body|part|parts|unit|product)\b|\b(plastic|material|housing|body|part|parts|unit|product)\b.{0,80}\b(crack|cracked|cracking)\b/i,
  },
  {
    kind: "complaint",
    claim: "build or product quality problems",
    pattern: /\b(broken|defective|failed|fails|dead|unusable|crack|cracked|cracking)\b.{0,50}\b(build|quality|part|parts|unit|product)\b|\b(build|quality|part|parts|unit|product)\b.{0,50}\b(broken|defective|failed|fails|dead|unusable|crack|cracked|cracking)\b/i,
  },
  {
    kind: "complaint",
    claim: "difficult cleaning or maintenance",
    pattern: /\b(hard|difficult|problem|problems)\b.{0,50}\b(clean|cleaning|cleanup|maintain|maintenance)\b|\b(clean|cleaning|cleanup|maintain|maintenance)\b.{0,50}\b(hard|difficult|problem|problems)\b/i,
  },
  {
    kind: "complaint",
    claim: "capacity or performance is not enough",
    pattern: /\b(not enough)\b.{0,50}\b(capacity|power|performance|space|size)\b|\b(capacity|power|performance|space|size)\b.{0,50}\b(not enough)\b/i,
  },
];

function provenanceFor(
  rule: ReviewClaimRule,
  records: AdjudicatedEvidenceRecord[],
): ReviewClaimProvenance | null {
  const matching = records.filter((record) => {
    return reviewClauses(record.body).some((clause) => {
      if (!rule.pattern.test(clause)) return false;
      const sentiment = reviewSentiment(clause);
      const praiseCount = sentiment.praise + Array.from(clause.matchAll(/\b(nice|beautiful|best|perfect|perfection|delicious|juicy)\b|to die for/gi)).filter((match) => !negatedAt(clause, match.index || 0) && !expectationAt(clause, match.index || 0)).length;
      const complaintCount = sentiment.complaints;
      if (rule.kind === "strength") {
        return !/\b(?:not|never|isn't|isnt|doesn't|doesnt)\b.{0,24}\b(?:good|great|easy|reliable|durable|worth|works?|fast|useful)\b/i.test(clause)
          && praiseCount > complaintCount;
      }
      return !/\b(?:no|never|without|not)\b.{0,16}\b(?:problems?|complaints?|cracks?|cracked|broken|failed|refund)\b/i.test(clause)
        && complaintCount > 0;
    });
  });

  if (!matching.length) return null;

  return {
    claim: rule.claim,
    supportCount: matching.length,
    sourceIds: Array.from(new Set(matching.map((record) => record.id))).sort(),
    sourceHashes: Array.from(
      new Set(matching.map((record) => record.stableEvidenceHash)),
    ).sort(),
    provenance: "ACCEPTED_WRITTEN_REVIEW",
  };
}

function rankedClaims(
  kind: ReviewClaimRule["kind"],
  records: AdjudicatedEvidenceRecord[],
): ReviewClaimProvenance[] {
  return claimRules
    .filter((rule) => rule.kind === kind)
    .map((rule) => provenanceFor(rule, records))
    .filter(
      (item): item is ReviewClaimProvenance =>
        Boolean(item),
    )
    .sort(
      (a, b) =>
        b.supportCount - a.supportCount ||
        a.claim.localeCompare(b.claim),
    )
    .slice(0, 5);
}

function deriveDeterministicEvidenceResultImpl(input: {
  acceptedRecords: AdjudicatedEvidenceRecord[];
  exactProductAccepted: boolean;
  rating: number | null;
  marketplaceReviewCount: number;
  price?: number | null;
  verifiedProductMetadata?: Record<string, unknown>;
  riskFeatures?: Record<string, unknown>;
  summaryModelVersion?: string | null;
}): DeterministicEvidenceResult {
  const records = [...new Map(input.acceptedRecords.filter((record) => record.accepted && record.exactProductAccepted)
    .map((record) => [record.stableEvidenceHash, record])).values()]
    .sort((a, b) => a.stableEvidenceHash.localeCompare(b.stableEvidenceHash));
  const acceptedReviewHashes = records.map((record) => record.stableEvidenceHash);
  const acceptedCorpusHash = acceptedReviewHashes.length ? sha({ version: EVIDENCE_PROVENANCE_VERSION, acceptedReviewHashes }) : null;
  const n = records.length;
  const sentiments = records.map((record) => reviewSentiment(record.body));
  const positiveCounts = sentiments.map((sentiment) => sentiment.praise);
  const negativeCounts = sentiments.map((sentiment) => sentiment.complaints);
  const positiveSignal = positiveCounts.reduce((sum, count) => sum + Math.min(count, 4), 0);
  const negativeSignal = negativeCounts.reduce((sum, count) => sum + Math.min(count, 4), 0);
  const severeCount = sentiments.filter((sentiment) => sentiment.hasSevereComplaint).length;
  const sufficient = input.exactProductAccepted && n >= 5 && Boolean(acceptedCorpusHash);
  const marketplaceScore = typeof input.rating === "number" && Number.isFinite(input.rating) ? Math.max(0, Math.min(10, input.rating * 2)) : null;
  const sentimentScore = n ? Math.max(0, Math.min(10, 5 + ((positiveSignal - negativeSignal) / Math.max(1, n)) * 1.6)) : null;
  const severeRatio = n ? severeCount / n : 0;
  const score = sufficient && positiveSignal + negativeSignal > 0 && sentimentScore !== null && marketplaceScore !== null
    ? Math.round(Math.max(1, Math.min(10, sentimentScore * 0.7 + marketplaceScore * 0.3 - severeRatio * 2)) * 10) / 10
    : null;
  const verdict: "BUY" | "AVOID" | "DO NOT BUY YET" = !sufficient || score === null ? "DO NOT BUY YET" : score !== null && score >= 6.5 && severeRatio < 0.35 && positiveSignal >= negativeSignal ? "BUY" : "AVOID";
  const strengths = sufficient ? rankedClaims("strength", records) : [];
  const complaints = sufficient ? rankedClaims("complaint", records) : [];
  const valueRule = claimRules.find((rule) => rule.claim === "good value for the price");
  const valuePraise = valueRule ? provenanceFor(valueRule, records)?.supportCount || 0 : 0;
  const valueComplaints = records.filter((record) => reviewClauses(record.body).some((clause) =>
    Array.from(clause.matchAll(/\b(?:not worth\s+(?:(?:the|my|our|extra)\s+)?(?:it|money|price|cost|penny|dollar|paying)|overpriced|expensive|waste of money|poor value|bad value)\b/gi)).some((match) => !negatedAt(clause, match.index || 0) && !expectationAt(clause, match.index || 0))
  )).length;
  const valueForMoney: "Good" | "Fair" | "Poor" | "Unknown" = score === null || valuePraise + valueComplaints === 0 ? "Unknown" : valuePraise > valueComplaints ? "Good" : valueComplaints > valuePraise ? "Poor" : "Fair";
  const marketplaceMetadataSnapshot = {
    rating: input.rating,
    reviewCount: input.marketplaceReviewCount,
    price: input.price ?? null,
    exactProductAccepted: input.exactProductAccepted,
  };
  const deterministicScoringInputs = {
    acceptedReviewCount: n,
    positiveSignal,
    negativeSignal,
    severeComplaintCount: severeCount,
    severeComplaintRatio: severeRatio,
    marketplaceScore,
    sentimentScore,
    minimumAcceptedReviews: 5,
    sufficient,
  };
  // Model-generated risk estimates and summary-model names are telemetry,
  // not inputs to the deterministic evidence policy or its result identity.
  const withoutHash = { scorerVersion: DETERMINISTIC_SCORER_VERSION, verdictPolicyVersion: VERDICT_POLICY_VERSION, acceptedReviewHashes, acceptedCorpusHash, marketplaceMetadataSnapshot, deterministicScoringInputs, buyScore: score, valueForMoney, customerVerdict: verdict, strengths, complaints };
  return {
    ...withoutHash,
    evidenceState: sufficient ? "SUFFICIENT" : "NOT_ENOUGH",
    bottomLine: verdict === "BUY" ? "Accepted exact-product review evidence supports buying this product." : verdict === "AVOID" ? "Accepted exact-product review evidence indicates material purchase risk." : sufficient ? "Accepted reviews were found, but ReviewIntel lacks enough grounded scoring inputs for a buying recommendation." : "ReviewIntel couldn't verify enough exact-product review evidence to recommend this purchase yet.",
    finalResultHash: sha(withoutHash),
  };
}

export function deriveDeterministicEvidenceResult(...args: Parameters<typeof deriveDeterministicEvidenceResultImpl>): ReturnType<typeof deriveDeterministicEvidenceResultImpl> {
  const result = deriveDeterministicEvidenceResultImpl(...args);
  captureStage("corpus", () => {
    const sourceDistribution: Record<string, number> = {};
    for (const record of args[0].acceptedRecords) sourceDistribution[record.independentSourceId] = (sourceDistribution[record.independentSourceId] || 0) + 1;
    return { acceptedHashes: result.acceptedReviewHashes, sourceDistribution, corpusHash: result.acceptedCorpusHash };
  });
  captureStage("evaluation", { args, result });
  return result;
}
