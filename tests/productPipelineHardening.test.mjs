import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { installOfflineGuard } from "../scripts/reviewintel-offline-guard.mjs";

installOfflineGuard();

const require = createRequire(import.meta.url);
const jiti = require("jiti")(process.cwd(), { alias: { "@": process.cwd() } });
const { stableProductSearchTerms } = jiti("./lib/productIdentityTokens.ts");
const { verifyProductCandidate, prepareCandidateForVerification, buildProductRetryQueries } = jiti("./lib/productSearchVerifier.ts");
const { buildRetrievalQueries, normalizeProductUrl, isProductUrl } = jiti("./lib/productUrlRetrieval.ts");
const { buildNativeReviewSearchQueries, runNativeReviewRetrieval } = jiti("./lib/nativeReviewRetrieval.ts");
const { extractWrittenReviewsFromHtml, collectWrittenReviewsFromListing } = jiti("./lib/reviewCollector.ts");
const { adjudicateReviewEvidence, verifyEvidenceClaims } = jiti("./lib/reviewEvidenceAdjudication.ts");
const { deriveDeterministicEvidenceResult } = jiti("./lib/reviewEvidenceDeterminism.ts");
const { ScanCostTelemetry } = jiti("./lib/scanCostTelemetry.ts");
const { findExactProductCandidates, parseIdentityCandidatesFromUrls } = jiti("./lib/exactProductSearch.ts");

const ring = { scanId: "offline-ring", brand: "RingConn", productName: "RingConn Gen 2 Air Smart Ring 10-Day Battery IP68 Ultra Thin Sleep Fitness", store: "Amazon.ca" };
const listing = "https://ringconn.com/products/ringconn-gen-2-air";
const cases = [
  [ring, "Gen 2 Air", "RingConn Gen-2-Air Smart Ring"],
  [{ scanId: "offline-robot", brand: "Roborock", productName: "Roborock Qrevo S Pro Robot Vacuum 2026 18,500Pa" }, "Qrevo S Pro", "Roborock Qrevo S Pro Robot Vacuum"],
  [{ scanId: "offline-philips", brand: "Philips", model: "NA555/00", productName: "Philips 5000 Series Dual Basket Airfryer NA555/00" }, "NA555/00", "Philips 5000 Series Dual Basket Airfryer NA555-00"],
  [{ scanId: "offline-generic", brand: "Aurora Labs", productName: "Aurora Labs Nova 3 Lite Smart Ring 12-Day Battery IP67" }, "Nova 3 Lite", "Aurora Labs Nova 3 Lite Smart Ring"],
  [{ scanId: "offline-named-explicit", brand: "Acme", model: "Zenith Lite", productName: "Acme Zenith Lite Wireless Headphones" }, "Zenith Lite", "Acme Zenith Lite Wireless Headphones"],
];
for (const [job, model, title] of cases) {
  test(`${job.brand}: role, queries, and exact verifier preserve the named model`, () => {
    const stable = stableProductSearchTerms(job);
    assert.equal(stable.roles.primaryBrand, job.brand.toLowerCase());
    assert.deepEqual(stable.models, [model.toUpperCase()]);
    const queries = [...buildRetrievalQueries(job), ...buildProductRetryQueries(job), ...buildNativeReviewSearchQueries({ productTitle: job.productName, brand: job.brand, model: job.model })];
    for (const query of queries) {
      assert.ok(query.toLowerCase().includes(job.brand.toLowerCase()), query);
      assert.ok(query.toLowerCase().includes(model.toLowerCase()), query);
      assert.doesNotMatch(query, /10-day|12-day|ip6[78]|ultra thin|2026|18,?500pa/i);
    }
    assert.equal(verifyProductCandidate(job, { url: "https://example.com/products/target", title }).canCollectReviews, true);
  });
}

