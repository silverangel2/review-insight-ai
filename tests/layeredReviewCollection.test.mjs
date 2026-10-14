// Layered public-page collection. Fixtures only. No network, no Chromium binary, no prod DB.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { brotliCompressSync, gzipSync } from "node:zlib";
import test from "node:test";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname, { alias: { "@": new URL("..", import.meta.url).pathname } });
const layered = jiti("./lib/layeredReviewCollection.ts");
const stores = jiti("./lib/storeCollectors.ts");
const profiles = jiti("./lib/browserProfiles.ts");
const chromium = jiti("./lib/layeredChromium.ts");
const polite = jiti("./lib/politeFetch.ts");
const deadline = jiti("./lib/scanDeadline.ts");
const { runNativeReviewRetrieval } = jiti("./lib/nativeReviewRetrieval.ts");
const { extractWrittenReviewsFromHtml } = jiti("./lib/reviewCollector.ts");

const fixture = (name) => readFileSync(new URL(`./fixtures/layered-reviews/${name}.html`, import.meta.url), "utf8");
const stripped = fixture("stripped");
const full = fixture("full");
const mobile = fixture("mobile");
const reviews = fixture("reviews");
const captcha = fixture("captcha");
const amazon = "https://www.amazon.com/dp/B0TESTLIST";
const collector = stores.collectorForUrl(amazon);

function page(body, status = 200, extra = {}) {
  return { status, ok: status === 200 && String(body || "").trim().length > 0, text: body, finalUrl: extra.finalUrl, setCookies: extra.setCookies, error: extra.error, robotsBlocked: extra.robotsBlocked };
}

test("fixtures distinguish stripped, full, mobile, reviews, and captcha pages", () => {
  const assess = (html, url = amazon) => layered.assessStorePage(collector, { html, requestedUrl: url, finalUrl: url, status: 200 });
  assert.ok(stripped.length >= 400);
  assert.equal(assess(stripped).stripped, true);
  assert.equal(assess(stripped).hasTitle, false);
  assert.equal(assess(stripped).hasReviews, false);
  const fat = `<html><head><title>Amazon.com</title></head><body>${"nav ".repeat(50_000)}</body></html>`;
  assert.ok(fat.length > 200_000);
  assert.equal(assess(fat).stripped, true, "fat shell with no title and no reviews is stripped");
  assert.equal(assess(full).stripped, false);
  assert.equal(assess(full).hasTitle, true);
  assert.equal(assess(full).hasReviews, true);
  assert.equal(assess(mobile).hasReviews, true);
  assert.equal(assess(mobile).stripped, false);
  assert.equal(assess(reviews).hasReviews, true);
  assert.equal(assess(reviews).hasTitle, false);
  assert.equal(assess(reviews).stripped, false);
  assert.equal(assess(captcha).challenge, true);
  assert.equal(assess(captcha).blocked, true);
  assert.equal(assess(captcha).stripped, false);
});

test("Amazon attempt plan orders profiles, URL forms, then sibling domains", () => {
  const plan = stores.buildAttemptPlan(amazon, true);
  assert.deepEqual(plan.slice(0, 2).map((attempt) => attempt.tier), ["primary-profile", "alternate-profile"]);
  assert.equal(plan[0].profileId, "chrome-win");
  assert.equal(plan[1].profileId, "chrome-mac");
  const tiers = plan.map((attempt) => attempt.tier);
  const mobileAt = tiers.indexOf("mobile-url");
  const reviewsAt = tiers.indexOf("reviews-endpoint");
  const siblingAt = tiers.indexOf("sibling-domain");
  assert.ok(mobileAt > 1 && reviewsAt > mobileAt && siblingAt > reviewsAt);
  assert.ok(plan.some((attempt) => attempt.url.includes("/gp/product/B0TESTLIST")));
  assert.ok(plan.some((attempt) => attempt.url.includes("/gp/aw/d/B0TESTLIST")));
  assert.ok(plan.some((attempt) => attempt.url.includes("th=1&psc=1")));
  assert.ok(plan.some((attempt) => attempt.url.includes("/hz/reviews-render/ajax/reviews/get/")));
  assert.ok(plan.some((attempt) => attempt.url.startsWith("https://www.amazon.ca/dp/B0TESTLIST")));
  assert.ok(plan.some((attempt) => attempt.url.startsWith("https://www.amazon.co.uk/dp/B0TESTLIST")));
  assert.equal(stores.buildAttemptPlan(`${amazon}?pageNumber=2`, true).length > stores.buildAttemptPlan(amazon, false).length, true);
  assert.deepEqual(stores.buildAttemptPlan(amazon, false).map((attempt) => attempt.tier), ["primary-profile", "alternate-profile"]);
});

