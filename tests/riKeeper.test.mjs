// RI Keeper v1 tests.
// Runs the REAL keeper code against in-memory stubs (supabase + email).
// Covers: each lane check (healthy/degraded/down), the Oct-15 reconciliation
// catch, whitelist enforcement, repair idempotency, fail-twice stop,
// kill switches, and ledger writes.
import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

register(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "hooks.mjs")).href);

const keeper = await import("../lib/riKeeper.ts");
const ledger = await import("../lib/riKeeperLedger.ts");
const stubSupabase = await import("./stubs/supabaseServer.stub.mjs");
const stubEmail = await import("./stubs/emailDelivery.stub.mjs");

const FIXED_NOW = new Date("2026-10-16T12:00:00.000Z").getTime();
const isoDaysAgo = (d) => new Date(FIXED_NOW - d * 24 * 60 * 60 * 1000).toISOString();
const isoHoursAgo = (h) => new Date(FIXED_NOW - h * 60 * 60 * 1000).toISOString();

const BATCH_TEXT = `---
product: Test Heater
product_id: B000TEST01
product_url: https://www.amazon.ca/dp/B000TEST01
store: amazon.ca
review_count: 3
rating_distribution: 5-star x2, 4-star x1
received: 2026-10-15T14:18:00.000Z
---

# Test Heater — owner batch

Notes: fixture batch.

## 1. Alice Smith - 5 out of 5 stars - Great heater
Reviewed in Canada on January 5, 2026 | Verified Purchase
This heater warms my whole bedroom in minutes. Quiet and safe.

## 2. Bob Jones - 5 out of 5 stars - Works well
Reviewed in Canada on January 6, 2026 | Verified Purchase
Solid build quality and the remote is handy.

## 3. Cara Lee - 4 out of 5 stars - Good value
Reviewed in Canada on January 7, 2026 | Verified Purchase
Heats well, wish the cord was longer.
`;

const FIXTURE_REG = {
  batchId: "owner-feed-fixture",
  batchLabel: "Fixture batch",
  productKey: "amazon.ca:B000TEST01",
  expectedIngested: 3,
  batchText: BATCH_TEXT,
};

function ownerFedRecord(i, body) {
  return { reviewId: `owner-fed-b000test01-${i}`, provenance: "owner_fed", body: body || `Body of review ${i} which is long enough.` };
}

async function registerBatch(reg) {
  const handle = await ledger.keeperJobStart("keeper_event");
  assert.ok(handle, "ledger available");
  await ledger.keeperEvidence(
    handle,
    ledger.CHECK_BATCH_REGISTERED,
    "Owner-feed batch registered",
    "info",
    `Batch ${reg.batchId} registered.`,
    reg
  );
  await ledger.keeperJobFinish(handle, "COMPLETED", 1, 1, "registered");
}

function envOf(extra = {}) {
  return { RI_KEEPER_ENABLED: "1", RI_KEEPER_REPAIRS_ENABLED: "0", ...extra };
}

test("whitelist: non-whitelisted repairs are refused", () => {
  assert.throws(() => keeper.assertWhitelisted("drop_table"), (e) => e.code === "KEEPER_REPAIR_REFUSED");
  assert.throws(() => keeper.assertWhitelisted("send_email_blast"), (e) => e.code === "KEEPER_REPAIR_REFUSED");
  keeper.assertWhitelisted("owner_feed_reingest");
  keeper.assertWhitelisted("tier_a_promote");
  assert.deepEqual([...keeper.keeperRepairWhitelist()], ["owner_feed_reingest", "tier_a_promote"]);
});

test("kill switch: RI_KEEPER_ENABLED=0 runs nothing", async () => {
  stubSupabase.__reset();
  const report = await keeper.runKeeper({ env: { RI_KEEPER_ENABLED: "0" }, now: () => FIXED_NOW });
  assert.equal(report.enabled, false);
  assert.deepEqual(report.lanes, []);
  assert.equal(report.openAiCalls, 0);
});

