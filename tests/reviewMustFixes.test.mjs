import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const shopper = jiti("./lib/shopperAnswer.ts");
const retrieval = jiti("./lib/productUrlRetrieval.ts");
const aggregate = jiti("./lib/marketplaceAggregate.ts");
const access = jiti("./lib/scanAccess.ts");
const ownership = jiti("./lib/scanOwnership.ts");
const progress = jiti("./lib/scanProgress.ts");
const email = jiti("./lib/lifecycleEmail.ts");

const ASIN = "B0D1XD1ZV3";
const LINK = `https://www.amazon.com/dp/${ASIN}`;

const WIDGET_BEFORE_REAL = `
<html><head><title>Echo Dot (5th Gen)</title></head><body>
  <div id="comparison-widget" class="sponsored">Similar item <span>192 reviews</span></div>
  <div id="sims-sims">Customers who viewed this also viewed 192 reviews</div>
  <span id="productTitle">Echo Dot (5th Gen, 2022 release)</span>
  <span id="acrPopover" title="4.7 out of 5 stars">4.7 out of 5 stars</span>
  <span id="acrCustomerReviewText">200,849 ratings</span>
</body></html>`;

function blankPageResult() {
  return {
    product: { title: `Amazon ${ASIN}`, name: `Amazon ${ASIN}`, url: LINK },
    productName: `Amazon ${ASIN}`,
    exactListingUrl: LINK,
    buyScore: null,
    verdict: "REVIEW FIRST",
    reviewEvidence: {
      commentsAnalyzed: 0,
      listingEvidence: { exactListingUrl: LINK, exactListingTitle: "Robot Check", reviewCount: null },
    },
  };
}