test("a full page stops on the primary profile", async () => {
  const calls = [];
  const result = await layered.runLayeredStoreFetch({
    url: amazon,
    fetchPage: async (attempt) => { calls.push(attempt); return page(full, 200, { finalUrl: attempt.url }); },
  });
  assert.equal(calls.length, 1);
  assert.equal(result.tier, "primary-profile");
  assert.equal(result.strippedPage, false);
  assert.equal(result.hasReviews, true);
  assert.equal(result.chromium, "not-needed");
});

test("stripped pages walk profiles and URL forms, then stop when reviews appear", async () => {
  const calls = [];
  const result = await layered.runLayeredStoreFetch({
    url: amazon,
    chromiumFetch: async () => { throw new Error("chromium must not run after reviews"); },
    fetchPage: async (attempt) => {
      calls.push(attempt.tier);
      const body = attempt.tier === "mobile-url" ? mobile : stripped;
      return page(body, 200, { finalUrl: attempt.url });
    },
  });
  assert.deepEqual(calls, ["primary-profile", "alternate-profile", "alternate-url", "alternate-url", "mobile-url"]);
  assert.equal(result.tier, "mobile-url");
  assert.equal(result.profileId, "chrome-android");
  assert.equal(result.strippedPage, true);
  assert.equal(result.hasReviews, true);
  assert.match(result.text, /easy to carry/i);
});

test("a reviews page is accepted and a captcha stops the ladder", async () => {
  const reviewCalls = [];
  const fromReviews = await layered.runLayeredStoreFetch({
    url: amazon,
    fetchPage: async (attempt) => {
      reviewCalls.push(attempt.url);
      const body = attempt.url.includes("/product-reviews/") ? reviews : stripped;
      return page(body, 200, { finalUrl: attempt.url });
    },
  });
  assert.equal(fromReviews.tier, "reviews-endpoint");
  assert.equal(fromReviews.strippedPage, true);
  assert.ok(reviewCalls.some((url) => url.includes("/product-reviews/")));
  assert.equal(reviewCalls.some((url) => url.includes("amazon.ca")), false);

  const captchaCalls = [];
  let chromiumCalled = false;
  const stopped = await layered.runLayeredStoreFetch({
    url: amazon,
    chromiumFetch: async () => { chromiumCalled = true; return null; },
    fetchPage: async (attempt) => { captchaCalls.push(attempt.url); return page(captcha, 200, { finalUrl: "https://www.amazon.com/errors/validateCaptcha" }); },
  });
  assert.equal(captchaCalls.length, 1);
  assert.equal(stopped.blocked, true);
  assert.equal(stopped.hasReviews, false);
  assert.equal(chromiumCalled, false);
});

test("cookie jar is reused and Accept-Language follows the domain", async () => {
  const seen = [];
  const jar = new profiles.ScanCookieJar();
  const result = await layered.runLayeredStoreFetch({
    url: "https://www.amazon.ca/dp/B0TESTLIST",
    jar,
    fetchPage: async (attempt, headers) => {
      seen.push(headers);
      if (seen.length === 1) return page(stripped, 200, { finalUrl: attempt.url, setCookies: ["session-id=abc123; Domain=.amazon.ca; Path=/"] });
      return page(reviews, 200, { finalUrl: attempt.url });
    },
  });
  assert.equal(seen[0]["accept-language"].startsWith("en-CA"), true);
  assert.match(seen[0]["accept-encoding"], /gzip/);
  assert.match(seen[0]["accept-encoding"], /br/);
  assert.match(seen[0]["user-agent"], /Chrome\/140/);
  assert.ok(seen[0]["sec-ch-ua"]);
  assert.ok(seen[0]["sec-fetch-dest"]);
  assert.equal(seen[0]["x-ri-profile"], "chrome-win");
  assert.equal(seen[1].cookie.includes("session-id=abc123"), true);
  assert.equal(result.hasReviews, true);
  const uk = profiles.headersForAttempt({ url: "https://www.amazon.co.uk/dp/B0TESTLIST", tier: "primary-profile", profileId: "chrome-win", jar: new profiles.ScanCookieJar() });
  assert.equal(uk["accept-language"].startsWith("en-GB"), true);
});