test("exact verifier rejects wrong named model, accessories, and bare URL identity", () => {
  for (const title of ["RingConn Gen 2 Pro Smart Ring", "RingConn Gen 3 Air Smart Ring", "RingConn Gen 2 Air Pro Smart Ring", "Replacement case compatible with RingConn Gen 2 Air", listing]) {
    assert.equal(verifyProductCandidate(ring, { url: listing, title }).canCollectReviews, false, title);
  }
  assert.equal(verifyProductCandidate(ring, { url: "https://www.amazon.ca/dp/B0TEST0001", title: "RingConn Gen 2 Air Smart Speaker" }).canCollectReviews, false);
  for (const model of ["Gen 3 Air", "Gen 2 Air Pro"]) {
    const decision = verifyProductCandidate(ring, { url: listing, title: "RingConn Gen 2 Air Smart Ring", brand: "RingConn", model });
    assert.equal(decision.canCollectReviews, false);
    assert.match(decision.verifierReasons.join(" "), /Fetched candidate model conflicts/);
  }
});

test("relative manufacturer canonicals preserve exact identity; wrong-ASIN redirects do not", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('<title>RingConn Gen 2 Air Smart Ring</title><link rel="canonical" href="/products/ringconn-gen-2-air">');
    const candidate = await prepareCandidateForVerification(ring, { url: `${listing}?ref=search`, title: null });
    assert.equal(candidate.url, listing);
    assert.equal(verifyProductCandidate(ring, candidate).canCollectReviews, true);
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      const response = new Response('<title>RingConn Gen 2 Air Smart Ring</title>');
      Object.defineProperty(response, "url", { value: "https://www.amazon.ca/dp/B0WRONG001" });
      return response;
    };
    const redirected = await prepareCandidateForVerification(ring, { url: "https://www.amazon.ca/dp/B0TEST0001", title: null });
    assert.equal(redirected.enrichmentSucceeded, false);
    assert.equal(verifyProductCandidate(ring, redirected).canCollectReviews, false);
    assert.equal(calls, 1);
    calls = 0;
    globalThis.fetch = async () => { calls += 1; return new Response("Access restricted", { status: 403 }); };
    await prepareCandidateForVerification(ring, { url: "https://www.amazon.ca/dp/B0TEST0001", title: null });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("manufacturer URL discovery is still a candidate, not a verified listing", () => {
  const [candidate] = parseIdentityCandidatesFromUrls([listing], "Amazon.ca");
  assert.equal(candidate.url, listing);
  assert.equal(candidate.title, null);
  assert.equal(verifyProductCandidate(ring, candidate).canCollectReviews, false);
});

test("real discovery query dispatch preserves Roborock S and Philips slash model", async () => {
  const oldFetch = globalThis.fetch;
  try {
    for (const [job, model, title] of cases.slice(1, 3)) {
      const queries = [];
      globalThis.fetch = async (url) => {
        const parsed = new URL(String(url));
        if (parsed.searchParams.has("q") || parsed.searchParams.has("k")) {
          queries.push(parsed.searchParams.get("q") || parsed.searchParams.get("k"));
          return new Response(`<a href="https://example.com/products/target">${title}</a>`);
        }
        assert.equal(parsed.hostname, "example.com");
        return new Response(`<title>${title}</title>`);
      };
      await findExactProductCandidates({ ...job, store: "Amazon.ca", searchQueries: buildProductRetryQueries(job), maxCandidates: 1 });
      assert.ok(queries.length > 0);
      for (const query of queries) {
        assert.ok(query.toLowerCase().includes(job.brand.toLowerCase()), query);
        assert.ok(query.toLowerCase().includes(model.toLowerCase()), query);
        assert.doesNotMatch(query, /2026|18,?500pa/i);
      }
    }
  } finally { globalThis.fetch = oldFetch; }
});

