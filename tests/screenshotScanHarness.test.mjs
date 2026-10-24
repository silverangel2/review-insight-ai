import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const harness = jiti("./lib/screenshotScanHarness.ts");
const identity = jiti("./lib/screenshotListingIdentity.ts");

const fixtures = JSON.parse(readFileSync(root + "fixtures/screenshot-scans/identity.json", "utf8"));

test("identity fixtures pass the screenshot harness", () => {
  const checks = fixtures.map((fixture) => harness.gradeIdentityFixture(fixture));
  const failed = checks.filter((check) => !check.pass);
  assert.deepEqual(failed.map((check) => ({ id: check.id, title: check.title, reasons: check.reasons })), []);
  assert.equal(harness.harnessReport(checks).ok, true);
});

test("outlet chrome cleans to the model, and a pasted Walmart link is not cross-enriched", () => {
  assert.equal(
    identity.cleanScreenshotProductTitle("Dyson Official Outlet - Walmart Exclusive V8 Absolute"),
    "Dyson V8 Absolute"
  );
  assert.equal(identity.cleanScreenshotProductTitle("Available at a lower price"), "");
  assert.equal(identity.isStorePageChromeLine("Available at a lower price from other sellers"), true);
  const shot = identity.screenshotCollectionPlan({
    store: "Walmart.ca",
    productName: "Dyson Official Outlet - Walmart Exclusive V8 Absolute",
  });
  assert.equal(shot.collectionStore, "Amazon.ca");
  assert.equal(shot.crossStoreAmazon, true);
  assert.match(shot.productName, /V8/);
  assert.doesNotMatch(shot.productName, /Official Outlet/);
  const linked = identity.screenshotCollectionPlan({
    store: "Walmart.ca",
    listingUrl: "https://www.walmart.ca/en/ip/dyson-v8/60001",
    productName: "Dyson V8 Absolute",
  });
  assert.equal(linked.crossStoreAmazon, false);
  assert.equal(linked.collectionStore, null);
  assert.equal(identity.shouldKeepCrossStoreAmazonListing({
    store: "Walmart.ca",
    returnedHost: "www.amazon.ca",
  }), true);
  assert.equal(identity.shouldKeepCrossStoreAmazonListing({
    store: "Walmart.ca",
    listingUrl: "https://www.walmart.ca/en/ip/dyson-v8/60001",
    returnedHost: "www.amazon.ca",
  }), false);
});

