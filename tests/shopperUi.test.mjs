// Shopper-first answer + live progress: derived only from real result fields / pipeline events.
import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const jiti = require("jiti")(new URL("../review-evidence-scoring-test.js", import.meta.url).pathname, { alias: { "@": new URL("..", import.meta.url).pathname } });
const { adjudicateReviewEvidence } = jiti("./lib/reviewEvidenceAdjudication.ts");
const { deriveDeterministicEvidenceResult } = jiti("./lib/reviewEvidenceDeterminism.ts");
const { deriveShopperAnswer, confidenceInWords, shortQuote } = jiti("./lib/shopperAnswer.ts");
const progress = jiti("./lib/scanProgressStore.ts");
const fixture = JSON.parse(readFileSync("tests/fixtures/reviewintel/ringconn-existing-capture-inputs.json"));

function realResult(overrides = {}) {
  const corpus = adjudicateReviewEvidence(...fixture.adjudicationArgs);
  const d = deriveDeterministicEvidenceResult({ ...fixture.evaluationMetadata, acceptedRecords: corpus.acceptedRecords });
  return { ...d, verdict: d.customerVerdict, strengthProvenance: d.strengths, complaintProvenance: d.complaints, verdictConfidence: 55,
    reviewEvidence: { evidenceAdjudication: corpus, commentsAnalyzed: corpus.acceptedRecords.length }, meta: { audience: "buyer" }, ...overrides };
}

test("verdicts map honestly to plain words", () => {
  assert.equal(deriveShopperAnswer(realResult({ verdict: "DO NOT BUY YET", customerVerdict: "DO NOT BUY YET" })).label, "Wait");
  assert.equal(deriveShopperAnswer(realResult({ verdict: "BUY", customerVerdict: "BUY" })).label, "Buy");
  assert.equal(deriveShopperAnswer(realResult({ verdict: "AVOID", customerVerdict: "AVOID" })).label, "Skip");
  const full = realResult();
  const thin = deriveShopperAnswer(realResult({ evidenceState: "NOT_ENOUGH" }));
  assert.equal(thin.label, "Low confidence");
  assert.equal(thin.confidenceWords, "Low");
  assert.equal(thin.confidencePercent, 55);
  assert.equal(thin.score, full.buyScore);
  assert.ok(thin.loves.length > 0, "real review quotes stay visible");
  assert.ok(thin.nextSteps.some(step => step.id === "screenshots"));
  assert.ok(thin.nextSteps.some(step => step.id === "amazon_listing"));
  assert.doesNotMatch(`${thin.label} ${thin.why} ${thin.trustLine}`, /not enough evidence|not scored|no reviews analyzed/i);
});

test("loves/complaints quote REAL accepted review bodies linked by evidence id, with source", () => {
  const result = realResult();
  const answer = deriveShopperAnswer(result);
  const bodies = result.reviewEvidence.evidenceAdjudication.acceptedRecords.map(r => r.body.replace(/\s+/g, " ").trim());
  for (const point of [...answer.loves, ...answer.complaints]) {
    assert.ok(point.quote, `quote for ${point.claim}`);
    const stem = point.quote.replace(/…$/, "");
    // Batch 2, rule 2: the quote is the clause that matched the theme, so it
    // is a real substring of the accepted body, not necessarily its prefix.
    assert.ok(bodies.some(body => body.includes(stem)), `quote is real evidence text: ${stem}`);
    assert.ok(point.sourceHost);
  }
  assert.ok(answer.loves.length <= 3 && answer.complaints.length <= 3);
  assert.match(answer.trustLine, /Based on real buyer reviews from /);
  assert.doesNotMatch(answer.trustLine, /\d+ real review/);
});

