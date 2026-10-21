import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname);
const { adjudicateReviewEvidence } = jiti("./lib/reviewEvidenceAdjudication.ts");
const referee = jiti("./lib/reviewReferee.ts");
const { deriveDeterministicEvidenceResult } = jiti("./lib/reviewEvidenceDeterminism.ts");

const {
  REFEREE_VERSION,
  buildRefereeDecision,
  capConfidenceLevel,
  isVariantDuplicate,
  prepareVariantProfile,
  refereeCheckClaims,
  refereeConfidenceCeiling,
  refereeCorpusFingerprint,
  refereeFlipGate,
  refereeHeldScore,
  refereeReconcileCounts,
  refereeRecordIdentity,
  refereeSnippetSentiment,
  textSideOfBody,
  variantSimilarity,
} = referee;

/* ------------------------------------------------------------------ */
/* The Sony exam fixture — shaped from the real 2026-10-20 evidence:   */
/* a WH-1000XM5 corpus of 11-13 reviews including an edited-after-1-   */
/* year rant and variant copies of the same reviews at different       */
/* truncations. The rant's opening lines are the buyer's real words    */
/* as captured live ("EDIT AFTER 1 YEAR OF USE: One of the most        */
/* frustrating device I've EVER used. I've tested this on 3 separate   */
/* PC's! If you want to wirelessly…"); the continuation is written in  */
/* the same voice with complaint language the pipeline's own lexicon   */
/* can see. Stored records model what earlier scans saved to the       */
/* library; fresh records model what today's scan collected.           */
/* ------------------------------------------------------------------ */

const LISTING_URL = "https://www.amazon.com/dp/B09XS7JWHH";
const OPTIONS = {
  productName: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
  brand: "Sony",
  model: "WH-1000XM5",
  exactListingAccepted: true,
  exactListingUrl: LISTING_URL,
  exactListingTitle: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
};

const RANT_V1 =
  "EDIT AFTER 1 YEAR OF USE: One of the most frustrating device I've EVER used. I've tested this on 3 separate PC's! " +
  "If you want to wirelessly connect to a laptop the connection is poor and the sound cuts out without warning. " +
  "The battery stopped holding a charge after a few months and the case broke at the hinge. " +
  "I am so disappointed with these headphones, this was a waste of money for me.";

const RANT_V2 =
  "EDIT AFTER 1 YEAR OF USE: One of the most frustrating device I've EVER used. I've tested this on 3 separate PC's! " +
  "If you want to wirelessly connect to a laptop the connection is poor and the sound cuts out without warning. " +
  "The battery stopped holding a charge after a few months. The case broke at the hinge and now one ear cup will not charge at all. " +
  "I am so disappointed with these headphones, this was a waste of money.";

const PRAISE_FULL =
  "The sound quality on these Sony headphones is excellent and the noise cancelling is the best I have used on any flight. " +
  "Battery lasts for days with my daily commute and the fit is comfortable for long listening sessions at my desk. " +
  "Setup was easy and they connected to my phone and laptop without any fuss at all, and the case feels solid and durable.";

const PRAISE_TRUNCATED =
  "The sound quality on these Sony headphones is excellent and the noise cancelling is the best I have used on any flight. " +
  "Battery lasts for days with my daily commute and the fit is comfortable for long listening sessions at my desk.";

const PRAISE_FLIGHT =
  "I bought these Sony WH-1000XM5 headphones for long flights and they are great. Comfortable fit, the case feels durable, " +
  "and the battery life is excellent. My ears do get warm after a few hours but overall I am happy " +
  "and would recommend them to anyone who travels for work.";

const COMPLAINT_HEADBAND_FULL =
  "The headband on my Sony WH-1000XM5 cracked after four months of careful use at home. " +
  "The sound is good but the build feels weak for the price and the plastic creaks whenever I put them on. " +
  "I expected better durability from Sony at this price point and I am disappointed that support offered no help.";

