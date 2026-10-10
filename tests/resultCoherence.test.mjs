import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { installOfflineGuard } from "../scripts/reviewintel-offline-guard.mjs";
import { auditRingConnCapture, loadResultAuditFunctions } from "../scripts/reviewintel-result-audit.mjs";
installOfflineGuard();
const require = createRequire(import.meta.url);
const jiti = require("jiti")(process.cwd(), { alias: { "@": process.cwd() }, cache: false });
const { adjudicateReviewEvidence } = jiti("./lib/reviewEvidenceAdjudication.ts");
const { deriveDeterministicEvidenceResult } = jiti("./lib/reviewEvidenceDeterminism.ts");
const { buildReviewEvidenceShopperResult, computeVerdictConfidenceAudit } = loadResultAuditFunctions();
const fixture = JSON.parse(readFileSync("tests/fixtures/reviewintel/ringconn-existing-capture-inputs.json"));
const options = fixture.adjudicationArgs[1];
const corpusFor = bodies => adjudicateReviewEvidence(bodies.map((body, i) => ({ body: `${body} Experience number ${i}.`, sourceUrl: options.exactListingUrl })), options);
const evaluate = bodies => deriveDeterministicEvidenceResult({ ...fixture.evaluationMetadata, acceptedRecords: corpusFor(bodies).acceptedRecords });
const neutralValue = Array.from({ length: 5 }, (_, i) => `My ring is comfortable and works well every day ${i}.`);

test("value labels need recurring explicit value evidence; isolated praise remains an observation", () => {
  const single = evaluate([...neutralValue, "My ring is good value for the money."]);
  assert.equal(single.valueForMoney, "Unknown");
  assert.equal(single.strengths.find(c => c.claim === "good value for the price").supportCount, 1);
  assert.equal(evaluate([...neutralValue, "My ring is good value.", "My ring is worth the money."]).valueForMoney, "Good");
  assert.equal(evaluate([...neutralValue, "My ring is overpriced."]).valueForMoney, "Unknown");
  assert.equal(evaluate([...neutralValue, "My ring is overpriced.", "My ring is a waste of money."]).valueForMoney, "Poor");
  assert.equal(evaluate([...neutralValue, "My ring is good value.", "My ring is worth the money.", "My ring is overpriced."]).valueForMoney, "Fair");
  assert.equal(evaluate([...neutralValue, "My ring has a good price and is affordable.", "My ring is expensive but works well."]).valueForMoney, "Unknown");
  const corpus = corpusFor(neutralValue);
  for (const rating of [null, 1, 5]) for (const price of [null, 1, 9999]) {
    assert.equal(deriveDeterministicEvidenceResult({ acceptedRecords: corpus.acceptedRecords, exactProductAccepted: true, rating, price, marketplaceReviewCount: 100000 }).valueForMoney, "Unknown");
  }
});

test("specific battery claims absorb redundant generic failures but preserve other failure evidence", () => {
  const specific = evaluate([...neutralValue, "My ring battery failed.", "My ring battery died."]);
  assert.equal(specific.complaints.find(c => c.claim === "battery failure or charge retention problems").supportCount, 2);
  assert.ok(!specific.complaints.some(c => c.claim === "reliability or failure problems"));
  const distinct = evaluate([...neutralValue, "My ring battery failed.", "My ring battery died.", "My ring sensor broke."]);
  assert.equal(distinct.complaints.find(c => c.claim === "reliability or failure problems").supportCount, 3);
});

