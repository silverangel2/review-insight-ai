// Shopper-page capture: DOM fixtures, validation, Buying Score v2, quota. No OpenAI, no prod DB.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname, { alias: { "@": new URL("..", import.meta.url).pathname } });
const extractors = require("../extension/extractors.js");
const pageCapture = jiti("./lib/pageCapture.ts");
const blocked = jiti("./lib/linkScanBlocked.ts");
const shopper = jiti("./lib/shopperAnswer.ts");
const stores = jiti("./lib/storeCollectors.ts");
const sessions = jiti("./lib/accountSession.ts");
const { POST } = jiti("./app/api/page-capture/route.ts");

const fixture = (name) => readFileSync(new URL(`./fixtures/page-capture/${name}.html`, import.meta.url), "utf8");
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const FORBIDDEN = /written reviews read|not scored|not enough evidence|no reviews analyzed|vercel/i;
const BRANDS = /\b(Amazon|Walmart|Best Buy|BestBuy|Target|Home Depot|HomeDepot|Vercel)\b/;

const PAGES = [
  ["amazon", "https://www.amazon.com/dp/B0TRAILBTL", "B0TRAILBTL", "Trail Bottle 32 ounce", 4.6, 1284],
  ["walmart", "https://www.walmart.com/ip/trail-bottle/123456789", "123456789", "Trail Bottle 32 ounce", 4.4, 812],
  ["bestbuy", "https://www.bestbuy.com/site/trail-bottle/6505432.p", "6505432", "Trail Bottle 32 ounce", 4.7, 320],
  ["target", "https://www.target.com/p/trail-bottle/-/A-84616174", "84616174", "Trail Bottle 32 ounce", 4.2, 150],
  ["homedepot", "https://www.homedepot.com/p/trail-bottle/312345678", "312345678", "Trail Bottle 32 ounce", 3.9, 64],
];

test("each store fixture yields the visible title, id, rating, count, and review cards", () => {
  for (const [store, url, id, title, rating, count] of PAGES) {
    const result = extractors.fromHtml(fixture(store), url);
    assert.equal(result.ok, true, store);
    assert.equal(result.capture.productId, id, store);
    assert.equal(result.capture.title, title, store);
    assert.equal(result.capture.rating, rating, store);
    assert.equal(result.capture.ratingCount, count, store);
    assert.ok(result.capture.reviews.length >= 1, store);
    for (const review of result.capture.reviews) {
      assert.ok(review.text.length >= 8, store);
      assert.equal(/alert\(1\)|hidden card/i.test(review.text), false, store);
      assert.equal(/<[^>]+>/.test(review.text), false, store);
    }
  }
  const amazon = extractors.fromHtml(fixture("amazon"), PAGES[0][1]).capture;
  assert.equal(amazon.reviews.length, 2);
  assert.equal(amazon.reviews[0].stars, 5);
  assert.equal(amazon.reviews[0].verified, true);
  assert.match(amazon.reviews[0].date, /January 5, 2026/);
  assert.equal(amazon.reviews[1].stars, 2);
  assert.equal(amazon.reviews[1].verified, false);
  const walmart = extractors.fromHtml(fixture("walmart"), PAGES[1][1]).capture;
  assert.equal(walmart.reviews[0].verified, true);
  assert.equal(walmart.reviews[0].date, "2026-02-11");
  const bestbuy = extractors.fromHtml(fixture("bestbuy"), PAGES[2][1]).capture;
  assert.equal(bestbuy.reviews[0].verified, true);
  assert.equal(bestbuy.reviews[0].stars, 4);
});

test("product ids match the server collectors and ignore other sites", () => {
  const samples = [
    "https://www.amazon.ca/gp/product/B0TRAILBTL",
    "https://www.walmart.ca/en/ip/trail-bottle/600020176",
    "https://www.bestbuy.ca/en-ca/product/trail-bottle/6505432",
    "https://www.target.com/p/-/A-84616174",
    "https://www.homedepot.ca/p/trail-bottle/312345678",
  ];
  for (const url of samples) {
    const fromPage = extractors.productIdFromUrl(url);
    const server = stores.amazonStableId(url) || stores.walmartItemId(url) || stores.bestBuyIdentity(url)?.sku || stores.targetTcin(url) || stores.homeDepotIdentity(url)?.id;
    assert.equal(fromPage, server, url);
  }
  assert.equal(extractors.productIdFromUrl("https://example.com/dp/B0TRAILBTL"), "");
  assert.equal(extractors.fromHtml("<html></html>", "https://example.com/dp/B0TRAILBTL").ok, false);
});