test("owner-feed: fed-but-not-ingested reads DOWN with the exact missing count", async () => {
  stubSupabase.__reset();
  await registerBatch(FIXTURE_REG);
  const lane = await keeper.checkOwnerFeed([]);
  assert.equal(lane.status, "down");
  assert.equal(lane.evidence.missingTotal, 3);
  assert.equal(lane.evidence.batches[0].missing, 3);
  assert.equal(lane.repairKey, "owner_feed_reingest");
  assert.ok(lane.escalation && lane.escalation.humanAction.length > 0);
});

test("owner-feed: healthy when every expected review is in the corpus", async () => {
  stubSupabase.__reset();
  await registerBatch(FIXTURE_REG);
  stubSupabase.__seed("product_review_library", [
    {
      product_key: "amazon.ca:B000TEST01",
      corpus: [ownerFedRecord(1), ownerFedRecord(2), ownerFedRecord(3)],
      scan_count: 0,
      review_count: 3,
    },
  ]);
  const lane = await keeper.checkOwnerFeed([]);
  assert.equal(lane.status, "healthy");
  assert.equal(lane.evidence.batches[0].missing, 0);
});

test("owner-feed: partial ingest reads DOWN with the remaining missing count", async () => {
  stubSupabase.__reset();
  await registerBatch(FIXTURE_REG);
  stubSupabase.__seed("product_review_library", [
    {
      product_key: "amazon.ca:B000TEST01",
      corpus: [ownerFedRecord(1)],
      scan_count: 0,
      review_count: 1,
    },
  ]);
  const lane = await keeper.checkOwnerFeed([]);
  assert.equal(lane.status, "down");
  assert.equal(lane.evidence.missingTotal, 2);
});

test("owner-feed repair: re-ingest closes the gap; a second run is a no-op", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  await registerBatch(FIXTURE_REG);
  const env = envOf({ RI_KEEPER_REPAIRS_ENABLED: "1" });

  const first = await keeper.runKeeper({ env, now: () => FIXED_NOW });
  const repair = first.repairs.find((r) => r.repairKey === "owner_feed_reingest");
  assert.ok(repair, "repair attempted");
  assert.equal(repair.status, "done");

  const after = await keeper.checkOwnerFeed([]);
  assert.equal(after.status, "healthy");

  const second = await keeper.runKeeper({ env, now: () => FIXED_NOW });
  assert.equal(
    second.repairs.filter((r) => r.repairKey === "owner_feed_reingest" && r.status === "done").length,
    0,
    "second run repairs nothing (idempotent)"
  );
  const rows = await stubSupabase.supabaseSelect(
    "product_review_library",
    "product_key=eq.amazon.ca%3AB000TEST01&select=*&limit=1"
  );
  assert.equal(rows[0].corpus.length, 3, "no duplicate records after two runs");
});

test("owner-feed repair: skipped with escalation when repairs are disabled", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  await registerBatch(FIXTURE_REG);
  const report = await keeper.runKeeper({ env: envOf(), now: () => FIXED_NOW });
  const repair = report.repairs.find((r) => r.repairKey === "owner_feed_reingest");
  assert.ok(repair);
  assert.equal(repair.status, "skipped");
  assert.ok(/disabled/i.test(repair.message));
  assert.ok(report.escalations.some((e) => e.lane === "owner_feed"));
});

test("owner-feed repair: no stored batch text cannot self-repair; escalates", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  await registerBatch({ ...FIXTURE_REG, batchText: undefined });
  const report = await keeper.runKeeper({
    env: envOf({ RI_KEEPER_REPAIRS_ENABLED: "1" }),
    now: () => FIXED_NOW,
  });
  const lane = report.lanes.find((l) => l.lane === "owner_feed");
  assert.equal(lane.status, "down");
  assert.equal(lane.evidence.batches[0].repairable, false);
  const repair = report.repairs.find((r) => r.repairKey === "owner_feed_reingest");
  assert.ok(repair);
  assert.equal(repair.status, "skipped");
  assert.ok(/admin\/owner-feed/.test(lane.escalation.humanAction));
});