const capturePath = "/private/tmp/reviewintel-replay-captures/scan_b5c835b5-e0d7-4f51-b61c-c08d7b619a4b.json";
test("requested RingConn capture reaches a coherent current route result", { skip: !existsSync(capturePath) && "Local capture unavailable; portable fixture tests still run" }, () => {
  const report = auditRingConnCapture(capturePath);
  const result = report.result;
  assert.equal(result.scanId, "scan_b5c835b5-e0d7-4f51-b61c-c08d7b619a4b");
  assert.equal(result.meta.scanId, result.scanId);
  assert.equal(result.commentsAnalyzed, 7);
  assert.equal(result.marketplaceReviewCount, 1048);
  assert.equal(result.sourceDiversity, 1);
  assert.equal(result.buyScore, 6.1);
  assert.equal(result.verdict, "DO NOT BUY YET");
  assert.equal(result.valueForMoney, "Unknown");
  assert.equal(result.evidenceState, "SUFFICIENT");
  assert.equal(result.canonicalEvidenceEligible, true);
  assert.equal(result.exactListingAccepted, true);
  assert.equal(result.finalDecisionSource, "deterministicAcceptedReviewCorpus");
  for (const key of ["verdictConfidence", "buyerConfidence", "buyingConfidence", "confidence"]) assert.equal(result[key], 55);
  assert.match(result.bottomLine, /7 accepted written reviews from 1 source domain/);
  assert.equal(result.complaintProvenance.length, 2);
  assert.equal(result.complaintProvenance.find(c => c.claim === "unanswered customer support").supportCount, 1);
  assert.deepEqual(result.acceptedReviewHashes, report.deterministic.acceptedReviewHashes);
  assert.equal(result.finalResultHash, report.deterministic.finalResultHash);
  // Inflated summary and collector counters cannot replace accepted review count.
  const inflated = structuredClone(report.input);
  inflated.reviewEvidence.commentsAnalyzed = 1048;
  inflated.reviewEvidence.reviewsCollected = 1048;
  inflated.reviewEvidence.productPros = Array.from({length: 100}, () => "great product");
  const checked = buildReviewEvidenceShopperResult(inflated);
  assert.equal(checked.commentsAnalyzed, 7);
  assert.equal(checked.confidence, 55);
  assert.equal(checked.verdictConfidenceAudit.commentsAnalyzed, 7);
  assert.equal(checked.verdictConfidenceAudit.prosConsScore, result.verdictConfidenceAudit.prosConsScore);
  // Adjudication count sufficiency is not semantic sufficiency.
  const unsupported = structuredClone(report.input);
  unsupported.reviewEvidence.evidenceAdjudication = corpusFor(Array.from({length: 6}, (_, i) => `这是一段真实用户评论，使用体验需要进一步分析 ${i}`));
  const unknown = buildReviewEvidenceShopperResult(unsupported);
  assert.equal(unknown.buyScore, null);
  assert.equal(unknown.confidence, null);
  assert.equal(unknown.valueForMoney, "Unknown");
  assert.equal(unknown.canonicalEvidenceEligible, false);
  assert.deepEqual(unknown.strengths, []);
  const rejected = structuredClone(report.input);
  rejected.reviewEvidence.exactListingAccepted = false;
  rejected.reviewEvidence.evidenceAdjudication = adjudicateReviewEvidence(...[report.input.reviewEvidence.evidenceAdjudication.acceptedRecords.map(record => record.original), { ...options, exactListingAccepted: false }]);
  const unverified = buildReviewEvidenceShopperResult(rejected);
  assert.equal(unverified.commentsAnalyzed, 0);
  assert.equal(unverified.confidence, null);
  assert.equal(unverified.buyScore, null);
  assert.deepEqual(unverified.strengths, []);
  assert.equal(unknown.reviewEvidence.commentsAnalyzed, unknown.commentsAnalyzed);
  assert.equal(unknown.reviewEvidence.evidenceAdjudication.acceptedRecordCount, unknown.commentsAnalyzed);
  assert.equal(unknown.reviewEvidence.evidenceAdjudication.rejectedRecords.length, unsupported.reviewEvidence.evidenceAdjudication.rejectedRecords.length);
});

test("source diversity limits confidence separately from review count", () => {
  const input = { exactListingUrl: options.exactListingUrl, exactListingConfirmed: "high", collectorSourceAccepted: true, screenshotTitle: "RingConn Gen 2 Air", listingTitle: "RingConn Gen 2 Air", screenshotStore: "Amazon.ca", listingStore: "Amazon.ca", rating: 4.1, marketplaceReviewCount: 30, commentsAnalyzed: 30, productProsCount: 4, productConsCount: 2, buyScore: 6.1, verdict: "DO NOT BUY YET", finalDecisionSource: "deterministicAcceptedReviewCorpus" };
  assert.equal(computeVerdictConfidenceAudit({...input, independentSourceCount: 1}).verdictConfidence, 65);
  assert.equal(computeVerdictConfidenceAudit({...input, independentSourceCount: 2}).verdictConfidence, 75);
  assert.equal(computeVerdictConfidenceAudit({...input, independentSourceCount: 3}).verdictConfidence, 100);
});

test("listing collector does not spend the remaining corpus allowance on duplicate pages", async () => {
  const { collectWrittenReviewsFromListing } = jiti("./lib/reviewCollector.ts");
  const originalFetch = globalThis.fetch;
  const page = start => `<title>RingConn Gen 2 Air</title><script type="application/ld+json">${JSON.stringify({"@type":"Product",name:"RingConn Gen 2 Air",review:Array.from({length:5},(_,i)=>({"@type":"Review",reviewBody:`My ring is comfortable and works well in my daily experience number ${start+i}.`}))})}</script>`;
  const requested = [];
  globalThis.fetch = async url => { requested.push(String(url)); return new Response(page(String(url).includes("sortBy=recent") ? 5 : 0)); };
  try {
    const result = await collectWrittenReviewsFromListing({listingUrl:options.exactListingUrl,productName:options.productName,maxReviews:10});
    assert.equal(result.reviewsCollected, 10);
    assert.ok(requested.some(url => url.includes("sortBy=recent")));
  } finally { globalThis.fetch = originalFetch; }
});