const COMPLAINT_HEADBAND_SNIPPET =
  "The headband on my Sony WH-1000XM5 cracked after four months of careful use at home. " +
  "The sound is good but the build feels weak for the price and the plastic creaks whenever I put them on.";

const COMPLAINT_MIC =
  "The microphone quality is poor on calls and people tell me I sound distant and muffled. " +
  "The touch controls are difficult to use with gloves and often pause my music when I only adjust the fit. " +
  "Not a deal breaker for music at home but disappointing for the price I paid.";

const PRAISE_WFH =
  "Great headphones for working from home every day. The noise cancelling is excellent, pairing is fast, " +
  "and the microphone is clear enough for meetings. I wear them all day and they stay comfortable, " +
  "and the battery lasts the whole week without charging.";

const SHORT_PRAISE_A = "Great sound and a comfortable fit. I use them every day at the gym and the battery lasts all week.";
const SHORT_PRAISE_B = "Great sound, very comfortable. I wear them on my commute daily and the charge lasts for days.";

function rec(body, extra = {}) {
  return { body, source: LISTING_URL, sourceUrl: LISTING_URL, ...extra };
}

/** Stored library records, as earlier scans saved them. */
const STORED = [
  rec(RANT_V1, { rating: 5 }),
  rec(PRAISE_FULL, { rating: 5 }),
  rec(PRAISE_FLIGHT, { rating: 4 }),
  rec(COMPLAINT_HEADBAND_FULL, { rating: 2 }),
];

/** Fresh records collected by today's scan. */
const FRESH = [
  rec(RANT_V2, { rating: 5 }),
  rec(PRAISE_TRUNCATED, { rating: 5 }),
  rec(PRAISE_FLIGHT, { rating: 4 }),
  rec(COMPLAINT_HEADBAND_SNIPPET, { rating: 2 }),
  rec(COMPLAINT_MIC, { rating: 3 }),
  rec(PRAISE_WFH, { rating: 5 }),
  rec(SHORT_PRAISE_A, { rating: 5 }),
  rec(SHORT_PRAISE_B, { rating: 4 }),
];

function adjudicateMerged() {
  return adjudicateReviewEvidence([...FRESH, ...STORED], OPTIONS);
}

/* ------------------------------ D1 ------------------------------ */

test("D1: edited variant of the same review collapses; the longest copy survives", () => {
  const result = adjudicateMerged();
  assert.equal(result.variantDeduplicatedRecordCount, 3, "rant edit, praise truncation, headband snippet");
  const rantDropped = result.records.find((record) => !record.accepted && record.body.includes("frustrating"));
  assert.ok(rantDropped, "one copy of the rant was collapsed");
  const rantPair = result.variantDuplicatePairs.find((pair) => pair.droppedId === rantDropped.id);
  assert.ok(rantPair, "a variant pair was recorded for the rant");
  const kept = result.records.find((record) => record.id === rantPair.keptId);
  const dropped = result.records.find((record) => record.id === rantPair.droppedId);
  assert.ok(kept && dropped, "pair ids resolve to records");
  assert.ok(kept.body.length >= dropped.body.length, "survivor is the longest variant");
  assert.equal(dropped.accepted, false);
  assert.match(dropped.rejectionReason || "", /variant duplicate/);
});

test("D1: adjudication ledger accounts for every merged record exactly once", () => {
  const result = adjudicateMerged();
  assert.equal(result.records.length, FRESH.length + STORED.length);
  assert.equal(result.acceptedRecordCount + result.rejectedRecordCount, result.records.length);
  assert.equal(result.acceptedRecordCount, 8, "eight unique opinions survive: rant, 3 praises, flight praise, headband, mic, 2 short");
  assert.equal(result.deduplicatedRecordCount, 1, "the exact re-collected copy is an exact duplicate");
});

test("D1: distinct buyers with genuinely similar short praise are never collapsed", () => {
  const result = adjudicateReviewEvidence([rec(SHORT_PRAISE_A), rec(SHORT_PRAISE_B)], OPTIONS);
  assert.equal(result.acceptedRecordCount, 2);
  assert.equal(result.variantDeduplicatedRecordCount, 0);
});

