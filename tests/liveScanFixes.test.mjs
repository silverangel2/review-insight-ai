// Live-scan regressions from 2026-10-14. Fixtures and fakes only. No network, no prod DB.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname, { alias: { "@": new URL("..", import.meta.url).pathname } });
const links = jiti("./lib/linkIdentity.ts");
const authority = jiti("./lib/listingAuthority.ts");
const search = jiti("./lib/exactProductSearch.ts");
const verifier = jiti("./lib/productSearchVerifier.ts");
const layered = jiti("./lib/layeredReviewCollection.ts");
const shopper = jiti("./lib/shopperAnswer.ts");
const buying = jiti("./lib/buyingScore.ts");
const { buildNativeReviewSearchQueries } = jiti("./lib/nativeReviewRetrieval.ts");

const reviews = readFileSync(new URL("./fixtures/layered-reviews/reviews.html", import.meta.url), "utf8");
const captcha = readFileSync(new URL("./fixtures/layered-reviews/captcha.html", import.meta.url), "utf8");

const walmart = "https://www.walmart.com/ip/Stanley-FatMax-Tape-FMHT74038/147784490";
const bestBuy = "https://www.bestbuy.com/site/apple-airpods-pro-2-wireless-earbuds/6447382.p";
const target = "https://www.target.com/p/stanley-fatmax-tape-fmht33338/-/A-1000747659";
const homeDepot = "https://www.homedepot.com/p/Stanley-FatMax-16-ft-Tape-Measure-FMHT33338L/204624581";
const amazonSlug = "https://www.amazon.com/Stanley-FatMax-25-Foot-Tape/dp/B00002X2GQ";
const battery = "https://www.amazon.com/dp/B00BATT3RY";

test("placeholder names are not search queries or match terms", () => {
  for (const name of ["unknown", "Unknown product", "product", "item", "Amazon product", ""]) {
    assert.equal(links.isPlaceholderProductName(name), true, name);
    assert.equal(links.placeholderFreeText(name), "");
    assert.equal(authority.isDriftSearchQuery(`site:amazon.ca "${name}"`), true, name);
  }
  assert.equal(links.isPlaceholderProductName("Stanley FatMax FMHT33338L"), false);
  assert.equal(authority.isDriftSearchQuery('site:homedepot.com "FMHT33338L"'), false);
  const queries = buildNativeReviewSearchQueries({ productTitle: "Unknown product", brand: "", listingUrl: homeDepot });
  assert.equal(queries.some((query) => /unknown product/i.test(query)), false);
});

test("a placeholder search is not sent when the page fetch failed", async () => {
  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(String(url)); return new Response("no", { status: 404 }); };
  try {
    const result = await search.findExactProductCandidates({ productName: "unknown product", store: "Amazon.ca" });
    assert.equal(result.candidates.length, 0);
    assert.match(result.notes.join(" "), /placeholder/i);
    assert.equal(urls.some((url) => /unknown/i.test(url)), false);
  } finally { globalThis.fetch = original; }
});

test("store links keep their own id and slug when the page cannot be read", async () => {
  const cases = [
    [walmart, "walmart", "147784490", "FMHT74038"],
    [bestBuy, "bestbuy", "6447382", null],
    [target, "target", "1000747659", "FMHT33338"],
    [homeDepot, "homedepot", "204624581", "FMHT33338L"],
    [amazonSlug, "amazon", "B00002X2GQ", null],
  ];
  for (const [url, store, id, model] of cases) {
    const identity = links.identityFromProductLink(url);
    assert.equal(identity.storeId, store, url);
    assert.equal(identity.productId, id, url);
    assert.equal(links.isPlaceholderProductName(identity.displayName), false, url);
    if (model) assert.ok(identity.modelTokens.includes(model), `${url} ${identity.modelTokens}`);
  }
  assert.match(links.identityFromProductLink(amazonSlug).displayName, /Stanley/i);
  assert.match(links.identityFromProductLink(homeDepot).displayName, /FMHT33338L/);

  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(String(url)); return new Response("blocked", { status: 503 }); };
  try {
    for (const url of [walmart, bestBuy, target, homeDepot]) {
      const result = await search.findExactProductCandidates({ productName: "unknown product", listingUrl: url, store: "Amazon.ca" });
      assert.equal(result.candidates[0].url, url);
      assert.equal(result.queries.some((query) => /unknown product/i.test(query)), false);
    }
    assert.equal(urls.some((url) => /unknown\+product|unknown%20product|amazon\.ca\/s/i.test(url)), false);
  } finally { globalThis.fetch = original; }
});

