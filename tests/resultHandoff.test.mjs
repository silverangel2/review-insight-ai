import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const analyzer = fs.readFileSync("components/AnalyzerForm.tsx", "utf8");
const results = fs.readFileSync("components/ResultsClient.tsx", "utf8");
const storage = fs.readFileSync("lib/resultStorage.ts", "utf8");
const historyRoute = fs.readFileSync("app/api/account/analyses/route.ts", "utf8");

test("successful analyze navigation carries the returned durable scan identity", () => {
  assert.match(analyzer, /const resultUrl = `\/results\?scanId=\$\{encodeURIComponent\(data\.scanId\)\}`/);
  assert.match(analyzer, /router\.push\(resultUrl\)/);
  assert.doesNotMatch(analyzer, /router\.push\("\/results"\)/);
});

test("results reads URL identity before browser-only active state", () => {
  assert.match(results, /const requestedScanId =/);
  assert.match(results, /const activeScanId = requestedScanId \|\| \(selectedHistoryId \? "" : readActiveScanId\(\)\)/);
  assert.match(results, /persistedScanId === requestedIdentity/);
});

test("missing identity never falls back to an arbitrary newest analysis", () => {
  assert.doesNotMatch(results, /availableAnalyses\[0\]/);
  assert.match(results, /if \(!requestedIdentity\) return;/);
});

test("result loading remains ownership-scoped and does not fabricate samples", () => {
  assert.match(results, /getClientAccount\(\)/);
  assert.match(results, /fetch\(`\/api\/account\/analyses\?/);
  assert.match(results, /if \(!result\)/);
  assert.match(results, /No scan loaded/);
  assert.match(results, /reviewIntelDevDiagnostic\("RESULTS_RENDER_BRANCH", \{ branch: "no_scan_loaded" \}\)/);
});

test("refresh and server restart use persisted account history when the URL identity remains", () => {
  assert.match(results, /fetch\(`\/api\/account\/analyses\?/);
  assert.match(results, /cache: "no-store"/);
  assert.match(results, /const requestedIdentity = selectedHistoryId \|\| requestedScanId \|\| activeScanId/);
  assert.match(results, /persistedScanId === requestedIdentity/);
});

test("unauthenticated and invalid identities fail safely without a server-render crash", () => {
  assert.match(results, /const account = getClientAccount\(\)/);
  assert.match(results, /if \(!account\?\.email\) return;/);
  assert.doesNotMatch(results, /if \(!account\?\.email \|\| account\.plan === "free_buyer"\) return;/);
  assert.match(results, /params\.set\("scanId", requestedScanId\)/);
  assert.match(results, /if \(!parsed\)/);
  assert.match(results, /branch: "no_scan_loaded"/);
  assert.match(historyRoute, /if \(!email\)/);
  assert.match(historyRoute, /status: 400/);
});

test("history lookup is ownership-scoped and cannot disclose another user's scan", () => {
  assert.match(historyRoute, /emailMismatchResponse\(requestedEmail, email\)/);
  assert.match(historyRoute, /status: 403/);
  assert.match(historyRoute, /profile_email=eq\.\$\{encodeURIComponent\(email\)\}/);
  assert.match(results, /fetch\(`\/api\/account\/analyses\?\$\{params\.toString\(\)\}`/);
  assert.doesNotMatch(results, /availableAnalyses\[0\]/);
});

test("result loading is client-side and does not parse the persisted result during server rendering", () => {
  assert.match(results, /useEffect\(\(\) => \{/);
  assert.match(results, /typeof window !== "undefined"/);
  assert.match(results, /new URLSearchParams\(window\.location\.search\)/);
  assert.doesNotMatch(results, /export default async function/);
});

test("recovery uses persistence only and never starts another provider scan", () => {
  assert.doesNotMatch(results, /fetch\("\/api\/analyze"/);
  assert.doesNotMatch(results, /fetch\(`\/api\/analyze/);
  assert.match(results, /fetch\(`\/api\/account\/analyses\?/);
});

test("a requested URL scan ID is a hard identity constraint", () => {
  assert.match(results, /requestedScanId \|\| selectedHistoryId \? null : readLatestResult/);
  assert.match(results, /if \(!parsed && !requestedScanId && !selectedHistoryId\)/);
  assert.match(results, /const activeScanId = requestedScanId \|\|/);
  assert.match(results, /if \(activeScanId && parsedScanId !== activeScanId\) \{/);
  assert.match(results, /parsed = null;/);
  assert.doesNotMatch(results, /Using completed analysis despite stale scan ID/);
  assert.match(results, /const requestedScanId = new URLSearchParams\(window\.location\.search\)\.get\("scanId"\);/);
  assert.match(results, /if \(requestedScanId && recoveredScanId !== requestedScanId\) return;/);
});

test("requested scans never use an unconstrained browser result", () => {
  assert.match(results, /activeScanId \? \{ scanId: activeScanId \} : \{ allowAnyScan: Boolean\(selectedHistoryId\) \}/);
  assert.match(results, /const requestedIdentity = selectedHistoryId \|\| requestedScanId \|\| activeScanId/);
  assert.match(storage, /if \(!requestedScanId\) return true;/);
  assert.doesNotMatch(storage, /if \(!requestedScanId \|\| options\.allowAnyScan\) return true;/);
});

test("explicit history selection carries the selected scan identity", () => {
  const history = fs.readFileSync("components/ShopperResultHistoryCorner.tsx", "utf8");
  assert.match(history, /scanIdFromResult/);
  assert.match(history, /scanId=\$\{encodeURIComponent\(scanId\)\}/);
  assert.match(history, /history=\$\{encodeURIComponent\(item\.id\)\}/);
});

test("source wording separates accepted review evidence from discovery sources", () => {
  assert.match(results, /exact-product written review/);
  assert.match(results, /verified review evidence/);
  assert.match(results, /Additional web sources were checked for product matching and supporting context/);
  assert.match(results, /Discovery sources checked/);
  assert.match(results, /Accepted written reviews/);
  assert.match(results, /Discovery\/context:/);
});

test("the Takki evidence count is presentation-only and scoring remains untouched", () => {
  assert.match(results, /acceptedWrittenReviewCount/);
  assert.match(results, /evidenceAdjudication/);
  const scoring = fs.readFileSync("lib/reviewEvidenceScoring.ts", "utf8");
  assert.match(scoring, /export function scoreReviewEvidenceSignals/);
  assert.match(scoring, /const notEnough =/);
  assert.match(scoring, /buyScore = writtenScore \* \(1 - ratingWeight\)/);
});