test("owner-feed repair: fail-twice stops the repair and escalates", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  // Batch text that will NOT parse -> ingest throws twice, recorded as fails.
  await registerBatch({ ...FIXTURE_REG, batchText: "not a batch at all" });
  const env = envOf({ RI_KEEPER_REPAIRS_ENABLED: "1" });

  const first = await keeper.runKeeper({ env, now: () => FIXED_NOW });
  assert.equal(first.repairs.find((r) => r.repairKey === "owner_feed_reingest").status, "failed");
  const second = await keeper.runKeeper({ env, now: () => FIXED_NOW });
  assert.equal(second.repairs.find((r) => r.repairKey === "owner_feed_reingest").status, "failed");
  const third = await keeper.runKeeper({ env, now: () => FIXED_NOW });
  const outcome = third.repairs.find((r) => r.repairKey === "owner_feed_reingest");
  assert.equal(outcome.status, "skipped");
  assert.ok(/consecutive/i.test(outcome.message));
  assert.ok(third.escalations.some((e) => e.lane === "owner_feed"));
});

test("community: healthy when nothing pending and Tier-A fed", async () => {
  stubSupabase.__reset();
  stubSupabase.__seed("community_reviews", [
    {
      id: "c1",
      product_key: "amazon.ca:B000TEST01",
      stars: 5,
      body: "A solid heater, very happy with the purchase overall.",
      status: "approved",
      verified_purchase: true,
      created_at: isoDaysAgo(2),
    },
  ]);
  stubSupabase.__seed("product_review_library", [
    {
      product_key: "amazon.ca:B000TEST01",
      corpus: [{ reviewId: "community-c1", provenance: { source: "reviewintel_community" }, body: "A solid heater, very happy with the purchase overall." }],
      scan_count: 1,
      review_count: 1,
    },
  ]);
  const lane = await keeper.checkCommunity(keeper.keeperConfig(envOf()), FIXED_NOW);
  assert.equal(lane.status, "healthy");
});

test("community: stale pending reads degraded; ancient pending reads down", async () => {
  stubSupabase.__reset();
  stubSupabase.__seed("community_reviews", [
    { id: "p1", product_key: "amazon.ca:B000TEST01", stars: 4, body: "Waiting on moderation for a while now.", status: "pending", verified_purchase: false, created_at: isoDaysAgo(10) },
  ]);
  let lane = await keeper.checkCommunity(keeper.keeperConfig(envOf()), FIXED_NOW);
  assert.equal(lane.status, "degraded");
  assert.equal(lane.evidence.pending, 1);

  stubSupabase.__reset();
  stubSupabase.__seed("community_reviews", [
    { id: "p2", product_key: "amazon.ca:B000TEST01", stars: 4, body: "Waiting on moderation for a very long time now.", status: "pending", verified_purchase: false, created_at: isoDaysAgo(30) },
  ]);
  lane = await keeper.checkCommunity(keeper.keeperConfig(envOf()), FIXED_NOW);
  assert.equal(lane.status, "down");
});

test("community: Tier-A gap reads degraded and repair promotes it idempotently", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  stubSupabase.__seed("community_reviews", [
    { id: "c1", product_key: "amazon.ca:B000TEST01", stars: 5, body: "A solid heater, very happy with the purchase overall and then some.", status: "approved", verified_purchase: true, created_at: isoDaysAgo(2) },
    { id: "c2", product_key: "amazon.ca:B000TEST01", stars: 2, body: "Died after a month, would not buy again unfortunately.", status: "approved", verified_purchase: true, created_at: isoDaysAgo(2) },
  ]);
  stubSupabase.__seed("product_review_library", [
    { product_key: "amazon.ca:B000TEST01", corpus: [], scan_count: 1, review_count: 0 },
  ]);
  const lane = await keeper.checkCommunity(keeper.keeperConfig(envOf()), FIXED_NOW);
  assert.equal(lane.status, "degraded");
  assert.equal(lane.evidence.tierAGapCount, 2);
  assert.equal(lane.repairKey, "tier_a_promote");

  const report = await keeper.runKeeper({
    env: envOf({ RI_KEEPER_REPAIRS_ENABLED: "1" }),
    now: () => FIXED_NOW,
  });
  const repair = report.repairs.find((r) => r.repairKey === "tier_a_promote");
  assert.ok(repair);
  assert.equal(repair.status, "done");
  assert.equal(repair.after.fedTotal, 2);

  // Second run: nothing left to promote (idempotent).
  const second = await keeper.runKeeper({
    env: envOf({ RI_KEEPER_REPAIRS_ENABLED: "1" }),
    now: () => FIXED_NOW,
  });
  assert.equal(
    second.repairs.filter((r) => r.repairKey === "tier_a_promote" && r.status === "done").length,
    0,
    "promotion is a no-op once fed"
  );
  const rows = await stubSupabase.supabaseSelect(
    "product_review_library",
    "product_key=eq.amazon.ca%3AB000TEST01&select=*&limit=1"
  );
  const ids = rows[0].corpus.map((r) => r.reviewId).sort();
  assert.deepEqual(ids, ["community-c1", "community-c2"]);
});

