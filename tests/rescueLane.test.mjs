// Rescue Lane: owner researches failed scans, pastes reviews, rescues + emails the verdict.
// Junel's owner rules hold here: zero OpenAI in scoring, no shopper-facing
// forbidden strings, fake env only (storage is injected).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

// Guarantee "storage unconfigured" behavior in this file's process.
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE",
  "RESEND_API_KEY",
]) {
  delete process.env[key];
}

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const reviews = jiti(root + "lib/rescueReviews.ts");
const rescore = jiti(root + "lib/rescueRescore.ts");
const email = jiti(root + "lib/rescueEmail.ts");
const queue = jiti(root + "lib/rescueQueue.ts");
const flag = jiti(root + "lib/rescueFlag.ts");

/** In-memory fake for supabaseSelect/supabaseUpsert with upsert-on-conflict dedupe. */
function fakeStorage({ throwOn } = {}) {
  const tables = { scan_rescue_queue: [], product_review_library: [] };
  const select = async (table, query) => {
    if (throwOn === "select") throw new Error("storage down");
    const rows = tables[table] ?? [];
    const m = query.match(/status=eq\.([^&]+)/);
    if (m) return rows.filter((r) => r.status === decodeURIComponent(m[1]));
    return rows.slice();
  };
  let nextId = 1;
  const upsert = async (table, rows, conflict) => {
    if (throwOn === "upsert") throw new Error("storage down");
    const store = tables[table] ?? (tables[table] = []);
    const out = [];
    for (const row of rows) {
      const idx = conflict ? store.findIndex((r) => String(r[conflict]) === String(row[conflict])) : -1;
      const merged =
        idx >= 0
          ? { ...store[idx], ...row }
          : { id: `fake-uuid-${nextId++}`, created_at: new Date().toISOString(), ...row };
      if (idx >= 0) store[idx] = merged; else store.push(merged);
      out.push(merged);
    }
    return out;
  };
  return { tables, deps: { select, upsert } };
}

const BLOCK = (n) => `This is review body number ${n} and it is definitely longer than twenty characters.`;

test("parser: blank-line blocks become reviews; too-short blocks are dropped", () => {
  const text = `${BLOCK(1)}\n\n${BLOCK(2)}\n\nok\n\n${BLOCK(3)}`;
  const records = reviews.parseOwnerPastedReviews(text, { productUrl: null, marketplace: null });
  assert.equal(records.length, 3);
  assert.ok(records.every((r) => r.provenance === "owner_research"));
  assert.ok(records.every((r) => r.body.length >= 20));
});

test("parser: star-prefix detection (5 stars / 5/5 / star glyphs), else null", () => {
  assert.equal(reviews.parseRescueRatingPrefix("5 stars — " + BLOCK(1)), 5);
  assert.equal(reviews.parseRescueRatingPrefix("4/5 " + BLOCK(1)), 4);
  assert.equal(reviews.parseRescueRatingPrefix("★★★★★ " + BLOCK(1)), 5);
  assert.equal(reviews.parseRescueRatingPrefix("★★★ " + BLOCK(1)), 3);
  assert.equal(reviews.parseRescueRatingPrefix("3 out of 5 " + BLOCK(1)), 3);
  assert.equal(reviews.parseRescueRatingPrefix(BLOCK(1)), null);
  const withPrefix = reviews.parseOwnerPastedReviews("5 stars — " + BLOCK(1), { productUrl: null, marketplace: null });
  assert.equal(withPrefix[0].rating, 5);
  assert.ok(!withPrefix[0].body.startsWith("5 stars"));
});

test("parser: empty paste returns no records and never throws", () => {
  assert.deepEqual(reviews.parseOwnerPastedReviews("", { productUrl: null, marketplace: null }), []);
  assert.deepEqual(reviews.parseOwnerPastedReviews("   \n\n  ", { productUrl: null, marketplace: null }), []);
});

