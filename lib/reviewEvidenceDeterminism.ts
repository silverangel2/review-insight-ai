import { semanticText, reviewLanguageHint, SEMANTIC_VERSION } from "./reviewSemanticSignals";
import { captureStage } from "./devScanCapture";
import { createHash } from "node:crypto";
import type { AdjudicatedEvidenceRecord } from "./reviewEvidenceAdjudication";

export const DETERMINISTIC_SCORER_VERSION = "deterministic-evidence-scorer-v10";
export const VERDICT_POLICY_VERSION = "buyer-verdict-policy-v2";
export const EVIDENCE_PROVENANCE_VERSION = "accepted-review-provenance-v4";

export type ReviewClaimProvenance = {
  claim: string;
  supportCount: number;
  sourceIds: string[];
  sourceHashes: string[];
  provenance: "ACCEPTED_WRITTEN_REVIEW";
  sourceUrls: string[];
  sourceDiversity: number;
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

const positive = /\b(awesome|lifesaver|game[- ]changer|perfect|perfection|delicious|juicy|best|nice|beautiful|love|loved|enjoying|impressed|comfortable|insightful|fantastic|great|good|excellent|works|worked|working|reliable|durable|easy|useful|worth|recommend|recommended|stable|bright|fast|portable|lasts|lasting|solid|happy|satisfied)\b/gi;
const negative = /\b(overpriced|waste of money|crack|cracked|cracking|broke|breaks|bad|poor|broken|failed|fails|stopped|died|dies|dead|refund|return|returned|disappointed|weak|slow|hard|difficult|unusable|useless|overheat|overheats|unsafe|defective|problem|problems|complaint|complaints|not enough)\b/gi;
const severe = /\b(cracked|cracking|breaks|broke|broken|failed|stopped|died|dies|dead|defective|unsafe|overheat|overheats)\b/gi;

function reviewClauses(body: string) {
  const clauses: string[] = [];
  let previousProduct = false;
  for (const sentence of semanticText(body).split(/[!?;]|\.(?!\d)/)) {
    // Discourse, not brand names, identifies a previously owned product.
    // Its failure must not become evidence against the replacement product.
    const introducesPrevious = /\b(?:used to (?:own|have|use)|(?:i|we) (?:had|owned) (?:a|an) (?!problem|issue|complaint|failure|defect|question|refund|return|great|good|bad)\b)/i.test(sentence);
    if (introducesPrevious) previousProduct = true;
    const transitionsToCurrent = /\b(?:replaced (?:it|that|them) with (?:this|the new)|decided on|switched to|upgraded to|bought this|(?:i|we) have had|this (?:version|one|unit|product))\b/i.test(sentence);
    if (previousProduct) {
      if (transitionsToCurrent) {
        previousProduct = false;
        if (introducesPrevious || /\b(?:replaced|decided on|switched to|upgraded to)\b/i.test(sentence)) continue;
      } else continue;
    }
    clauses.push(...sentence.split(/\b(?:but|however|until)\b/i));
  }
  return clauses;
}

function negatedAt(clause: string, index: number) {
  const prefix = clause.slice(0, index).replace(/[,]/g, " ");
  return /\b(?:no|not|never|without|pas|nicht|isn't|isnt|doesn't|doesnt|don't|dont|didn't|didnt|hasn't|hasnt|haven't|havent|shouldn't|shouldnt|wouldn't|wouldnt|couldn't|couldnt|won't|wont|can't|cant|cannot|wasn't|wasnt|aren't|arent)\b(?:\s+[a-z]+){0,3}\s*$/i.test(prefix)
    && !/\bnot\s+(?:only|just)\b[^.!?;]*$/i.test(prefix);
}

function expectationAt(clause: string, index: number) {
  return /\b(?:supposed to|expected to|advertised as|claimed to|promised to|should be|would be|might be|could be)\b(?:\s+[a-z]+){0,3}\s*$/i.test(clause.slice(0, index));
}

function reviewSentiment(body: string) {
  let praise = 0;
  let complaints = 0;
  let hasSevereComplaint = false;
  let hasSafetyComplaint = false;
  for (const clause of reviewClauses(body)) {
    if (/\b(?:support|customer service)\b.{0,55}\b(?:hasn't|has not|never|no)\b.{0,30}\b(?:responded|replied|messaged|response|reply)\b/i.test(clause)) complaints += 1;
    for (const match of clause.matchAll(positive)) {
      if (expectationAt(clause, match.index || 0)) continue;
      if (negatedAt(clause, match.index || 0)) complaints += 1;
      else praise += 1;
    }
    for (const match of clause.matchAll(negative)) {
      if (negatedAt(clause, match.index || 0)) praise += 1;
      else complaints += 1;
    }
    for (const match of clause.matchAll(/\b(?:caught fire|fire hazard|electric shock|burned me|unsafe|exploded|explosion)\b/gi)) {
      if (!negatedAt(clause, match.index || 0)) { hasSafetyComplaint = true; hasSevereComplaint = true; complaints += 1; }
    }
    for (const match of clause.matchAll(severe)) {
      if (!negatedAt(clause, match.index || 0)) hasSevereComplaint = true;
    }
    if (/\b(?:doesn't|doesnt|does not|won't|wont|will not|can't|cannot)\s+(?:work|charge|turn on|last)\b/i.test(clause)) {
      complaints += 1;
      hasSevereComplaint = true;
    }
  }
  return { praise, complaints, hasSevereComplaint, hasSafetyComplaint };
}

type ReviewClaimRule = {
  kind: "strength" | "complaint";
  claim: string;
  pattern: RegExp;
};

const claimRules: ReviewClaimRule[] = [
  { kind: "strength", claim: "useful tracking or app insights", pattern: /\b(?:app|metrics|sleep stats|tracking)\b.{0,45}\b(?:insightful|great|fantastic|useful)\b|\b(?:great|fantastic|useful)\b.{0,30}\b(?:app|metrics|sleep stats|tracking)\b/i },
  { kind: "complaint", claim: "unanswered customer support", pattern: /\b(?:support|customer service)\b.{0,55}\b(?:hasn't|has not|never|no)\b.{0,30}\b(?:responded|replied|messaged|response|reply)\b/i },

  { kind: "complaint", claim: "app or connectivity problems", pattern: /\b(?:don't|do not|doesn't|does not)\b.{0,30}\b(?:love|work|like)\b.{0,30}\bapp\b|\b(?:app|connection|connectivity)\b.{0,40}\b(?:problems?|failed|unusable|difficult)\b/i },

  { kind: "strength", claim: "comfortable fit", pattern: /\bcomfortable\b/i },
  { kind: "strength", claim: "long battery life", pattern: /\b(?:battery|charge)\b.{0,60}\b(?:great|good|lasts|week|days)\b|\b(?:lasts|charge)\b.{0,40}\b(?:week|days)\b/i },
  { kind: "complaint", claim: "battery failure or charge retention problems", pattern: /\bbattery\b.{0,100}\b(?:failed|died|dead|lost|stopped)\b|\b(?:failed|died|dead|lost)\b.{0,60}\bbattery\b|\bwon't keep.{0,20}charge\b/i },
  { kind: "complaint", claim: "material safety warnings", pattern: /\b(?:caught fire|fire hazard|electric shock|burned me|unsafe|exploded|explosion)\b/i },

  // Strengths: every displayed claim still requires support from an
  // accepted exact-product written review. These rules only improve the
  // customer-facing taxonomy; they do not affect scoring.
  {
    kind: "strength",
    claim: "reliable or durable performance",
    pattern: /\b(reliable|reliably|durable)\b/i,
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
    pattern: /\b(?:good|great|excellent)\b(?:\s+[a-z]+){0,3}\s+value\b|\bvalue\b(?:\s+[a-z]+){0,3}\s+(?:good|great|excellent)\b|\bworth\s+(?:(?:the|my|our|every|extra)\s+)?(?:it|money|price|cost|penny|dollar|paying)\b/i,
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
    pattern: /\b(broke|breaks|broken|failed|fails|stopped|died|dies|dead|defective|unusable)\b|\b(?:doesn't|doesnt|won't|wont|does not)\s+(?:work|charge|turn on)\b/i,
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
      const match = rule.pattern.exec(clause);
      if (!match || expectationAt(clause, match.index) || negatedAt(clause, match.index)) return false;
      const sentiment = reviewSentiment(clause);
      const praiseCount = sentiment.praise + Array.from(clause.matchAll(/\b(nice|beautiful|best|perfect|perfection|delicious|juicy)\b|to die for/gi)).filter((match) => !negatedAt(clause, match.index || 0) && !expectationAt(clause, match.index || 0)).length;
      const complaintCount = sentiment.complaints;
      if (rule.kind === "strength") {
        return !/\b(?:not|never|isn't|isnt|doesn't|doesnt|don't|dont|didn't|didnt|hasn't|hasnt|haven't|havent|shouldn't|shouldnt|wouldn't|wouldnt|couldn't|couldnt|won't|wont|can't|cant|cannot)\b.{0,24}\b(?:good|great|easy|reliable|durable|worth|works?|fast|useful)\b/i.test(clause)
          && praiseCount > complaintCount;
      }
      return !/\b(?:no|never|without|not|don't|dont|didn't|didnt|hasn't|hasnt|haven't|havent)\b.{0,16}\b(?:problems?|complaints?|cracks?|cracked|broken|broke|failed|refund)\b/i.test(clause)
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
    sourceUrls: Array.from(new Set(matching.flatMap(record => record.sourceUrl ? [record.sourceUrl] : []))).sort(),
    sourceDiversity: new Set(matching.map(record => record.independentSourceId)).size,
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
    // Generic failure adds no shopper information when every supporting
    // review already supports a specific battery failure warning. Preserve
    // it when any additional review reports a different failure.
    .filter((item, _index, claims) => item.claim !== "reliability or failure problems" ||
      !claims.some(specific => specific.claim === "battery failure or charge retention problems" &&
        item.sourceHashes.every(hash => specific.sourceHashes.includes(hash))))
    .sort(
      (a, b) =>
        b.supportCount - a.supportCount ||
        a.claim.localeCompare(b.claim),
    )
    .slice(0, 5);
}

/** Policy boundary: explicit distinct-review support, never price or stars. */
export function valueLabelFromReviewSupport(input: {eligible: boolean; praiseCount: number; complaintCount: number}): "Good" | "Fair" | "Poor" | "Unknown" {
  if (!input.eligible || !Number.isInteger(input.praiseCount) || !Number.isInteger(input.complaintCount) || input.praiseCount < 0 || input.complaintCount < 0) return "Unknown";
  if (input.praiseCount > 0 && input.complaintCount > 0) return "Fair";
  if (input.praiseCount >= 2) return "Good";
  if (input.complaintCount >= 2) return "Poor";
  return "Unknown";
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
  // Each distinct written record gets one sentiment vote, regardless of
  // verbosity. Mixed records contribute to both sides, never keyword volume.
  const positiveSignal = sentiments.filter((item) => item.praise > 0).length;
  const negativeSignal = sentiments.filter((item) => item.complaints > 0).length;
  const severeCount = sentiments.filter((item) => item.hasSevereComplaint).length;
  const safetyCount = sentiments.filter((item) => item.hasSafetyComplaint).length;
  const analyzableCount = sentiments.filter((item) => item.praise + item.complaints > 0).length;
  const sufficient = input.exactProductAccepted && n >= 5 && analyzableCount >= 5 && analyzableCount / n >= 0.8 && Boolean(acceptedCorpusHash);
  const marketplaceScore = typeof input.rating === "number" && Number.isFinite(input.rating) ? Math.max(0, Math.min(10, input.rating * 2)) : null;
  const severeRatio = n ? severeCount / n : 0;
  const sentimentScore = n ? 5 + 3 * (positiveSignal - negativeSignal) / n : null;
  const score = sufficient && sentimentScore !== null
    ? Math.round(Math.max(1, Math.min(10, sentimentScore - severeRatio * 2)) * 10) / 10
    : null;
  // Clear purchase support needs a supermajority and limited contradictions.
  // Recurring failures need multiple records; a single failure remains visible.
  // One material safety report blocks BUY pending corroboration, not automatic AVOID.
  const avoidSupported = sufficient && (
    negativeSignal / n >= 0.6 && (negativeSignal > positiveSignal || score !== null && score <= 4.5) ||
    severeCount >= 2 && severeRatio >= 0.35 || safetyCount >= 2
  );
  const buySupported = sufficient && score !== null && score >= 6.5 &&
    positiveSignal / n >= 0.7 && negativeSignal / n <= 0.2 && severeRatio < 0.2 && safetyCount === 0;
  const verdict: "BUY" | "AVOID" | "DO NOT BUY YET" =
    !sufficient || score === null ? "DO NOT BUY YET" : avoidSupported ? "AVOID" : buySupported ? "BUY" : "DO NOT BUY YET";
  const strengths = sufficient ? rankedClaims("strength", records) : [];
  const complaints = sufficient ? rankedClaims("complaint", records) : [];
  const valueRule = claimRules.find((rule) => rule.claim === "good value for the price");
  const valuePraise = valueRule ? provenanceFor(valueRule, records)?.supportCount || 0 : 0;
  const valueComplaints = records.filter((record) => reviewClauses(record.body).some((clause) =>
    Array.from(clause.matchAll(/\b(?:not worth\s+(?:(?:the|my|our|extra)\s+)?(?:it|money|price|cost|penny|dollar|paying)|overpriced|waste of money|poor value|bad value)\b/gi)).some((match) => !negatedAt(clause, match.index || 0) && !expectationAt(clause, match.index || 0))
  )).length;
  // A label describes recurring explicit value observations, not price,
  // product sentiment, or one customer's praise. Two distinct reviews are
  // the minimum; conflicting value observations stay Fair. Source breadth
  // is reported separately and constrains overall confidence.
  const valueForMoney = valueLabelFromReviewSupport({eligible: score !== null, praiseCount: valuePraise, complaintCount: valueComplaints});
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
    safetyComplaintCount: safetyCount,
    analyzableReviewCount: analyzableCount,
    semanticCoverageRatio: n ? analyzableCount / n : null,
    independentSourceCount: new Set(records.map(record => record.independentSourceId)).size,
    semanticVersion: SEMANTIC_VERSION,
    languageHints: records.reduce<Record<string, number>>((counts, record) => { const hint = reviewLanguageHint(record.body); counts[hint] = (counts[hint] || 0) + 1; return counts; }, {}),
    reviewsWithOriginalDates: records.filter(record => typeof record.original.date === "string" && record.original.date.trim()).length,
    verifiedIndependentReviewerCount: null,
    marketplaceWeight: 0,
    buySupported,
    avoidSupported,
    marketplaceScore,
    sentimentScore,
    valuePraiseCount: valuePraise,
    valueComplaintCount: valueComplaints,
    minimumValueSupport: 2,
    minimumAcceptedReviews: 5,
    sufficient,
  };
  // Model-generated risk estimates and summary-model names are telemetry,
  // not inputs to the deterministic evidence policy or its result identity.
  const sourceCount = new Set(records.map(record => record.independentSourceId)).size;
  const coverageNote = `${n} accepted written reviews from ${sourceCount} source domain${sourceCount === 1 ? "" : "s"}; ${severeCount} review${severeCount === 1 ? "" : "s"} report product failures or material safety concerns. This accessible sample may not represent all customers.`;
  const withoutHash = { scorerVersion: DETERMINISTIC_SCORER_VERSION, verdictPolicyVersion: VERDICT_POLICY_VERSION, acceptedReviewHashes, acceptedCorpusHash, marketplaceMetadataSnapshot, deterministicScoringInputs, buyScore: score, valueForMoney, customerVerdict: verdict, strengths, complaints };
  // Display metadata has zero decision weight and cannot change decision
  // identity. Retain the snapshot as telemetry beside the hashed evidence.
  const { marketplaceScore: _marketplaceTelemetry, ...evidenceScoringInputs } = deterministicScoringInputs;
  const { marketplaceMetadataSnapshot: _displaySnapshot, ...decisionIdentity } = withoutHash;
  return {
    ...withoutHash,
    evidenceState: sufficient ? "SUFFICIENT" : "NOT_ENOUGH",
    bottomLine: (verdict === "BUY" ? "Accepted exact-product written evidence clearly favors purchase. " : verdict === "AVOID" ? "Recurring failures or predominantly negative written evidence supports avoidance. " : input.exactProductAccepted && n >= 5 ? "Accepted reviews were found, but mixed evidence or incomplete semantic coverage does not justify a clear recommendation. " : "ReviewIntel couldn't verify enough exact-product review evidence to recommend this purchase yet. ") + coverageNote + (score !== null && valueForMoney === "Unknown" ? ` Value remains Unknown: ${valuePraise} review${valuePraise === 1 ? "" : "s"} praise value and ${valueComplaints} criticize it; a product-level label needs recurring explicit value evidence.` : ""),
    finalResultHash: sha({ ...decisionIdentity, deterministicScoringInputs: evidenceScoringInputs }),
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