test("extension reads only after a click and asks for the minimum permissions", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  assert.deepEqual(manifest.permissions, ["activeTab"]);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.host_permissions.some((host) => /amazon|walmart|bestbuy|target|homedepot/.test(host)), true);
  assert.equal(manifest.host_permissions.some((host) => /getreviewintel|vercel|openai/.test(host)), false);
  const content = read("extension/content.js");
  const source = read("extension/extractors.js");
  assert.equal(/fetch\s*\(|XMLHttpRequest|pageNumber\s*=/.test(content + source), false);
  assert.match(content, /Analyze with ReviewIntel/);
  assert.match(read("extension/popup.html"), /Analyze with ReviewIntel/);
  assert.equal(content.includes("fromDocument"), true);
  assert.match(read("extension/popup.html") + read("components/ExtensionPrompt.tsx") + read("app/tools/analyze-page/page.tsx"), /Analyze/);
  const promptLines = [
    "Get real reviews read: add the free extension",
    "Open the product page yourself, then let ReviewIntel read the reviews already on your screen.",
    "Add it free",
  ];
  for (const line of promptLines) {
    assert.equal(shopper.shopperSafeText(line), line);
    assert.equal(/openai|evidenceState|\bNOT_ENOUGH\b|\bvercel\b|review analysis failed|not enough evidence|not scored|no reviews analyzed/i.test(line), false);
  }
  assert.match(read("components/ExtensionPrompt.tsx"), /shopperSafeText/);
  assert.equal(BRANDS.test(read("components/ExtensionPrompt.tsx") + read("app/tools/analyze-page/page.tsx") + read("extension/popup.html") + manifest.description), false);
});

test("server drops tags, rejects a mismatched product id, and dedupes reviews", () => {
  const url = "https://www.amazon.com/dp/B0TRAILBTL";
  const dirty = pageCapture.validatePageCapture({
    url,
    productId: "B0TRAILBTL",
    title: "Trail <b>Bottle</b>",
    rating: 4.6,
    ratingCount: "1,284",
    reviews: [
      { text: "<b>The lid seals tightly</b> and the bottle survived a month in my bag. <script>alert(1)</script>", stars: 5, date: "January 5, 2026", verified: true },
      { text: "The lid seals tightly and the bottle survived a month in my bag.", stars: 5, date: "January 5, 2026", verified: false },
      { text: "<img src=x onerror=alert(1)>The handle cracked after a week and the seal started leaking.", stars: "2", verified: false },
    ],
  });
  assert.equal(dirty.ok, true);
  assert.equal(dirty.capture.title, "Trail Bottle");
  assert.equal(dirty.capture.reviews.length, 2);
  assert.equal(dirty.capture.duplicatesRemoved, 1);
  assert.equal(dirty.capture.reviews.some((review) => /<|>|alert\(1\)/.test(review.text)), false);
  assert.equal(dirty.capture.reviews[0].verified, true);

  const mismatch = pageCapture.validatePageCapture({ url, productId: "B00OTHERZZ", title: "Other", rating: 4, ratingCount: 10, reviews: [] });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, "PRODUCT_ID_MISMATCH");

  const tooMany = pageCapture.validatePageCapture({
    url,
    productId: "B0TRAILBTL",
    title: "Trail Bottle",
    rating: 4,
    ratingCount: 10,
    reviews: Array.from({ length: 41 }, (_, index) => ({ text: `Visible review number ${index} says the lid still seals after daily use.`, stars: 4 })),
  });
  assert.equal(tooMany.ok, false);
  assert.equal(tooMany.code, "TOO_MANY_REVIEWS");
});

test("submitted reviews are the Buying Score source and shoppers are not shown a review count", () => {
  const validated = pageCapture.validatePageCapture({
    url: "https://www.walmart.com/ip/trail-bottle/123456789",
    productId: "123456789",
    title: "Trail Bottle 32 ounce",
    rating: 4.4,
    ratingCount: 812,
    reviews: [
      { text: "The lid seals tightly and the bottle survived a month in my bag.", stars: 5, verified: true },
      { text: "The handle cracked after a week and the seal started leaking.", stars: 2 },
      { text: "Light to carry and easy to clean in the dishwasher.", stars: 4 },
    ],
  });
  assert.equal(validated.ok, true);
  const scored = pageCapture.scorePageCapture(validated.capture, "scan_page_capture_test");
  assert.equal(scored.pageCapture, true);
  assert.equal(scored.openAiCalls, 0);
  assert.equal(scored.buyingScoreV2.audit.openAiCalls, 0);
  assert.equal(scored.buyingScoreV2.version, "buying-score-v2");
  assert.equal(scored.finalDecisionSource, "buyingScoreV2");
  assert.equal(scored.buyingScoreV2.audit.n, 3);
  assert.equal(scored.meta.review_count_estimate, 0);
  const shown = JSON.stringify({
    bottomLine: scored.bottomLine,
    evidenceLine: scored.buyingScoreV2.evidenceLine,
    confidenceReason: scored.buyingScoreV2.confidenceReason,
    notes: scored.buyingScoreV2.notes,
    label: scored.buyingScoreV2.label,
  });
  assert.equal(FORBIDDEN.test(shown), false, shown);
  assert.match(scored.buyingScoreV2.evidenceLine, /812/);
});