test("merge: existing corpus preserved, only new bodies appended, no dupes", () => {
  const stored = [{ id: "scan-1", body: BLOCK(1), provenance: "reviewintel_scan" }];
  const fresh = [
    { id: "owner-rescue-1", body: BLOCK(1), provenance: "owner_research" },
    { id: "owner-rescue-2", body: BLOCK(2), provenance: "owner_research" },
  ];
  const merged = reviews.mergeRescueReviewsWithCorpus(fresh, stored);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].provenance, "reviewintel_scan");
  assert.equal(merged[1].provenance, "owner_research");
});

test("queue: record dedupes on scan_ref (no duplicate rows)", async () => {
  const { deps, tables } = fakeStorage();
  const ok1 = await queue.recordRescueCandidate({ scanRef: "scan_1", productName: "Widget", reason: "r" }, deps);
  const ok2 = await queue.recordRescueCandidate({ scanRef: "scan_1", productName: "Widget", reason: "r" }, deps);
  assert.ok(ok1 && ok2);
  assert.equal(tables.scan_rescue_queue.length, 1);
});

test("queue: fail-soft on storage failure (never throws)", async () => {
  const { deps } = fakeStorage({ throwOn: "upsert" });
  const ok = await queue.recordRescueCandidate({ scanRef: "scan_x", productName: "W" }, deps);
  assert.equal(ok, false);
  const rows = await queue.listRescueQueue("pending", 10, { select: async () => { throw new Error("down"); } });
  assert.deepEqual(rows, []);
  const updated = await queue.updateRescueQueueRow("nope", { status: "rescued" }, deps);
  assert.equal(updated, false);
});

test("queue: email validation rejects bad emails", () => {
  assert.equal(queue.isValidRescueEmail("not-an-email"), false);
  assert.equal(queue.isValidRescueEmail("a@b"), false);
  assert.equal(queue.isValidRescueEmail("a b@c.com"), false);
  assert.equal(queue.isValidRescueEmail("guest@example.com"), true);
  assert.equal(queue.isValidRescueEmail("  GUEST@Example.COM  "), true);
});

test("queue: attach consent updates the email on repeat subscribe (no dupes)", async () => {
  const { deps, tables } = fakeStorage();
  await queue.recordRescueCandidate({ scanRef: "scan_9", productName: "Gadget" }, deps);
  const row = (await queue.listRescueQueue("pending", 10, deps))[0];
  const a1 = await queue.attachRescueConsent(row.id, "first@example.com", "2026-10-15T00:00:00Z", deps);
  const a2 = await queue.attachRescueConsent(row.id, "second@example.com", "2026-10-15T01:00:00Z", deps);
  assert.ok(a1 && a2);
  assert.equal(tables.scan_rescue_queue.length, 1);
  const stored = tables.scan_rescue_queue[0];
  assert.equal(stored.account_email, "second@example.com");
  assert.equal(stored.consent_source, "rescue_verdict_request");
  assert.equal(stored.subscribed_at, "2026-10-15T01:00:00Z");
});

test("queue: attach consent fail-soft", async () => {
  const { deps } = fakeStorage({ throwOn: "upsert" });
  assert.equal(await queue.attachRescueConsent("x", "a@b.com", "2026-10-15T00:00:00Z", deps), false);
});