test("D1: different named reviewers never collapse, even for near-identical long texts", () => {
  const a = prepareVariantProfile(RANT_V1);
  const b = prepareVariantProfile(RANT_V2);
  const same = isVariantDuplicate(a, "buyer one", b, "buyer one");
  assert.equal(same.variant, true, "same reviewer + edited text = variant");
  const different = isVariantDuplicate(a, "buyer one", b, "buyer two");
  assert.equal(different.variant, false, "different reviewers = different buyers");
});

test("D1: similarity guards refuse short generic texts", () => {
  const a = prepareVariantProfile("Great product, works well and I love it a lot.");
  const b = prepareVariantProfile("Great product, works well and I love it so much.");
  const outcome = isVariantDuplicate(a, "", b, "");
  assert.equal(outcome.variant, false);
  assert.ok(outcome.similarity.shorterChars < referee.REFEREE_VARIANT.minNormalizedChars);
});

test("D1: two long, independently phrased reviews of the same product do not collapse", () => {
  const result = adjudicateReviewEvidence([rec(PRAISE_FULL), rec(PRAISE_WFH), rec(COMPLAINT_MIC)], OPTIONS);
  assert.equal(result.acceptedRecordCount, 3);
  assert.equal(result.variantDeduplicatedRecordCount, 0);
  const sim = variantSimilarity(prepareVariantProfile(PRAISE_FULL), prepareVariantProfile(PRAISE_WFH));
  assert.ok(sim.containment < referee.REFEREE_VARIANT.containmentThreshold);
});

test("D1: marketplace review identity is decisive — different ids never collapse, same id confirms an edit", () => {
  // Template-sibling texts: identical except the review number
  // (containment ~0.81 — under the text-only bar, over the standard bar).
  const sibling = (n) =>
    `TEST PRODUCT ALPHA 150 review ${n}: it works reliably, is durable and easy to use. the battery failed and was returned for a refund`;
  // The id rides in the review URL only (no reviewId field), so
  // adjudication's own by-id exact dedupe stays out of the way and the
  // Referee's identity verdict is the mechanism under test.
  const withId = (n) => ({
    body: sibling(n),
    source: `https://www.amazon.ca/product-reviews/B0ALPHA150/?reviewId=RID${n}`,
    sourceUrl: `https://www.amazon.ca/product-reviews/B0ALPHA150/?reviewId=RID${n}`,
  });
  const distinct = adjudicateReviewEvidence([withId(1), withId(2)], {
    productName: "TEST PRODUCT ALPHA 150",
    brand: "TEST BRAND",
    model: "ALPHA-150",
    exactListingAccepted: true,
    exactListingUrl: "https://www.amazon.ca/dp/B0ALPHA150",
    exactListingTitle: "TEST BRAND TEST PRODUCT ALPHA 150",
  });
  assert.equal(distinct.acceptedRecordCount, 2, "two different marketplace review ids are two different reviews");
  assert.equal(distinct.variantDeduplicatedRecordCount, 0);
  // The same review id in an edited state IS one buyer speaking twice.
  const edited = { ...withId(1), body: sibling(1).replace("it works reliably", "it works reliably most days") };
  const collapsed = adjudicateReviewEvidence([withId(1), edited], {
    productName: "TEST PRODUCT ALPHA 150",
    brand: "TEST BRAND",
    model: "ALPHA-150",
    exactListingAccepted: true,
    exactListingUrl: "https://www.amazon.ca/dp/B0ALPHA150",
    exactListingTitle: "TEST BRAND TEST PRODUCT ALPHA 150",
  });
  assert.equal(collapsed.variantDeduplicatedRecordCount, 1, "same marketplace id + edited text = variant duplicate");
  // Identity extraction itself.
  const identity = referee.refereeReviewIdentity(withId(7));
  assert.equal(identity.reviewId, "rid7");
  assert.equal(identity.host, "amazon.ca");
  assert.equal(referee.refereeReviewIdentity(rec("no identity here")), null);
});

