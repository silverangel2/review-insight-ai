import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const ASIN = "B09B8V1LZ3";
const LINK = `https://www.amazon.com/dp/${ASIN}`;
const CA_LINK = `https://www.amazon.ca/dp/${ASIN}`;
const OCR_TITLE = "Amazon Echo Dot (newest model) - Vibrant...";
const NAV = "Echo Dot Echo Dot Max Echo Spot Echo Studio. Echo Show 5...";
const BLANK_PAGE = "<html><head><title>Robot Check</title></head><body>Sorry, we just need to make sure you're not a robot.</body></html>";

const authority = jiti("./lib/listingAuthority.ts");
const facts = jiti("./lib/screenshotProductFacts.ts");
const verifier = jiti("./lib/productSearchVerifier.ts");
const retrieval = jiti("./lib/productUrlRetrieval.ts");
const buying = jiti("./lib/buyingScore.ts");
const governor = jiti("./lib/decisionGovernor.ts");
const scoring = jiti("./lib/reviewEvidenceScoring.ts");
const native = jiti("./lib/nativeReviewRetrieval.ts");

test("blank anti-bot page falls back to the OCR product title, then Amazon ASIN", () => {
  const page = retrieval.extractProductEvidenceFromHtml(BLANK_PAGE, CA_LINK);
  assert.equal(page.title, null);
  assert.equal(page.rating, null);
  assert.equal(page.reviewCount, null);

  const ocr = facts.productFactsFromOcr({
    fileSha256: "echo-dot",
    ocrConfidence: 92,
    engine: "t",
    lines: [
      { text: NAV, confidence: 96 },
      { text: OCR_TITLE, confidence: 94 },
      { text: "4.7 out of 5 stars", confidence: 93 },
      { text: "200,809 ratings", confidence: 91 },
    ],
  });
  assert.equal(ocr.name, OCR_TITLE);
  assert.equal(ocr.rating, "4.7");
  assert.equal(ocr.reviewCount, "200809");
  assert.equal(facts.isAmazonNavOrHeaderText(OCR_TITLE), false);

  assert.equal(facts.authoritativeDisplayName({ listingTitle: page.title, screenshotName: ocr.name, asin: ASIN }), OCR_TITLE);
  assert.equal(facts.authoritativeDisplayName({ listingTitle: "Robot Check", screenshotName: ocr.name, asin: ASIN }), OCR_TITLE);
  assert.equal(facts.authoritativeDisplayName({ listingTitle: "", screenshotName: NAV, asin: ASIN }), "Amazon product");
  assert.equal(facts.authoritativeDisplayName({
    listingTitle: "Echo Dot (5th Gen, 2022 release) | Smart speaker with Alexa",
    screenshotName: ocr.name,
    asin: ASIN,
  }), "Echo Dot (5th Gen, 2022 release) | Smart speaker with Alexa");
});

test("OCR stars and review count become the provisional marketplace score when the page has no aggregate", () => {
  const aggregate = buying.marketplaceAggregateForScore({
    exactListingAccepted: true,
    pageRating: null,
    pageCount: null,
    screenshotRating: "4.7",
    screenshotCount: "200809",
  });
  assert.equal(aggregate.source, "screenshot");
  assert.equal(aggregate.rating, 4.7);
  assert.equal(aggregate.count, 200809);

  const score = buying.buyingScoreFromReviews({
    marketplace: { rating: aggregate.rating, count: aggregate.count, matchesExactModel: true },
    reviews: [],
  });
  assert.equal(score.mode, "provisional_marketplace");
  assert.equal(score.verdict, "Buy");
  assert.equal(typeof score.score, "number");
  assert.ok(score.score > 10);
  assert.ok(score.leaning);
  assert.match(score.label, /Provisional Marketplace Score/);

  const rejected = buying.marketplaceAggregateForScore({
    exactListingAccepted: false,
    pageRating: 4.1,
    pageCount: 12,
    screenshotRating: "4.7",
    screenshotCount: "200,809",
  });
  assert.equal(rejected.source, "screenshot");
  assert.equal(rejected.rating, 4.7);
  assert.equal(rejected.count, 200809);
  const rejectedScore = buying.buyingScoreFromReviews({
    marketplace: { rating: rejected.rating, count: rejected.count, matchesExactModel: true },
    reviews: [],
  });
  assert.equal(rejectedScore.mode, "provisional_marketplace");
  assert.equal(typeof rejectedScore.score, "number");
  const shopper = jiti("./lib/shopperAnswer.ts");
  const screenshotResult = {
    product: { name: "Echo Dot (5th Gen)", url: LINK, rating: "4.7", reviewCount: "200,809" },
    buyScore: rejectedScore.score,
    buyingScoreV2: rejectedScore,
    exactListingUrl: LINK,
    reviewEvidence: { commentsAnalyzed: 0, listingEvidence: { exactListingUrl: LINK, rating: null, reviewCount: null } },
  };
  assert.equal(shopper.isUnreadableAmazonPage(screenshotResult), false);
  const answer = shopper.deriveShopperAnswer(screenshotResult);
  assert.equal(answer.unreadable, false);
  assert.equal(answer.score, rejectedScore.score);
  assert.notEqual(answer.why, "We couldn't read this Amazon page right now.");

  const pageWins = buying.marketplaceAggregateForScore({
    exactListingAccepted: true,
    pageRating: 4.4,
    pageCount: 80000,
    screenshotRating: "4.7",
    screenshotCount: "200809",
  });
  assert.equal(pageWins.source, "page");
  assert.equal(pageWins.rating, 4.4);
});