test("unknown stays Unknown; confidence in words; empty result is low confidence with the real count", () => {
  assert.equal(deriveShopperAnswer(realResult({ valueForMoney: "Unknown" })).value, "Unknown");
  assert.equal(deriveShopperAnswer(realResult({ valueForMoney: undefined })).value, deriveShopperAnswer(realResult()).value);
  assert.equal(confidenceInWords(null), "Unknown"); assert.equal(confidenceInWords(0.8), "High"); assert.equal(confidenceInWords(55), "Medium"); assert.equal(confidenceInWords(20), "Low");
  const empty = deriveShopperAnswer({});
  assert.equal(empty.kind, "not_enough"); assert.equal(empty.label, "Low confidence");
  assert.equal(empty.reviewCount, 0); assert.equal(empty.score, null);
  assert.equal(empty.confidenceWords, "Low"); assert.equal(empty.confidencePercent, null);
  assert.match(empty.why, /Low confidence/);
  assert.doesNotMatch(empty.why, /0 real reviews|real reviews analyzed/);
  assert.match(empty.why, /Scan the Amazon listing link or add a review screenshot/);
  assert.doesNotMatch(`${empty.label} ${empty.why} ${empty.trustLine}`, /not enough evidence|not scored|no reviews analyzed/i);
  assert.ok(shortQuote("a ".repeat(200)).length <= 152);
});

test("live progress is driven by real pipeline events and aliases the client scan id", async () => {
  const corpus = adjudicateReviewEvidence(...fixture.adjudicationArgs);
  let midway;
  await progress.runWithScanProgress("server-scan-123", async () => {
    progress.aliasScanProgress("client-scan-456");
    assert.equal(progress.getScanProgress("client-scan-456").reviewsFound, null, "unknown before any event");
    progress.noteScanProgressEvent("identity", { productName: "RingConn Gen 2 Air" });
    progress.noteScanProgressEvent("page", () => ({ sourceUrl: "https://www.amazon.ca/dp/X" }));
    progress.noteScanProgressEvent("page", { sourceUrl: "https://www.amazon.ca/dp/X" });
    progress.noteScanProgressEvent("page", { sourceUrl: "https://ringconn.com/p" });
    progress.reportReviewsFound(9);
    progress.noteScanProgressEvent("adjudication", { args: [], result: corpus });
    midway = progress.getScanProgress("client-scan-456");
  });
  assert.equal(midway.productIdentified, true);
  assert.equal(midway.sourcesChecked, 2);
  assert.deepEqual(midway.sourceHosts, ["amazon.ca", "ringconn.com"]);
  assert.equal(midway.reviewsFound, 9);
  assert.equal(midway.reviewsAccepted, corpus.acceptedRecords.length);
  assert.equal(midway.stage, "checking");
  assert.ok(midway.snippets.length > 0 && midway.snippets.every(s => corpus.acceptedRecords.some(r => r.body.replace(/\s+/g, " ").startsWith(s.text.replace(/…$/, "")))));
  assert.equal(progress.getScanProgress("client-scan-456").stage, "done");
  assert.equal(progress.getScanProgress("never-started-999"), null);
  progress.noteScanProgressEvent("page", { sourceUrl: "https://x.example" }); // outside a scan: ignored, no throw
});

test("progress bar fraction comes from the real stage, indeterminate without data", () => {
  const ts = require("typescript");
  const src = readFileSync("components/ReviewIntelScanOverlay.tsx", "utf8");
  const code = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  // The rebuilt overlay imports the "@/..." alias; resolve it through the same
  // jiti instance the test uses for lib modules (raw require cannot).
  const overlayRequire = (id) => (typeof id === "string" && id.startsWith("@/") ? jiti(`./${id.slice(2)}.ts`) : require(id));
  new Function("require", "module", "exports", code)(overlayRequire, mod, mod.exports);
  const { progressFraction, ReviewIntelScanOverlay } = mod.exports;
  assert.equal(progressFraction("analyzing", 100, null), null);
  assert.ok(progressFraction("analyzing", 100, { stage: "checking" }) > progressFraction("analyzing", 100, { stage: "searching" }));
  assert.equal(progressFraction("done", 0, null), 1);
  const React = require("react"); const { renderToStaticMarkup } = require("react-dom/server");
  const html = renderToStaticMarkup(React.createElement(ReviewIntelScanOverlay, { stage: "analyzing", uploadProgress: 100, initialProgress: { stage: "reading", productIdentified: true, productName: "Acme ZX100", sourcesChecked: 3, sourceHosts: ["amazon.ca"], reviewsFound: 12, reviewsAccepted: null, snippets: [{ text: "Works great.", host: "amazon.ca" }] } }));
  assert.ok(html.includes("Acme ZX100") && html.includes("Works great."));
  assert.ok(!html.includes(">12<") && !html.includes("Reviews found") && !html.includes("Real reviews kept"), "retrieved review counts stay off the progress overlay");
});

