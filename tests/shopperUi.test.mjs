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
const progress = jiti("./lib/scanProgress.ts");
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
  const thin = deriveShopperAnswer(realResult({ evidenceState: "NOT_ENOUGH" }));
  assert.equal(thin.label, "Not enough reviews yet");
  assert.equal(thin.score, null); assert.equal(thin.confidenceWords, "Unknown");
  assert.deepEqual(thin.loves, []); assert.ok(thin.nextSteps.some(step => step.id === "screenshots"));
});

test("loves/complaints quote REAL accepted review bodies linked by evidence id, with source", () => {
  const result = realResult();
  const answer = deriveShopperAnswer(result);
  const bodies = result.reviewEvidence.evidenceAdjudication.acceptedRecords.map(r => r.body.replace(/\s+/g, " ").trim());
  for (const point of [...answer.loves, ...answer.complaints]) {
    assert.ok(point.quote, `quote for ${point.claim}`);
    const stem = point.quote.replace(/…$/, "");
    assert.ok(bodies.some(body => body.startsWith(stem)), `quote is a real body prefix: ${stem}`);
    assert.ok(point.sourceHost);
  }
  assert.ok(answer.loves.length <= 3 && answer.complaints.length <= 3);
  assert.match(answer.trustLine, new RegExp(`Based on ${answer.reviewCount} real buyer reviews? from `));
});

test("unknown stays Unknown; confidence in words; empty result is not enough", () => {
  assert.equal(deriveShopperAnswer(realResult({ valueForMoney: "Unknown" })).value, "Unknown");
  assert.equal(deriveShopperAnswer(realResult({ valueForMoney: undefined })).value, deriveShopperAnswer(realResult()).value);
  assert.equal(confidenceInWords(null), "Unknown"); assert.equal(confidenceInWords(0.8), "High"); assert.equal(confidenceInWords(55), "Medium"); assert.equal(confidenceInWords(20), "Low");
  const empty = deriveShopperAnswer({});
  assert.equal(empty.kind, "not_enough"); assert.equal(empty.reviewCount, 0); assert.equal(empty.score, null);
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
  const mod = { exports: {} }; new Function("require", "module", "exports", code)(require, mod, mod.exports);
  const { progressFraction, ReviewIntelScanOverlay } = mod.exports;
  assert.equal(progressFraction("analyzing", 100, null), null);
  assert.ok(progressFraction("analyzing", 100, { stage: "checking" }) > progressFraction("analyzing", 100, { stage: "searching" }));
  assert.equal(progressFraction("done", 0, null), 1);
  const React = require("react"); const { renderToStaticMarkup } = require("react-dom/server");
  const html = renderToStaticMarkup(React.createElement(ReviewIntelScanOverlay, { stage: "analyzing", uploadProgress: 100, initialProgress: { stage: "reading", productIdentified: true, productName: "Acme ZX100", sourcesChecked: 3, sourceHosts: ["amazon.ca"], reviewsFound: 12, reviewsAccepted: null, snippets: [{ text: "Works great.", host: "amazon.ca" }] } }));
  assert.ok(html.includes("Acme ZX100") && html.includes(">12<") && html.includes("Works great."));
  assert.ok(html.includes('aria-label="not yet known"'), "accepted count unknown is shown as indeterminate, not 0");
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
  // Genuinely null (NOT ENOUGH) is the only Unknown.
  const thin = renderToStaticMarkup(React.createElement(ShopperAnswerCard, { result: { ...result, evidenceState: "NOT_ENOUGH", verdict: "REVIEW EVIDENCE NOT ENOUGH", verdictConfidence: null, buyerConfidence: null, buyingConfidence: null, confidence: null }, productName: "x" }));
  assert.match(thin, /data-testid="answer-confidence">Unknown</);
});

test("dev progress preview quotes are real accepted RingConn review text", async () => {
  const { buildRingConnShopperResult } = await import("../scripts/reviewintel-ringconn-shopper-fixture.mjs");
  const bodies = buildRingConnShopperResult().reviewEvidence.evidenceAdjudication.acceptedRecords.map(r => r.body.replace(/\s+/g, " ").trim());
  const saved = JSON.parse(readFileSync("app/dev-preview/scan-progress/ringconn-accepted-quotes.json", "utf8"));
  assert.ok(saved.quotes.length > 0);
  for (const q of saved.quotes) assert.ok(bodies.some(b => b.startsWith(q.text.replace(/…$/, ""))), q.text);
});