test("an exact ASIN link is accepted despite a screenshot rating mismatch and is collected on that domain", () => {
  const result = verifier.verifyProductCandidate({
    scanId: "echo-dot",
    productName: "Echo Dot",
    store: "Amazon.ca",
    rating: 4.7,
    reviewCount: 200809,
    authoritativeListingUrl: LINK,
  }, {
    url: CA_LINK,
    title: "Echo Dot (5th Gen, 2022 release)",
    rating: 4.2,
    reviewCount: 1200,
    source: "supplied-listing-identity",
  });
  assert.equal(result.verifierStatus, "verified_exact_match");
  assert.notEqual(result.verifierStatus, "rejected_rating_review_count_mismatch");
  assert.equal(result.canCollectReviews, true);
  assert.equal(result.canonicalIdentifier, ASIN);
  assert.equal(result.verifiedListingUrl, LINK);
  assert.match(result.verifierReasons.join(" "), /not a rejection/i);

  assert.equal(authority.collectorListingForAuthoritativeAsin({
    listingUrl: LINK,
    verifiedListingUrl: result.verifiedListingUrl,
    canonicalIdentifier: result.canonicalIdentifier,
    canCollectReviews: result.canCollectReviews,
  }), LINK);
  assert.equal(authority.preferredAmazonHost({ listingUrl: LINK, store: "Amazon.ca" }), "www.amazon.com");
  assert.equal(authority.preferredAmazonHost({ store: "Amazon.ca" }), "www.amazon.ca");
  assert.equal(authority.amazonStoreLabel(LINK), "Amazon.com");

  const nativeSource = readFileSync(new URL("../lib/nativeReviewRetrieval.ts", import.meta.url), "utf8");
  const direct = nativeSource.indexOf("buildDirectReviewCandidateUrls(listingUrl)");
  const sibling = nativeSource.indexOf("for (const url of buildLocaleListingVariants(listingUrl))");
  const pages = nativeSource.indexOf("buildAmazonReviewPageUrls(listingUrl, asin)");
  assert.ok(direct > 0 && sibling > direct && pages > sibling);
  const evidence = readFileSync(new URL("../lib/reviewEvidence.ts", import.meta.url), "utf8");
  assert.match(evidence, /collectorListingForAuthoritativeAsin\(/);
});

test("store-only and star-rating search queries are not sent", () => {
  assert.equal(authority.isDriftSearchQuery("Amazon.ca"), true);
  assert.equal(authority.isDriftSearchQuery("4.7 stars 200,809 ratings Amazon.ca"), true);
  assert.equal(authority.isDriftSearchQuery("4.7 stars ... Amazon.ca"), true);
  assert.equal(authority.isDriftSearchQuery('site:amazon.com "Echo Dot" speaker'), false);

  const retries = verifier.buildProductRetryQueries({
    scanId: "drift",
    store: "Amazon.ca",
    productName: "4.7 stars Amazon.ca",
    rating: 4.7,
    reviewCount: 200809,
  });
  assert.ok(retries.every((query) => !authority.isDriftSearchQuery(query)));
  assert.doesNotMatch(retries.join("\n"), /^(?:Amazon\.ca|4\.7 stars)/im);

  const nativeQueries = native.buildNativeReviewSearchQueries({
    productTitle: "4.7 stars Amazon.ca",
    store: "Amazon.ca",
  });
  assert.ok(nativeQueries.every((query) => !authority.isDriftSearchQuery(query)));
  assert.equal(nativeQueries.some((query) => /amazon\.ca/i.test(query) && !/echo|dot|speaker/i.test(query)), false);

  const linked = native.buildNativeReviewSearchQueries({
    productTitle: "Echo Dot (newest model)",
    store: "Amazon.ca",
    listingUrl: LINK,
  });
  assert.ok(linked.some((query) => /Amazon\.com/i.test(query)));
  assert.equal(linked.some((query) => /Amazon\.ca reviews/i.test(query)), false);
});

test("zero analyzed reviews never keep a review-evidence Buy score", () => {
  const written = buying.buyingScoreFromReviews({
    marketplace: { rating: 4.7, count: 200809, matchesExactModel: true },
    reviews: [{
      body: "This speaker sounds great and I use it every day in the kitchen.",
      rating: 5,
      source: "Amazon",
      sourceUrl: LINK,
    }],
  });
  assert.ok(written.audit.n > 0);
  const faced = buying.customerFacingDecision({ analyzedReviews: 0, buyingScore: written });
  assert.equal(faced.finalDecisionSource, "buyingScoreV2");
  assert.notEqual(faced.finalDecisionSource, "reviewEvidence");
  assert.equal(faced.verdict, "BUY");
  assert.notEqual(faced.verdict, "AVOID");
  assert.equal(faced.buyingScore.mode, "provisional_marketplace");
  assert.equal(faced.buyingScore.verdict, "Buy");
  assert.ok(faced.buyingScore.leaning);
  assert.equal(typeof faced.buyScore, "number");
  assert.ok(faced.buyScore > 10);
  assert.notEqual(faced.buyScore, 8);
  assert.notEqual(faced.buyScore, 9.6);

  const governed = governor.governBuyerDecision({
    rating: 4.7,
    reviewCount: 200809,
    commentsAnalyzed: 0,
    exactListingAccepted: true,
    canonicalSufficiencyPassed: true,
  });
  assert.notEqual(governed?.verdict, "BUY");
  assert.notEqual(governed?.buyScore, 8);
  assert.notEqual(governed?.buyScore, 8.8);
  assert.notEqual(governed?.buyScore, 9.6);

  const scored = scoring.scoreReviewEvidenceSignals({
    rating: 4.7,
    marketplaceRating: 4.7,
    marketplaceReviewCount: 200809,
    commentsAnalyzed: 0,
    evidenceStrength: "none",
  });
  assert.notEqual(scored.verdict, "BUY");
  assert.equal(scored.buyScore, null);
});

test("a valid product URL can be analyzed without a screenshot", () => {
  assert.equal(authority.isAnalyzableProductUrl(LINK), true);
  assert.equal(authority.isAnalyzableProductUrl("https://www.amazon.ca/dp/B09B8V1LZ3?th=1"), true);
  assert.equal(authority.isAnalyzableProductUrl("https://www.walmart.com/ip/Some-Product/123456"), true);
  assert.equal(authority.isAnalyzableProductUrl("https://www.amazon.ca"), false);
  assert.equal(authority.isAnalyzableProductUrl("https://www.amazon.com/s?k=echo+dot"), false);
  assert.equal(authority.isAnalyzableProductUrl(""), false);

  const form = readFileSync(new URL("../components/AnalyzerForm.tsx", import.meta.url), "utf8");
  assert.match(form, /isAnalyzableProductUrl\(productLink\)/);
  assert.doesNotMatch(form, /const canAnalyze = Boolean\(image\) && !isLoading/);
  assert.match(form, /if \(image\) formData\.append\("image", image\)/);
  const route = readFileSync(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");
  assert.match(route, /isAnalyzableProductUrl\(productLink\)/);
  assert.match(route, /customerFacingDecision\(/);
  assert.match(route, /marketplaceAggregateForScore\(/);
  assert.doesNotMatch(form, /Not scored|Not enough evidence/i);
});