test("Walmart and Best Buy aggregates score without an Amazon review scrape", () => {
  const facts = jiti("./lib/screenshotProductFacts.ts");
  const buying = jiti("./lib/buyingScore.ts");
  const ocr = (lines) => ({
    fileSha256: "0".repeat(64),
    ocrConfidence: 90,
    engine: "test",
    lines: lines.map((text) => ({ text, confidence: 90 })),
  });
  const parenPipe = facts.productFactsFromOcr(ocr([
    "Walmart.ca",
    "BISSELL PowerForce Turbo Pet Lightweight Upright Vacuum",
    "$119.99",
    "(4.3) | 448",
  ]));
  assert.equal(parenPipe.rating, "4.3");
  assert.equal(parenPipe.reviewCount, "448");
  assert.equal(parenPipe.ratingBelongsToProduct, true);
  assert.equal(parenPipe.price, "$119.99");
  assert.match(parenPipe.name, /PowerForce/);
  assert.doesNotMatch(parenPipe.name, /\(4\.3\)/);

  const parenCount = facts.productFactsFromOcr(ocr([
    "Best Buy",
    "Sony WH-1000XM5 Wireless Noise Canceling Headphones",
    "$398.00",
    "4.3 (448)",
  ]));
  assert.equal(parenCount.rating, "4.3");
  assert.equal(parenCount.reviewCount, "448");
  assert.equal(parenCount.ratingBelongsToProduct, true);
  assert.equal(parenCount.store, "Best Buy");

  const pipe = facts.productFactsFromOcr(ocr([
    "Walmart.ca",
    "Instant Pot Duo Plus 8 Quart Multi-Use Pressure Cooker",
    "$129.99",
    "4.8 | 2,553",
  ]));
  assert.equal(pipe.rating, "4.8");
  assert.equal(pipe.reviewCount, "2553");
  assert.match(pipe.name, /8 Quart/);
  assert.doesNotMatch(pipe.name, /2,553|2553/);

  const split = facts.productFactsFromOcr(ocr([
    "Walmart.ca",
    "BISSELL PowerForce Turbo Pet Lightweight Upright Vacuum",
    "(4.3)",
    "448",
  ]));
  assert.equal(split.rating, "4.3");
  assert.equal(split.reviewCount, "448");

  const labeled = facts.reviewCountFromOcrText("2,553 ratings");
  assert.equal(labeled, "2553");
  const reviewsWord = facts.reviewCountFromOcrText("448 reviews");
  assert.equal(reviewsWord, "448");

  const notInvented = facts.productFactsFromOcr(ocr([
    "Walmart.ca",
    "BISSELL PowerForce Turbo Pet Lightweight Upright Vacuum",
    "$119.99",
    "8 Quart",
  ]));
  assert.equal(notInvented.rating, "");
  assert.equal(notInvented.reviewCount, "");

  const blocked = buying.marketplaceAggregateForScore({
    exactListingAccepted: true,
    pageRating: 4.1,
    pageCount: null,
    screenshotRating: parenPipe.rating,
    screenshotCount: parenPipe.reviewCount,
  });
  assert.equal(blocked.source, "screenshot");
  assert.equal(blocked.rating, 4.3);
  assert.equal(blocked.count, 448);
  const missed = buying.marketplaceAggregateForScore({
    exactListingAccepted: false,
    screenshotRating: "4.8",
    screenshotCount: "2,553",
  });
  const score = buying.buyingScoreFromReviews({
    marketplace: { rating: missed.rating, count: missed.count, matchesExactModel: true },
    reviews: [],
  });
  assert.equal(missed.source, "screenshot");
  assert.equal(score.mode, "provisional_marketplace");
  assert.equal(typeof score.score, "number");
  const pageWins = buying.marketplaceAggregateForScore({
    exactListingAccepted: true,
    pageRating: 4.6,
    pageCount: 12000,
    screenshotRating: "4.8",
    screenshotCount: "2553",
  });
  assert.equal(pageWins.source, "page");
  assert.equal(pageWins.rating, 4.6);
  const unnamed = buying.marketplaceAggregateForScore({
    exactListingAccepted: true,
    pageRating: 4.1,
    pageCount: 900,
    screenshotRating: "4.8",
    screenshotCount: "2553",
    productName: "Amazon product",
  });
  assert.equal(unnamed.source, "screenshot");
  assert.equal(unnamed.rating, 4.8);
  assert.equal(unnamed.count, 2553);
});