test("real RingConn orchestration discovers manufacturer identity and scores only extracted reviews", async () => {
  const oldFetch = globalThis.fetch;
  const envNames = ["REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED", "REVIEWINTEL_RETRIEVAL_DELAY_MS"];
  const oldEnv = envNames.map((name) => process.env[name]);
  process.env.REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED = "false";
  process.env.REVIEWINTEL_RETRIEVAL_DELAY_MS = "0";
  const requests = [];
  const reviews = Array.from({ length: 7 }, (_, index) => ({ "@type": "Review", reviewBody: `Synthetic offline fixture ${index}: I use this ring daily; it is comfortable and reliable, with easy setup.`, reviewRating: { ratingValue: 5 } }));
  const html = `<title>RingConn Gen 2 Air Smart Ring</title><script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "RingConn Gen 2 Air Smart Ring", brand: "RingConn", model: "Gen 2 Air", review: reviews })}</script>`;
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url)); requests.push(parsed);
    assert.doesNotMatch(parsed.hostname, /openai|firecrawl|supabase/);
    if (parsed.hostname === "ringconn.com") return new Response(html);
    assert.ok(["www.bing.com", "duckduckgo.com", "www.amazon.ca"].includes(parsed.hostname), parsed.hostname);
    return new Response(`<a href="${listing}">RingConn Gen 2 Air Smart Ring</a>`);
  };
  try {
    const { POST } = jiti("./app/api/dev/reviewintel-diagnostic/route.ts");
    const response = await POST(new Request("http://localhost/api/dev/reviewintel-diagnostic", { method: "POST", body: JSON.stringify({ ...ring, rating: 4.5, reviewCount: 700 }) }));
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.canonicalUrl, listing);
    assert.equal(result.productVerified, true);
    assert.equal(result.acceptedExactProductReviews, 7);
    assert.equal(result.analysisReceivedAcceptedCorpus, true);
    assert.equal(result.verdict, "BUY");
    assert.equal(result.cost.openAiCalls, 0);
    assert.equal(result.cost.firecrawlCalls, 0);
    assert.equal(result.deterministicResult.acceptedReviewHashes.length, 7);
    assert.ok(result.deterministicResult.strengths.every((claim) => claim.provenance === "ACCEPTED_WRITTEN_REVIEW"));
    for (const request of requests.filter((url) => url.searchParams.has("q") || url.searchParams.has("k"))) {
      const query = request.searchParams.get("q") || request.searchParams.get("k");
      assert.match(query, /ringconn/i);
      assert.match(query, /gen 2 air/i);
      assert.doesNotMatch(query, /10-day|ip68|ultra thin/i);
    }
  } finally {
    globalThis.fetch = oldFetch;
    envNames.forEach((name, index) => oldEnv[index] === undefined ? delete process.env[name] : process.env[name] = oldEnv[index]);
  }
});

test("native pagination continues beyond a tiny corpus while new exact reviews are available", async () => {
  const oldFetch = globalThis.fetch;
  const pages = [];
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    // The verified locale sibling is probed once for identity; this fixture
    // serves it nothing, so only the verified marketplace supplies reviews.
    if (parsed.hostname === "www.amazon.com" && parsed.pathname === "/dp/B0TEST0001") return new Response("", { status: 404 });
    assert.equal(parsed.hostname, "www.amazon.ca");
    if (!parsed.pathname.endsWith('/robots.txt')) pages.push(parsed.toString()); // robots.txt policy fetches are not page requests
    const prefix = parsed.searchParams.toString() || parsed.pathname;
    return new Response(Array.from({ length: 10 }, (_, index) => `<div data-hook="review"><span data-hook="review-body">Synthetic pagination fixture ${prefix} reviewer ${index}: I used this smart ring daily and it was comfortable and reliable.</span></div>`).join(""));
  };
  try {
    const result = await runNativeReviewRetrieval({ productTitle: ring.productName, brand: ring.brand, model: "Gen 2 Air", listingUrl: "https://www.amazon.ca/dp/B0TEST0001", maxPages: 8, maxQueries: 1, maxSnippets: 65, politeDelayMs: 0 });
    assert.equal(pages.length, 7);
    assert.equal(result.reviewsCollected, 65);
  } finally { globalThis.fetch = oldFetch; }
});