test("D1: serial-stamp siblings (long shared body, differing tail stamp) are distinct records, not variants", () => {
  // The shape of templated review sets — and of the pipeline's own
  // full-body-difference doctrine: six records that share a long body
  // and differ only in a final observation number must ALL survive
  // adjudication (the AI-pattern system needs to see every one).
  const prefix = "I use my ring daily and it is comfortable. " + Array.from({ length: 85 }, () => "context").join(" ");
  const siblings = Array.from({ length: 6 }, (_, i) => ({
    body: `${prefix} My independent experience ends with observation ${i}.`,
    source: LISTING_URL,
    sourceUrl: LISTING_URL,
  }));
  const result = adjudicateReviewEvidence(siblings, OPTIONS);
  assert.equal(result.acceptedRecordCount, 6);
  assert.equal(result.variantDeduplicatedRecordCount, 0);
  assert.equal(referee.isSerialStampSibling(prepareVariantProfile(siblings[0].body), prepareVariantProfile(siblings[1].body)), true);
  // …while a genuine truncation of the same long body still collapses.
  const full = `${prefix} My independent experience ends with observation 0. The strap also irritates my skin after long runs in summer heat.`;
  const truncated = prefix;
  const pair = adjudicateReviewEvidence([rec(full), rec(truncated)], OPTIONS);
  assert.equal(pair.variantDeduplicatedRecordCount, 1, "a long extra tail is a truncation, not a stamp");
});

/* ------------------------------ D2 ------------------------------ */

test("D2: a 5-star rating cannot file a complaint text as a buy reason", () => {
  const outcome = refereeSnippetSentiment("positive", RANT_V2);
  assert.equal(outcome.textSide, "negative");
  assert.equal(outcome.corrected, true);
  assert.equal(outcome.sentiment, "negative");
  const honest = refereeSnippetSentiment("positive", PRAISE_FULL);
  assert.equal(honest.corrected, false);
  assert.equal(honest.sentiment, "positive");
  assert.equal(textSideOfBody(COMPLAINT_HEADBAND_FULL), "mixed", "praise + complaint stays mixed, never forced to a side");
});

test("D2: a strength backed by a pure-complaint record is dropped, never re-sided", () => {
  const result = adjudicateMerged();
  const byId = new Map(result.acceptedRecords.map((record) => [record.id, record.body]));
  const rant = result.acceptedRecords.find((record) => record.body.includes("frustrating"));
  const praise = result.acceptedRecords.find((record) => record.body.startsWith("The sound quality"));
  assert.ok(rant && praise);
  const check = refereeCheckClaims({
    strengths: [
      { claim: "long battery life", sourceIds: [rant.id] },
      { claim: "excellent noise cancelling", sourceIds: [praise.id] },
    ],
    complaints: [{ claim: "poor call quality", sourceIds: [praise.id] }],
    bodyByRecordId: byId,
  });
  assert.equal(check.dropped.length, 2);
  assert.ok(check.dropped.every((item) => item.reason.length > 0));
  assert.deepEqual(check.kept.map((item) => item.claim), ["excellent noise cancelling"]);
});

test("D2: the deterministic scorer never backs a strength with the rant", () => {
  const result = adjudicateMerged();
  const deterministic = deriveDeterministicEvidenceResult({
    acceptedRecords: result.acceptedRecords,
    exactProductAccepted: true,
    rating: 4.2,
    marketplaceReviewCount: 20217,
    price: null,
    verifiedProductMetadata: { productName: OPTIONS.productName, brand: "Sony", store: "Amazon.com" },
    riskFeatures: {},
    summaryModelVersion: null,
  });
  const rant = result.acceptedRecords.find((record) => record.body.includes("frustrating"));
  assert.ok(rant);
  for (const strength of deterministic.strengths) {
    assert.ok(!strength.sourceIds.includes(rant.id), `strength "${strength.claim}" must not be backed by the rant`);
  }
  assert.ok(
    deterministic.complaints.some((complaint) => complaint.sourceIds.includes(rant.id)),
    "the rant backs a complaint instead"
  );
});