test("live Walmart OCR star noise still scores BISSELL 4.3 from 448 as Wait", () => {
  const facts = jiti("./lib/screenshotProductFacts.ts");
  const shopper = jiti("./lib/shopperAnswer.ts");
  const ocr = (lines) => ({
    fileSha256: "0".repeat(64),
    ocrConfidence: 80,
    engine: "test",
    lines,
  });
  const noisy = facts.productFactsFromOcr(ocr([
    { text: "Walmart.ca", confidence: 78 },
    { text: "BISSELL® PowerForce® Turbo Pet Bagless Upright Vacuum", confidence: 90 },
    { text: "Now $98.88", confidence: 86 },
    { text: "$98.88", confidence: 84 },
    { text: "BISSELL Feder dede (43) | 448", confidence: 56 },
    { text: "BISSELL wR Rw 4.3) | 448", confidence: 54 },
  ]));
  assert.equal(noisy.rating, "4.3");
  assert.equal(noisy.reviewCount, "448");
  assert.match(noisy.name, /PowerForce/);
  assert.doesNotMatch(noisy.name, /Feder|\(43\)|4\.3\)/);
  const price = facts.productFactsFromOcr(ocr([
    { text: "Walmart.ca", confidence: 80 },
    { text: "BISSELL PowerForce Turbo Pet Bagless Upright Vacuum", confidence: 90 },
    { text: "$98.88 | 448", confidence: 88 },
  ]));
  assert.equal(price.rating, "");
  assert.equal(price.reviewCount, "");
  const bare = facts.productFactsFromOcr(ocr([
    { text: "Walmart.ca", confidence: 80 },
    { text: "BISSELL PowerForce Turbo Pet Bagless Upright Vacuum", confidence: 90 },
    { text: "(43)", confidence: 70 },
  ]));
  assert.equal(bare.rating, "");
  assert.equal(bare.reviewCount, "");
  const fixture = fixtures.find((item) => item.id === "walmart-bissell-powerforce-live-ocr-noise");
  const graded = harness.gradeIdentityFixture(fixture);
  assert.deepEqual(graded.reasons, []);
  assert.equal(graded.shopperVerdict, "Wait");
  const answer = shopper.deriveShopperAnswer({
    finalDecisionSource: "buyingScoreV2",
    verdict: "BUY",
    product: { title: "Travel kettle", name: "Travel kettle" },
    buyingScoreV2: { version: "buying-score-v2", mode: "buying_score", score: 80, verdict: "Buy", confidence: "High", audit: { n: 2 } },
    strengthProvenance: [{ claim: "Stays cool in a bag", supportCount: 3, sourceIds: ["r1"], sourceHashes: [] }],
    complaintProvenance: [{ claim: "The lid leaks", supportCount: 2, sourceIds: ["r2"], sourceHashes: [] }],
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecordCount: 2,
        acceptedRecords: [
          { id: "r1", body: "Got for my soon to be great niece's arrival and it stays cool in a bag.", sourceUrl: "https://www.amazon.com/dp/B0GENERIC1" },
          { id: "r2", body: "The lid leaks if you tip it over on the counter.", sourceUrl: "https://www.amazon.ca/dp/B0GENERIC1" },
        ],
      },
    },
  });
  assert.match(answer.loves[0].finding, /stays cool in a bag/i);
  assert.match(answer.complaints[0].finding, /the lid leaks/i);
  assert.doesNotMatch(`${answer.loves[0].finding} ${answer.complaints[0].finding} ${answer.why}`, /Buyers report|Shoppers note|Buyers consistently/i);
  assert.match(answer.loves[0].quote, /niece/);
  assert.doesNotMatch(answer.why, /niece|counter/i);
  assert.match(answer.why, /stays cool in a bag/i);
  assert.match(answer.why, /the lid leaks/i);
  assert.doesNotMatch(`${answer.loves[0].finding} ${answer.complaints[0].finding}`, /\bI\b|Vercel|Not scored|Not enough evidence/i);
  const hollow = shopper.deriveShopperAnswer({
    finalDecisionSource: "buyingScoreV2",
    verdict: "BUY",
    product: { title: "Travel kettle", name: "Travel kettle" },
    buyingScoreV2: { version: "buying-score-v2", mode: "buying_score", score: 80, verdict: "Buy", confidence: "High", audit: { n: 2 } },
    strengthProvenance: [{ claim: "easy to use or set up", supportCount: 2, sourceIds: ["r1"], sourceHashes: [] }],
    complaintProvenance: [{ claim: "The lid leaks", supportCount: 2, sourceIds: ["r2"], sourceHashes: [] }],
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecordCount: 2,
        acceptedRecords: [
          { id: "r1", body: "It was easy to use right away.", sourceUrl: "https://www.amazon.com/dp/B0GENERIC1" },
          { id: "r2", body: "The lid leaks if you tip it over on the counter.", sourceUrl: "https://www.amazon.ca/dp/B0GENERIC1" },
        ],
      },
    },
  });
  assert.equal(hollow.loves[0].finding, null);
  assert.match(hollow.complaints[0].finding, /the lid leaks/i);
  assert.doesNotMatch(hollow.why, /easy to use/i);
  assert.match(hollow.why, /the lid leaks/i);
});

test("star-line totals become a review count without stealing the stars or a model size", () => {
  const facts = jiti("./lib/screenshotProductFacts.ts");
  const ocr = (lines) => ({
    fileSha256: "0".repeat(64),
    ocrConfidence: 90,
    engine: "test",
    lines: lines.map((text) => ({ text, confidence: 90 })),
  });
  const parenthetical = facts.productFactsFromOcr(ocr([
    "Walmart.com",
    "Instant Pot Duo Plus 8qt Multi-Use Pressure Cooker",
    "$89.99",
    "4.6 out of 5 stars (12,431)",
  ]));
  assert.equal(parenthetical.rating, "4.6");
  assert.equal(parenthetical.reviewCount, "12431");
  assert.equal(parenthetical.store, "Walmart.com");
  const thousands = facts.reviewCountFromOcrText("4.5 out of 5 stars\n2.3K reviews");
  assert.equal(thousands, "2300");
  const phone = facts.productFactsFromOcr(ocr([
    "bestbuy.com",
    "Google Pixel 9a 128GB Unlocked Android Smartphone",
    "$499.99",
    "4.5 out of 5 stars",
  ]));
  assert.equal(phone.reviewCount, "");
  assert.equal(phone.rating, "4.5");
  assert.equal(phone.store, "Best Buy.com");
});