test("collection budget stops further attempts and skips Chromium", async () => {
  let calls = 0;
  let chromiumCalled = false;
  const result = await layered.runLayeredStoreFetch({
    url: amazon,
    remainingMs: () => (calls === 0 ? 50_000 : 1_000),
    chromiumFetch: async () => { chromiumCalled = true; return page(mobile); },
    fetchPage: async (attempt) => { calls += 1; return page(stripped, 200, { finalUrl: attempt.url }); },
  });
  assert.equal(calls, 1);
  assert.equal(result.attempts, 1);
  assert.equal(result.hasReviews, false);
  assert.equal(chromiumCalled, false);
  assert.equal(result.chromium, "skipped-budget");
});

test("deadline helper is what the ladder reads when no clock is injected", async () => {
  let calls = 0;
  await deadline.withScanDeadline(1, async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    const result = await layered.runLayeredStoreFetch({
      url: amazon,
      fetchPage: async () => { calls += 1; return page(stripped); },
    });
    assert.ok(deadline.scanCollectionRemainingMs() <= 0);
    assert.equal(calls, 0);
    assert.equal(result.attempts, 0);
    assert.equal(result.chromium, "skipped-budget");
  });
});

test("Chromium is last, only when HTTP tiers stay stripped and time remains", async () => {
  let chromiumCalled = false;
  const result = await layered.runLayeredStoreFetch({
    url: amazon,
    maxAttempts: 2,
    remainingMs: () => 20_000,
    chromiumFetch: async (url) => { chromiumCalled = true; assert.equal(url, amazon); return page(mobile, 200, { finalUrl: url }); },
    fetchPage: async (attempt) => page(stripped, 200, { finalUrl: attempt.url }),
  });
  assert.equal(chromiumCalled, true);
  assert.equal(result.tier, "chromium");
  assert.equal(result.chromium, "used");
  assert.equal(result.strippedPage, true);
  assert.equal(chromium.chromiumTierEnabled({}), false);
  assert.equal(chromium.chromiumTierEnabled({ REVIEWINTEL_LAYERED_CHROMIUM: "on" }), true);
  const skipped = await chromium.maybeSparticuzChromium(amazon, 1000, {});
  assert.equal(skipped.state, "disabled");
});

test("gzip and brotli bodies are decoded, and profiles do not share a cache entry", async () => {
  const compressed = (payload, coding) => ({
    status: 200,
    ok: true,
    url: "",
    headers: { get: (name) => String(name).toLowerCase() === "content-encoding" ? coding : null, getSetCookie: () => [] },
    text: async () => "still compressed",
    arrayBuffer: async () => payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength),
  });
  const fetcher = polite.createPoliteFetcher({
    minHostIntervalMs: 0,
    fetchImpl: async (url, init) => {
      const headers = new Headers(init.headers || {});
      assert.equal(headers.get("x-ri-profile"), null);
      const encoding = headers.get("accept-encoding") || "";
      const coding = encoding.includes("gzip") ? "gzip" : "br";
      const payload = coding === "gzip" ? gzipSync(Buffer.from(full)) : brotliCompressSync(Buffer.from(full));
      return compressed(payload, coding);
    },
  });
  const gzipHeaders = profiles.headersForAttempt({ url: amazon, tier: "primary-profile", profileId: "chrome-win", jar: new profiles.ScanCookieJar() });
  const gzipResult = await fetcher.get(amazon, { headers: gzipHeaders });
  assert.match(gzipResult.text, /productTitle/);
  const brHeaders = profiles.headersForAttempt({ url: "https://www.amazon.ca/dp/B0TESTLIST", tier: "primary-profile", profileId: "chrome-mac", jar: new profiles.ScanCookieJar() });
  delete brHeaders["accept-encoding"];
  brHeaders["accept-encoding"] = "br";
  const brResult = await fetcher.get("https://www.amazon.ca/dp/B0TESTLIST", { headers: brHeaders });
  assert.match(brResult.text, /productTitle/);
  assert.equal(fetcher.stats.cacheHits, 0);
});