/* ------------------------------ D3 ------------------------------ */

test("D3: a flip on recounts alone is held; a flip on new voices passes", () => {
  const held = refereeFlipGate({ previousVerdict: "WAIT", newVerdict: "BUY", newUniqueOpinionCount: 1, totalUniqueOpinionCount: 12 });
  assert.equal(held.flip, true);
  assert.equal(held.hold, true);
  assert.ok(held.requiredNewOpinions >= 2);
  const passed = refereeFlipGate({ previousVerdict: "WAIT", newVerdict: "BUY", newUniqueOpinionCount: 4, totalUniqueOpinionCount: 13 });
  assert.equal(passed.hold, false);
  assert.equal(passed.material, true);
  const noFlip = refereeFlipGate({ previousVerdict: "BUY", newVerdict: "BUY", newUniqueOpinionCount: 0, totalUniqueOpinionCount: 9 });
  assert.equal(noFlip.hold, false);
  const firstScan = refereeFlipGate({ previousVerdict: null, newVerdict: "SKIP", newUniqueOpinionCount: 0, totalUniqueOpinionCount: 3 });
  assert.equal(firstScan.hold, false, "first-ever scan cannot be held");
});

test("D3: held score prints inside the held word's band, computed numbers preserved", () => {
  assert.equal(refereeHeldScore("WAIT", 76), 74);
  assert.equal(refereeHeldScore("WAIT", 63), 63, "already in band: unchanged");
  assert.equal(refereeHeldScore("BUY", 41), 75);
  assert.equal(refereeHeldScore("SKIP", 88), 49);
});

test("D3 (Sony exam): the edited rant is not a new opinion — delta counts real new voices only", () => {
  const result = adjudicateMerged();
  const storedIdentities = new Set(STORED.map((record) => refereeRecordIdentity(record)));
  assert.equal(storedIdentities.size, 4);
  const newOpinions = referee.countNewOpinions(result.acceptedRecords, STORED);
  assert.equal(newOpinions, 4, "mic complaint, work-from-home praise, and the two short praises are new; the rant edit is not");
  const gate = refereeFlipGate({
    previousVerdict: "WAIT",
    newVerdict: "BUY",
    newUniqueOpinionCount: newOpinions,
    totalUniqueOpinionCount: result.acceptedRecordCount,
  });
  assert.equal(gate.hold, false, "four genuinely new opinions in a pile of eight is a material delta");
  const starved = refereeFlipGate({
    previousVerdict: "WAIT",
    newVerdict: "BUY",
    newUniqueOpinionCount: 1,
    totalUniqueOpinionCount: result.acceptedRecordCount,
  });
  assert.equal(starved.hold, true);
});

/* ------------------------------ D4 ------------------------------ */

test("D4: published counts reconcile to the post-D1 unique set", () => {
  const result = adjudicateMerged();
  const ok = refereeReconcileCounts({
    preGradeRecordCount: FRESH.length + STORED.length,
    totalRecordCount: result.records.length,
    acceptedRecordCount: result.acceptedRecordCount,
    rejectedRecordCount: result.rejectedRecordCount,
    exactDuplicateCount: result.deduplicatedRecordCount,
    variantDuplicateCount: result.variantDeduplicatedRecordCount,
    publishedAcceptedCount: result.acceptedRecords.length,
  });
  assert.equal(ok.reconciled, true, ok.detail);
  const tampered = refereeReconcileCounts({
    preGradeRecordCount: FRESH.length + STORED.length,
    totalRecordCount: result.records.length,
    acceptedRecordCount: result.acceptedRecordCount,
    rejectedRecordCount: result.rejectedRecordCount,
    exactDuplicateCount: result.deduplicatedRecordCount,
    variantDuplicateCount: result.variantDeduplicatedRecordCount,
    publishedAcceptedCount: result.acceptedRecordCount + 3,
  });
  assert.equal(tampered.reconciled, false);
});