test("live chrome and other-product lines never become the product name", () => {
  const facts = jiti("./lib/screenshotProductFacts.ts");
  assert.equal(identity.isUnrelatedPageText("Shop in our free App today (*open"), true);
  assert.equal(identity.isUnrelatedPageText("EmbTao Sorry The Lifestyle You Ordered Is Currently Out Of Stock Patch"), true);
  assert.equal(identity.isUnrelatedPageText("SHOKZ Secure Fit. Big on comfort. el All"), true);
  assert.equal(identity.isUnrelatedPageText("Sony WH-1000XM5 Wireless Noise Canceling Headphones"), false);
  assert.equal(identity.cleanScreenshotProductTitle("Kindle Paperwhite &#34;thinnest&#34;"), 'Kindle Paperwhite "thinnest"');
  assert.equal(
    facts.authoritativeDisplayName({
      listingTitle: "Epson Lifestudio Grand Ultra Short Throw",
      screenshotName: "Logitech MX Master 3S Wireless Performance Mouse",
    }),
    "Logitech MX Master 3S Wireless Performance Mouse"
  );
  assert.equal(
    facts.authoritativeDisplayName({
      listingTitle: "Ninja CREAMi Ice Cream Maker",
      screenshotName: "Ninja CREAMi NC301C Ice Cream Maker",
    }),
    "Ninja CREAMi NC301C Ice Cream Maker"
  );
  assert.equal(
    facts.authoritativeDisplayName({
      listingTitle: "Echo Dot (5th Gen, 2022 release) | Smart speaker with Alexa",
      screenshotName: "Amazon Echo Dot (newest model) - Vibrant...",
    }),
    "Echo Dot (5th Gen, 2022 release) | Smart speaker with Alexa"
  );
});

test("shopper headline keeps the model a 4-word cut would drop", () => {
  const creami = identity.shopperFacingProductTitle("Ninja CREAMi, NC301C, Ice Cream, Gelato, Milkshake Maker");
  assert.match(creami, /NC301C/);
  const pot = identity.shopperFacingProductTitle("Instant Pot Duo Plus 8qt Multi-Use Pressure Cooker");
  assert.match(pot, /8qt/);
});

test("saved results fail closed on empty prominent scans, chrome titles, and untagged Amazon links", () => {
  const empty = harness.gradeSavedScanResult(
    { product: { title: "Instant Pot Duo Plus 8qt" }, verdict: "NOT_ENOUGH" },
    { id: "empty", prominent: true, expectTitleIncludes: ["8qt"] }
  );
  assert.equal(empty.pass, false);
  assert.match(empty.reasons.join(" "), /no Buy, Wait, or Skip/i);

  const chrome = harness.gradeSavedScanResult(
    { product: { title: "Dyson Official Outlet Walmart" } },
    { id: "chrome", expectTitleExcludes: ["Official Outlet"] }
  );
  assert.equal(chrome.pass, false);

  const untagged = harness.gradeSavedScanResult(
    { exactListingUrl: "https://www.amazon.ca/dp/B0TEST1234", product: { title: "Google Pixel 9a" } },
    { id: "untagged" }
  );
  assert.equal(untagged.pass, false);
  assert.match(untagged.reasons.join(" "), /associate tag/);

  const tagged = harness.gradeSavedScanResult(
    { exactListingUrl: "https://www.amazon.ca/dp/B0TEST1234?tag=reviewintel-20", product: { title: "Google Pixel 9a" } },
    { id: "tagged", expectTitleIncludes: ["Pixel", "9a"], expectTitleExcludes: ["Official Outlet"] }
  );
  assert.equal(tagged.pass, true, tagged.reasons.join(" "));
});
