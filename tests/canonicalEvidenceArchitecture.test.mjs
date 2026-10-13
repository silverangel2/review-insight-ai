import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname);
const { adjudicateReviewEvidence, verifyEvidenceClaims } = jiti("./lib/reviewEvidenceAdjudication.ts");

const reviewEvidenceSource = fs.readFileSync(new URL("../lib/reviewEvidence.ts", import.meta.url), "utf8");
const analyzeRouteSource = fs.readFileSync(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");
const productStabilitySource = fs.readFileSync(new URL("../lib/productStability.ts", import.meta.url), "utf8");
const governorSource = fs.readFileSync(new URL("../lib/decisionGovernor.ts", import.meta.url), "utf8");

const options = {
  productName: "TEST PRODUCT ALPHA 150",
  brand: "TEST BRAND",
  model: "ALPHA-150",
  exactListingAccepted: true,
  exactListingUrl: "https://marketplace.example/products/alpha-150",
  exactListingTitle: "TEST BRAND TEST PRODUCT ALPHA 150",
};

function review(id, sourceUrl, body = `TEST BRAND TEST PRODUCT ALPHA 150 review ${id}: reliable performance and durable construction.`) {
  return { body, source: sourceUrl, sourceUrl };
}

test("remembered evidence is re-adjudicated before the reusable return", () => {
  assert.match(reviewEvidenceSource, /function adjudicateRememberedEvidence/);
  assert.match(reviewEvidenceSource, /const rememberedAdjudication = adjudicateRememberedEvidence/);
  assert.match(reviewEvidenceSource, /evidenceAdjudication: rememberedAdjudication/);
});

test("current evidence is the only evidence selected for product stability", () => {
  assert.match(productStabilitySource, /const finalReviewEvidence = currentReviewEvidence \|\| rememberedReviewEvidence \|\| null/);
  assert.match(productStabilitySource, /canonicalSufficiencyPassed/);
  assert.match(productStabilitySource, /!exactListingAccepted \|\| !canonicalSufficiencyPassed/);
});

test("governor cannot authorize score from comments alone", () => {
  assert.match(governorSource, /canonicalSufficiencyPassed === true/);
  assert.match(governorSource, /input.canonicalSufficiencyPassed === true/);
});

test("canonical eligibility guard precedes danger and AI-risk verdicts", () => {
  const guard = governorSource.indexOf('if (!hasVerifiedReviewEvidence)');
  const verdictBranches = governorSource.slice(guard);
  const avoid = verdictBranches.indexOf('verdict: "AVOID"');
  const danger = verdictBranches.indexOf('actualDanger ||');
  const aiRisk = verdictBranches.indexOf('(aiLikeRisk !== null && aiLikeRisk >= 75)');

  assert.ok(guard >= 0, "missing canonical eligibility guard");
  assert.ok(avoid >= 0, "missing AVOID branch");
  assert.ok(danger >= 0, "missing danger branch");
  assert.ok(aiRisk >= 0, "missing AI-risk branch");
});

test("unverified danger cannot produce AVOID", () => {
  assert.match(governorSource, /if \(!hasVerifiedReviewEvidence\) \{[\s\S]*?verdict: "REVIEW EVIDENCE NOT ENOUGH"/);
  assert.match(governorSource, /actualDanger \|\|/);
});

test("unverified AI-like risk cannot produce AVOID", () => {
  assert.match(governorSource, /if \(!hasVerifiedReviewEvidence\) \{[\s\S]*?buyerConfidence: null,[\s\S]*?buyScore: null/);
  assert.match(governorSource, /aiLikeRisk !== null && aiLikeRisk >= 75/);
});

test("verified exact danger path remains available", () => {
  assert.match(governorSource, /hasVerifiedReviewEvidence/);
  assert.match(governorSource, /if \(\s*actualDanger \|\|/);
  assert.match(governorSource, /verdict: "AVOID"/);
});

test("verified exact high AI-risk path remains available", () => {
  assert.match(governorSource, /hasVerifiedReviewEvidence/);
  assert.match(governorSource, /aiLikeRisk !== null && aiLikeRisk >= 75/);
  assert.match(governorSource, /verdict: "AVOID"/);
});

test("current insufficient or rejected truth dominates previously abundant evidence", () => {
  const abundant = Array.from({ length: 50 }, (_, index) => review(String(index), `https://marketplace.example/alpha/${index}`));
  const rejected = adjudicateReviewEvidence(abundant, { ...options, exactListingAccepted: false });
  const duplicateOnly = adjudicateReviewEvidence(
    abundant.map((record) => ({ ...record, body: abundant[0].body })),
    options
  );

  assert.equal(rejected.sufficientByExistingThreshold, false);
  assert.equal(duplicateOnly.acceptedRecordCount, 1);
  assert.equal(duplicateOnly.sufficientByExistingThreshold, false);
});

test("unsupported claims are removed while claims with accepted sources survive", () => {
  const adjudication = adjudicateReviewEvidence([
    review("one", "https://marketplace.example/alpha/1", "TEST BRAND TEST PRODUCT ALPHA 150 review: reliable performance."),
    review("two", "https://retailer.example/alpha/2", "TEST BRAND TEST PRODUCT ALPHA 150 review: reliable performance."),
    review("three", "https://forum.example/alpha/3", "TEST BRAND TEST PRODUCT ALPHA 150 review: reliable performance."),
  ], options);
  const verified = verifyEvidenceClaims([
    { claim: "reliable performance" },
    { claim: "unrelated invented claim" },
  ], adjudication);

  assert.equal(verified.claims[0].verified, true);
  assert.equal(verified.claims[1].verified, false);
  assert.equal(verified.passed, false);
});

test("exact listing plus canonical adjudicated evidence retains a scoring path", () => {
  const adjudication = adjudicateReviewEvidence([
    review("one", "https://marketplace.example/alpha/1"),
    review("two", "https://retailer.example/alpha/2", "TEST BRAND TEST PRODUCT ALPHA 150 review two: easy setup and reliable performance."),
    review("three", "https://forum.example/alpha/3", "TEST BRAND TEST PRODUCT ALPHA 150 review three: durable and reliable performance."),
  ], options);
  assert.equal(adjudication.sufficientByExistingThreshold, true);
  assert.match(productStabilitySource, /canonicalSufficiencyPassed/);
  assert.match(governorSource, /hasEnoughEvidence &&\s*hasVerifiedReviewEvidence/);
});

test("analyze result serialization uses canonical eligibility for all substantive claims", () => {
  assert.match(analyzeRouteSource, /const canonicalSufficiencyPassed =\s*evidenceAdjudication\?\.sufficientByExistingThreshold === true/);
  assert.match(analyzeRouteSource, /const canonicalEvidenceEligible = exactListingAccepted && canonicalSufficiencyPassed/);
  assert.match(analyzeRouteSource, /const hasUsableReviewEvidence = canonicalEvidenceEligible && hasReadableReviewEvidence/);
  assert.match(analyzeRouteSource, /topStrengths: canonicalEvidenceEligible &&/);
  assert.match(analyzeRouteSource, /topComplaints: canonicalEvidenceEligible &&/);
  assert.match(analyzeRouteSource, /strengths: canonicalEvidenceEligible &&/);
  assert.match(analyzeRouteSource, /complaints: canonicalEvidenceEligible &&/);
  assert.match(analyzeRouteSource, /aiPatternSignals: canonicalEvidenceEligible &&/);
  assert.match(analyzeRouteSource, /const customerReviewEvidence = canonicalEvidenceEligible/);
  assert.match(analyzeRouteSource, /reviewEvidence: customerReviewEvidence/);
  assert.match(analyzeRouteSource, /acceptedRecordCount: deterministic\.acceptedReviewHashes\.length/);
  assert.match(analyzeRouteSource, /sufficientByExistingThreshold: false/);
  assert.doesNotMatch(analyzeRouteSource, /isSufficientReviewEvidence\(/);
});

test("fictional rejected or insufficient evidence cannot authorize substantive output", () => {
  const fictional = {
    productName: "ZZQ_TEST_PRODUCT_X9_59317",
    brand: "ZZQ_TEST_BRAND_84721",
    model: "ZZQ_MODEL_44192",
  };
  const records = Array.from({ length: 11 }, (_, index) => review(
    String(index),
    `https://reviews.test.invalid/zzq/${index}`,
    `${fictional.brand} ${fictional.productName} review ${index}: large capacity and easy to use.`
  ));

  const rejected = adjudicateReviewEvidence(records, {
    ...options,
    ...fictional,
    exactListingAccepted: false,
    exactListingUrl: null,
  });
  const insufficient = adjudicateReviewEvidence(records.map((record) => ({ ...record, body: records[0].body })), {
    ...options,
    ...fictional,
    exactListingAccepted: true,
    exactListingUrl: "https://test.invalid/zzq-x9",
  });

  assert.equal(rejected.sufficientByExistingThreshold, false);
  assert.equal(insufficient.sufficientByExistingThreshold, false);
  assert.match(analyzeRouteSource, /const canonicalEvidenceEligible = exactListingAccepted && canonicalSufficiencyPassed/);
  assert.match(analyzeRouteSource, /topStrengths: canonicalEvidenceEligible &&/);
  assert.match(analyzeRouteSource, /buyScore = null/);
});