test("specifications, compatibility codes, and mutable metadata cannot become primary models", () => {
  const identity = stableProductSearchTerms({ brand: "Acme", productName: "Acme Robot Vacuum 2026 18,500Pa IP68 10-Day Battery Ultra Thin" });
  assert.deepEqual(identity.models, []);
  assert.doesNotMatch(identity.family, /2026|18|500|ip68|10-day|ultra/i);
  const eufy = stableProductSearchTerms({ brand: "Eufy", productName: "Eufy E340 Video Doorbell compatible with S380. Price $149.99 4.4 stars 4375 reviews" });
  assert.deepEqual(eufy.models, ["E340"]);
  assert.ok(eufy.roles.compatibleWith.includes("S380"));
  const kenmore = stableProductSearchTerms({ brand: "Kenmore", productName: "Kenmore 7.0 cu ft Front Load Electric Dryer" });
  assert.deepEqual(kenmore.models, []);
  assert.deepEqual(kenmore.roles.capacityOrSize, ["7.0 cu. ft."]);
});

test("sparse manufacturer candidate gets one safe structured identity enrichment", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response('<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"RingConn Gen 2 Air Smart Ring","brand":"RingConn","model":"Gen 2 Air"}]}</script>', { status: 200 });
  };
  try {
    const urls = new Set();
    const candidate = await prepareCandidateForVerification(ring, { url: listing, title: listing }, urls);
    assert.equal(candidate.enrichmentSucceeded, true);
    assert.equal(candidate.brand, "RingConn");
    assert.equal(candidate.model, "Gen 2 Air");
    assert.equal(verifyProductCandidate(ring, candidate).canCollectReviews, true);
    await prepareCandidateForVerification(ring, candidate, urls);
    assert.deepEqual(requests, [listing]);
  } finally { globalThis.fetch = originalFetch; }
});

test("failed enrichment cannot invent brand or turn sign-in content into identity", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    const response = new Response('<title>Sign in</title><span id="productTitle">RingConn Gen 2 Air Smart Ring</span>', { status: 200 });
    Object.defineProperty(response, "url", { value: "https://www.amazon.ca/ap/signin" });
    return response;
  };
  try {
    const candidate = await prepareCandidateForVerification(ring, { url: "https://www.amazon.ca/dp/B0TEST0001", title: null });
    assert.equal(candidate.enrichmentSucceeded, false);
    assert.equal(verifyProductCandidate(ring, candidate).canCollectReviews, false);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("candidate gates reject category, social, private, and deceptive URLs", () => {
  for (const url of ["https://www.walmart.com/search/product", "https://facebook.com/products/target", "http://127.0.0.1/products/target", "https://amazon.ca.attacker.example/search/products/target"]) {
    assert.equal(isProductUrl(url), false, url);
  }
  // Tracking/filter params (q/k/keyword/search) on a legitimate product path
  // are stripped during normalization, not treated as deceptive. Search-shaped
  // PATHS are still rejected.
  assert.equal(isProductUrl("https://example.com/products/target?q=reviews"), true);
  assert.equal(isProductUrl("https://example.com/search?q=phone"), false);
  const target = "https://ringconn.com/products/ringconn-gen-2-air";
  assert.equal(normalizeProductUrl(`https://www.bing.com/ck/a?u=a1${Buffer.from(target).toString("base64url")}`), target);
  const arbitrary = `https://example.com/products/target?url=${encodeURIComponent(target)}`;
  assert.equal(normalizeProductUrl(arbitrary), arbitrary);
});

test("native retrieval rejects HTTP-200 Amazon sign-in redirects without browser retry", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    if (!String(url).endsWith('/robots.txt')) urls.push(String(url)); // robots.txt policy fetches are not page requests
    const response = new Response('<div data-hook="review"><span data-hook="review-body">I love this product and it works reliably for everyday use.</span></div>', { status: 200 });
    Object.defineProperty(response, "url", { value: "https://www.amazon.ca/ax/claim" });
    return response;
  };
  try {
    const result = await runNativeReviewRetrieval({ productTitle: ring.productName, brand: ring.brand, listingUrl: "https://www.amazon.ca/dp/B0TEST0001", maxPages: 1, maxQueries: 1, politeDelayMs: 0 });
    assert.equal(result.reviewsCollected, 0);
    assert.equal(result.diagnostics.pagesBlocked, 1);
    assert.equal(result.playwrightAttempted, false);
    assert.equal(urls.length, 1);
  } finally { globalThis.fetch = originalFetch; }
});