test("D4: the graded corpus fingerprint is stable for the same corpus", () => {
  const result = adjudicateMerged();
  const ids = result.acceptedRecords.map((record) => `fp:${record.stableEvidenceHash}`);
  const a = refereeCorpusFingerprint(ids);
  const b = refereeCorpusFingerprint([...ids].reverse());
  assert.equal(a, b, "order-free");
  const again = adjudicateMerged();
  const c = refereeCorpusFingerprint(again.acceptedRecords.map((record) => `fp:${record.stableEvidenceHash}`));
  assert.equal(a, c, "same corpus in, same fingerprint out — the Referee is deterministic");
});

/* ------------------------------ D5 ------------------------------ */

test("D5: confidence ceiling follows the existing evidence bands and source breadth", () => {
  assert.equal(refereeConfidenceCeiling({ uniqueOpinionCount: 0, independentSourceCount: 0 }), null);
  assert.equal(refereeConfidenceCeiling({ uniqueOpinionCount: 3, independentSourceCount: 3 }), "Low");
  assert.equal(refereeConfidenceCeiling({ uniqueOpinionCount: 10, independentSourceCount: 1 }), "Low");
  assert.equal(refereeConfidenceCeiling({ uniqueOpinionCount: 10, independentSourceCount: 2 }), "Medium");
  assert.equal(refereeConfidenceCeiling({ uniqueOpinionCount: 20, independentSourceCount: 2 }), "Medium");
  assert.equal(refereeConfidenceCeiling({ uniqueOpinionCount: 20, independentSourceCount: 3 }), "High");
  assert.equal(refereeConfidenceCeiling({ uniqueOpinionCount: 40, independentSourceCount: 1 }), "Medium");
  assert.equal(refereeConfidenceCeiling({ uniqueOpinionCount: 40, independentSourceCount: 2 }), "High");
  assert.deepEqual(capConfidenceLevel("High", "Medium"), { level: "Medium", capped: true });
  assert.deepEqual(capConfidenceLevel("Low", "High"), { level: "Low", capped: false }, "the Referee never raises confidence");
});

/* ------------------------- decision object ------------------------- */

test("decision object: corrections, hold and block derive the right status", () => {
  const base = {
    interventions: [],
    uniqueOpinionCount: 8,
    independentSourceCount: 1,
    variantDuplicatesCollapsed: 0,
    newUniqueOpinionCount: 4,
    storedOpinionCount: 4,
    previousVerdict: "WAIT",
    newVerdict: "WAIT",
    heldVerdict: null,
    computedScore: 63,
    printedScore: 63,
    confidenceCeiling: "Low",
    confidenceCapped: false,
    countsReconciled: true,
    corpusFingerprint: "abc",
  };
  assert.equal(buildRefereeDecision(base).status, "PASS");
  assert.equal(buildRefereeDecision(base).version, REFEREE_VERSION);
  const corrected = buildRefereeDecision({
    ...base,
    interventions: [{ code: "VARIANT_DUPLICATE_COLLAPSED", duty: "D1", detail: "3 variant copies collapsed" }],
    variantDuplicatesCollapsed: 3,
  });
  assert.equal(corrected.status, "PASS_WITH_CORRECTIONS");
  const held = buildRefereeDecision({
    ...base,
    interventions: [{ code: "VERDICT_HELD_NO_MATERIAL_DELTA", duty: "D3", detail: "flip without new voices" }],
    newVerdict: "BUY",
    heldVerdict: "WAIT",
    printedScore: 74,
  });
  assert.equal(held.status, "HOLD");
  const blocked = buildRefereeDecision({
    ...base,
    interventions: [{ code: "COUNTS_MISMATCH_BLOCK", duty: "D4", detail: "counts do not reconcile" }],
    countsReconciled: false,
  });
  assert.equal(blocked.status, "BLOCK");
});