test("flag hook: records real shoppers, skips test accounts and successful scans", async () => {
  const { deps, tables } = fakeStorage();
  const insufficient = { scanState: "INSUFFICIENT_EVIDENCE", verdict: "REVIEW EVIDENCE NOT ENOUGH", buyScore: null, productName: "AirPods 4", url: "https://www.amazon.ca/dp/B0DGJDKHRQ" };

  assert.ok(flag.isInsufficientEvidenceResult(insufficient));
  assert.ok(!flag.isInsufficientEvidenceResult({ scanState: "COMPLETE", verdict: "BUY", buyScore: 87 }));
  assert.ok(flag.isInsufficientEvidenceResult({ finalDecisionSource: "reviewEvidenceNotEnough", buyScore: null, decisionStatus: "x" }));

  // Real shopper -> flagged.
  await flag.flagRescueCandidateFromScanResult(
    { result: insufficient, scanId: "flag_s1", email: "shopper@example.com" },
    deps
  );
  // Test account -> skipped (audits must not page the owner).
  await flag.flagRescueCandidateFromScanResult(
    { result: insufficient, scanId: "flag_s2", email: "shopper.premium@reviewintel.test" },
    deps
  );
  // Successful scan -> skipped.
  await flag.flagRescueCandidateFromScanResult(
    { result: { scanState: "COMPLETE", verdict: "BUY", buyScore: 87 }, scanId: "flag_s3", email: "shopper@example.com" },
    deps
  );
  assert.equal(tables.scan_rescue_queue.length, 1);
  const row = tables.scan_rescue_queue[0];
  assert.equal(row.scan_ref, "flag_s1");
  assert.equal(row.account_email, "shopper@example.com");
  assert.equal(row.product_key, "amazon.ca:B0DGJDKHRQ");
  assert.equal(row.status, "pending");
});

test("rescore: null on empty corpus", async () => {
  const empty = await rescore.rescoreFromLibrary("amazon.ca:B0DGJDKHRQ", {
    loadCorpus: async () => ({ reviews: [], scanCount: 0 }),
  });
  assert.equal(empty, null);
  const blank = await rescore.rescoreFromLibrary("", {});
  assert.equal(blank, null);
});

test("rescore: verdict from a fixture corpus (no OpenAI, deterministic)", async () => {
  const corpus = [
    { id: "r1", body: "Amazing sound quality and the battery lasts all day, highly recommended to everyone.", rating: 5, provenance: "owner_research" },
    { id: "r2", body: "Great fit and noise cancellation is superb for the price point, very happy with this purchase.", rating: 5, provenance: "owner_research" },
    { id: "r3", body: "Fell apart after two weeks, the charging case no longer works at all, terrible quality control.", rating: 1, provenance: "owner_research" },
  ];
  const first = await rescore.rescoreFromLibrary("amazon.ca:B0DGJDKHRQ", {
    loadCorpus: async () => ({ reviews: corpus, scanCount: 1 }),
  });
  const second = await rescore.rescoreFromLibrary("amazon.ca:B0DGJDKHRQ", {
    loadCorpus: async () => ({ reviews: corpus, scanCount: 1 }),
  });
  assert.ok(first && second);
  assert.ok(["BUY", "REVIEW FIRST", "AVOID"].includes(first.verdict));
  assert.equal(first.verdict, second.verdict);
  assert.equal(first.buyingScore, second.buyingScore);
  assert.equal(first.reviewCount, second.reviewCount);
  assert.ok(first.quotes.length >= 1 && first.quotes.every((q) => q.length > 0));
  assert.ok(["High", "Medium", "Low"].includes(first.confidence));
});

test("email builder: verdict + product present; no forbidden shopper strings", () => {
  const built = email.buildRescueEmail({
    productName: "Apple AirPods 4",
    verdict: "BUY",
    buyingScore: 85,
    confidence: "Medium",
    quotes: ["Great sound for the price, very happy."],
    reviewCount: 12,
  });
  assert.ok(built.subject.includes("Apple AirPods 4"));
  assert.ok(built.html.includes("BUY"));
  assert.ok(built.html.includes("85/100"));
  assert.ok(built.text.includes("Apple AirPods 4"));
  const blob = built.subject + built.html + built.text;
  for (const forbidden of ["Vercel", "evidenceState", "NOT_ENOUGH", "Not scored", "OpenAI", "openai"]) {
    assert.ok(!blob.includes(forbidden), `forbidden string leaked: ${forbidden}`);
  }
  // Verdict-purpose only: no marketing, no compensation.
  assert.ok(!/discount|coupon|subscribe|newsletter|reward|compensat/i.test(blob));
});
