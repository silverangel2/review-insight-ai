import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const buying = jiti("./lib/buyingScore.ts");
const retrieval = jiti("./lib/productUrlRetrieval.ts");
const aggregate = jiti("./lib/marketplaceAggregate.ts");
const visibility = jiti("./lib/shopperResultVisibility.ts");
const quota = jiti("./lib/freeScanQuota.ts");
const shopper = jiti("./lib/shopperAnswer.ts");

const route = readFileSync(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");
const pageHtml = readFileSync(new URL("./fixtures/amazon-product-page.html", import.meta.url), "utf8");
const liveBodies = ["echo", "firetv", "airpods"].map((name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/live-scans/${name}.json`, import.meta.url), "utf8")),
);

function reviewBody(index) {
  return `This item did what I bought it for and I would mention that in review number ${index}.`;
}

test("live scan bodies stay on the results page and show a score", async () => {
  const ts = require("typescript");
  const uiJiti = require("jiti")(process.cwd(), {
    alias: { "@": process.cwd() },
    extensions: [".js", ".json", ".ts", ".tsx", ".mjs"],
    cache: false,
    requireCache: false,
    transform: ({ source }) => ({
      code: ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      }).outputText,
    }),
  });
  const { ShopperAnswerCard } = uiJiti("./components/ShopperAnswerCard.tsx");
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");

  for (const body of liveBodies) {
    assert.equal(visibility.isBuyingScoreV2Result(body), true);
    assert.equal(visibility.resultsPageHidesScan(body), false);
    const html = renderToStaticMarkup(React.createElement(ShopperAnswerCard, {
      result: body,
      productName: body.productName || "Product",
    }));
    assert.doesNotMatch(html, /That scan is not available/);
    assert.match(html, /Score/);
    assert.match(html, new RegExp(String(body.buyingScoreV2.score)));
  }

  const echo = liveBodies[0];
  assert.equal(echo.buyingScoreV2.audit.n >= 1, true);
  assert.equal(echo.buyingConfidence, 55);
  assert.equal(visibility.isImpossibleCachedShopperResult(echo), false);

  const firetv = liveBodies[1];
  assert.equal(firetv.buyingScoreV2.audit.n, 0);
  assert.equal(firetv.verdict, "BUY");
  assert.equal(visibility.isImpossibleCachedShopperResult(firetv), true);
  assert.equal(visibility.resultsPageHidesScan(firetv), false);
});

test("v2 BUY with written reviews stays visible; a firm BUY with n=0 is flagged but not hidden", () => {
  const visible = {
    analysisVersion: "review-evidence-v2",
    finalDecisionSource: "buyingScoreV2",
    verdict: "BUY",
    stableVerdict: "BUY",
    productScore: 90,
    buyingConfidence: 55,
    bottomLine: "mixed evidence does not justify a clear recommendation",
    buyingScoreV2: { version: "buying-score-v2", mode: "buying_score", score: 90, confidence: "Medium", verdict: "Buy", audit: { n: 7 } },
  };
  assert.equal(visibility.isImpossibleCachedShopperResult(visible), false);
  assert.equal(visibility.resultsPageHidesScan(visible), false);

  const flagged = {
    ...visible,
    buyingScoreV2: { ...visible.buyingScoreV2, mode: "buying_score", verdict: "Buy", audit: { n: 0 } },
  };
  assert.equal(visibility.isImpossibleCachedShopperResult(flagged), true);
  assert.equal(visibility.resultsPageHidesScan(flagged), false);

  const legacy = { verdict: "BUY", productScore: 40, buyingConfidence: 20, bottomLine: "Fine product." };
  assert.equal(visibility.isImpossibleCachedShopperResult(legacy), true);
  assert.equal(visibility.resultsPageHidesScan(legacy), true);
});

test("a strong marketplace rating with no written reviews is a clear BUY", () => {
  const card = buying.buyingScoreFromReviews({
    marketplace: { rating: 4.7, count: 270111, matchesExactModel: true },
    reviews: [],
  });
  const faced = buying.customerFacingDecision({ analyzedReviews: 0, buyingScore: card });
  assert.equal(faced.verdict, "BUY");
  assert.notEqual(faced.verdict, "AVOID");
  assert.equal(faced.buyingScore.mode, "provisional_marketplace");
  assert.equal(faced.buyingScore.verdict, "Buy");
  assert.equal(faced.buyingScore.confidence, "Medium");
  const line = buying.shopperBottomLineForBuyingScore(faced.buyingScore, faced.verdict);
  assert.match(line, /Based on 270,111 marketplace ratings averaging 4\.7★/);
  assert.doesNotMatch(line, /mixed signals|reviews read|does not justify|couldn.?t verify/i);
  assert.equal(buying.buyingConfidenceFromV2("High"), 80);
  assert.equal(buying.buyingConfidenceFromV2("Medium"), 65);
  assert.equal(buying.buyingConfidenceFromV2("Low"), 45);
});

test("analyze route aligns confidence and bottom line with the v2 decision", () => {
  const start = route.indexOf("const faced = customerFacingDecision");
  const end = route.indexOf("[ReviewIntel PIPELINE] exact-product-gate");
  const block = route.slice(start, end);
  assert.match(block, /buyingConfidenceFromV2\(faced\.buyingScore\.confidence\)/);
  assert.match(block, /buyingScoreV2 = wordingWhenListingAlreadySupplied\(faced\.buyingScore, listingWasSupplied\)/);
  assert.match(block, /shopperBottomLineForBuyingScore\(buyingScoreV2, faced\.verdict, store\)/);
  assert.match(route, /catch \{ \/\* a missing release function must not fail the scan \*\/ \}/);
});

test("a 200 Amazon page yields #productTitle and the main rating block on every Amazon domain", async () => {
  const saved = globalThis.fetch;
  const domains = ["amazon.com", "amazon.ca", "amazon.co.uk"];
  try {
    for (const domain of domains) {
      const html = pageHtml
        .replace("Everyday Glass Kettle", "Everyday Glass Kettle")
        .replaceAll("amazon.com", domain);
      const parsed = retrieval.extractProductEvidenceFromHtml(html, `https://www.${domain}/dp/B0GENERIC1`);
      assert.equal(parsed.title, "Everyday Glass Kettle", domain);
      assert.equal(parsed.rating, 4.6, domain);
      assert.equal(parsed.reviewCount, 12345, domain);
      assert.notEqual(parsed.reviewCount, 192);
      const direct = aggregate.extractMarketplaceAggregateFromHtml(html);
      assert.equal(direct.rating, 4.6);
      assert.equal(direct.count, 12345);

      const url = `https://www.${domain}/Some-Product/dp/B0GENERIC1/ref=sr_1_1`;
      globalThis.fetch = async () => {
        const response = new Response(html, { status: 200 });
        Object.defineProperty(response, "url", { value: url });
        return response;
      };
      const enriched = await retrieval.enrichRetrievedProductCandidate({
        url: `https://www.${domain}/dp/B0GENERIC1`,
        title: `https://www.${domain}/dp/B0GENERIC1`,
        notes: [],
      }, 2000);
      assert.equal(enriched.title, "Everyday Glass Kettle", domain);
      assert.equal(enriched.rating, 4.6, domain);
      assert.equal(enriched.reviewCount, 12345, domain);
    }
  } finally {
    globalThis.fetch = saved;
  }
});

