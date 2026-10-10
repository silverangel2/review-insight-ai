// Builds an API-shaped RingConn shopper result (the same canonical fields /api/analyze returns)
// from the saved real capture, for UI tests, screenshots and the dev progress preview.
// Usage: node scripts/reviewintel-ringconn-shopper-fixture.mjs [--write-preview-quotes] [--write-result=/path.json]
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(process.cwd() + "/x.js");

export function buildRingConnShopperResult(root = process.cwd()) {
  const jiti = require("jiti")(root, { alias: { "@": root } });
  const { adjudicateReviewEvidence } = jiti("./lib/reviewEvidenceAdjudication.ts");
  const { deriveDeterministicEvidenceResult } = jiti("./lib/reviewEvidenceDeterminism.ts");
  const fx = JSON.parse(readFileSync(`${root}/tests/fixtures/reviewintel/ringconn-existing-capture-inputs.json`, "utf8"));
  const corpus = adjudicateReviewEvidence(...fx.adjudicationArgs);
  const d = deriveDeterministicEvidenceResult({ ...fx.evaluationMetadata, acceptedRecords: corpus.acceptedRecords });
  // Fixture-only id: must not collide with a real stored scan (that id belongs to a different product).
  const scanId = "scan_fixture_ringconn_gen2_air";
  // Known canonical breakdown for this capture: raw 81, capped at 55 because only 7 written reviews (<8).
  const displayedVerdictConfidence = 55;
  const signals = Number(d.deterministicScoringInputs?.analyzableReviewCount ?? d.strengths.length + d.complaints.length);
  return {
    ...d, scanId, analysisVersion: "review-evidence-v2", finalDecisionSource: "reviewEvidence", decisionStatus: "review_evidence_verdict",
    verdict: d.customerVerdict, recommendation: d.customerVerdict, finalVerdict: d.customerVerdict, stableVerdict: d.customerVerdict,
    buyerConfidence: displayedVerdictConfidence, buyingConfidence: displayedVerdictConfidence, confidence: displayedVerdictConfidence, verdictConfidence: displayedVerdictConfidence,
    verdictConfidenceAudit: { raw: 81, cap: 55, capReason: "fewer than 8 written reviews analyzed", displayed: displayedVerdictConfidence },
    buyScore: d.buyScore, score: d.buyScore, productScore: d.buyScore, valueForMoney: d.valueForMoney, value: d.valueForMoney,
    // Fields the API also returns and the results page's display contract requires.
    exactListingAccepted: true, reviewIntelligenceSignals: signals, reviewsCollected: corpus.acceptedRecords.length,
    commentsAnalyzed: corpus.acceptedRecords.length, sourceDiversity: 1,
    topStrengths: d.strengths.map(c => c.claim), topComplaints: d.complaints.map(c => c.claim), strengthProvenance: d.strengths, complaintProvenance: d.complaints,
    product: { name: "RingConn Gen 2 Air", title: "RingConn Gen 2 Air Smart Ring", store: "Amazon.ca" }, analysis: {},
    reviewEvidence: { exactListingAccepted: true, reviewIntelligenceSignals: signals, reviewsCollected: corpus.acceptedRecords.length, evidenceAdjudication: corpus, commentsAnalyzed: corpus.acceptedRecords.length, listingEvidence: { exactListingUrl: fx.adjudicationArgs[1].exactListingUrl } },
    researchQuality: { evidenceLevel: "verified", notes: [] }, meta: { audience: "buyer", locale: "en", scanId },
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = buildRingConnShopperResult();
  const out = process.argv.find(a => a.startsWith("--write-result="))?.slice(15);
  if (out) writeFileSync(out, JSON.stringify({ version: 2, savedAt: new Date().toISOString(), scanId: result.scanId, result }));
  if (process.argv.includes("--write-preview-quotes")) {
    const quotes = result.reviewEvidence.evidenceAdjudication.acceptedRecords.slice(0, 3).map(r => {
      const body = r.body.replace(/\s+/g, " ").trim();
      const cut = body.length > 140 ? body.lastIndexOf(" ", 140) : body.length;
      return { text: body.length > 140 ? `${body.slice(0, cut)}…` : body, host: new URL(r.sourceUrl).hostname.replace(/^www\./, ""), sourceUrl: r.sourceUrl, evidenceId: r.id };
    });
    writeFileSync("app/dev-preview/scan-progress/ringconn-accepted-quotes.json", JSON.stringify({ source: "tests/fixtures/reviewintel/ringconn-existing-capture-inputs.json (accepted records)", productName: "RingConn Gen 2 Air Smart Ring", acceptedCount: result.reviewEvidence.evidenceAdjudication.acceptedRecords.length, quotes }, null, 1));
  }
  console.log(JSON.stringify({ verdict: result.verdict, confidence: result.verdictConfidence, accepted: result.commentsAnalyzed }));
}