test("buying score renders out of 100, not out of 10", async () => {
  const result = {
    verdict: "BUY",
    buyScore: 84,
    score: 84,
    evidenceState: "SUFFICIENT",
    reviewEvidence: {
      commentsAnalyzed: 4,
      evidenceAdjudication: {
        acceptedRecords: [
          { body: "Battery lasts all day and the sound is clear enough.", sourceUrl: LINK },
        ],
      },
    },
  };
  const answer = shopper.deriveShopperAnswer(result);
  assert.equal(answer.score, 84);
  assert.equal(answer.unreadable, false);

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
  const html = renderToStaticMarkup(React.createElement(ShopperAnswerCard, { result, productName: "Echo Dot" }));
  assert.match(html, />84</);
  assert.match(html, /\/ 100</);
  assert.doesNotMatch(html, /\/ 10(?!\d)|Score [^<]*\/10/);

  const rendered = [
    "components/ShopperAnswerCard.tsx",
    "components/VerdictSummaryCard.tsx",
    "components/ResultsClient.tsx",
    "app/v/[token]/page.tsx",
    "app/v/[token]/opengraph-image.tsx",
    "app/compare/side-by-side/page.tsx",
    "app/guides/[slug]/page.tsx",
    "lib/betterPicks.ts",
    "lib/emailTemplate.ts",
    "lib/lifecycleEmail.ts",
  ];
  for (const file of rendered) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\/ 10(?!\d)|\/10`|toFixed\(1\)\} ?\/ ?10/, file);
  }
});

test("marketplace count comes from the main rating block, not a comparison widget", () => {
  const evidence = retrieval.extractProductEvidenceFromHtml(WIDGET_BEFORE_REAL, LINK);
  assert.equal(evidence.reviewCount, 200849);
  assert.equal(evidence.rating, 4.7);
  assert.notEqual(evidence.reviewCount, 192);

  const widgetOnly = `
    <html><body>
      <div class="sponsored-comparison">192 reviews</div>
      <div data-hook="comparison">Customers also viewed this. 192 reviews</div>
    </body></html>`;
  const onlyWidget = retrieval.extractProductEvidenceFromHtml(widgetOnly, LINK);
  assert.equal(onlyWidget.reviewCount, null);

  assert.equal(aggregate.marketplaceCountForCollection(200849, 192), 200849);
  assert.equal(aggregate.marketplaceCountForCollection(null, 200849), 200849);
  const collector = readFileSync(new URL("../lib/reviewCollector.ts", import.meta.url), "utf8");
  assert.match(collector, /marketplaceCountForCollection\(marketplaceAggregate\.count/);
  const evidenceRoute = readFileSync(new URL("../lib/reviewEvidence.ts", import.meta.url), "utf8");
  assert.match(evidenceRoute, /collectedWrittenReviews\.marketplaceAggregate\?\.count/);
});

test("an unreadable Amazon page asks to retry and never mentions zero reviews or the ASIN", async () => {
  const result = blankPageResult();
  assert.equal(shopper.neutralProductLabel(`Amazon ${ASIN}`), "Amazon product");
  assert.equal(shopper.isUnreadableAmazonPage(result), true);
  const answer = shopper.deriveShopperAnswer(result);
  assert.equal(answer.unreadable, true);
  assert.equal(answer.why, "We couldn't read this Amazon page right now.");
  assert.ok(answer.nextSteps.some((step) => step.id === "retry" && /try again/i.test(step.label)));
  assert.ok(answer.nextSteps.some((step) => /screenshot of the product page/i.test(step.detail)));
  const visible = `${answer.label} ${answer.why} ${answer.trustLine} ${answer.nextSteps.map((step) => `${step.label} ${step.detail}`).join(" ")}`;
  assert.match(visible, /Please try again in a moment/);
  assert.doesNotMatch(visible, /Retrying is free/);
  assert.doesNotMatch(visible, /0 real reviews|Scan the Amazon listing/i);
  assert.doesNotMatch(visible, new RegExp(`Amazon ${ASIN}`));
  assert.match(answer.nextSteps.find((step) => step.id === "retry").href, new RegExp(ASIN));
  const releasedAnswer = shopper.deriveShopperAnswer({ ...result, quota: { code: "released" } });
  assert.match(`${releasedAnswer.trustLine} ${releasedAnswer.nextSteps.map((step) => step.detail).join(" ")}`, /Retrying is free/);

  const named = {
    ...result,
    product: { title: "Echo Dot (5th Gen)", name: "Echo Dot (5th Gen)", url: LINK },
    productName: "Echo Dot (5th Gen)",
    reviewEvidence: { commentsAnalyzed: 0, listingEvidence: { exactListingUrl: LINK, exactListingTitle: "Echo Dot (5th Gen)", reviewCount: null, rating: null } },
  };
  assert.equal(shopper.isUnreadableAmazonPage(named), true, "a guessed title is not proof the Amazon page was read");
  const rated = { ...named, product: { ...named.product, rating: "4.7/5", reviewCount: "200,849" } };
  assert.equal(shopper.isUnreadableAmazonPage(rated), false, "a marketplace rating means the listing was read");

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
  const html = renderToStaticMarkup(React.createElement(ShopperAnswerCard, { result, productName: `Amazon ${ASIN}` }));
  assert.match(html, /We couldn(?:'|&#x27;)t read this Amazon page right now/);
  assert.match(html, /Please try again in a moment/);
  assert.doesNotMatch(html, /Retrying is free/);
  assert.match(html, /Try again/);
  assert.match(html, /screenshot of the product page/i);
  assert.doesNotMatch(html, /0 real reviews|Scan the Amazon listing/i);
  assert.doesNotMatch(html.replace(/href="[^"]*"/g, ""), new RegExp(ASIN));

  const namedHtml = renderToStaticMarkup(React.createElement(ShopperAnswerCard, { result: named, productName: "Echo Dot (5th Gen)" }));
  assert.match(namedHtml, /data-testid="unreadable-amazon-page"/);
  assert.match(namedHtml, /We couldn(?:'|&#x27;)t read this Amazon page right now/);
  assert.match(namedHtml, /Please try again in a moment/);
  assert.doesNotMatch(namedHtml, /Retrying is free/);
  assert.doesNotMatch(namedHtml, /0 real reviews|real reviews analyzed|Based on|Scan the Amazon listing|Low · 0/);

  const high = {
    verdict: "BUY",
    buyScore: 84,
    verdictConfidence: 65,
    buyerConfidence: 65,
    evidenceState: "SUFFICIENT",
    buyingScoreV2: { version: "buying-score-v2", mode: "buying_score", confidence: "High", score: 84 },
    product: { title: "Echo Dot (5th Gen)", url: LINK, rating: "4.7/5", reviewCount: "200849" },
    reviewEvidence: {
      commentsAnalyzed: 4,
      listingEvidence: { exactListingUrl: LINK, rating: 4.7, reviewCount: 200849 },
      evidenceAdjudication: { acceptedRecords: [{ body: "Battery lasts all day and the sound is clear enough.", sourceUrl: LINK }] },
    },
  };
  const highAnswer = shopper.deriveShopperAnswer(high);
  assert.equal(highAnswer.confidenceWords, "High");
  assert.equal(highAnswer.confidenceFromV2, true);
  assert.equal(shopper.formatShopperConfidence(highAnswer), "High");
  const highHtml = renderToStaticMarkup(React.createElement(ShopperAnswerCard, { result: high, productName: "Echo Dot" }));
  assert.match(highHtml, /data-testid="answer-confidence">High</);
  assert.doesNotMatch(highHtml, /65%|Medium/);

  assert.equal(email.cleanProductLabel(`Amazon ${ASIN}`), "Amazon product");
  const results = readFileSync(new URL("../components/ResultsClient.tsx", import.meta.url), "utf8");
  assert.match(results, /UNREADABLE_AMAZON_MESSAGE/);
  assert.match(results, /unreadableRetryPhrase/);
  assert.match(results, /neutralProductLabel/);
});

test("scan access refuses without a secret and validates the HMAC token", () => {
  const source = readFileSync(new URL("../lib/scanAccess.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /reviewintel-dev-scan-access/);
  const saved = {
    scan: process.env.REVIEWINTEL_SCAN_ACCESS_SECRET,
    session: process.env.REVIEWINTEL_SESSION_SECRET,
    next: process.env.NEXTAUTH_SECRET,
    role: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  try {
    delete process.env.REVIEWINTEL_SCAN_ACCESS_SECRET;
    delete process.env.REVIEWINTEL_SESSION_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(access.scanAccessToken("scan_no_secret"), "");
    assert.equal(access.cookieGrantsScan("scan_no_secret.aaaaaaaa", "scan_no_secret"), false);
    assert.equal(ownership.signedOutOwnsScan("scan_no_secret", { scanToken: "a-long-token-value" }), false);

    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-fallback-secret";
    const scanId = "scan_service_role";
    const token = access.scanAccessToken(scanId);
    assert.ok(token.length >= 8);
    assert.equal(ownership.signedOutOwnsScan(scanId, { scanToken: token }), true);
    assert.equal(ownership.signedOutOwnsScan(scanId, { scanToken: "a-long-token-value" }), false);
  } finally {
    for (const [key, value] of Object.entries({
      REVIEWINTEL_SCAN_ACCESS_SECRET: saved.scan,
      REVIEWINTEL_SESSION_SECRET: saved.session,
      NEXTAUTH_SECRET: saved.next,
      SUPABASE_SERVICE_ROLE_KEY: saved.role,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("a missing progress table is detected once and later writes are skipped", async () => {
  progress.resetProgressTableProbeForTests();
  assert.equal(progress.progressTableWritesDisabled(), false);
  progress.observeProgressTableResponse(500, "upstream timeout");
  assert.equal(progress.progressTableWritesDisabled(), false);
  progress.observeProgressTableResponse(404, '{"code":"PGRST205","message":"Could not find the table public.reviewintel_scan_progress in the schema cache"}');
  assert.equal(progress.progressTableWritesDisabled(), true);

  const saved = {
    pub: process.env.NEXT_PUBLIC_SUPABASE_URL,
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('{"code":"PGRST205","message":"Could not find the table"}', { status: 404 });
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://progress-table.example";
  process.env.SUPABASE_URL = "https://progress-table.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role";
  try {
    const missed = await progress.readScanProgress("scan_not_in_memory_missing_table");
    assert.equal(missed, null);
    assert.equal(calls, 0, "cached missing table skips the read");

    progress.resetProgressTableProbeForTests();
    calls = 0;
    await progress.runWithScanProgress("scan_table_missing_once", async () => {
      progress.noteScanProgressEvent("identity", { productName: "Echo Dot" });
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.ok(calls >= 1);
    assert.equal(progress.progressTableWritesDisabled(), true);
    const after = calls;
    await progress.runWithScanProgress("scan_table_missing_again", async () => {});
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(calls, after, "later progress writes are skipped");
  } finally {
    globalThis.fetch = originalFetch;
    progress.resetProgressTableProbeForTests();
    for (const [key, value] of Object.entries({
      NEXT_PUBLIC_SUPABASE_URL: saved.pub,
      SUPABASE_URL: saved.url,
      SUPABASE_SERVICE_ROLE_KEY: saved.key,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
