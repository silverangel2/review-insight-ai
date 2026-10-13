import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const NAV = "Echo Dot Echo Dot Max Echo Spot Echo Studio. Echo Show 5...";
const FETCHED = "Echo Dot (5th Gen, 2022 release) | Smart speaker with Alexa";
const ASIN = "B09B8V1LZ3";
const LISTING = `https://www.amazon.com/dp/${ASIN}`;

const facts = jiti("./lib/screenshotProductFacts.ts");
const ownership = jiti("./lib/scanOwnership.ts");
const access = jiti("./lib/scanAccess.ts");
const progress = jiti("./lib/scanProgress.ts");
const verifier = jiti("./lib/productSearchVerifier.ts");

test("Amazon nav menu text is not the product name, and ratings still come through", () => {
  assert.equal(facts.isAmazonNavOrHeaderText(NAV), true);
  const onlyNav = facts.productFactsFromOcr({
    fileSha256: "nav",
    ocrConfidence: 90,
    engine: "t",
    lines: [
      { text: NAV, confidence: 96 },
      { text: "4.7 out of 5 stars", confidence: 92 },
      { text: "412,203 ratings", confidence: 91 },
    ],
  });
  assert.equal(onlyNav.name, "");
  assert.equal(onlyNav.normalizedSearchQuery, "");
  assert.equal(onlyNav.rating, "4.7");
  assert.equal(onlyNav.reviewCount, "412203");
  assert.doesNotMatch(`${onlyNav.name} ${onlyNav.normalizedSearchQuery}`, /Echo Spot|Echo Studio/);

  const withTitle = facts.productFactsFromOcr({
    fileSha256: "page",
    ocrConfidence: 90,
    engine: "t",
    lines: [
      { text: NAV, confidence: 96 },
      { text: FETCHED, confidence: 94 },
      { text: "4.6 out of 5 stars 89,000 ratings", confidence: 90 },
    ],
  });
  assert.equal(withTitle.name, FETCHED);
  assert.equal(withTitle.rating, "4.6");
});

