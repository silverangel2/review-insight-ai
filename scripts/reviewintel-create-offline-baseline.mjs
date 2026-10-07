import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { installOfflineGuard } from "./reviewintel-offline-guard.mjs";
import { replayScan } from "./reviewintel-replay-scan.mjs";

installOfflineGuard();
const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath || sourcePath === outputPath) throw new Error("Provide distinct source capture and new baseline paths.");
const bytes = readFileSync(sourcePath);
const source = JSON.parse(bytes.toString("utf8"));
const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root, { alias: { "@": root } });
const production = {
  ...jiti("./lib/productIdentityTokens.ts"),
  ...jiti("./lib/productSearchVerifier.ts"),
  ...jiti("./lib/nativeReviewRetrieval.ts"),
  ...jiti("./lib/reviewEvidenceAdjudication.ts"),
  ...jiti("./lib/reviewEvidenceDeterminism.ts"),
};
const events = [];
const corpora = [];
for (const event of source.events) {
  const args = event.data?.args;
  if (event.stage === "identity") events.push(event);
  if (event.stage === "verification" || event.stage === "source-match") {
    const fn = event.stage === "verification" ? production.verifyProductCandidate : production.nativeSourceMatchesProduct;
    events.push({ ...event, data: { args, result: fn(...args) } });
  }
  if (event.stage === "adjudication") {
    const corpus = production.adjudicateReviewEvidence(...args);
    corpora.push(corpus);
    events.push({ ...event, data: { args, result: corpus } });
  }
  if (event.stage === "evaluation") {
    const hashes = args[0].acceptedRecords.map((record) => record.stableEvidenceHash).sort();
    const corpus = [...corpora].reverse().find((item) => JSON.stringify(item.records.filter((record) => hashes.includes(record.stableEvidenceHash)).map((record) => record.stableEvidenceHash).sort()) === JSON.stringify(hashes));
    if (hashes.length && !corpus) throw new Error("Historical scoring corpus has no raw adjudication inputs.");
    const input = { ...args[0], acceptedRecords: corpus?.acceptedRecords.filter((record) => hashes.includes(record.stableEvidenceHash)) || [] };
    events.push({ ...event, data: { args: [input], result: production.deriveDeterministicEvidenceResult(input) } });
  }
}
const baseline = {
  schemaVersion: 1,
  scanId: source.scanId,
  timestamp: source.timestamp,
  status: "OFFLINE_BASELINE",
  provenance: {
    kind: "DERIVED_OFFLINE_NOT_LIVE_RUNTIME_PROOF",
    sourceCaptureSha256: createHash("sha256").update(bytes).digest("hex"),
    scorerVersion: production.DETERMINISTIC_SCORER_VERSION,
    explanation: "Original raw evidence and scoring inputs; current production adjudication/scorer. No new evidence or persistence is claimed.",
  },
  events,
};
const replayed = replayScan(baseline, production);
if (!replayed.final) throw new Error("No final evaluation was captured; cannot generate a scored baseline.");
writeFileSync(outputPath, `${JSON.stringify(baseline, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ baseline: outputPath, historicalCaptureUnchanged: true, acceptedReviews: replayed.final.acceptedReviewHashes.length, corpusHash: replayed.final.acceptedCorpusHash, score: replayed.final.buyScore, verdict: replayed.final.customerVerdict, networkCalls: 0, openAiCalls: 0, firecrawlCalls: 0 }));