test("the extension prompt is only for a blocked link-only scan", () => {
  assert.equal(blocked.linkScanBlockedForLinkOnly({
    linkOnly: true,
    listingUrl: "https://www.amazon.com/dp/B0TRAILBTL",
    writtenCount: 0,
    diagnostics: { nativeScraperBlocked: true, finalStopReason: "access_restricted" },
    mode: "no_score",
  }), true);
  assert.equal(blocked.linkScanBlockedForLinkOnly({
    linkOnly: true,
    listingUrl: "https://www.bestbuy.com/site/trail-bottle/6505432.p",
    writtenCount: 3,
    diagnostics: { nativeScraperBlocked: true },
    mode: "buying_score",
  }), false);
  assert.equal(blocked.linkScanBlockedForLinkOnly({
    linkOnly: false,
    listingUrl: "https://www.amazon.com/dp/B0TRAILBTL",
    writtenCount: 0,
    mode: "no_score",
  }), false);
  assert.equal(blocked.linkOnlyScanWasBlocked({ pageCapture: true, linkScanBlocked: true }), false);
  assert.equal(blocked.linkOnlyScanWasBlocked({ linkOnlyScan: false, exactListingUrl: "https://www.amazon.com/dp/B0TRAILBTL" }), false);
  assert.equal(blocked.linkOnlyScanWasBlocked({ linkScanBlocked: true, buyingScoreV2: { audit: { n: 0 }, mode: "no_score" } }), true);
});

function sessionCookie(plan) {
  const token = sessions.createAccountSession({ email: `${plan}@example.com`, role: "buyer", plan });
  return `reviewintel_account_session=${encodeURIComponent(token)}`;
}

function captureBody() {
  return {
    url: "https://www.target.com/p/trail-bottle/-/A-84616174",
    productId: "84616174",
    title: "Trail Bottle 32 ounce",
    rating: 4.2,
    ratingCount: 150,
    reviews: [
      { text: "It kept water cold on a short walk, then the paint chipped near the base.", stars: 3, date: "December 3, 2025", verified: true },
    ],
  };
}

async function postCapture(plan) {
  return POST(new Request("http://127.0.0.1/api/page-capture", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: sessionCookie(plan) },
    body: JSON.stringify(captureBody()),
  }));
}

test("authenticated page capture uses the free scan allowance and opens a scored result", async () => {
  const route = read("app/api/page-capture/route.ts");
  assert.equal(/openai/i.test(route), false);
  const first = await postCapture("free_buyer");
  assert.equal(first.status, 200);
  const body = await first.json();
  assert.match(body.scanId, /^scan_/);
  assert.equal(body.buyingScoreV2.version, "buying-score-v2");
  assert.equal(body.buyingScoreV2.audit.openAiCalls, 0);
  assert.equal(FORBIDDEN.test(JSON.stringify({
    bottomLine: body.bottomLine,
    evidenceLine: body.buyingScoreV2.evidenceLine,
    notes: body.buyingScoreV2.notes,
  })), false);

  assert.equal((await postCapture("free_buyer")).status, 200);
  assert.equal((await postCapture("free_buyer")).status, 200);
  const limited = await postCapture("free_buyer");
  assert.equal(limited.status, 429);
  const limitedBody = await limited.json();
  assert.equal(limitedBody.code, "DAILY_SCAN_LIMIT_REACHED");

  const premium = await postCapture("buyer_pro");
  assert.equal(premium.status, 200);
  assert.equal((await postCapture("buyer_pro")).status, 200);
  assert.equal((await postCapture("buyer_pro")).status, 200);
  assert.equal((await postCapture("buyer_pro")).status, 200);

  const signedOut = await POST(new Request("http://127.0.0.1/api/page-capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(captureBody()),
  }));
  assert.equal(signedOut.status, 401);
});