const association = { productName: ring.productName, brand: ring.brand, exactListingAccepted: true, exactListingUrl: listing, exactListingTitle: "RingConn Gen 2 Air Smart Ring" };
test("verified listing context accepts its own review, never arbitrary same-host text", () => {
  const result = adjudicateReviewEvidence([
    { body: "I love the ring and the battery works well for my daily use.", sourceUrl: listing },
    { body: "I love this product and the battery works well.", sourceUrl: "https://ringconn.com/products/unrelated" },
    { body: "Smart Ring IP68 10-Day Battery Ultra Thin 2026 specifications", sourceUrl: listing, evidenceType: "specification" },
    { body: "Smart Ring IP68 10-Day Battery Ultra Thin 2026 specifications", sourceUrl: listing, reviewStructureVerified: true },
    { snippet: "RingConn Gen 2 Air is great value and worth buying.", sourceUrl: listing },
  ], association);
  assert.equal(result.acceptedRecordCount, 1);
  assert.equal(result.rejectedRecordCount, 4);
});

test("genuine failure narratives and French customer experience are not treated as specifications", () => {
  const result = adjudicateReviewEvidence([
    { body: "Started to discharge in storage and stopped accepting a charge. Colossal waste of money.", sourceUrl: listing },
    { body: "J'adore! J'ai utilise ce produit tous les jours sans probleme.", sourceUrl: listing },
  ], association);
  assert.equal(result.acceptedRecordCount, 2);
  const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "RingConn Gen 2 Air", review: result.acceptedRecords.map((record) => ({ "@type": "Review", reviewBody: record.body })) })}</script>`;
  assert.equal(extractWrittenReviewsFromHtml(html, listing).length, 2);
});

test("direct collector retains final redirect provenance instead of labeling another ASIN as the requested one", async () => {
  const originalFetch = globalThis.fetch;
  const expected = "https://www.amazon.ca/dp/B0TEST0001";
  const actual = "https://www.amazon.ca/dp/B0WRONG001";
  globalThis.fetch = async () => {
    const response = new Response(`<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "RingConn Gen 2 Air", review: { "@type": "Review", reviewBody: "I love this ring and it is comfortable for daily use." } })}</script>`);
    Object.defineProperty(response, "url", { value: actual });
    return response;
  };
  try {
    const collected = await collectWrittenReviewsFromListing({ listingUrl: expected, productName: ring.productName, maxReviews: 1 });
    assert.equal(collected.reviews.length, 1);
    assert.equal(collected.reviews[0].sourceUrl, actual);
    const corpus = adjudicateReviewEvidence(collected.reviews, { ...association, exactListingUrl: expected });
    assert.equal(corpus.acceptedRecordCount, 0);
    assert.match(corpus.rejectedRecords[0].rejectionReason, /different product ID/);
  } finally { globalThis.fetch = originalFetch; }
});

test("structured recommended-product reviews cannot inherit the main listing identity", () => {
  const reviews = extractWrittenReviewsFromHtml(`<script type="application/ld+json">${JSON.stringify([
    { "@type": "Product", name: "RingConn Gen 2 Air Smart Ring", review: { "@type": "Review", reviewBody: "I like the battery and it works well for my daily tracking." } },
    { "@type": "Product", name: "RingConn Gen 3 Pro Smart Ring", review: { "@type": "Review", reviewBody: "I love this other ring and the battery works reliably for me." } },
  ])}</script>`, listing);
  const result = adjudicateReviewEvidence(reviews, association);
  assert.equal(reviews.length, 2);
  assert.equal(result.acceptedRecordCount, 1);
  assert.match(result.rejectedRecords[0].rejectionReason, /different product model/);
});

test("short authoritative brands and structured alternate brands remain identity boundaries", () => {
  const outside = adjudicateReviewEvidence([{ body: "Sony X1 is reliable and I love using it.", sourceUrl: "https://reviews.example/products/x1" }], { productName: "LG X1 Speaker", brand: "LG", model: "X1", exactListingAccepted: true, exactListingUrl: "https://lg.com/products/x1" });
  assert.equal(outside.acceptedRecordCount, 0);
  const html = `<script type="application/ld+json">${JSON.stringify([
    { "@type": "Product", name: "Kenmore Electric Dryer", brand: "Kenmore", review: { "@type": "Review", reviewBody: "I use this dryer every day and it works reliably." } },
    { "@type": "Product", name: "Electric Dryer", brand: { name: "Whirlpool" }, review: { "@type": "Review", reviewBody: "I love this dryer and it works reliably for me." } },
  ])}</script>`;
  const url = "https://example.com/products/kenmore-dryer";
  const corpus = adjudicateReviewEvidence(extractWrittenReviewsFromHtml(html, url), { brand: "Kenmore", productName: "Kenmore Electric Dryer", exactListingAccepted: true, exactListingUrl: url });
  assert.equal(corpus.acceptedRecordCount, 1);
  assert.match(corpus.rejectedRecords[0].rejectionReason, /different product brand/);
});

test("shipping complaint and long unique bodies survive extraction", () => {
  const prefix = "I bought this product and used it every day. ".repeat(5);
  const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "RingConn Gen 2 Air", review: [
    { "@type": "Review", reviewBody: `${prefix}Shipping was slow and packaging was damaged.` },
    { "@type": "Review", reviewBody: `${prefix}The plastic body cracked after regular use.` },
  ] })}</script>`;
  assert.equal(extractWrittenReviewsFromHtml(html, listing).length, 2);
});