test("varied v2 results are never hidden, and n=0 is BUY only in the clear band", () => {
  const categories = ["kettle", "novel", "stroller", "drill", "shampoo"];
  const domains = ["com", "ca", "co.uk"];
  const ratings = [2.5, 3.4, 4.1, 4.9];
  const counts = [0, 12, 49, 5000, 500000];
  const written = [0, 1, 8, 50];
  const levels = ["High", "Medium", "Low"];
  const reviews = Array.from({ length: 50 }, (_, index) => ({
    body: reviewBody(index),
    rating: 4,
    source: "Amazon",
    sourceUrl: "https://www.amazon.com/dp/B0GENERIC1",
  }));
  let seen = 0;
  categories.forEach((category, categoryIndex) => {
    const domain = domains[categoryIndex % domains.length];
    for (const rating of ratings) {
      for (const count of counts) {
        for (const n of written) {
          const card = buying.buyingScoreFromReviews({
            marketplace: { rating, count, matchesExactModel: true },
            reviews: reviews.slice(0, n),
          });
          const faced = buying.customerFacingDecision({ analyzedReviews: n, buyingScore: card });
          if (n === 0 || card.audit.n === 0) {
            const gate = buying.provisionalShopperFacing(card);
            if (gate?.firmBuy) assert.equal(faced.verdict, "BUY", `${category} ${rating} ${count}`);
            else assert.notEqual(faced.verdict, "BUY", `${category} ${rating} ${count}`);
            assert.notEqual(faced.verdict, "AVOID", `${category} ${rating} ${count}`);
          }
          const level = levels[seen % levels.length];
          const result = {
            analysisVersion: "review-evidence-v2",
            finalDecisionSource: "buyingScoreV2",
            verdict: faced.verdict,
            stableVerdict: faced.verdict,
            productScore: faced.buyScore,
            buyingConfidence: level === "High" ? 80 : level === "Medium" ? 65 : 45,
            bottomLine: "Accepted reviews were found, but mixed evidence does not justify a clear recommendation.",
            product: { name: category, url: `https://www.amazon.${domain}/dp/B0GENERIC1` },
            buyingScoreV2: { ...faced.buyingScore, confidence: level },
          };
          assert.equal(visibility.resultsPageHidesScan(result), false, `${category} n=${n} ${domain}`);
          if (result.verdict === "BUY" && result.buyingScoreV2.audit.n === 0) {
            assert.equal(visibility.isImpossibleCachedShopperResult(result), !buying.isClearProvisionalBuy(result.buyingScoreV2));
          } else {
            assert.equal(visibility.isImpossibleCachedShopperResult(result), false);
          }
          const answer = shopper.deriveShopperAnswer(result);
          if (result.buyingScoreV2.audit.n === 0) {
            const gate = buying.provisionalShopperFacing(faced.buyingScore, "Amazon");
            if (!gate) assert.notEqual(answer.label, "Buy");
            else if (gate.firmBuy) assert.equal(answer.label, "Buy");
            else if (gate.leaning === "Buy") assert.equal(answer.label, "Leaning Buy");
            else if (gate.leaning === "Skip") assert.equal(answer.label, "Skip");
            else assert.equal(answer.label, "Wait");
            if (gate) {
              assert.equal(answer.confidenceWords, gate.confidence);
              assert.doesNotMatch(`${answer.why} ${answer.trustLine}`, /mixed signals|reviews read|could not access enough|Low confidence/i);
            }
          } else {
            const expected = card.verdict === "Buy" ? "Buy" : card.verdict === "Skip" ? "Skip" : "Wait";
            assert.equal(answer.label, expected, `${category} n=${n} ${card.verdict}`);
            assert.equal(answer.confidenceWords, level);
            assert.equal(shopper.formatShopperConfidence(answer), level);
          }
          const answerText = `${answer.label} ${answer.why} ${answer.nextSteps.map((step) => `${step.label} ${step.detail}`).join(" ")}`;
          assert.doesNotMatch(answerText, /Scan the Amazon listing link/);
          seen += 1;
        }
      }
    }
  });
  assert.ok(seen > 100);
});