test("Walmart, Best Buy, Target, and Home Depot expose public review URLs", () => {
  const walmart = stores.buildAttemptPlan("https://www.walmart.com/ip/some-item/123456789", true);
  assert.ok(walmart.some((attempt) => attempt.tier === "reviews-endpoint" && attempt.url.includes("/reviews/product/123456789")));
  assert.ok(walmart.some((attempt) => attempt.tier === "sibling-domain" && attempt.url.includes("walmart.ca")));
  const bestbuy = stores.buildAttemptPlan("https://www.bestbuy.com/site/some-item/6543210.p", true);
  assert.ok(bestbuy.some((attempt) => attempt.url.includes("/ugc/v2/reviews?sku=6543210")));
  assert.equal(bestbuy.some((attempt) => attempt.tier === "sibling-domain"), false);
  const target = stores.buildAttemptPlan("https://www.target.com/p/some-item/-/A-12345678", true);
  assert.ok(target.some((attempt) => attempt.url.includes("r2d2.target.com") && attempt.url.includes("reviewedId=12345678")));
  const depot = stores.buildAttemptPlan("https://www.homedepot.com/p/some-drill/123456789", true);
  assert.ok(depot.some((attempt) => attempt.url.includes("/p/reviews/some-drill/123456789")));
});

test("store JSON is copied into reviewBody and a captcha JSON is not required", () => {
  const targetJson = JSON.stringify({
    reviews: [{ text: "I used this drill every weekend and the battery stayed reliable.", title: "Solid", Rating: 5, submitted_at: "2026-04-02" }],
  });
  const normalized = stores.normalizeReviewPayload(targetJson);
  const extracted = extractWrittenReviewsFromHtml(normalized, "https://r2d2.target.com/ggc/v2/summary?reviewedId=12345678");
  assert.equal(extracted.length, 1);
  assert.match(extracted[0].body, /battery stayed reliable/);
  const blurb = stores.normalizeReviewPayload(JSON.stringify({ text: "A long product description that is not a customer review at all.", rating: 4 }));
  assert.equal(blurb.includes("reviewBody"), false);
});

test("Best Buy and Target ladders stop on the public reviews endpoint", async () => {
  const reviewJson = JSON.stringify({
    reviews: [{ text: "I used this speaker outside and the sound stayed clear all afternoon.", title: "Clear", rating: 5, submissionTime: "2026-03-01" }],
  });
  async function run(url, match) {
    const calls = [];
    const result = await layered.runLayeredStoreFetch({
      url,
      fetchPage: async (attempt) => {
        calls.push(attempt.url);
        return page(match(attempt.url) ? reviewJson : stripped, 200, { finalUrl: attempt.url });
      },
    });
    return { calls, result };
  }
  const best = await run("https://www.bestbuy.com/site/some-item/6543210.p", (url) => url.includes("/ugc/v2/reviews"));
  assert.equal(best.result.tier, "reviews-endpoint");
  assert.equal(best.result.store, "bestbuy");
  assert.ok(extractWrittenReviewsFromHtml(best.result.text, best.calls.at(-1)).length >= 1);
  const target = await run("https://www.target.com/p/some-item/-/A-12345678", (url) => url.includes("r2d2.target.com"));
  assert.equal(target.result.tier, "reviews-endpoint");
  assert.equal(target.result.store, "target");
  assert.equal(target.calls.some((url) => url.includes("amazon.")), false);
});

test("Home Depot adds a Bazaarvoice URL only from a passkey the page already exposed", async () => {
  const calls = [];
  const shell = `${stripped}\n<script>{"passkey":"publicpasskey123"}</script>`;
  const payload = JSON.stringify({ Results: [{ ReviewText: "I installed this faucet myself and the handle still feels solid.", Title: "Solid", Rating: 4, SubmissionTime: "2026-02-02" }] });
  const result = await layered.runLayeredStoreFetch({
    url: "https://www.homedepot.com/p/some-faucet/123456789",
    fetchPage: async (attempt) => {
      calls.push(attempt.url);
      if (attempt.url.includes("bazaarvoice.com")) return page(payload, 200, { finalUrl: attempt.url });
      return page(shell, 200, { finalUrl: attempt.url });
    },
  });
  assert.ok(calls.some((url) => url.includes("api.bazaarvoice.com") && url.includes("publicpasskey123") && url.includes("123456789")));
  assert.equal(result.tier, "reviews-endpoint");
  assert.match(result.text, /handle still feels solid/);
});

async function withFetch(fake, action) {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try { return await action(); } finally { globalThis.fetch = original; }
}