test("a block does not skip later product-page attempts, and review and sibling tiers still run", async () => {
  for (const status of [403, 503]) {
    const calls = [];
    const result = await layered.runLayeredStoreFetch({
      url: "https://www.amazon.com/dp/B0TESTLIST",
      chromiumFetch: async () => { throw new Error("chromium must not run on a block"); },
      fetchPage: async (attempt) => {
        calls.push(attempt);
        if (attempt.tier === "reviews-endpoint" || attempt.tier === "sibling-domain") {
          return { status: 200, ok: true, text: reviews, finalUrl: attempt.url };
        }
        return { status, ok: false, text: "unavailable", finalUrl: attempt.url };
      },
    });
    assert.equal(result.tier, "reviews-endpoint", String(status));
    assert.equal(result.hasReviews, true);
    assert.ok(calls.some((attempt) => attempt.tier === "reviews-endpoint"));
    assert.ok(result.tierAttempts.some((entry) => entry.stop === `blocked-http-${status}`));
    assert.equal(result.tierAttempts.some((entry) => entry.stop === "skipped-host-blocked"), false);
    assert.ok(calls.some((attempt) => attempt.tier === "alternate-profile"));
    assert.ok(calls.some((attempt) => attempt.tier === "mobile-url"));
  }

  const captchaCalls = [];
  const stopped = await layered.runLayeredStoreFetch({
    url: walmart,
    fetchPage: async (attempt) => {
      captchaCalls.push(attempt.tier);
      return { status: 200, ok: true, text: captcha, finalUrl: "https://www.walmart.com/account/signin" };
    },
  });
  assert.equal(stopped.hasReviews, false);
  assert.ok(captchaCalls.includes("reviews-endpoint"));
  assert.ok(captchaCalls.includes("sibling-domain"));
  assert.equal(stopped.tierAttempts.filter((entry) => entry.stop === "blocked-challenge").length > 0, true);
});

test("cross-store matching requires the link's model or id and never a different listing", () => {
  const job = { authoritativeListingUrl: homeDepot, productName: "unknown product", store: "Home Depot" };
  const wrong = verifier.verifyProductCandidate(job, {
    url: battery,
    title: "0 Cycle 480mAh Unknown Product Battery APP00276",
  });
  assert.equal(wrong.canCollectReviews, false);
  assert.match(wrong.verifierReasons.join(" "), /model or id/i);

  const same = verifier.verifyProductCandidate(job, { url: homeDepot, title: null });
  assert.equal(same.canCollectReviews, true);

  const named = verifier.verifyProductCandidate(job, {
    url: "https://www.walmart.com/ip/stanley-fatmax-tape-fmht33338l/555555555",
    title: "Stanley FatMax 16 ft Tape Measure FMHT33338L",
  });
  assert.equal(named.canCollectReviews, true);

  const accessory = verifier.verifyProductCandidate(job, {
    url: "https://www.amazon.com/dp/B0CASE1234",
    title: "Replacement case for FMHT33338L",
  });
  assert.equal(accessory.canCollectReviews, false);

  const earbuds = { authoritativeListingUrl: bestBuy, productName: "Apple AirPods Pro 2", store: "Best Buy" };
  assert.equal(verifier.verifyProductCandidate(earbuds, {
    url: "https://www.amazon.com/dp/B0D1XD1ZV3",
    title: "Apple AirPods Pro 2 Wireless Earbuds",
  }).canCollectReviews, false);
  assert.equal(verifier.verifyProductCandidate(earbuds, { url: bestBuy, title: "Apple AirPods Pro 2" }).canCollectReviews, true);

  const blank = {
    identityUnconfirmed: true,
    product: { name: "0 Cycle 480mAh Unknown Product Battery APP00276", url: battery },
    reviewEvidence: { commentsAnalyzed: 0, listingEvidence: { exactListingUrl: battery, exactListingTitle: "0 Cycle 480mAh Unknown Product Battery APP00276" } },
  };
  assert.equal(shopper.isUnreadableAmazonPage(blank), true);
  const answer = shopper.deriveShopperAnswer(blank);
  assert.equal(answer.unreadable, true);
  assert.equal(answer.score, null);
  assert.doesNotMatch(`${answer.why} ${answer.label}`, /Unknown Product Battery|Not scored|Review evidence not enough/i);
});