test("RingConn card shows the canonical 55% confidence (raw 81, capped at 55 for 7 reviews)", async () => {
  const { buildRingConnShopperResult } = await import("../scripts/reviewintel-ringconn-shopper-fixture.mjs");
  const result = buildRingConnShopperResult();
  assert.equal(result.verdictConfidenceAudit.raw, 81); assert.equal(result.commentsAnalyzed, 7);
  const answer = deriveShopperAnswer(result);
  assert.equal(answer.confidencePercent, 55);
  assert.equal(answer.confidenceWords, "Medium");
  assert.equal(answer.label, "Wait");
  assert.equal(answer.value, result.valueForMoney); // Unknown when no review discusses value
  const ts = require("typescript");
  const uiJiti = require("jiti")(process.cwd(), { alias: { "@": process.cwd() }, extensions: [".js", ".json", ".ts", ".tsx", ".mjs"], cache: false, requireCache: false,
    transform: ({ source }) => ({ code: ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText }) });
  const { ShopperAnswerCard } = uiJiti("./components/ShopperAnswerCard.tsx");
  const React = require("react"); const { renderToStaticMarkup } = require("react-dom/server");
  const html = renderToStaticMarkup(React.createElement(ShopperAnswerCard, { result, productName: "RingConn Gen 2 Air" }));
  assert.match(html, /data-testid="answer-confidence">55% · Medium</);
  const thinResult = { ...result, evidenceState: "NOT_ENOUGH", verdict: "REVIEW EVIDENCE NOT ENOUGH", verdictConfidence: null, buyerConfidence: null, buyingConfidence: null, confidence: null };
  const thin = renderToStaticMarkup(React.createElement(ShopperAnswerCard, { result: thinResult, productName: "x" }));
  const thinAnswer = deriveShopperAnswer(thinResult);
  assert.match(thin, /data-testid="answer-confidence">Low</);
  assert.doesNotMatch(thin, /Low · \d+ real reviews|real reviews analyzed|Based on \d+/);
  assert.equal(thinAnswer.confidencePercent, null);
  assert.ok(thinAnswer.reviewCount > 0);
  assert.ok(thin.includes("Add a review screenshot"));
  assert.doesNotMatch(thin, /Scan the Amazon listing/);
  assert.doesNotMatch(thin, /not enough evidence|not scored|no reviews analyzed|NOT ENOUGH EVIDENCE/i);
  assert.ok(thinAnswer.loves.some(point => point.quote), "thin results still quote a real review");
});

test("dev progress preview quotes are real accepted RingConn review text", async () => {
  const { buildRingConnShopperResult } = await import("../scripts/reviewintel-ringconn-shopper-fixture.mjs");
  const bodies = buildRingConnShopperResult().reviewEvidence.evidenceAdjudication.acceptedRecords.map(r => r.body.replace(/\s+/g, " ").trim());
  const saved = JSON.parse(readFileSync("app/dev-preview/scan-progress/fixture-accepted-quotes.json", "utf8"));
  assert.ok(saved.quotes.length > 0);
  for (const q of saved.quotes) assert.ok(bodies.some(b => b.startsWith(q.text.replace(/…$/, ""))), q.text);
});