test("link-only Amazon retrieval uses a later tier when /dp and the reviews page are stripped", async () => {
  const urls = [];
  const out = await withFetch(async (url) => {
    const parsed = new URL(String(url));
    urls.push(parsed.href);
    if (parsed.pathname === "/robots.txt") return new Response("", { status: 404 });
    if (parsed.pathname.includes("/hz/reviews-render/ajax/")) return new Response(reviews, { status: 200 });
    if (parsed.hostname.includes("amazon.")) return new Response(stripped, { status: 200 });
    return new Response("", { status: 404 });
  }, () => runNativeReviewRetrieval({
    productTitle: "UnrelatedMaker Q7 Portable Station",
    brand: "UnrelatedMaker",
    listingUrl: amazon,
    maxPages: 4,
    maxQueries: 1,
    politeDelayMs: 0,
  }));
  assert.ok(out.reviewsCollected >= 1, `collected ${out.reviewsCollected}`);
  assert.match(out.reviews[0].body, /fan noise stays low/);
  assert.equal(out.layeredCollection.strippedPage, true);
  assert.equal(out.layeredCollection.tier, "reviews-endpoint");
  assert.ok(out.layeredCollection.stores.includes("amazon"));
  assert.ok(urls.some((url) => url.includes("/hz/reviews-render/ajax/")));
});

test("Walmart reviews page is collected through the same ladder", async () => {
  const listing = "https://www.walmart.com/ip/unrelatedmaker-q7/123456789";
  const html = `<html><head><title>UnrelatedMaker Q7 Portable Station</title><meta property="og:title" content="UnrelatedMaker Q7 Portable Station"><script type="application/ld+json">${JSON.stringify({ "@type": "Review", reviewBody: "I used this portable station all week and the battery stayed reliable on the jobsite.", author: { "@type": "Person", name: "Buyer" }, reviewRating: { "@type": "Rating", ratingValue: 5 } })}</script></head><body></body></html>`;
  const out = await withFetch(async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname === "/robots.txt") return new Response("", { status: 404 });
    if (parsed.pathname.includes("/reviews/product/")) return new Response(html, { status: 200 });
    if (parsed.hostname.includes("walmart.")) return new Response(stripped, { status: 200 });
    return new Response("", { status: 404 });
  }, () => runNativeReviewRetrieval({
    productTitle: "UnrelatedMaker Q7 Portable Station",
    brand: "UnrelatedMaker",
    listingUrl: listing,
    maxPages: 4,
    maxQueries: 1,
    politeDelayMs: 0,
  }));
  assert.ok(out.reviewsCollected >= 1, `collected ${out.reviewsCollected}`);
  assert.equal(out.layeredCollection.tier, "reviews-endpoint");
  assert.equal(out.layeredCollection.strippedPage, true);
  assert.ok(out.layeredCollection.stores.includes("walmart"));
});

test("the same review text on two Amazon domains is kept once", async () => {
  const shared = "I used this portable station all week and the battery stayed reliable on the jobsite.";
  const extra = "The outlets are easy to reach and the case did not crack in the truck.";
  const bodyFor = (host) => {
    const second = host.endsWith("amazon.com") ? `<div data-hook="review"><span data-hook="review-body"><span>${extra}</span></span></div>` : "";
    return full.replace(/I used this portable station all week and the battery stayed reliable on the jobsite\./, shared) + second;
  };
  const out = await withFetch(async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname === "/robots.txt") return new Response("", { status: 404 });
    if (parsed.hostname.endsWith("amazon.ca") && parsed.pathname.startsWith("/dp/")) return new Response(bodyFor("amazon.ca"), { status: 200 });
    if (parsed.hostname.endsWith("amazon.com") && parsed.pathname.startsWith("/dp/")) return new Response(bodyFor("amazon.com"), { status: 200 });
    return new Response("", { status: 404 });
  }, () => runNativeReviewRetrieval({
    productTitle: "UnrelatedMaker Q7 Portable Station",
    brand: "UnrelatedMaker",
    listingUrl: "https://www.amazon.ca/dp/B0TESTLIST",
    maxPages: 12,
    maxQueries: 1,
    politeDelayMs: 0,
  }));
  const bodies = out.reviews.map((review) => review.body);
  assert.equal(bodies.filter((body) => body.includes("battery stayed reliable")).length, 1);
  assert.ok(bodies.some((body) => body.includes("outlets are easy to reach")));
});