test("community: fail-soft when the table is absent", async () => {
  stubSupabase.__reset();
  // No community_reviews table at all -> module resolves [] -> healthy with zeros.
  const lane = await keeper.checkCommunity(keeper.keeperConfig(envOf()), FIXED_NOW);
  assert.equal(lane.status, "healthy");
  assert.equal(lane.evidence.total, 0);
});

test("library growth: flat reviews with rising scans reads degraded", async () => {
  stubSupabase.__seed("product_review_library", [
    { product_key: "a", corpus: [], scan_count: 6, review_count: 250, last_seen_at: isoHoursAgo(2), updated_at: isoHoursAgo(2) },
    { product_key: "b", corpus: [], scan_count: 6, review_count: 250, last_seen_at: isoHoursAgo(2), updated_at: isoHoursAgo(2) },
  ]);
  const totals = await keeper.readLibraryTotals(FIXED_NOW);
  assert.equal(totals.reviews, 500);
  const lane = keeper.checkLibraryGrowth(totals, { reviews: 500, scanCount: 10 });
  assert.equal(lane.status, "degraded");
  assert.ok(/not feeding the library/.test(lane.message));
});

test("library growth: rising reviews reads healthy; first run is a baseline", async () => {
  stubSupabase.__reset();
  stubSupabase.__seed("product_review_library", [
    { product_key: "a", corpus: [], scan_count: 6, review_count: 260, last_seen_at: isoHoursAgo(2), updated_at: isoHoursAgo(2) },
  ]);
  const totals = await keeper.readLibraryTotals(FIXED_NOW);
  assert.equal(keeper.checkLibraryGrowth(totals, { reviews: 250, scanCount: 12 }).status, "healthy");
  assert.equal(keeper.checkLibraryGrowth(totals, null).status, "healthy");
});

test("rescue queue: old pendings degrade, very old go down", async () => {
  stubSupabase.__reset();
  stubSupabase.__seed("scan_rescue_queue", [
    { id: "r1", scan_ref: "s1", status: "pending", created_at: isoHoursAgo(60) },
  ]);
  let lane = await keeper.checkRescueQueue(keeper.keeperConfig(envOf()), FIXED_NOW);
  assert.equal(lane.status, "degraded");

  stubSupabase.__reset();
  stubSupabase.__seed("scan_rescue_queue", [
    { id: "r2", scan_ref: "s2", status: "pending", created_at: isoDaysAgo(10) },
  ]);
  lane = await keeper.checkRescueQueue(keeper.keeperConfig(envOf()), FIXED_NOW);
  assert.equal(lane.status, "down");
  assert.ok(lane.escalation);
});

test("rescue queue: empty reads healthy", async () => {
  stubSupabase.__reset();
  const lane = await keeper.checkRescueQueue(keeper.keeperConfig(envOf()), FIXED_NOW);
  assert.equal(lane.status, "healthy");
});

