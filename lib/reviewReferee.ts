/**
 * The Make-Sense Referee — ReviewIntel's deterministic judgment layer.
 * Owner commission, 2026-10-20: "a mini Sophie that referees inside it…
 * that's where the intelligence is from — REVIEWINTEL: Review Intelligence."
 * Owner's complexity rule applies: as sophisticated as needed backstage,
 * one logical decision out; the customer surface stays simple.
 *
 * The Referee grades NOTHING. Collectors collect, adjudication judges
 * identity, the scorers score — the Referee asks the human question the
 * pipeline never asked: "does this answer make sense?" Its only powers
 * are to correct provable nonsense, hold an unjustified verdict flip,
 * cap confidence at what the evidence holds, and block to the honest
 * state when the numbers do not reconcile — always with a reason code
 * written where the keeper and Sophie read diagnostics.
 *
 * Duties:
 *  D1 ONE BUYER, ONE VOICE — variant-duplicate collapse (edited /
 *     truncated / snippet-vs-full copies of the same review) across the
 *     merged corpus, extending adjudication's exact-text dedupe.
 *  D2 REASONS MATCH THEIR SIDE — a backing record whose own text is a
 *     complaint can never support a strength (and the mirror for
 *     complaints); a printed reason with no valid backing is dropped,
 *     never re-sided silently.
 *  D3 NO FLIP WITHOUT A REASON — a verdict-word flip versus the
 *     product's stored verdict requires a material delta of genuinely
 *     new unique opinions; otherwise the stored word is HELD.
 *  D4 NUMBERS RECONCILE — every count the scan publishes derives from
 *     the post-D1 unique-opinion set; a reconciliation failure blocks
 *     to the honest state.
 *  D5 CONFIDENCE CEILING — confidence is capped by the unique-opinion
 *     count and independent-source count (existing evidence bands);
 *     the Referee can lower confidence, never raise it.
 *
 * Deterministic: same input, same decision. No AI, no network, no I/O.
 */
import { createHash } from "node:crypto";
import { reviewSentiment } from "./claimClauseEvidence";

export const REFEREE_VERSION = "make-sense-referee-v1";

/* ------------------------------------------------------------------ */
/* Shared text handling — byte-mirror of reviewEvidenceAdjudication's  */
/* clean()/normalized(), so identities computed here live in exactly   */
/* the same space as adjudication's stableEvidenceHash.                */
/* ------------------------------------------------------------------ */

function cleanRefereeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/<[^>]*>/g, " ")
    .replace(/\\u0026/g, "&")
    .replace(/\\n/g, " ")
    .replace(/Brief content visible, double tap to read full content\. Full content visible, double tap to read brief content\./gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizedRefereeText(value: unknown): string {
  return cleanRefereeText(value)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** sha256 over the normalized body — identical to adjudication's hash(). */
export function refereeTextFingerprint(value: unknown): string {
  return createHash("sha256").update(normalizedRefereeText(value)).digest("hex");
}

/** Body extraction mirroring adjudication's bodyOf() field chain. */
export function refereeRecordBody(record: Record<string, unknown> | null | undefined): string {
  if (!record || typeof record !== "object") return "";
  return cleanRefereeText(
    record.body ?? record.text ?? record.snippet ?? record.content ?? record.review ?? record.reviewText
  );
}

/**
 * One identity space for stored and fresh records alike: a record that
 * carries a stableEvidenceHash uses it; any other record is identified
 * by the fingerprint of its body. Adjudication's stableEvidenceHash IS
 * refereeTextFingerprint(body), so both sides land on the same key.
 */
export function refereeRecordIdentity(record: Record<string, unknown> | null | undefined): string {
  if (!record || typeof record !== "object") return "";
  const stamped = cleanRefereeText(record.stableEvidenceHash);
  if (stamped) return `fp:${stamped.toLowerCase()}`;
  const body = refereeRecordBody(record);
  if (!body) return "";
  return `fp:${refereeTextFingerprint(body)}`;
}

/** Deterministic fingerprint of a whole graded corpus (sorted identities). */
export function refereeCorpusFingerprint(identities: string[]): string {
  const sorted = [...identities].filter(Boolean).sort();
  return createHash("sha256").update(sorted.join("\n")).digest("hex");
}

/* ------------------------------------------------------------------ */
/* D1 — variant duplicates                                             */
/*                                                                     */
/* Measure: word 4-gram shingles over the normalized text. The         */
/* primary signal is CONTAINMENT of the shorter text's shingles in     */
/* the longer text: a truncated copy is (near-)wholly contained; an    */
/* edited copy keeps almost all of its earlier phrasing; two distinct   */
/* buyers describing the same product share vocabulary but almost      */
/* never share 4-word runs beyond product-name boilerplate. A second   */
/* signal (distinctive-token Jaccard) catches edits that change both   */
/* ends of a text at once, and then only with substantial containment   */
/* as well. Guards: below the minimum length the text is too generic   */
/* to prove identity (distinct short praise must survive), and two     */
/* records naming DIFFERENT reviewers are two buyers, full stop.       */
/* ------------------------------------------------------------------ */

export const REFEREE_VARIANT = {
  shingleWords: 4,
  minNormalizedChars: 120,
  minShingles: 8,
  containmentThreshold: 0.8,
  editedJaccardThreshold: 0.8,
  editedContainmentThreshold: 0.6,
  /**
   * Text-only tier — used when marketplace review identity cannot
   * decide the pair (an id missing on either side). Stricter, because
   * text alone must separate a real edit from two different buyers
   * writing alike. Measured anchors (2026-10-20): an
   * edited-after-a-year rant pair scores containment 0.88 /
   * distinctive-token Jaccard 0.97; template-sibling reviews that
   * differ only in their review number score 0.81 / 0.83 and must NOT
   * collapse — so the text-only bar sits at 0.90 on either axis.
   */
  textOnlyContainmentThreshold: 0.9,
  textOnlyJaccardThreshold: 0.9,
  textOnlyJaccardMinContainment: 0.75,
  /** Serial-stamp sibling exclusion (see isSerialStampSibling). */
  serialStampPrefixShare: 0.95,
  serialStampMaxDifferingShingles: 4,
} as const;

/**
 * Marketplace review identity for one record: the review id the
 * marketplace itself assigned (the Amazon collector captures
 * data-review-id; stored library records keep the field), plus host.
 * The strongest same-review signal that exists: an edited review
 * KEEPS its marketplace id, and two different ids on one host are
 * provably two different reviews.
 */
export type RefereeReviewIdentity = { host: string; reviewId: string } | null;

export function refereeReviewIdentity(record: Record<string, unknown> | null | undefined): RefereeReviewIdentity {
  if (!record || typeof record !== "object") return null;
  let reviewId = cleanText(record.reviewId).toLowerCase();
  const urlText = [record.sourceUrl, record.source, record.url, record.link]
    .map((value) => (typeof value === "string" ? value : ""))
    .find((value) => value.startsWith("http"));
  let host = "";
  if (urlText) {
    try {
      const parsed = new URL(urlText);
      host = parsed.hostname.replace(/^www\./, "").toLowerCase();
      if (!reviewId) {
        const param = parsed.searchParams.get("reviewId") || parsed.searchParams.get("review_id") || "";
        if (param) reviewId = param.trim().toLowerCase();
      }
      if (!reviewId) {
        const segment = parsed.pathname.match(/\/review\/([A-Za-z0-9-]{6,})/)?.[1] || "";
        if (segment) reviewId = segment.toLowerCase();
      }
    } catch {
      /* unparseable URL: no identity */
    }
  }
  if (!reviewId) return null;
  return { host, reviewId };
}

export type RefereeIdentityVerdict = "same-review" | "different-review" | "unknown";

/**
 * Decisive only when BOTH records carry a marketplace review id for
 * the same host: equal ids = the same review (edits keep the id);
 * different ids = provably different reviews, whatever the text says.
 * Anything else is "unknown" and the text decides under the strict tier.
 */
export function refereeIdentityVerdict(
  a: RefereeReviewIdentity,
  b: RefereeReviewIdentity
): RefereeIdentityVerdict {
  if (!a || !b) return "unknown";
  if (a.host && b.host && a.host !== b.host) return "unknown";
  return a.reviewId === b.reviewId ? "same-review" : "different-review";
}

const GENERIC_TOKENS = new Set([
  "test", "product", "review", "reviews", "brand", "model", "item",
  "this", "that", "with", "from", "have", "been", "they", "them",
  "then", "than", "when", "what", "your", "yours", "mine", "ours",
]);

export type VariantProfile = {
  normalized: string;
  chars: number;
  shingles: Set<string>;
  shingleList: string[];
  distinctiveTokens: Set<string>;
};

export function prepareVariantProfile(body: string): VariantProfile {
  const normalized = normalizedRefereeText(body);
  const words = normalized.split(" ").filter(Boolean);
  const shingles = new Set<string>();
  const shingleList: string[] = [];
  const size = REFEREE_VARIANT.shingleWords;
  for (let i = 0; i + size <= words.length; i++) {
    const shingle = words.slice(i, i + size).join(" ");
    shingles.add(shingle);
    shingleList.push(shingle);
  }
  const distinctiveTokens = new Set(
    words.filter((token) => (token.length >= 4 || /\d/.test(token)) && !GENERIC_TOKENS.has(token))
  );
  return { normalized, chars: normalized.length, shingles, shingleList, distinctiveTokens };
}

/**
 * Serial-stamp siblings: two texts that share >= 95% of the shorter
 * text as an identical opening run and differ ONLY in a handful of
 * shingles at the very tail (a serial number, an instance stamp) are
 * DISTINCT records — that shape is how templated/fabricated review
 * sets present, and the pipeline's AI-pattern system must see every
 * one of them to detect the pattern. A genuine re-collection variant
 * differs differently: a truncation leaves the longer text holding a
 * long extra tail (many non-shared shingles), and a real edit differs
 * in a middle span, breaking the opening run. Collapsing stamp
 * siblings here would hide pattern evidence and double-count nothing.
 */
export function isSerialStampSibling(a: VariantProfile, b: VariantProfile): boolean {
  const listA = a.shingleList;
  const listB = b.shingleList;
  const minLength = Math.min(listA.length, listB.length);
  if (!minLength) return false;
  let prefix = 0;
  while (prefix < minLength && listA[prefix] === listB[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < minLength - prefix &&
    listA[listA.length - 1 - suffix] === listB[listB.length - 1 - suffix]
  ) {
    suffix++;
  }
  if (prefix / minLength < REFEREE_VARIANT.serialStampPrefixShare) return false;
  const differingA = listA.length - prefix - suffix;
  const differingB = listB.length - prefix - suffix;
  return (
    differingA <= REFEREE_VARIANT.serialStampMaxDifferingShingles &&
    differingB <= REFEREE_VARIANT.serialStampMaxDifferingShingles
  );
}

export type VariantSimilarity = {
  containment: number;
  jaccard: number;
  shorterShingles: number;
  longerShingles: number;
  shorterChars: number;
};

export function variantSimilarity(a: VariantProfile, b: VariantProfile): VariantSimilarity {
  const shorter = a.shingles.size <= b.shingles.size ? a : b;
  const longer = shorter === a ? b : a;
  let sharedShingles = 0;
  for (const shingle of shorter.shingles) {
    if (longer.shingles.has(shingle)) sharedShingles++;
  }
  const containment = shorter.shingles.size ? sharedShingles / shorter.shingles.size : 0;
  let sharedTokens = 0;
  for (const token of a.distinctiveTokens) {
    if (b.distinctiveTokens.has(token)) sharedTokens++;
  }
  const tokenUnion = a.distinctiveTokens.size + b.distinctiveTokens.size - sharedTokens;
  const jaccard = tokenUnion ? sharedTokens / tokenUnion : 0;
  return {
    containment,
    jaccard,
    shorterShingles: shorter.shingles.size,
    longerShingles: longer.shingles.size,
    shorterChars: Math.min(a.chars, b.chars),
  };
}

/** Reviewer identity for the different-buyers guard ("" = unknown). */
export function refereeReviewerIdentity(record: Record<string, unknown> | null | undefined): string {
  if (!record || typeof record !== "object") return "";
  const raw = record.reviewer ?? record.author ?? record.reviewerName ?? record.reviewer_name ?? "";
  return normalizedRefereeText(raw);
}

export function isVariantDuplicate(
  candidate: VariantProfile,
  candidateReviewer: string,
  survivor: VariantProfile,
  survivorReviewer: string,
  identityVerdict: RefereeIdentityVerdict = "unknown"
): { variant: boolean; similarity: VariantSimilarity } {
  const similarity = variantSimilarity(candidate, survivor);
  // Two different marketplace review ids on one host are two different
  // reviews by construction — no text score can overrule that.
  if (identityVerdict === "different-review") {
    return { variant: false, similarity };
  }
  if (candidateReviewer && survivorReviewer && candidateReviewer !== survivorReviewer) {
    return { variant: false, similarity };
  }
  if (
    similarity.shorterChars < REFEREE_VARIANT.minNormalizedChars ||
    similarity.shorterShingles < REFEREE_VARIANT.minShingles
  ) {
    return { variant: false, similarity };
  }
  // Serial-stamp siblings are distinct records (the AI-pattern system's
  // evidence), never variants — unless the marketplace itself proves
  // the two records are one review (same id), which outranks shape.
  if (identityVerdict !== "same-review" && isSerialStampSibling(candidate, survivor)) {
    return { variant: false, similarity };
  }
  if (identityVerdict === "same-review") {
    // The marketplace itself says this is one review in two states of
    // edit: the standard tier applies.
    if (similarity.containment >= REFEREE_VARIANT.containmentThreshold) {
      return { variant: true, similarity };
    }
    if (
      similarity.jaccard >= REFEREE_VARIANT.editedJaccardThreshold &&
      similarity.containment >= REFEREE_VARIANT.editedContainmentThreshold
    ) {
      return { variant: true, similarity };
    }
    return { variant: false, similarity };
  }
  // Text-only tier: no identity to lean on, so the bar is stricter.
  if (similarity.containment >= REFEREE_VARIANT.textOnlyContainmentThreshold) {
    return { variant: true, similarity };
  }
  if (
    similarity.jaccard >= REFEREE_VARIANT.textOnlyJaccardThreshold &&
    similarity.containment >= REFEREE_VARIANT.textOnlyJaccardMinContainment
  ) {
    return { variant: true, similarity };
  }
  return { variant: false, similarity };
}

/**
 * D3's delta counter: how many of today's accepted opinions are
 * genuinely NEW — identity absent from the stored corpus AND not a
 * variant copy of a stored opinion (an edited re-post of an old review
 * is the same buyer speaking again, not a new voice).
 */
export function countNewOpinions(
  acceptedRecords: Array<{ body: string; stableEvidenceHash: string; original?: Record<string, unknown> | null }>,
  storedRecords: Array<Record<string, unknown>>
): number {
  const storedIdentities = new Set(storedRecords.map((record) => refereeRecordIdentity(record)).filter(Boolean));
  const storedProfiles = storedRecords.map((record) => ({
    profile: prepareVariantProfile(refereeRecordBody(record)),
    reviewer: refereeReviewerIdentity(record),
    identity: refereeReviewIdentity(record),
  }));
  let count = 0;
  for (const record of acceptedRecords) {
    if (storedIdentities.has(`fp:${String(record.stableEvidenceHash || "").toLowerCase()}`)) continue;
    const profile = prepareVariantProfile(record.body);
    const reviewer = refereeReviewerIdentity(record.original ?? undefined);
    const identity = refereeReviewIdentity(record.original ?? undefined);
    const variantOfStored = storedProfiles.some(
      (stored) =>
        isVariantDuplicate(profile, reviewer, stored.profile, stored.reviewer, refereeIdentityVerdict(identity, stored.identity)).variant
    );
    if (!variantOfStored) count++;
  }
  return count;
}

/* ------------------------------------------------------------------ */
/* D2 — reasons match their side                                       */
/*                                                                     */
/* Per-record text sentiment comes from the pipeline's own clause      */
/* machinery (lib/claimClauseEvidence.reviewSentiment) — the same      */
/* signals the deterministic scorer votes with. A record whose text    */
/* is purely a complaint (complaints > 0, praise = 0) is NEGATIVE;     */
/* purely praise is POSITIVE; both signals = MIXED (honest either      */
/* side); neither = NONE (carries no side).                            */
/* ------------------------------------------------------------------ */

export type RefereeTextSide = "positive" | "negative" | "mixed" | "none";

export function textSideOfBody(body: string): RefereeTextSide {
  const sentiment = reviewSentiment(body);
  if (sentiment.praise > 0 && sentiment.complaints === 0) return "positive";
  if (sentiment.complaints > 0 && sentiment.praise === 0) return "negative";
  if (sentiment.praise === 0 && sentiment.complaints === 0) return "none";
  return "mixed";
}

/**
 * A snippet's assigned side (in the recovery path it is derived from
 * the star rating) is corrected when the review's OWN text is purely
 * the opposite side. A 5-star rating on an edited-after-a-year rant
 * cannot file that rant under the buy reasons.
 */
export function refereeSnippetSentiment(
  assigned: "positive" | "mixed" | "negative",
  body: string
): { sentiment: "positive" | "mixed" | "negative"; corrected: boolean; textSide: RefereeTextSide } {
  const textSide = textSideOfBody(body);
  if (assigned === "positive" && textSide === "negative") {
    return { sentiment: "negative", corrected: true, textSide };
  }
  if (assigned === "negative" && textSide === "positive") {
    return { sentiment: "positive", corrected: true, textSide };
  }
  return { sentiment: assigned, corrected: false, textSide };
}

export type RefereeClaimCheck = {
  kept: Array<{ claim: string; sourceIds: string[] }>;
  dropped: Array<{ claim: string; side: "strength" | "complaint"; offendingRecordIds: string[]; reason: string }>;
};

/**
 * Provenance re-verification for composed claims: a strength survives
 * only if NONE of its backing records is a purely-negative text; a
 * complaint only if none of its backing records is purely positive.
 * Dropped claims are never re-sided — they are removed and logged.
 */
export function refereeCheckClaims(input: {
  strengths: Array<{ claim: string; sourceIds: string[] }>;
  complaints: Array<{ claim: string; sourceIds: string[] }>;
  bodyByRecordId: Map<string, string>;
}): RefereeClaimCheck {
  const checkSide = (
    claims: Array<{ claim: string; sourceIds: string[] }>,
    side: "strength" | "complaint"
  ) => {
    const kept: RefereeClaimCheck["kept"] = [];
    const dropped: RefereeClaimCheck["dropped"] = [];
    for (const claim of claims) {
      const offending: string[] = [];
      for (const id of claim.sourceIds) {
        const body = input.bodyByRecordId.get(id);
        if (body === undefined) continue;
        const textSide = textSideOfBody(body);
        if (side === "strength" && textSide === "negative") offending.push(id);
        if (side === "complaint" && textSide === "positive") offending.push(id);
      }
      if (offending.length) {
        dropped.push({
          claim: claim.claim,
          side,
          offendingRecordIds: offending,
          reason:
            side === "strength"
              ? "strength backed by a record whose own text is a complaint"
              : "complaint backed by a record whose own text is praise",
        });
      } else {
        kept.push(claim);
      }
    }
    return { kept, dropped };
  };
  const strengths = checkSide(input.strengths, "strength");
  const complaints = checkSide(input.complaints, "complaint");
  return {
    kept: [...strengths.kept, ...complaints.kept],
    dropped: [...strengths.dropped, ...complaints.dropped],
  };
}

/* ------------------------------------------------------------------ */
/* D3 — no flip without a reason                                       */
/*                                                                     */
/* A flip is material only when genuinely NEW unique opinions (post-D1 */
/* identities absent from the stored corpus) are at least 2 AND at     */
/* least 20% of today's graded unique-opinion pile. One or two new     */
/* voices recounting an old pile cannot reverse a product's verdict;   */
/* a fifth of the pile turning over can.                               */
/* ------------------------------------------------------------------ */

export const REFEREE_FLIP_MIN_NEW_OPINIONS = 2;
export const REFEREE_FLIP_MIN_NEW_SHARE = 0.2;

export type RefereeVerdictWord = "BUY" | "WAIT" | "SKIP";

export function refereeFlipGate(input: {
  previousVerdict: RefereeVerdictWord | null;
  newVerdict: RefereeVerdictWord;
  newUniqueOpinionCount: number | null;
  totalUniqueOpinionCount: number;
}): {
  flip: boolean;
  material: boolean;
  requiredNewOpinions: number;
  hold: boolean;
  reason: string;
} {
  const requiredNewOpinions = Math.max(
    REFEREE_FLIP_MIN_NEW_OPINIONS,
    Math.ceil(REFEREE_FLIP_MIN_NEW_SHARE * Math.max(0, input.totalUniqueOpinionCount))
  );
  if (!input.previousVerdict || input.previousVerdict === input.newVerdict) {
    return { flip: false, material: true, requiredNewOpinions, hold: false, reason: "no verdict flip" };
  }
  if (input.newUniqueOpinionCount === null) {
    return {
      flip: true,
      material: false,
      requiredNewOpinions,
      hold: true,
      reason: "verdict flip with no stored-corpus delta available to justify it",
    };
  }
  const material = input.newUniqueOpinionCount >= requiredNewOpinions;
  return {
    flip: true,
    material,
    requiredNewOpinions,
    hold: !material,
    reason: material
      ? "verdict flip backed by a material delta of new unique opinions"
      : "verdict flip without a material delta of new unique opinions",
  };
}

/** Band edges for the held word, mirroring buyingScore's 75/50 bands. */
export function refereeBandForWord(word: RefereeVerdictWord): { min: number; max: number } {
  if (word === "BUY") return { min: 75, max: 100 };
  if (word === "WAIT") return { min: 50, max: 74 };
  return { min: 0, max: 49 };
}

/**
 * On HOLD the printed pair is (stored word, computed score clamped to
 * the stored word's band edge) — the dual of the existing Buy-57 render
 * fence, which re-bands a word to its score. A score already inside the
 * held band prints unchanged. Both numbers are logged; nothing hidden.
 */
export function refereeHeldScore(word: RefereeVerdictWord, computedScore: number): number {
  const band = refereeBandForWord(word);
  return Math.min(band.max, Math.max(band.min, Math.round(computedScore)));
}

/* ------------------------------------------------------------------ */
/* D5 — confidence ceiling                                             */
/*                                                                     */
/* Bands reuse the existing evidenceStrengthForCount thresholds in     */
/* lib/reviewEvidence.ts (1-4 weak, 5-14 limited, 15-29 usable, 30+    */
/* strong); independent sources then gate how high confidence may      */
/* climb. The ceiling can only lower a computed level.                 */
/* ------------------------------------------------------------------ */

export type RefereeConfidenceLevel = "Low" | "Medium" | "High";
const CONFIDENCE_ORDER: RefereeConfidenceLevel[] = ["Low", "Medium", "High"];

export function refereeConfidenceCeiling(input: {
  uniqueOpinionCount: number;
  independentSourceCount: number;
}): RefereeConfidenceLevel | null {
  const n = Math.max(0, Math.floor(input.uniqueOpinionCount || 0));
  const sources = Math.max(0, Math.floor(input.independentSourceCount || 0));
  if (n <= 0) return null;
  if (n < 5) return "Low";
  if (n < 15) return sources >= 2 ? "Medium" : "Low";
  if (n < 30) return sources >= 3 ? "High" : "Medium";
  return sources >= 2 ? "High" : "Medium";
}

export function capConfidenceLevel(
  level: RefereeConfidenceLevel,
  ceiling: RefereeConfidenceLevel | null
): { level: RefereeConfidenceLevel; capped: boolean } {
  if (!ceiling) return { level, capped: false };
  const capped = CONFIDENCE_ORDER.indexOf(level) > CONFIDENCE_ORDER.indexOf(ceiling);
  return { level: capped ? ceiling : level, capped };
}

/* ------------------------------------------------------------------ */
/* D4 — count reconciliation + the decision object                    */
/* ------------------------------------------------------------------ */

export type RefereeInterventionCode =
  | "VARIANT_DUPLICATE_COLLAPSED"
  | "SNIPPET_SENTIMENT_CORRECTED"
  | "REASON_SIDE_MISMATCH"
  | "VERDICT_HELD_NO_MATERIAL_DELTA"
  | "CONFIDENCE_CAPPED"
  | "COUNTS_MISMATCH_BLOCK";

export type RefereeIntervention = {
  code: RefereeInterventionCode;
  duty: "D1" | "D2" | "D3" | "D4" | "D5";
  detail: string;
  numbers?: Record<string, number | string>;
};

export type RefereeDecisionStatus = "PASS" | "PASS_WITH_CORRECTIONS" | "HOLD" | "BLOCK";

/**
 * The evidence layer's half of the decision: computed inside
 * collectAndAnalyzeReviewEvidence where the merged corpus, the stored
 * library state and the final adjudication all live. The analyze route
 * merges this with its own D2/D3/D5 interventions into the scan's final
 * RefereeDecision.
 */
export type RefereeEvidenceSummary = {
  version: string;
  uniqueOpinionCount: number;
  independentSourceCount: number;
  variantDuplicatesCollapsed: number;
  variantDuplicatePairs: Array<{ keptId: string; droppedId: string; containment: number; jaccard: number }>;
  storedOpinionCount: number | null;
  newUniqueOpinionCount: number | null;
  corpusFingerprint: string | null;
  countsReconciled: boolean;
  /** Canonical library key for this product (null when no library state). */
  libraryProductKey: string | null;
  /**
   * D3 fallback previous verdict: the verdict the STORED corpus alone
   * produces under the deterministic scorer, mapped onto the shopper
   * vocabulary (BUY -> BUY, DO NOT BUY YET -> WAIT, AVOID -> SKIP).
   * The route prefers the Referee state table's exact last-printed
   * word when that store exists.
   */
  storedVerdict: string | null;
  storedVerdictSource: "stored_corpus" | null;
  interventions: RefereeIntervention[];
};

export type RefereeDecision = {
  version: string;
  status: RefereeDecisionStatus;
  interventions: RefereeIntervention[];
  uniqueOpinionCount: number;
  independentSourceCount: number;
  variantDuplicatesCollapsed: number;
  newUniqueOpinionCount: number | null;
  storedOpinionCount: number | null;
  previousVerdict: string | null;
  newVerdict: string | null;
  heldVerdict: string | null;
  computedScore: number | null;
  printedScore: number | null;
  confidenceCeiling: RefereeConfidenceLevel | null;
  confidenceCapped: boolean;
  countsReconciled: boolean;
  corpusFingerprint: string | null;
  decidedAt: string;
};

export function buildRefereeDecision(parts: {
  interventions: RefereeIntervention[];
  uniqueOpinionCount: number;
  independentSourceCount: number;
  variantDuplicatesCollapsed: number;
  newUniqueOpinionCount: number | null;
  storedOpinionCount: number | null;
  previousVerdict: string | null;
  newVerdict: string | null;
  heldVerdict: string | null;
  computedScore: number | null;
  printedScore: number | null;
  confidenceCeiling: RefereeConfidenceLevel | null;
  confidenceCapped: boolean;
  countsReconciled: boolean;
  corpusFingerprint: string | null;
}): RefereeDecision {
  const blocked = parts.interventions.some((item) => item.code === "COUNTS_MISMATCH_BLOCK");
  const status: RefereeDecisionStatus = blocked
    ? "BLOCK"
    : parts.heldVerdict
      ? "HOLD"
      : parts.interventions.length
        ? "PASS_WITH_CORRECTIONS"
        : "PASS";
  return {
    version: REFEREE_VERSION,
    status,
    interventions: parts.interventions,
    uniqueOpinionCount: parts.uniqueOpinionCount,
    independentSourceCount: parts.independentSourceCount,
    variantDuplicatesCollapsed: parts.variantDuplicatesCollapsed,
    newUniqueOpinionCount: parts.newUniqueOpinionCount,
    storedOpinionCount: parts.storedOpinionCount,
    previousVerdict: parts.previousVerdict,
    newVerdict: parts.newVerdict,
    heldVerdict: parts.heldVerdict,
    computedScore: parts.computedScore,
    printedScore: parts.printedScore,
    confidenceCeiling: parts.confidenceCeiling,
    confidenceCapped: parts.confidenceCapped,
    countsReconciled: parts.countsReconciled,
    corpusFingerprint: parts.corpusFingerprint,
    decidedAt: new Date().toISOString(),
  };
}

/**
 * D4 reconciliation over the adjudication ledger: every pre-grade
 * record is accounted for exactly once — accepted, identity-rejected,
 * exact-duplicated, or variant-duplicated — and the accepted count the
 * scan publishes equals the ledger's accepted count.
 */
export function refereeReconcileCounts(input: {
  preGradeRecordCount: number;
  totalRecordCount: number;
  acceptedRecordCount: number;
  rejectedRecordCount: number;
  exactDuplicateCount: number;
  variantDuplicateCount: number;
  publishedAcceptedCount: number;
}): { reconciled: boolean; detail: string } {
  const ledgerTotal = input.acceptedRecordCount + input.rejectedRecordCount;
  if (input.totalRecordCount !== input.preGradeRecordCount) {
    return { reconciled: false, detail: `adjudication ledger holds ${input.totalRecordCount} records but ${input.preGradeRecordCount} were graded` };
  }
  if (ledgerTotal !== input.preGradeRecordCount) {
    return { reconciled: false, detail: `accepted ${input.acceptedRecordCount} + rejected ${input.rejectedRecordCount} != graded ${input.preGradeRecordCount}` };
  }
  if (input.publishedAcceptedCount !== input.acceptedRecordCount) {
    return { reconciled: false, detail: `published accepted count ${input.publishedAcceptedCount} != ledger accepted count ${input.acceptedRecordCount}` };
  }
  if (input.exactDuplicateCount + input.variantDuplicateCount > input.rejectedRecordCount) {
    return { reconciled: false, detail: "duplicate counts exceed rejected count" };
  }
  return { reconciled: true, detail: "counts reconcile to the unique-opinion set" };
}