test("a v2 Buy is not rewritten by a legacy NOT_ENOUGH state", async () => {
  const cerave = JSON.parse(readFileSync(new URL("./fixtures/live-scans/cerave.json", import.meta.url), "utf8"));
  assert.equal(cerave.evidenceState, "NOT_ENOUGH");
  assert.equal(cerave.buyingScoreV2.verdict, "Buy");
  assert.equal(cerave.buyingScoreV2.audit.n >= 1, true);
  const answer = shopper.deriveShopperAnswer(cerave);
  assert.equal(answer.label, "Buy");
  assert.equal(answer.kind, "buy");
  assert.equal(answer.confidenceWords, "Medium");
  assert.equal(shopper.formatShopperConfidence(answer), "Medium");
  assert.equal(answer.score, 96);
  assert.equal(answer.why, "Buyers are mostly positive about this product.");
  assert.ok(answer.loves.some((point) => point.quote && point.quote.length > 20 && !answer.why.includes(point.quote.slice(0, 24))));
  assert.doesNotMatch(`${answer.label} ${answer.why} ${answer.nextSteps.map((step) => `${step.label} ${step.detail}`).join(" ")}`, /Scan the Amazon listing link/);
  assert.equal(answer.nextSteps.some((step) => step.id === "amazon_listing"), false);

  const wait = {
    ...cerave,
    evidenceState: "NOT_ENOUGH",
    verdict: "REVIEW FIRST",
    reviewEvidence: { commentsAnalyzed: 0, evidenceAdjudication: { acceptedRecords: [], acceptedRecordCount: 0 } },
    buyingScoreV2: { ...cerave.buyingScoreV2, verdict: "Wait", score: 61, confidence: "Low", audit: { ...cerave.buyingScoreV2.audit, n: 4 } },
  };
  const waiting = shopper.deriveShopperAnswer(wait);
  assert.equal(waiting.label, "Wait");
  assert.equal(waiting.kind, "wait");
  assert.doesNotMatch(waiting.why, /Scan the Amazon listing link/);

  const ts = require("typescript");
  const uiJiti = require("jiti")(process.cwd(), {
    alias: { "@": process.cwd() },
    extensions: [".js", ".json", ".ts", ".tsx", ".mjs"],
    cache: false,
    requireCache: false,
    transform: ({ source }) => ({
      code: ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      }).outputText,
    }),
  });
  const { ShopperAnswerCard } = uiJiti("./components/ShopperAnswerCard.tsx");
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const html = renderToStaticMarkup(React.createElement(ShopperAnswerCard, { result: cerave, productName: cerave.productName }));
  assert.match(html, />Buy</);
  assert.match(html, /data-testid="answer-confidence">Medium</);
  assert.doesNotMatch(html, /Scan the Amazon listing link/);
  assert.doesNotMatch(html, /Low confidence/);
});