test("actual shopper UI renders canonical values, review counts, and one-off claims on both layouts", () => {
  const ts = require("typescript");
  const filename = resolve("components/ResultsClient.tsx");
  const source = readFileSync(filename, "utf8").replace('import "./results-stagger.css";', '') + "\nexport { ShopperProductDetail };\n";
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const uiJiti = require("jiti")(process.cwd(), {
    alias: { "@": process.cwd() }, extensions: [".js", ".json", ".ts", ".tsx", ".mjs"],
    cache: false, requireCache: false,
    transform: ({ source }) => ({ code: ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText }),
  });
  const { ShopperProductDetail } = uiJiti.evalModule(compiled, { filename, ext: ".js" });
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const corpus = adjudicateReviewEvidence(...fixture.adjudicationArgs);
  const deterministic = deriveDeterministicEvidenceResult({...fixture.evaluationMetadata, acceptedRecords:corpus.acceptedRecords});
  const result = { ...deterministic, verdict: deterministic.customerVerdict, buyScore:6.1, productScore:6.1, verdictConfidence:55, valueForMoney:"Poor", sourceDiversity:1,
    topStrengths:deterministic.strengths.map(c=>c.claim),topComplaints:deterministic.complaints.map(c=>c.claim),
    strengthProvenance:deterministic.strengths,complaintProvenance:deterministic.complaints,
    product:{name:"RingConn Gen 2 Air",store:"Amazon.ca",reviewCount:"1048"},
    reviewEvidence:{evidenceAdjudication:corpus,commentsAnalyzed:7,listingEvidence:{exactListingUrl:options.exactListingUrl,reviewCount:1048}},
    researchQuality:{evidenceLevel:"verified",notes:[]},meta:{audience:"buyer",locale:"en"},
  };
  const html = renderToStaticMarkup(React.createElement(ShopperProductDetail,{result,preview:""}));
  assert.equal((html.match(/55%/g)||[]).length, 2);
  assert.equal((html.match(/>Poor</g)||[]).length, 2, "Backend Poor must not become Fair");
  assert.equal((html.match(/7 exact-product written reviews were analyzed from 1 source domain/g)||[]).length, 2);
  assert.equal((html.match(/unanswered customer support \(1 written review; one-off report\)/g)||[]).length, 2);
  assert.equal((html.match(/good value for the price \(1 written review; one-off report\)/g)||[]).length, 2);
  assert.ok(html.includes("6.1"));
  assert.ok(html.includes("Total marketplace reviews: 1,048"));
  assert.ok(html.includes("Single-source evidence"));
  assert.ok(html.includes("not your probability of satisfaction"));
});

test("generic public pagination stops after two pages add no unique reviews", async () => {
  const { runNativeReviewRetrieval } = jiti("./lib/nativeReviewRetrieval.ts");
  const originalFetch = globalThis.fetch;
  const requested = [];
  const listing = "https://ringconn.com/products/ringconn-gen-2-air";
  const reviews = Array.from({length:7},(_,i)=>({"@type":"Review",reviewBody:`My RingConn Gen 2 Air ring works well and is comfortable every day experience ${i}.`}));
  globalThis.fetch = async url => {
    const u = new URL(url); requested.push(u.toString());
    if (u.hostname !== "ringconn.com") return new Response("",{status:404});
    const current = Number(u.searchParams.get("page") || 1);
    return new Response(`<title>RingConn Gen 2 Air Smart Ring</title><script type="application/ld+json">${JSON.stringify({"@type":"Product",name:"RingConn Gen 2 Air Smart Ring",brand:"RingConn",review:reviews})}</script><a href="${listing}/reviews?page=${current+1}">Next reviews</a>`);
  };
  try {
    const result = await runNativeReviewRetrieval({ productTitle:"RingConn Gen 2 Air Smart Ring",brand:"RingConn",listingUrl:listing,maxPages:12,maxQueries:1,politeDelayMs:0 });
    assert.equal(result.reviewsCollected,7);
    assert.ok(requested.some(url=>url.includes("page=3")));
    assert.ok(!requested.some(url=>url.includes("page=4")));
  } finally { globalThis.fetch = originalFetch; }
});