test("aggregate product metadata is not a generic body/rating review, while individual embedded reviews remain usable", () => {
  const body = "Works reliably with IP68 protection, durable battery, great product specifications.";
  for (const metadata of [
    { name: "RingConn Gen 2 Air", reviewCount: 700, rating: 4.8, body },
    { "@type": "Product", name: "RingConn Gen 2 Air", reviewText: body, rating: 4.8 },
  ]) {
    const html = `<script type="application/json">${JSON.stringify(metadata)}</script>`;
    const reviews = extractWrittenReviewsFromHtml(html, listing);
    assert.equal(reviews.length, 0);
  }
  const review = { reviewId: "fixture-review", body: "I use this ring daily and it is reliable and comfortable.", rating: 5 };
  assert.equal(extractWrittenReviewsFromHtml(`<script type="application/json">${JSON.stringify(review)}</script>`, listing).length, 1);
});

test("same accepted corpus is order-independent and rejected records cannot boost the score", () => {
  const records = Array.from({ length: 6 }, (_, i) => ({ body: `I used this ring for ${i + 1} days and it works well with easy tracking.`, sourceUrl: listing }));
  const first = adjudicateReviewEvidence(records, association);
  const second = adjudicateReviewEvidence([...records].reverse(), association);
  const score = (acceptedRecords) => deriveDeterministicEvidenceResult({ acceptedRecords, exactProductAccepted: true, rating: 4.3, marketplaceReviewCount: 100 });
  assert.deepEqual(score(first.acceptedRecords), score(second.acceptedRecords));
  assert.deepEqual(score(first.acceptedRecords), score([...first.acceptedRecords, { ...first.acceptedRecords[0], accepted: false }]));
});

test("negated value praise cannot turn into a supported strength", () => {
  const records = Array.from({ length: 5 }, (_, i) => ({ body: `I used it for ${i + 1} days. Great packaging but not worth the price.`, sourceUrl: listing }));
  const corpus = adjudicateReviewEvidence(records, association);
  const score = deriveDeterministicEvidenceResult({ acceptedRecords: corpus.acceptedRecords, exactProductAccepted: true, rating: 4, marketplaceReviewCount: 40 });
  assert.equal(score.strengths.some((claim) => claim.claim === "good value for the price"), false);
});

