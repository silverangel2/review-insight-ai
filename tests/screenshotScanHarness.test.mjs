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
