// Shareable verdicts are signed real-scan summaries; the homepage sample is real saved data.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "review-evidence-scoring-test.js", { alias: { "@": root } });
const { sharedVerdictFromResult, signSharedVerdict, verifySharedVerdict, shareSecret } = jiti("./lib/shareVerdict.ts");
const { buildRingConnShopperResult } = await import("../scripts/reviewintel-ringconn-shopper-fixture.mjs");

test("share token round-trips the real verdict and rejects tampering or a wrong secret", () => {
  const result = buildRingConnShopperResult(root.replace(/\/$/, "")); const scanId = result.scanId;
  const data = sharedVerdictFromResult(result, scanId, new Date("2026-10-10T12:00:00Z"));
  assert.equal(data.label, "Wait"); assert.equal(data.confidencePercent, 55); assert.equal(data.reviewCount, 7);
  const token = signSharedVerdict(data, "s1");
  assert.deepEqual(verifySharedVerdict(token, "s1"), data);
  assert.equal(verifySharedVerdict(token, "s2"), null);
  const [body, sig] = token.split(".");
  assert.equal(verifySharedVerdict(`${body.slice(0, -2)}AA.${sig}`, "s1"), null);
  assert.equal(verifySharedVerdict("garbage", "s1"), null);
});

test("every shared quote is a verbatim excerpt of an accepted review", () => {
  const result = buildRingConnShopperResult(root.replace(/\/$/, "")); const scanId = result.scanId;
  const bodies = result.reviewEvidence.evidenceAdjudication.acceptedRecords.map(r => String(r.body || r.text || "").replace(/\s+/g, " "));
  const data = sharedVerdictFromResult(result, scanId);
  for (const point of [data.love, data.complaint].filter(Boolean)) {
    const core = point.quote.replace(/[…]$/, "").slice(0, 60);
    assert.ok(bodies.some(b => b.includes(core)), core);
  }
});

test("production without a secret disables sharing; dev has a local fallback", () => {
  assert.equal(shareSecret({ NODE_ENV: "production" }), null);
  assert.ok(shareSecret({ NODE_ENV: "development" }));
  assert.notEqual(shareSecret({ NODE_ENV: "production", REVIEWINTEL_SESSION_SECRET: "x" }), "x", "derived, never the raw secret");
});

test("homepage sample is generated from the saved real scan, with verbatim quotes", () => {
  const sample = JSON.parse(fs.readFileSync(root + "lib/homeSample.json", "utf8"));
  const result = buildRingConnShopperResult(root.replace(/\/$/, ""));
  const bodies = result.reviewEvidence.evidenceAdjudication.acceptedRecords.map(r => String(r.body || r.text || "").replace(/\s+/g, " "));
  assert.equal(sample.reviewCount, bodies.length);
  for (const p of [...sample.loves, ...sample.complaints]) assert.ok(bodies.some(b => b.includes(p.quote.replace(/[…]$/, "").slice(0, 60))), p.quote);
  const page = fs.readFileSync(root + "app/page.tsx", "utf8");
  assert.match(page, /homeSample\.json/);
  assert.match(page, /scanCount > 0 \?/, "scan count only shown when the DB returns a real number");
});

test("share API verifies against the stored scan when a database is configured", () => {
  const route = fs.readFileSync(root + "app/api/share/route.ts", "utf8");
  assert.match(route, /if \(isSupabaseConfigured\(\)\) \{\s*result = await storedResult\(scanId\)/);
  assert.match(route, /NODE_ENV !== "production"/);
});