test("runKeeper: ledger rows for checks, repairs, escalations, and summary", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  await registerBatch(FIXTURE_REG);
  stubSupabase.__seed("product_review_library", [
    { product_key: "amazon.ca:B000TEST01", corpus: [], scan_count: 0, review_count: 0, last_seen_at: isoHoursAgo(1), updated_at: isoHoursAgo(1) },
  ]);
  const report = await keeper.runKeeper({ env: envOf(), now: () => FIXED_NOW });
  assert.ok(report.ledger.jobId, "job opened");
  assert.equal(report.openAiCalls, 0);

  const evidence = await stubSupabase.supabaseSelect("ri_ops_evidence", "select=check_id,status&limit=500");
  const checkIds = evidence.map((e) => e.check_id);
  assert.ok(checkIds.includes("keeper.check.owner_feed"), "owner-feed check logged");
  assert.ok(checkIds.includes("keeper.check.community"), "community check logged");
  assert.ok(checkIds.includes("keeper.check.library_growth"), "growth check logged");
  assert.ok(checkIds.includes("keeper.check.rescue_queue"), "rescue check logged");
  assert.ok(checkIds.includes("keeper.check.scan_activity"), "scan activity logged");
  assert.ok(checkIds.includes("keeper.escalation"), "escalation logged");
  assert.ok(checkIds.includes("keeper.run_summary"), "run summary logged");

  const jobs = await stubSupabase.supabaseSelect("ri_ops_jobs", "select=*&limit=10");
  const run = jobs.find((j) => j.job_type === "keeper_run");
  assert.ok(run);
  assert.equal(run.status, "FAILED", "down lane marks the run failed");
});

test("runKeeper: sends one consolidated escalation email; flag disables it", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  await registerBatch(FIXTURE_REG);
  await keeper.runKeeper({ env: envOf(), now: () => FIXED_NOW });
  assert.equal(stubEmail.__sent().length, 1);
  assert.ok(/Keeper/.test(stubEmail.__sent()[0].subject));
  assert.equal(stubEmail.__sent()[0].to, "support@getreviewintel.com");

  stubSupabase.__reset();
  stubEmail.__reset();
  await registerBatch(FIXTURE_REG);
  await keeper.runKeeper({ env: envOf({ RI_KEEPER_EMAIL_ESCALATIONS: "0" }), now: () => FIXED_NOW });
  assert.equal(stubEmail.__sent().length, 0);
});

test("runKeeper: healthy store produces a clean report and COMPLETED run", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  // Healthy fixtures across lanes, including both seed batches fully ingested.
  const fedMany = (n) => Array.from({ length: n }, (_, i) => ({ reviewId: `of-${i}`, provenance: "owner_fed", body: `Seed batch review body number ${i}, long enough to count.` }));
  stubSupabase.__seed("product_review_library", [
    {
      product_key: "amazon.ca:B000TEST01",
      corpus: [ownerFedRecord(1), ownerFedRecord(2), ownerFedRecord(3)],
      scan_count: 2,
      review_count: 3,
      last_seen_at: isoHoursAgo(1),
      updated_at: isoHoursAgo(1),
    },
    {
      product_key: "amazon.ca:B0DGJDKHRQ",
      corpus: fedMany(73),
      scan_count: 3,
      review_count: 73,
      last_seen_at: isoHoursAgo(1),
      updated_at: isoHoursAgo(1),
    },
    {
      product_key: "amazon.ca:B097RG67QB",
      corpus: fedMany(49),
      scan_count: 1,
      review_count: 49,
      last_seen_at: isoHoursAgo(1),
      updated_at: isoHoursAgo(1),
    },
  ]);
  await registerBatch(FIXTURE_REG);
  const report = await keeper.runKeeper({ env: envOf(), now: () => FIXED_NOW });
  assert.equal(report.ok, true);
  assert.equal(report.lanes.find((l) => l.lane === "owner_feed").status, "healthy");
  assert.equal(report.lanes.find((l) => l.lane === "community").status, "healthy");
  assert.equal(report.escalations.length, 0);
  assert.equal(stubEmail.__sent().length, 0, "no email when nothing is wrong");
  const jobs = await stubSupabase.supabaseSelect("ri_ops_jobs", "select=*&limit=10");
  const run = jobs.find((j) => j.job_type === "keeper_run");
  assert.equal(run.status, "COMPLETED");
});

test("runKeeper: seed batches surface the Oct-15 failure on an empty store", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  const report = await keeper.runKeeper({ env: envOf(), now: () => FIXED_NOW });
  const lane = report.lanes.find((l) => l.lane === "owner_feed");
  assert.equal(lane.status, "down");
  assert.equal(lane.evidence.missingTotal, 73 + 49, "both seed batches missing in full");
});