test("negated praise cannot create BUY; absence of failure cannot create severe risk", () => {
  const score = (body) => {
    const corpus = adjudicateReviewEvidence(Array.from({ length: 6 }, (_, index) => ({ body: `I used it for ${index + 1} days. ${body}`, sourceUrl: listing })), association);
    assert.equal(corpus.acceptedRecordCount, 6);
    return deriveDeterministicEvidenceResult({ acceptedRecords: corpus.acceptedRecords, exactProductAccepted: true, rating: 4.9, marketplaceReviewCount: 700 });
  };
  const negative = score("Not reliable. Not durable. Not easy to use. Not good quality.");
  assert.equal(negative.customerVerdict, "AVOID");
  assert.equal(negative.deterministicScoringInputs.positiveSignal, 0);
  assert.ok(negative.deterministicScoringInputs.negativeSignal > 0);
  const positive = score("No problems. Never failed. No refund needed. It works reliably and I am happy.");
  assert.equal(positive.customerVerdict, "BUY");
  assert.equal(positive.deterministicScoringInputs.severeComplaintCount, 0);
  assert.equal(positive.complaints.length, 0);
  const failure = score("It does not work or charge.");
  assert.equal(failure.customerVerdict, "AVOID");
  assert.equal(failure.deterministicScoringInputs.severeComplaintCount, 6);
});

test("price mentions and advertised durability cannot create observed value or build claims", () => {
  const corpus = adjudicateReviewEvidence(Array.from({ length: 6 }, (_, index) => ({ body: `I used this product for ${index + 1} days. It works well. While being 3x the price, it is supposed to be extra durable.`, sourceUrl: listing })), association);
  const result = deriveDeterministicEvidenceResult({ acceptedRecords: corpus.acceptedRecords, exactProductAccepted: true, rating: 4.5, marketplaceReviewCount: 100 });
  assert.equal(result.strengths.some((claim) => /value|build|durable/.test(claim.claim)), false);
  assert.equal(result.valueForMoney, "Unknown");
  const noSignals = adjudicateReviewEvidence(Array.from({ length: 6 }, (_, index) => ({ body: `My order ${index + 1} arrived yesterday and the box contains a ring and a cable.`, sourceUrl: listing })), association);
  const unknown = deriveDeterministicEvidenceResult({ acceptedRecords: noSignals.acceptedRecords, exactProductAccepted: true, rating: 5, marketplaceReviewCount: 5000 });
  assert.equal(unknown.buyScore, null);
  assert.equal(unknown.customerVerdict, "DO NOT BUY YET");
  assert.match(unknown.bottomLine, /Accepted reviews were found/);
});

test("accepted citation ID cannot authorize a claim its review does not support", () => {
  const corpus = adjudicateReviewEvidence([{ body: "I use this smart ring every day and it is comfortable.", sourceUrl: listing }], { ...ring, exactListingAccepted: true, exactListingUrl: listing });
  const claims = verifyEvidenceClaims([{ claim: "Terrible battery failure and unsafe overheating", sourceIds: [corpus.acceptedRecords[0].id] }], corpus);
  assert.equal(claims.passed, false);
});

test("AI risk estimate and summary-model telemetry cannot drift the deterministic verdict hash", () => {
  const corpus = adjudicateReviewEvidence(Array.from({ length: 7 }, (_, index) => ({ body: `Fixture reviewer ${index}: I find the ring reliable, comfortable and easy to use.`, sourceUrl: listing })), { ...ring, exactListingAccepted: true, exactListingUrl: listing });
  const input = { acceptedRecords: corpus.acceptedRecords, exactProductAccepted: true, rating: 4.3, marketplaceReviewCount: 100 };
  assert.deepEqual(deriveDeterministicEvidenceResult({ ...input, riskFeatures: { score: 10 }, summaryModelVersion: "model-a" }), deriveDeterministicEvidenceResult({ ...input, riskFeatures: { score: 90 }, summaryModelVersion: "model-b" }));
});

test("explicitly null provider usage stays UNKNOWN, not zero", () => {
  const telemetry = new ScanCostTelemetry();
  telemetry.recordOpenAiCall({ inputTokens: null, outputTokens: null });
  assert.equal(telemetry.snapshot().openAiTotalTokens, null);
  assert.equal(telemetry.snapshot().estimatedScanCostUsd, null);
  assert.equal(telemetry.snapshot().firecrawlCalls, 0);
});
