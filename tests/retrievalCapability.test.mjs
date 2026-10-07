import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const repoRoot = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(repoRoot, { alias: { "@": repoRoot } });
const {
  buildDirectReviewCandidateUrls,
  buildIdentityRecoveryPrompt,
  findExactProductCandidates,
  normalizeProductCandidateUrl,
  parseIdentityCandidatesFromUrls,
  parseIdentityRecoveryCandidates,
} = jiti("./lib/exactProductSearch.ts");
const { buildProductRetryQueries, enrichProductCandidate, prepareCandidateForVerification, verifyProductCandidate } = jiti("./lib/productSearchVerifier.ts");
const { buildRetrievalQueries } = jiti("./lib/productUrlRetrieval.ts");
const { extractProductIdentityTokenRoles } = jiti("./lib/productIdentityTokens.ts");
const { collectAndAnalyzeReviewEvidence } = jiti("./lib/reviewEvidence.ts");
const exactSearch = fs.readFileSync(new URL("../lib/exactProductSearch.ts", import.meta.url), "utf8");
const nativeRetrieval = fs.readFileSync(new URL("../lib/nativeReviewRetrieval.ts", import.meta.url), "utf8");
const reviewEvidence = fs.readFileSync(new URL("../lib/reviewEvidence.ts", import.meta.url), "utf8");
const analyzeRoute = fs.readFileSync(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");

test("identity recovery queries stay product-generic", () => {
  const products = [
    { brand: "Acme", productName: "Acme ZX900 Countertop Oven", store: "Amazon.ca" },
    { brand: "Northstar", productName: "Northstar Q5 Cordless Vacuum", store: "Amazon.com" },
    { brand: "Orion", productName: "Orion X200 Bluetooth Speaker", store: "Amazon.ca" },
  ];

  const querySets = products.map((product) => buildRetrievalQueries(product));
  assert.ok(querySets[0].some((query) => /Acme.*ZX900.*Countertop Oven/i.test(query)));
  assert.ok(querySets[1].some((query) => /Northstar.*Q5.*Cordless Vacuum/i.test(query)));
  assert.ok(querySets[2].some((query) => /Orion.*X200.*Bluetooth Speaker/i.test(query)));
  assert.ok(querySets[0].some((query) => /site:amazon\.ca/i.test(query)));
  assert.ok(querySets[1].some((query) => /site:amazon\.com/i.test(query)));
  assert.ok(querySets[2].some((query) => /site:amazon\.ca/i.test(query)));
});

test("strong model identity survives native query construction without brand-only degradation", () => {
  const input = {
    brand: "Anker",
    productName: "Anker eufy Security Video Doorbell E340 Battery Powered Dual Cameras",
    store: "Amazon.ca",
  };
  const nativeQueries = buildRetrievalQueries(input);
  const retryQueries = buildProductRetryQueries({ ...input, productKey: input.productName });

  assert.ok(nativeQueries.length > 0);
  assert.ok(nativeQueries.every((query) => /E340/i.test(query)));
  assert.ok(retryQueries.length > 0);
  assert.ok(retryQueries.every((query) => /E340/i.test(query)));
  assert.equal(nativeQueries.some((query) => /^Anker Amazon\.ca$/i.test(query.trim())), false);
  assert.equal(retryQueries.some((query) => /^Anker Amazon\.ca$/i.test(query.trim())), false);
});

test("E340 is primary while S380 compatibility and mutable marketplace fields stay out of identity queries", () => {
  const input = {
    brand: "Anker",
    productName: "Anker eufy Security Video Doorbell E340 (Battery Powered), Dual Cameras",
    model: "E340 S380 149",
    store: "Amazon.ca",
    price: 149.99,
    rating: 4,
    reviewCount: 4375,
  };
  const roles = extractProductIdentityTokenRoles(input);
  const queries = buildRetrievalQueries(input).join("\n");

  assert.deepEqual(roles.primaryModels, ["E340"]);
  assert.deepEqual(roles.compatibleWith, ["S380"]);
  assert.match(roles.primaryProductFamily.join(" "), /security video doorbell/i);
  assert.doesNotMatch(queries, /S380|149(?:\.99)?|4\.0?|4375|reviews?/i);
  assert.match(queries, /E340/i);
  assert.match(queries, /eufy|video doorbell/i);
});

test("native exact search receives model-aware queries before bounded AI fallback", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes("amazon.ca/s?")) {
      return new Response('<a href="/dp/B0EUFYE340">eufy Security Video Doorbell E340 Battery Powered Dual Cameras</a>', { status: 200 });
    }
    if (String(url).includes("amazon.ca/dp/B0EUFYE340")) {
      return new Response('<span id="productTitle">eufy Security Video Doorbell E340 Battery Powered Dual Cameras</span><script type="application/ld+json">{"@type":"Product","brand":{"name":"eufy"},"model":"E340"}</script>', { status: 200 });
    }
    return new Response("", { status: 404 });
  };
  try {
    const result = await findExactProductCandidates({
      productName: "Anker eufy Security Video Doorbell E340 Battery Powered Dual Cameras",
      brand: "Anker",
      model: "E340",
      store: "Amazon.ca",
      searchQueries: ["site:amazon.ca eufy E340 Video Doorbell"],
      maxCandidates: 2,
      timeoutMs: 2500,
    });
    assert.ok(result.queries.some((query) => /E340/i.test(query)));
    assert.ok(requests.some((url) => /amazon\.ca\/s\?k=.*E340/i.test(decodeURIComponent(url))));
    assert.equal(result.candidates[0]?.url, "https://www.amazon.ca/dp/B0EUFYE340");
    assert.equal(result.candidates[0]?.identityFetched, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("native search parser accepts quoted and redirected Amazon product links", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.includes("bing.com/search")) {
      const target = encodeURIComponent("https://www.amazon.ca/shop/item/dp/B0REDIR001?tag=tracking");
      return new Response(`<a href='https://www.bing.com/redirect?url=${target}'>Eufy E340 Video Doorbell</a>`, { status: 200 });
    }
    if (value.includes("amazon.ca/dp/B0REDIR001")) {
      return new Response('<span id="productTitle">eufy Security Video Doorbell E340</span><script type="application/ld+json">{"@type":"Product","brand":{"name":"eufy"},"model":"E340"}</script>', { status: 200 });
    }
    return new Response("", { status: 404 });
  };
  try {
    const result = await findExactProductCandidates({
      productName: "eufy Security Video Doorbell E340",
      brand: "eufy",
      model: "E340",
      store: "Amazon.ca",
      searchQueries: ["site:amazon.ca E340 Video Doorbell"],
      maxCandidates: 2,
      timeoutMs: 2500,
    });
    assert.equal(result.candidates[0]?.url, "https://www.amazon.ca/dp/B0REDIR001");
    assert.equal(result.candidates[0]?.identityFetched, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("identity query construction cannot cross-contaminate products", () => {
  const products = [
    { brand: "Acme", productName: "Acme ZX900 Countertop Oven", store: "Amazon.ca" },
    { brand: "Northstar", productName: "Northstar Q5 Cordless Vacuum", store: "Amazon.com" },
    { brand: "Orion", productName: "Orion X200 Bluetooth Speaker", store: "Amazon.ca" },
  ];
  const identities = products.map((product) =>
    new Set(`${product.brand} ${product.productName}`.toLowerCase().split(/\s+/))
  );

  products.forEach((product, index) => {
    const queries = buildRetrievalQueries(product).join(" ").toLowerCase();
    identities.forEach((identity, otherIndex) => {
      if (index === otherIndex) return;
      for (const term of identity) {
        assert.equal(queries.includes(term), false, `${product.brand} query contains ${term} from product ${otherIndex}`);
      }
    });
  });
});

test("known Amazon ASINs generate direct review candidates", () => {
  assert.match(exactSearch, /buildDirectReviewCandidateUrls/);
  assert.match(exactSearch, /product-reviews\/\$\{asin\}\/\?reviewerType=all_reviews/);
  assert.match(exactSearch, /product-reviews\/\$\{asin\}\/\?sortBy=recent&reviewerType=all_reviews/);
  assert.match(exactSearch, /product-reviews\/\$\{asin\}\/\?filterByStar=critical&reviewerType=all_reviews/);
});

test("bounded identity discovery parses an Amazon.ca ASIN without asserting verification", () => {
  const prompt = buildIdentityRecoveryPrompt({
    brand: "ZZQ_TEST_BRAND_84721",
    productName: "ZZQ_TEST_PRODUCT_X9_59317",
    store: "Amazon.ca",
    price: 199.99,
    rating: 4.8,
    reviewCount: 50000,
  });
  const candidates = parseIdentityRecoveryCandidates(JSON.stringify({
    candidates: [{
      asin: "B0ZZQ84721",
      title: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
      store: "Amazon.ca",
      listingUrl: "https://www.amazon.ca/dp/B0ZZQ84721",
    }],
  }), "Amazon.ca");
  const verified = verifyProductCandidate({
    store: "Amazon.ca",
    brand: "ZZQ_TEST_BRAND_84721",
    productName: "ZZQ_TEST_PRODUCT_X9_59317",
    productKey: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
    rating: 4.8,
    reviewCount: 50000,
  }, candidates[0]);

  assert.match(prompt, /ZZQ_TEST_BRAND_84721/);
  assert.equal(candidates[0].url, "https://www.amazon.ca/dp/B0ZZQ84721");
  assert.equal(candidates[0].source, "openai-identity-discovery");
  assert.equal(verified.canCollectReviews, true);
  assert.equal(verified.canScoreProduct, true);
});

test("Amazon identity accepts harmless title drift and persists the canonical ASIN", () => {
  const job = {
    store: "Amazon.ca",
    brand: "Philips",
    productName: "Philips Premium Airfryer XXL Healthy Air Fryer, Digital Touchscreen, 2.75 lb Capacity, 4.4 QT, Black",
    productKey: "Philips Airfryer XXL 2.75 lb 4.4 QT Black",
    rating: 4.7,
    reviewCount: 3200,
  };
  const result = verifyProductCandidate(job, {
    url: "https://www.amazon.ca/dp/B0PHILIP01",
    title: "Philips Premium Airfryer XXL - Healthy Air Fryer with Digital Touchscreen, 2.75 pounds, 4.4 quarts, Black",
    rating: 4.3,
    reviewCount: 4100,
  });

  assert.equal(result.verifierStatus, "verified_exact_match");
  assert.equal(result.canCollectReviews, true);
  assert.equal(result.canonicalIdentifier, "B0PHILIP01");
  assert.equal(result.canonicalMarketplace, "amazon.ca");
});

test("Amazon identity rejects wrong size, model, and bundle variants", () => {
  const job = {
    store: "Amazon.ca",
    brand: "Philips",
    productName: "Philips Premium Airfryer XXL Healthy Air Fryer 2.75 lb 4.4 QT Black",
    productKey: "Philips Airfryer XXL 2.75 lb 4.4 QT Black",
  };
  const wrongSize = verifyProductCandidate(job, {
    url: "https://www.amazon.ca/dp/B0PHILIP02",
    title: "Philips Premium Airfryer XXL Healthy Air Fryer 1.5 lb 2.6 QT Black",
  });
  const wrongModel = verifyProductCandidate(job, {
    url: "https://www.amazon.ca/dp/B0PHILIP03",
    title: "Philips Essential Airfryer XL Healthy Air Fryer 2.75 lb 4.4 QT Black",
  });
  const wrongBundle = verifyProductCandidate(job, {
    url: "https://www.amazon.ca/dp/B0PHILIP04",
    title: "Philips Premium Airfryer XXL Healthy Air Fryer 2.75 lb 4.4 QT Black 2-piece bundle",
  });

  assert.equal(wrongSize.canCollectReviews, false);
  assert.equal(wrongModel.canCollectReviews, false);
  assert.equal(wrongBundle.canCollectReviews, false);
});

test("wrapped OpenAI identity output preserves every supported identity clue", () => {
  const wrappedOutput = [
    "Here are the discovered identities:",
    "```json",
    '{"candidates":[{"url":"https://www.amazon.ca/product-reviews/ZZQASIN010"},{"url":"https://www.amazon.ca/gp/aw/d/ZZQASIN011"}]}' ,
    "```",
    "Use the verifier before acceptance.",
  ].join("\n");
  const candidates = parseIdentityRecoveryCandidates(
    wrappedOutput,
    "Amazon.ca",
    5
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.url),
    [
      "https://www.amazon.ca/dp/ZZQASIN010",
      "https://www.amazon.ca/dp/ZZQASIN011",
    ]
  );
  assert.ok(candidates.every((candidate) => candidate.enrichmentAttempted !== true));
});

test("identity-bearing Amazon URL shapes normalize to unverified product candidates", () => {
  const urls = [
    "https://www.amazon.test/dp/ZZQASIN001?tag=tracking",
    "https://www.amazon.test/gp/product/ZZQASIN002?ref=search",
    "https://www.amazon.test/gp/aw/d/ZZQASIN003",
    "https://www.amazon.test/product-reviews/ZZQASIN004/?reviewerType=all_reviews",
  ];

  assert.deepEqual(
    urls.map((url) => normalizeProductCandidateUrl(url)),
    [
      "https://www.amazon.test/dp/ZZQASIN001",
      "https://www.amazon.test/dp/ZZQASIN002",
      "https://www.amazon.test/dp/ZZQASIN003",
      "https://www.amazon.test/dp/ZZQASIN004",
    ]
  );

  const candidates = parseIdentityCandidatesFromUrls(urls, "Amazon.test");
  assert.equal(candidates.length, 4);
  assert.equal(candidates[3].url, "https://www.amazon.test/dp/ZZQASIN004");
  assert.equal(candidates[3].title, null);
  assert.match(candidates[3].notes.join(" "), /identity-bearing URL/i);
});

test("search redirects unwrap only provable Amazon destinations", () => {
  const wrapped = "https://www.bing.com/redirect?url=" + encodeURIComponent(
    "https://www.amazon.test/product-reviews/ZZQASIN005?tag=tracking"
  );
  const candidates = parseIdentityCandidatesFromUrls([wrapped], "Amazon.test");
  assert.equal(candidates[0].url, "https://www.amazon.test/dp/ZZQASIN005");
  assert.deepEqual(parseIdentityCandidatesFromUrls([wrapped.replace("www.bing.com", "untrusted.test")], "Amazon.test"), []);
  assert.deepEqual(parseIdentityCandidatesFromUrls(["https://www.google.com/url?q=not-a-url"], "Amazon.test"), []);
});

test("review URL promotion remains discovery-only until fetched identity verification", () => {
  const candidates = parseIdentityCandidatesFromUrls(
    ["https://www.amazon.test/product-reviews/ZZQASIN009"],
    "Amazon.test",
    1,
    "openai-review-source-identity-discovery"
  );
  assert.equal(candidates[0].source, "openai-review-source-identity-discovery");

  const verifier = verifyProductCandidate({
    store: "Amazon.test",
    brand: "ZZQ_TEST_BRAND_84721",
    productName: "ZZQ_TEST_PRODUCT_X9_59317",
    productKey: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
  }, candidates[0]);

  assert.equal(verifier.canCollectReviews, false);
  assert.equal(verifier.canScoreProduct, false);
});

test("strong Amazon discovery metadata can launch Tier B review retrieval when page identity is unavailable", async () => {
  const previousFetch = globalThis.fetch;
  const previousFlag = process.env.REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED;
  const asin = "ZZQASIN009";
  const reviewBlocks = Array.from({ length: 6 }, (_, index) =>
    `<div data-hook="review"><span data-hook="review-body"><span>ZZQ_TEST_PRODUCT_X9_59317 review ${index} is reliable and useful for testing.</span></span><span data-hook="review-title">Review ${index}</span></div>`
  ).join("");

  process.env.REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED = "false";
  globalThis.fetch = async (input) => {
    const url = String(typeof input === "string" ? input : input?.url || input);
    const reviewLink = `/product-reviews/${asin}`;
    if (url.includes("/product-reviews/")) {
      return new Response(`<html>${reviewBlocks}</html>`, { status: 200 });
    }
    if (url.includes("/dp/")) {
      return new Response(
        `<html><title>ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317</title><a href="${reviewLink}">reviews</a><script type="application/ld+json">{"@type":"Product","name":"ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317","brand":{"name":"ZZQ_TEST_BRAND_84721"},"model":"ZZQ_MODEL_44192"}</script></html>`,
        { status: 200 }
      );
    }
    return new Response(
      `<html><a href="https://www.amazon.ca/product-reviews/${asin}">ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317</a></html>`,
      { status: 200 }
    );
  };

  try {
    const { POST } = jiti("./app/api/dev/reviewintel-diagnostic/route.ts");
    const response = await POST(new Request("http://localhost/api/dev/reviewintel-diagnostic", {
      method: "POST",
      body: JSON.stringify({
        productName: "ZZQ_TEST_PRODUCT_X9_59317", brand: "ZZQ_TEST_BRAND_84721",
        model: "ZZQ_MODEL_44192", store: "Amazon.ca", rating: 4.8,
        reviewCount: 50000, price: 199.99,
      }),
    }));
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.match(result.canonicalUrl || "", /amazon\.ca\/dp\//i);
    assert.equal(result.productVerified, true);
    assert.equal(result.nativeScraperStarted, true);
    assert.equal(result.acceptedExactProductReviews, 6);
    assert.equal(result.analysisReceivedAcceptedCorpus, true);
    assert.match(result.corpusHash, /^[a-f0-9]{64}$/);
    assert.equal(typeof result.buyScore, "number");
    assert.equal(result.finalEvaluationCompleted, true);
    assert.equal(result.cost.firecrawlCalls, 0);
    assert.ok(result.deterministicResult.strengths.every(claim => claim.sourceHashes.length > 0));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousFlag === undefined) delete process.env.REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED;
    else process.env.REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED = previousFlag;
  }
});

test("analyze reaches the single late-identity feedback loop", () => {
  assert.match(analyzeRoute, /collectAndAnalyzeReviewEvidence\(/);
  assert.match(reviewEvidence, /identitySourceUrls:/);
  assert.match(reviewEvidence, /parseIdentityCandidatesFromUrls\(/);
  assert.match(reviewEvidence, /promoteIdentityCandidatesFromUrls/);
  assert.match(reviewEvidence, /prepareCandidateForVerification\(/);
  assert.match(reviewEvidence, /collectWrittenReviewsFromListing\(/);
  assert.match(reviewEvidence, /adjudicateReviewEvidence\(/);
});


test("identity discovery candidate is still rejected when product identity is wrong", () => {
  const candidates = parseIdentityRecoveryCandidates(JSON.stringify({
    candidates: [{ asin: "B0ZZQ84722", title: "UNRELATED_UNKNOWN_PRODUCT", store: "Amazon.ca" }],
  }), "Amazon.ca");
  const result = verifyProductCandidate({
    store: "Amazon.ca",
    brand: "ZZQ_TEST_BRAND_84721",
    productName: "ZZQ_TEST_PRODUCT_X9_59317",
    productKey: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
  }, candidates[0]);

  assert.equal(result.canCollectReviews, false);
  assert.equal(result.canScoreProduct, false);
  assert.match(result.verifierStatus, /rejected|possible/);
});

test("known synthetic Amazon.ca ASIN produces same-origin review URLs", async () => {
  const urls = buildDirectReviewCandidateUrls("https://www.amazon.ca/dp/B0ALPH1234");
  assert.equal(urls[0], "https://www.amazon.ca/product-reviews/B0ALPH1234/?reviewerType=all_reviews");
  assert.equal(urls[1], "https://www.amazon.ca/product-reviews/B0ALPH1234/?sortBy=recent&reviewerType=all_reviews");

  const result = await findExactProductCandidates({
    productName: "TEST PRODUCT ALPHA",
    brand: "TEST BRAND",
    store: "Amazon.ca",
    listingUrl: "https://www.amazon.ca/product-reviews/B0ALPH1234",
  });
  assert.equal(result.candidates[0].url, "https://www.amazon.ca/dp/B0ALPH1234");
});

test("metadata-poor Amazon candidate is enriched before existing verification", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(`
    <span id="productTitle">ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192</span>
    <script type="application/ld+json">{"@type":"Product","brand":{"name":"ZZQ_TEST_BRAND_84721"},"model":"ZZQ_MODEL_44192"}</script>
  `, { status: 200, headers: { "content-type": "text/html" } });
  try {
    const job = {
      store: "Amazon.ca",
      brand: "ZZQ_TEST_BRAND_84721",
      model: "ZZQ_MODEL_44192",
      productName: "ZZQ_TEST_PRODUCT_X9_59317",
      productKey: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
    };
    const enriched = await enrichProductCandidate(job, {
      url: "https://www.amazon.ca/dp/B0ZZQ84721",
      title: "Amazon.ca",
      store: "Amazon.ca",
      domain: "amazon.ca",
    });
    const verified = verifyProductCandidate(job, enriched);
    assert.equal(enriched.enrichmentAttempted, true);
    assert.equal(enriched.enrichmentSucceeded, true);
    assert.equal(verified.canCollectReviews, true);
    assert.deepEqual(buildDirectReviewCandidateUrls(verified.verifiedListingUrl), [
      "https://www.amazon.ca/product-reviews/B0ZZQ84721/?reviewerType=all_reviews",
      "https://www.amazon.ca/product-reviews/B0ZZQ84721/?sortBy=recent&reviewerType=all_reviews",
      "https://www.amazon.ca/product-reviews/B0ZZQ84721/?filterByStar=critical&reviewerType=all_reviews",
      "https://www.amazon.ca/product-reviews/B0ZZQ84721/?pageNumber=2&reviewerType=all_reviews",
      "https://www.amazon.ca/product-reviews/B0ZZQ84721/?pageNumber=3&reviewerType=all_reviews",
      "https://www.amazon.ca/dp/B0ZZQ84721",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("wrong or unresolvable enriched Amazon candidates remain unverified", async () => {
  const originalFetch = globalThis.fetch;
  const job = {
    store: "Amazon.ca",
    brand: "ZZQ_TEST_BRAND_84721",
    productName: "ZZQ_TEST_PRODUCT_X9_59317",
    productKey: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
  };
  globalThis.fetch = async () => new Response(
    `<span id="productTitle">OTHER_TEST_BRAND_11111 OTHER_TEST_PRODUCT_Q2</span>`,
    { status: 200, headers: { "content-type": "text/html" } }
  );
  try {
    const wrong = await enrichProductCandidate(job, {
      url: "https://www.amazon.ca/dp/B0WRONG123",
      title: "Amazon.ca",
      store: "Amazon.ca",
      domain: "amazon.ca",
    });
    assert.equal(verifyProductCandidate(job, wrong).canCollectReviews, false);

    globalThis.fetch = async () => new Response("<html><title>Amazon.ca</title></html>", { status: 200 });
    const unresolved = await enrichProductCandidate(job, {
      url: "https://www.amazon.ca/dp/B0UNRES123",
      title: "Amazon.ca",
      store: "Amazon.ca",
      domain: "amazon.ca",
    });
    assert.equal(unresolved.enrichmentAttempted, true);
    assert.equal(unresolved.enrichmentSucceeded, false);
    assert.equal(verifyProductCandidate(job, unresolved).canCollectReviews, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("mutable aggregate mismatches trigger bounded identity fetches but never decide identity", async () => {
  const originalFetch = globalThis.fetch;
  const job = {
    scanId: "synthetic-scan",
    store: "Amazon.ca",
    brand: "ZZQ_TEST_BRAND_84721",
    model: "ZZQ_MODEL_44192",
    productName: "ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
    productKey: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
    rating: 4.8,
    reviewCount: 50000,
  };
  const candidate = {
    url: "https://www.amazon.ca/dp/B0ZZQ84721",
    title: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
    store: "Amazon.ca",
    domain: "amazon.ca",
    rating: 4.1,
    reviewCount: 10,
  };
  const fetchedTitle = "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192";
  globalThis.fetch = async () => new Response(
    `<span id="productTitle">${fetchedTitle}</span><script type="application/ld+json">{"@type":"Product","brand":{"name":"ZZQ_TEST_BRAND_84721"},"model":"ZZQ_MODEL_44192"}</script>`,
    { status: 200, headers: { "content-type": "text/html" } }
  );
  try {
    for (const mismatch of [
      { rating: 4.1, reviewCount: 50000 },
      { rating: 4.8, reviewCount: 10 },
      { rating: 4.1, reviewCount: 10 },
    ]) {
      const result = verifyProductCandidate(job, { ...candidate, ...mismatch });
      assert.equal(result.verifierStatus, "verified_exact_match");
      const enriched = await enrichProductCandidate(job, { ...candidate, ...mismatch }, 2200, true);
      const verified = verifyProductCandidate(job, enriched);
      assert.equal(enriched.enrichmentAttempted, true);
      assert.equal(enriched.identityFetched, true);
      assert.equal(verified.canCollectReviews, true);
      assert.equal(verified.canScoreProduct, true);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("plausible variant suspicion receives one fetched identity check before rejection", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  const job = {
    scanId: "synthetic-scan",
    store: "Amazon.ca",
    brand: "ZZQ_TEST_BRAND_84721",
    productName: "ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192 Blue",
    productKey: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192 Blue",
    color: "Blue",
    rating: 4.8,
    reviewCount: 50000,
  };
  const candidate = {
    url: "https://www.amazon.ca/dp/B0ZZQ84722",
    title: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192 Gray",
    store: "Amazon.ca",
    domain: "amazon.ca",
    rating: 4.8,
    reviewCount: 50000,
  };
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(
      `<span id="productTitle">ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192 Blue</span>`,
      { status: 200, headers: { "content-type": "text/html" } }
    );
  };
  try {
    assert.equal(verifyProductCandidate(job, candidate).verifierStatus, "rejected_wrong_variant");
    const prepared = await prepareCandidateForVerification(job, candidate, new Set());
    assert.equal(fetchCount, 1);
    assert.equal(prepared.identityFetched, true);
    assert.equal(verifyProductCandidate(job, prepared).verifierStatus, "verified_exact_match");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetched bundle identity remains rejected after bounded preparation", async () => {
  const originalFetch = globalThis.fetch;
  const job = {
    scanId: "synthetic-scan",
    store: "Amazon.ca",
    brand: "ZZQ_TEST_BRAND_84721",
    productName: "ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
    productKey: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
  };
  const candidate = {
    url: "https://www.amazon.ca/dp/B0ZZQ84723",
    title: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192 Kit",
    store: "Amazon.ca",
    domain: "amazon.ca",
  };
  globalThis.fetch = async () => new Response(
    `<span id="productTitle">ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192 Kit</span>`,
    { status: 200, headers: { "content-type": "text/html" } }
  );
  try {
    const prepared = await prepareCandidateForVerification(job, candidate, new Set());
    assert.equal(prepared.enrichmentAttempted, true);
    assert.equal(verifyProductCandidate(job, prepared).canCollectReviews, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetched wrong, bundle, ambiguous, and failed identities remain rejected", async () => {
  const originalFetch = globalThis.fetch;
  const job = {
    scanId: "synthetic-scan",
    store: "Amazon.ca",
    brand: "ZZQ_TEST_BRAND_84721",
    productName: "ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
    productKey: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
    rating: 4.8,
    reviewCount: 50000,
  };
  const base = {
    url: "https://www.amazon.ca/dp/B0ZZQ84721",
    title: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
    store: "Amazon.ca",
    domain: "amazon.ca",
    rating: 4.1,
    reviewCount: 10,
  };
  try {
    globalThis.fetch = async () => new Response(
      "<span id=\"productTitle\">UNRELATED_DEVICE_NOVA_777</span>",
      { status: 200 }
    );
    const wrong = await enrichProductCandidate(job, base, 2200, true);
    assert.equal(verifyProductCandidate(job, wrong).canCollectReviews, false);

    globalThis.fetch = async () => new Response(
      "<span id=\"productTitle\">ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192 Bundle Kit</span>",
      { status: 200 }
    );
    const bundle = await enrichProductCandidate(job, base, 2200, true);
    assert.equal(verifyProductCandidate(job, bundle).canCollectReviews, false);

    globalThis.fetch = async () => new Response("<html><title>Amazon.ca</title></html>", { status: 200 });
    const ambiguous = await enrichProductCandidate(job, base, 2200, true);
    assert.equal(ambiguous.identityFetched, false);
    assert.equal(verifyProductCandidate(job, ambiguous).canCollectReviews, true);

    globalThis.fetch = async () => new Response("", { status: 503 });
    const failed = await enrichProductCandidate(job, base, 2200, true);
    assert.equal(failed.enrichmentAttempted, true);
    assert.equal(failed.enrichmentSucceeded, false);
    assert.equal(verifyProductCandidate(job, failed).canCollectReviews, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("all identity sources share preparation and equivalent Amazon URLs fetch once", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  const job = {
    scanId: "synthetic-scan",
    store: "Amazon.ca",
    brand: "ZZQ_TEST_BRAND_84721",
    productName: "ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
    productKey: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
    rating: 4.8,
    reviewCount: 50000,
  };
  const candidate = {
    url: "https://www.amazon.ca/dp/B0ZZQ84721",
    title: "ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192",
    store: "Amazon.ca",
    domain: "amazon.ca",
    rating: 4.1,
    reviewCount: 10,
    source: "openai-identity-discovery",
  };
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(
      `<span id="productTitle">ZZQ_TEST_BRAND_84721 ZZQ_TEST_PRODUCT_X9_59317 ZZQ_MODEL_44192</span>`,
      { status: 200 }
    );
  };
  try {
    const attempted = new Set();
    const first = await prepareCandidateForVerification(job, candidate, attempted);
    const second = await prepareCandidateForVerification(job, {
      ...candidate,
      url: "https://www.amazon.ca/product-reviews/B0ZZQ84721/?reviewerType=all_reviews",
    }, attempted);
    assert.equal(first.identityFetched, true);
    assert.notEqual(Boolean(second.identityFetched), true);
    assert.equal(fetchCount, 1);
    assert.equal(attempted.size, 1);
    assert.match(reviewEvidence, /prepareCandidateForVerification\(/);
    assert.match(reviewEvidence, /bounded OpenAI identity recovery/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Amazon.ca identity remains on the same-origin direct review path", () => {
  assert.match(exactSearch, /const url = new URL\(canonical\)/);
  assert.match(exactSearch, /return asin \? `\$\{url\.origin\}\/dp\/\$\{asin\.toUpperCase\(\)\}`/);
  assert.match(nativeRetrieval, /buildDirectReviewCandidateUrls\(listingUrl\)/);
});

test("missing ASIN keeps bounded native and exact candidate discovery available", () => {
  assert.match(exactSearch, /retrieveProductUrls\(/);
  assert.match(exactSearch, /fetchFastProductUrlCandidates\(/);
  assert.match(exactSearch, /fetchAmazonSearchCandidates\(/);
  assert.match(nativeRetrieval, /buildNativeReviewSearchQueries/);
});

test("exact-agent failure does not disable later adaptive retrieval", () => {
  assert.match(reviewEvidence, /const exactProductAgent = await runExactProductAgent/);
  assert.match(reviewEvidence, /const webResearchEnabled = isOpenAiWebSearchEnabled\(\)/);
  assert.match(reviewEvidence, /runAdaptiveReviewResearch/);
  assert.match(reviewEvidence, /collectWrittenReviewsFromUrls/);
  assert.match(reviewEvidence, /discoverExactProductIdentityWithOpenAi/);
  assert.match(reviewEvidence, /bounded OpenAI identity recovery/);
  assert.match(reviewEvidence, /current product verification is still required/);
  assert.match(reviewEvidence, /canonical exact-product association is not yet established/);
});

test("adaptive recovery remains native-first and bounded", () => {
  assert.match(reviewEvidence, /runNativeReviewRetrieval\(/);
  assert.match(reviewEvidence, /maxCalls: 5/);
  assert.match(reviewEvidence, /stagnantPasses: 2/);
  assert.match(reviewEvidence, /const canonicalSufficiencyFor =/);
  assert.match(reviewEvidence, /if \(webResearchEnabled && !canonicalSufficiencyFor\(\)/);
  assert.match(reviewEvidence, /sufficient: \(records\) => canonicalSufficiencyFor\(records\)/);
  assert.match(reviewEvidence, /evidenceSatisfied: \(\) => canonicalSufficiencyFor\(\)/);
  assert.doesNotMatch(reviewEvidence, /if \(webResearchEnabled && collectedWrittenReviewCount\(\) < reliableSignalTarget/);
});

test("raw review volume cannot suppress unresolved or canonically insufficient recovery", () => {
  assert.match(reviewEvidence, /sufficientByExistingThreshold/);
  assert.match(reviewEvidence, /!canonicalSufficiencyFor\(\)/);
  assert.match(reviewEvidence, /exactListingAccepted,/);
});

test("recovered records still pass canonical adjudication", () => {
  assert.match(reviewEvidence, /let evidenceAdjudication = adjudicateReviewEvidence\(collectedWrittenReviews\.reviews/);
  assert.match(reviewEvidence, /evidenceAdjudication\.acceptedRecordCount/);
  assert.match(reviewEvidence, /evidenceAdjudication = adjudicateReviewEvidence\(collectedWrittenReviews\.reviews/);
});

test("insufficient serialized evidence cannot report accepted records", () => {
  assert.match(analyzeRoute, /acceptedRecords: \[\]/);
  assert.match(analyzeRoute, /acceptedRecordCount: 0/);
  assert.match(analyzeRoute, /sufficientByExistingThreshold: false/);
});

test("retrieval diagnostics distinguish searches, pages, and written evidence", () => {
  assert.match(nativeRetrieval, /candidateUrlsDiscovered/);
  assert.match(nativeRetrieval, /fetchedPageUrls/);
  assert.match(nativeRetrieval, /writtenReviewSources/);
  assert.match(reviewEvidence, /retrievalDiagnostics/);
});

test("analyze passes a supplied product URL into retrieval", () => {
  assert.match(analyzeRoute, /listingUrl: productLink \|\| null/);
});

test("normal analyze review acquisition is native-only", () => {
  assert.doesNotMatch(reviewEvidence, /firecrawl|runFirecrawl/i);
  assert.match(reviewEvidence, /runNativeReviewRetrieval\(/);
  assert.match(reviewEvidence, /exactListingAccepted && listingUrlForReviewCollector/);
  assert.match(reviewEvidence, /identitySourceUrls: \[\]/);
  assert.match(analyzeRoute, /collectAndAnalyzeReviewEvidence/);
});

test("native retrieval remains bounded and paginates candidate pages", () => {
  assert.match(nativeRetrieval, /buildDirectReviewCandidateUrls\(listingUrl\)/);
  assert.match(nativeRetrieval, /for \(const link of candidateLinks\) await collectPage\(link\)/);
  assert.match(nativeRetrieval, /paginationContinued/);
});

test("Firecrawl is disabled in scan telemetry and reservations", () => {
  const { ScanCostTelemetry, SCAN_COST_LIMITS } = jiti("./lib/scanCostTelemetry.ts");
  const { SCAN_BUDGET_LIMITS, scanBudgetLimitsFromEnv } = jiti("./lib/scanBudget.ts");
  const telemetry = new ScanCostTelemetry();
  assert.equal(SCAN_COST_LIMITS.maxFirecrawlCalls, 0);
  assert.equal(telemetry.canStartFirecrawlCall(), false);
  telemetry.recordFirecrawlCall(5, 5);
  const snapshot = telemetry.snapshot();
  assert.equal(snapshot.firecrawlCalls, 0);
  assert.equal(snapshot.firecrawlPages, 0);
  assert.equal(snapshot.firecrawlCreditsUsed, 0);
  for (const group of Object.values(SCAN_BUDGET_LIMITS)) {
    assert.equal(group.firecrawlCalls, 0);
    assert.equal(group.firecrawlPages, 0);
  }
  for (const group of Object.values(scanBudgetLimitsFromEnv())) {
    assert.equal(group.firecrawlCalls, 0);
    assert.equal(group.firecrawlPages, 0);
  }
});


test("supplied Amazon URL cannot verify itself using the requested product title", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; return new Response("Unavailable", { status: 503 }); };
  try {
    const result = await findExactProductCandidates({
      productName: "Unverified Test Product X900",
      store: "Amazon.ca",
      listingUrl: "https://www.amazon.ca/dp/B0UNVER001",
    });
    assert.ok(requests > 0);
    assert.notEqual(result.candidates[0]?.title, "Unverified Test Product X900");
    assert.equal(result.candidates[0]?.identityFetched, false);
  } finally { globalThis.fetch = originalFetch; }
});