test("fetched listing title and ASIN outrank a screenshot nav name", () => {
  assert.equal(facts.authoritativeDisplayName({ listingTitle: FETCHED, screenshotName: NAV, asin: ASIN }), FETCHED);
  assert.equal(facts.authoritativeDisplayName({ listingTitle: "", screenshotName: NAV, asin: ASIN }), `Amazon ${ASIN}`);
  assert.equal(facts.authoritativeDisplayName({ listingTitle: LISTING, screenshotName: NAV, asin: ASIN }), `Amazon ${ASIN}`);
  assert.equal(facts.authoritativeDisplayName({ screenshotName: FETCHED }), FETCHED);
  assert.equal(facts.authoritativeDisplayName({ screenshotName: NAV }), "");
  const route = readFileSync(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");
  assert.match(route, /const productForReviewEvidence = suppliedAsin\s*\?\s*""/);
  assert.match(route, /authoritativeDisplayName\(/);
  assert.doesNotMatch(facts.authoritativeDisplayName.toString(), /Not scored|Not enough evidence/);
});

test("a supplied ASIN is accepted even when the screenshot name is the nav menu", () => {
  const navJob = {
    scanId: "scan-echo",
    productName: NAV,
    brand: "Echo",
    store: "Amazon.com",
    authoritativeListingUrl: LISTING,
  };
  const listing = {
    url: LISTING,
    title: FETCHED,
    source: "supplied-listing-identity",
  };
  const accepted = verifier.verifyProductCandidate(navJob, listing);
  assert.equal(accepted.canCollectReviews, true);
  assert.equal(accepted.canonicalIdentifier, ASIN);
  assert.equal(accepted.verifiedListingUrl, LISTING);
  assert.equal(facts.authoritativeDisplayName({ listingTitle: listing.title, screenshotName: NAV, asin: accepted.canonicalIdentifier }), FETCHED);

  const other = verifier.verifyProductCandidate(navJob, {
    url: "https://www.amazon.com/dp/B0TEST1234",
    title: "Kitchen sponge pack of 12",
    source: "search",
  });
  assert.equal(other.canCollectReviews, false);

  const withoutLink = verifier.verifyProductCandidate({ ...navJob, authoritativeListingUrl: null }, listing);
  assert.equal(withoutLink.canCollectReviews, false);
});

test("signed-out scan owner can view their scan and cannot view someone else's", () => {
  const scanId = "scan_echo_dot_owner";
  assert.equal(ownership.signedOutOwnsScan(scanId, { cookieGrant: true }), true);
  assert.equal(ownership.signedOutOwnsScan(scanId, { sessionScanId: scanId }), true);
  assert.equal(ownership.signedOutOwnsScan(scanId, { scanToken: "token-from-this-scan" }), true);
  assert.equal(ownership.signedOutOwnsScan(scanId, { ownedScanIds: [scanId] }), true);
  assert.equal(ownership.signedOutOwnsScan(scanId, { sessionScanId: "scan_other", ownedScanIds: ["scan_other"] }), false);
  assert.equal(ownership.signedOutOwnsScan("", { cookieGrant: true }), false);

  assert.equal(ownership.scanVisibleToViewer({
    scanId,
    signedOutProof: { cookieGrant: true },
  }), true);
  assert.equal(ownership.scanVisibleToViewer({
    scanId,
    envelopeEmail: "owner@example.com",
    signedOutProof: { cookieGrant: true },
  }), false);
  assert.equal(ownership.scanVisibleToViewer({
    scanId,
    viewerEmail: "owner@example.com",
    envelopeEmail: "owner@example.com",
  }), true);
  assert.equal(ownership.scanVisibleToViewer({
    scanId,
    viewerEmail: "other@example.com",
    envelopeEmail: "owner@example.com",
  }), false);
  assert.match(readFileSync(new URL("../components/ResultsClient.tsx", import.meta.url), "utf8"), /signedOutOwnsScan\(requestedScanId/);
  assert.match(readFileSync(new URL("../components/ResultsClient.tsx", import.meta.url), "utf8"), /readLatestResult\(account, \{ scanId: requestedScanId \}\)/);
});

test("scan access cookie grants only the signed scan id", () => {
  process.env.REVIEWINTEL_SCAN_ACCESS_SECRET = "test-scan-access-secret";
  const scanId = "scan_echo_cookie";
  const cookie = access.withScanGrant("", scanId);
  assert.equal(access.cookieGrantsScan(cookie, scanId), true);
  assert.equal(access.cookieGrantsScan(cookie, "scan_someone_else"), false);
  const [id, token] = cookie.split(".");
  assert.equal(access.cookieGrantsScan(`${id}.${token.slice(0, -1)}x`, scanId), false);
  const both = access.withScanGrant(cookie, "scan_second_ok");
  assert.equal(access.cookieGrantsScan(both, scanId), true);
  assert.equal(access.cookieGrantsScan(both, "scan_second_ok"), true);
});

test("scan-progress returns pending for a live id instead of 404, and returns real progress", async () => {
  const missing = progress.scanProgressHttp("scan_not_started_yet", null);
  assert.equal(missing.status, 200);
  assert.equal(missing.body.pending, true);
  assert.equal(missing.body.progress, null);
  assert.equal(progress.scanProgressHttp("bad id", null).status, 404);
  assert.equal(progress.scanProgressHttp("", null).status, 404);

  await progress.runWithScanProgress("server-scan-echo", async () => {
    progress.aliasScanProgress("scan_client_echo");
    progress.noteScanProgressEvent("identity", { productName: FETCHED });
  });
  const live = await progress.readScanProgress("scan_client_echo");
  assert.equal(live.productName, FETCHED);
  const http = progress.scanProgressHttp("scan_client_echo", live);
  assert.equal(http.status, 200);
  assert.equal(http.body.progress.productName, FETCHED);
  const route = readFileSync(new URL("../app/api/scan-progress/route.ts", import.meta.url), "utf8");
  assert.match(route, /readScanProgress/);
  assert.match(route, /scanProgressHttp/);
  assert.doesNotMatch(route, /Not scored|Not enough evidence/);
});