test("bare and slugged Amazon links keep the ASIN and fetch the listing page", async () => {
  const asin = "B00FLYWNYQ";
  const bare = [
    `https://www.amazon.com/dp/${asin}`,
    `https://www.amazon.ca/dp/${asin}`,
    `https://www.amazon.co.uk/dp/${asin}`,
    `https://www.amazon.com/gp/product/${asin}`,
    `https://www.amazon.ca/gp/product/${asin}`,
    `https://www.amazon.co.uk/gp/product/${asin}`,
  ];
  const slugged = [
    `https://www.amazon.com/Flybar-Foam-Pogo-Stick/dp/${asin}`,
    `https://www.amazon.ca/Flybar-Foam-Pogo-Stick/dp/${asin}`,
    `https://www.amazon.co.uk/Flybar-Foam-Pogo-Stick/gp/product/${asin}`,
  ];
  for (const url of bare) {
    const identity = links.identityFromProductLink(url);
    assert.equal(identity.productId, asin, url);
    assert.equal(links.collectionProductName(url), asin, url);
    assert.equal(links.isPlaceholderProductName(links.collectionProductName(url)), false, url);
  }
  for (const url of slugged) {
    const identity = links.identityFromProductLink(url);
    assert.equal(identity.productId, asin, url);
    assert.match(links.collectionProductName(url), /Flybar/, url);
    assert.doesNotMatch(links.collectionProductName(url), /Amazon product|unknown product/i, url);
  }

  const html = `<html><span id="productTitle">Flybar Foam Pogo Stick</span></html>`;
  const original = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    return new Response(html, { status: 200 });
  };
  try {
    for (const url of [bare[0], bare[1], bare[2], slugged[0], slugged[2]]) {
      fetched.length = 0;
      const result = await search.findExactProductCandidates({
        productName: links.collectionProductName(url),
        listingUrl: url,
        store: "Amazon",
      });
      assert.ok(fetched.some((item) => item.includes(`/dp/${asin}`)), `${url} ${fetched.join(" ")}`);
      assert.match(String(result.candidates[0]?.title || ""), /Flybar Foam Pogo Stick/, url);
    }
  } finally {
    globalThis.fetch = original;
  }
});

test("a blocked identified listing does not ask for the link again", () => {
  const empty = buying.buyingScoreFromReviews({ marketplace: { rating: null, count: null }, reviews: [] });
  assert.equal(buying.wordingWhenListingAlreadySupplied(empty, false).label, "Add the exact product link");
  const blockedCard = buying.wordingWhenListingAlreadySupplied(empty, true);
  assert.notEqual(blockedCard.label, "Add the exact product link");
  assert.doesNotMatch(`${blockedCard.notes.join(" ")} ${blockedCard.primaryAction}`, /exact product link|NOT_ENOUGH|OpenAI|vercel|evidenceState/i);
  const line = buying.shopperBottomLineForBuyingScore(blockedCard, "REVIEW FIRST");
  assert.doesNotMatch(line, /exact product link|REVIEW FIRST|NOT_ENOUGH|OpenAI|vercel/i);

  const rated = buying.wordingWhenListingAlreadySupplied(
    buying.buyingScoreFromReviews({ marketplace: { rating: 4.2, count: 80 }, reviews: [] }),
    true,
  );
  assert.equal(rated.mode, "provisional_marketplace");
  assert.equal(rated.audit.Rbar, 4.2);
  assert.equal(rated.audit.N, 80);
  assert.doesNotMatch(rated.notes.join(" "), /exact product link/i);

  const result = {
    pageUnreadable: true,
    verdict: "REVIEW FIRST",
    bottomLine: line,
    product: { name: "Flybar Foam Pogo Stick", title: "Flybar Foam Pogo Stick", url: "https://www.amazon.com/dp/B00FLYWNYQ" },
    url: "https://www.amazon.com/dp/B00FLYWNYQ",
    reviewEvidence: { commentsAnalyzed: 0, evidenceState: "NOT_ENOUGH", sourceNotes: ["OpenAI review analysis failed: 500"] },
    buyingScoreV2: blockedCard,
  };
  assert.equal(shopper.isUnreadableAmazonPage(result), true);
  const answer = shopper.deriveShopperAnswer(result);
  assert.equal(answer.unreadable, true);
  assert.equal(answer.score, null);
  assert.doesNotMatch(`${answer.why} ${answer.label} ${answer.trustLine}`, /exact product link|NOT_ENOUGH|OpenAI|vercel|evidenceState/i);
  assert.equal(shopper.shopperSafeText("OpenAI review analysis failed: 500"), "Written reviews were not available for a verdict.");
  assert.equal(shopper.shopperSafeText("evidenceState NOT_ENOUGH"), "Written reviews were not available for a verdict.");
});

test("shopper payloads no longer use the banned evidence labels", () => {
  for (const file of ["app/api/analyze/route.ts", "lib/reviewEvidence.ts", "lib/productStability.ts"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.equal(source.includes("Not scored"), false, file);
    assert.equal(source.includes("Review evidence not enough"), false, file);
  }
});