test("a quote-only result keeps raw review text out of the summary", () => {
  const quotes = [
    "Got for my soon to be great niece's arrival!",
    "There comes a point in life when one's skin has apparently resigned from its previous occupation.",
    "I pack this in a work bag and it still works every morning.",
    "The hinge loosened after a month of ordinary use.",
    "Five stars from our household and I would buy another.",
    "Smells odd at first, then fades, and the color is not what the photo shows.",
  ];
  const verdicts = [
    { word: "Buy", top: "BUY", why: "Buyers are mostly positive about this product." },
    { word: "Wait", top: "REVIEW FIRST", why: "Buyer feedback is mixed or still limited." },
    { word: "Skip", top: "AVOID", why: "Buyers report enough problems to skip this." },
  ];
  let seen = 0;
  quotes.forEach((quote, index) => {
    const verdict = verdicts[index % verdicts.length];
    const records = quotes.slice(index, index + 3).map((body, recordIndex) => ({
      id: `r${recordIndex}`,
      body,
      sourceUrl: `https://www.amazon.${["com", "ca", "co.uk"][recordIndex % 3]}/dp/B0GENERIC1`,
    }));
    const result = {
      analysisVersion: "review-evidence-v2",
      finalDecisionSource: "buyingScoreV2",
      verdict: verdict.top,
      evidenceState: "NOT_ENOUGH",
      strengthProvenance: [],
      complaintProvenance: [],
      buyingScoreV2: {
        version: "buying-score-v2",
        mode: "buying_score",
        score: 64,
        verdict: verdict.word,
        confidence: "Medium",
        audit: { n: records.length },
      },
      reviewEvidence: { evidenceAdjudication: { acceptedRecords: records, acceptedRecordCount: records.length } },
    };
    const answer = shopper.deriveShopperAnswer(result);
    assert.equal(answer.label, verdict.word, quote);
    assert.equal(answer.why, verdict.why, quote);
    for (const record of records) {
      assert.equal(answer.why.includes(record.body.slice(0, 24)), false, record.body);
      assert.ok(answer.loves.some((point) => point.quote && record.body.startsWith(point.quote.replace(/…$/, ""))), record.body);
    }
    seen += 1;
  });

  const claimed = shopper.deriveShopperAnswer({
    finalDecisionSource: "buyingScoreV2",
    verdict: "BUY",
    buyingScoreV2: { version: "buying-score-v2", mode: "buying_score", score: 80, verdict: "Buy", confidence: "High", audit: { n: 4 } },
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
  assert.match(claimed.why, /stays cool in a bag/i);
  assert.match(claimed.why, /the lid leaks/i);
  assert.doesNotMatch(claimed.why, /niece|counter/i);
  assert.ok(claimed.loves.some((point) => /niece/.test(point.quote || "")));
  assert.ok(seen >= quotes.length);
});

test("a variant page keeps its title when the canonical ASIN is the parent", async () => {
  const variantHtml = readFileSync(new URL("./fixtures/amazon-variant-page.html", import.meta.url), "utf8");
  const saved = globalThis.fetch;
  globalThis.fetch = async () => {
    const response = new Response(variantHtml, { status: 200 });
    Object.defineProperty(response, "url", { value: "https://www.amazon.com/Travel-Size-Glass-Kettle/dp/B0VARIANT1/ref=twister" });
    return response;
  };
  try {
    const enriched = await retrieval.enrichRetrievedProductCandidate({
      url: "https://www.amazon.com/dp/B0VARIANT1",
      title: "https://www.amazon.com/dp/B0VARIANT1",
      domain: "www.amazon.com",
      source: "manual-pattern",
      query: "variant",
      notes: [],
    });
    assert.equal(enriched.title, "Travel Size Glass Kettle");
    assert.equal(enriched.rating, 4.4);
    assert.equal(enriched.reviewCount, 8888);
    assert.match(enriched.url, /B0VARIANT1/);
    assert.equal(enriched.enrichmentSucceeded, true);

    const wrong = variantHtml
      .replaceAll("B0VARIANT1", "B0OTHER111")
      .replaceAll("Travel Size Glass Kettle", "Other Kettle");
    globalThis.fetch = async () => {
      const response = new Response(wrong, { status: 200 });
      Object.defineProperty(response, "url", { value: "https://www.amazon.com/dp/B0VARIANT1" });
      return response;
    };
    const rejected = await retrieval.enrichRetrievedProductCandidate({
      url: "https://www.amazon.com/dp/B0VARIANT1",
      title: "https://www.amazon.com/dp/B0VARIANT1",
      domain: "www.amazon.com",
      source: "manual-pattern",
      query: "variant",
      notes: [],
    });
    assert.equal(rejected.enrichmentSucceeded, false);
    assert.notEqual(rejected.title, "Other Kettle");
  } finally {
    globalThis.fetch = saved;
  }
});

test("a missing release function does not throw or log", async () => {
  const previous = {
    mode: process.env.REVIEWINTEL_LOCAL_QUOTA_TEST_MODE,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseUrl: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  delete process.env.REVIEWINTEL_LOCAL_QUOTA_TEST_MODE;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-for-missing-release";
  const savedFetch = globalThis.fetch;
  const errors = [];
  const savedError = console.error;
  console.error = (...args) => { errors.push(args.join(" ")); };
  globalThis.fetch = async (url) => {
    if (String(url).includes("release_reviewintel_free_scan")) {
      return new Response(JSON.stringify({ code: "PGRST202", message: "Could not find the function public.release_reviewintel_free_scan" }), { status: 404 });
    }
    return savedFetch(url);
  };
  try {
    const released = await quota.releaseFreeScan({
      kind: "authenticated",
      identity: "shopper@example.com",
      scanId: "scan-missing-release",
    });
    assert.equal(released.code, "unavailable");
    assert.equal(errors.length, 0);
  } finally {
    console.error = savedError;
    globalThis.fetch = savedFetch;
    if (previous.mode === undefined) delete process.env.REVIEWINTEL_LOCAL_QUOTA_TEST_MODE;
    else process.env.REVIEWINTEL_LOCAL_QUOTA_TEST_MODE = previous.mode;
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous.supabaseUrl;
    if (previous.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.key;
  }
});

test("a strong rating with no written reviews renders Buy, Medium, and one rating sentence", () => {
  const ts = require("typescript");
  const { readFileSync } = require("node:fs");
  const { resolve } = require("node:path");
  const filename = resolve("components/ResultsClient.tsx");
  const source = readFileSync(filename, "utf8").replace('import "./results-stagger.css";', "") + "\nexport { ShopperProductDetail };\n";
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const uiJiti = require("jiti")(process.cwd(), {
    alias: { "@": process.cwd() },
    extensions: [".js", ".json", ".ts", ".tsx", ".mjs"],
    cache: false,
    requireCache: false,
    transform: ({ source: fileSource }) => ({
      code: ts.transpileModule(fileSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
    }),
  });
  const { ShopperProductDetail } = uiJiti.evalModule(compiled, { filename, ext: ".js" });
  const { ShopperAnswerCard } = uiJiti("./components/ShopperAnswerCard.tsx");
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const card = buying.buyingScoreFromReviews({
    marketplace: { rating: 4.6, count: 46944, matchesExactModel: true },
    reviews: [],
  });
  const faced = buying.customerFacingDecision({ analyzedReviews: 0, buyingScore: card });
  const result = {
    analysisVersion: "review-evidence-v2",
    finalDecisionSource: "buyingScoreV2",
    verdict: faced.verdict,
    stableVerdict: faced.verdict,
    buyScore: faced.buyScore,
    productScore: faced.buyScore,
    buyingConfidence: 65,
    confidence: "Low",
    bottomLine: "ReviewIntel could not access enough public review evidence for this product.",
    product: { name: "AirPods Pro 2", store: "Amazon", rating: "4.6", reviewCount: "46944" },
    reviewEvidence: { commentsAnalyzed: 0, listingEvidence: { rating: 4.6, reviewCount: 46944, store: "Amazon", exactListingUrl: "https://www.amazon.com/dp/B0D1XD1ZV3" } },
    buyingScoreV2: { ...card, confidence: "Low", verdict: null, leaning: "Buy" },
    researchQuality: { evidenceLevel: "limited", notes: [] },
    meta: { audience: "buyer", locale: "en" },
    topStrengths: [],
    topComplaints: [],
  };
  const html = renderToStaticMarkup(React.createElement(ShopperProductDetail, { result, preview: "" }));
  assert.match(html, /Based on 46,944 Amazon ratings averaging 4\.6★/);
  assert.match(html, />Buy</);
  assert.match(html, /Medium/);
  assert.doesNotMatch(html, /mixed signals|No clear strengths|No repeated praise|could not access enough|Low confidence|LEANING BUY/i);
  const answerHtml = renderToStaticMarkup(React.createElement(ShopperAnswerCard, { result, productName: "AirPods Pro 2" }));
  assert.match(answerHtml, /Based on 46,944 Amazon ratings averaging 4\.6★/);
  assert.match(answerHtml, />Buy</);
  assert.match(answerHtml, /Medium/);
  assert.doesNotMatch(answerHtml, /mixed signals|No repeated praise|could not access enough|Low confidence|reviews read/i);
});
