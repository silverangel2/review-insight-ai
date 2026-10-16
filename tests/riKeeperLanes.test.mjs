// RI Keeper v2 lane tests — library guardian, deploy doctor, social postman.
// Runs the REAL keeper lane code against the same in-memory stubs as the
// v1 suite. Baselines: guardian snapshot persistence, shrink/duplicate/
// vanished detection, deploy stamp change + suspect logic + expected-build
// enforcement, postman real-failure escalation + dedup + label immunity.
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
const isoHoursAgo = (h) => new Date(FIXED_NOW - h * 60 * 60 * 1000).toISOString();
const isoDaysAgo = (d) => new Date(FIXED_NOW - d * 24 * 60 * 60 * 1000).toISOString();

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA_EXPECTED = "dddddddddddddddddddddddddddddddddddddddd";

function libraryRow(key, reviewCount, scanCount = 1, hoursAgo = 2) {
  return {
    product_key: key,
    corpus: [],
    review_count: reviewCount,
    scan_count: scanCount,
    last_seen_at: isoHoursAgo(hoursAgo),
    updated_at: isoHoursAgo(hoursAgo),
  };
}

async function writeRunSummary(laneStatuses) {
  const handle = await ledger.keeperJobStart("keeper_run");
  assert.ok(handle);
  await ledger.keeperEvidence(
    handle,
    ledger.CHECK_RUN_SUMMARY,
    "Keeper run summary",
    "info",
    "previous run",
    { totals: {}, laneStatuses, repairs: [] }
  );
  await ledger.keeperJobFinish(handle, "COMPLETED", 1, 1, "summary");
  return handle;
}

// ── Library Guardian ─────────────────────────────────────────────────────

test("library guardian: first run records the baseline, healthy", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  stubSupabase.__seed("product_review_library", [
    libraryRow("amazon.ca:KEY01", 54),
    libraryRow("amazon.ca:KEY02", 86),
  ]);
  const handle = await ledger.keeperJobStart("keeper_run");
  const lane = await keeper.checkLibraryGuardian(handle);
  assert.equal(lane.lane, "library_guardian");
  assert.equal(lane.status, "healthy");
  assert.ok(/baseline recorded/i.test(lane.message));
  const snap = await keeper.readLibraryGuardianSnapshot();
  assert.ok(snap);
  assert.equal(Object.keys(snap.keys).length, 2);
  assert.equal(snap.keys["amazon.ca:KEY01"].reviewCount, 54);
});

test("library guardian: no change reads healthy", async () => {
  stubSupabase.__reset();
  stubSupabase.__seed("product_review_library", [libraryRow("amazon.ca:KEY01", 54)]);
  const h1 = await ledger.keeperJobStart("keeper_run");
  await keeper.checkLibraryGuardian(h1);
  const h2 = await ledger.keeperJobStart("keeper_run");
  const lane = await keeper.checkLibraryGuardian(h2);
  assert.equal(lane.status, "healthy");
  assert.ok(/nominal/i.test(lane.message));
});

test("library guardian: shrink reads DOWN with before/after and plain cause", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  stubSupabase.__seed("product_review_library", [libraryRow("amazon.ca:KEY01", 54)]);
  const h1 = await ledger.keeperJobStart("keeper_run");
  await keeper.checkLibraryGuardian(h1);

  // The Oct-16 shrink shape: 54 → 7. (Keep the ledger: the snapshot
  // lives in the ops evidence table.)
  stubSupabase.__tables().set("product_review_library", [libraryRow("amazon.ca:KEY01", 7)]);
  const h2 = await ledger.keeperJobStart("keeper_run");
  const lane = await keeper.checkLibraryGuardian(h2);
  assert.equal(lane.status, "down");
  assert.ok(/54 → 7/.test(lane.message), `message names the shrink: ${lane.message}`);
  assert.ok(lane.message.includes("amazon.ca:KEY01"));
  const finding = lane.evidence.findings.find((f) => f.kind === "shrink");
  assert.ok(finding);
  assert.equal(finding.before, 54);
  assert.equal(finding.after, 7);
  assert.ok(lane.escalation, "escalation present");
  assert.ok(lane.escalation.likelyCause.length > 0, "plain-words likely cause");
  assert.ok(lane.escalation.humanAction.length > 0, "exact human action");
});

test("library guardian: duplicate rows read DEGRADED and name the key", async () => {
  stubSupabase.__reset();
  stubSupabase.__seed("product_review_library", [
    libraryRow("amazon.ca:KEY01", 54),
    libraryRow("amazon.ca:KEY01", 20, 1, 1), // duplicate, fresher
  ]);
  const handle = await ledger.keeperJobStart("keeper_run");
  const lane = await keeper.checkLibraryGuardian(handle);
  assert.equal(lane.status, "degraded");
  const finding = lane.evidence.findings.find((f) => f.kind === "duplicate_rows");
  assert.ok(finding);
  assert.equal(finding.rows, 2);
  assert.ok(lane.message.includes("amazon.ca:KEY01"));
  assert.ok(/dedupe/i.test(lane.escalation.humanAction), "human action names the dedupe migration");
});

test("library guardian: vanished key reads DOWN", async () => {
  stubSupabase.__reset();
  stubSupabase.__seed("product_review_library", [
    libraryRow("amazon.ca:KEY01", 54),
    libraryRow("amazon.ca:KEY02", 10),
  ]);
  const h1 = await ledger.keeperJobStart("keeper_run");
  await keeper.checkLibraryGuardian(h1);

  stubSupabase.__tables().set("product_review_library", [libraryRow("amazon.ca:KEY01", 54)]);
  const h2 = await ledger.keeperJobStart("keeper_run");
  const lane = await keeper.checkLibraryGuardian(h2);
  assert.equal(lane.status, "down");
  const finding = lane.evidence.findings.find((f) => f.kind === "vanished_key");
  assert.ok(finding);
  assert.equal(finding.productKey, "amazon.ca:KEY02");
  assert.ok(lane.escalation);
});

test("library guardian: canonical count follows the freshest row (PR #55 read)", async () => {
  stubSupabase.__reset();
  stubSupabase.__seed("product_review_library", [
    libraryRow("amazon.ca:KEY01", 86, 1, 5), // older, larger
    libraryRow("amazon.ca:KEY01", 20, 1, 1), // fresher, smaller — what the scorer reads
  ]);
  const handle = await ledger.keeperJobStart("keeper_run");
  const lane = await keeper.checkLibraryGuardian(handle);
  const snap = await keeper.readLibraryGuardianSnapshot();
  assert.equal(snap.keys["amazon.ca:KEY01"].reviewCount, 20, "canonical = freshest row");
});

// ── Deploy Doctor ────────────────────────────────────────────────────────

test("deploy doctor: no stamp off Vercel → unknown, observation-only", async () => {
  stubSupabase.__reset();
  const lane = await keeper.checkDeployDoctor({}, [], null);
  assert.equal(lane.lane, "deploy_doctor");
  assert.equal(lane.status, "unknown");
  assert.ok(/observation-only/i.test(lane.message));
  assert.equal(lane.escalation, undefined);
});

test("deploy doctor: stable stamp reads healthy, no drift", async () => {
  stubSupabase.__reset();
  const env = { VERCEL_GIT_COMMIT_SHA: SHA_A };
  const h1 = await ledger.keeperJobStart("keeper_run");
  const first = await keeper.checkDeployDoctor(env, [], h1);
  assert.equal(first.status, "healthy");
  const h2 = await ledger.keeperJobStart("keeper_run");
  const second = await keeper.checkDeployDoctor(env, [], h2);
  assert.equal(second.status, "healthy");
  assert.ok(/still live; no drift/i.test(second.message));
  assert.equal(second.evidence.changed, false);
});

test("deploy doctor: stamp change alone is info, not an escalation", async () => {
  stubSupabase.__reset();
  const h1 = await ledger.keeperJobStart("keeper_run");
  await keeper.checkDeployDoctor({ VERCEL_GIT_COMMIT_SHA: SHA_A }, [], h1);
  await writeRunSummary({ owner_feed: "healthy", community: "healthy" });
  const h2 = await ledger.keeperJobStart("keeper_run");
  const lane = await keeper.checkDeployDoctor(
    { VERCEL_GIT_COMMIT_SHA: SHA_B },
    [
      { lane: "owner_feed", status: "healthy", message: "", evidence: {} },
      { lane: "community", status: "healthy", message: "", evidence: {} },
    ],
    h2
  );
  assert.equal(lane.status, "healthy");
  assert.ok(/new build live/i.test(lane.message));
  assert.ok(lane.message.includes(SHA_A.slice(0, 12)));
  assert.ok(lane.message.includes(SHA_B.slice(0, 12)));
  assert.equal(lane.escalation, undefined);
});

test("deploy doctor: fresh failures right after a stamp change → 'deploy suspect' DOWN", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  const h1 = await ledger.keeperJobStart("keeper_run");
  await keeper.checkDeployDoctor({ VERCEL_GIT_COMMIT_SHA: SHA_A }, [], h1);
  await writeRunSummary({ owner_feed: "healthy", community: "healthy" });

  const h2 = await ledger.keeperJobStart("keeper_run");
  const lane = await keeper.checkDeployDoctor(
    { VERCEL_GIT_COMMIT_SHA: SHA_B },
    [
      { lane: "owner_feed", status: "down", message: "regressed", evidence: {} },
      { lane: "community", status: "healthy", message: "", evidence: {} },
    ],
    h2
  );
  assert.equal(lane.status, "down");
  assert.ok(/deploy suspect/i.test(lane.message));
  assert.ok(lane.message.includes("owner_feed"), "names the failing lane");
  assert.ok(!lane.message.includes("community"), "does not name the healthy lane");
  assert.ok(lane.escalation);
  assert.ok(/roll back/i.test(lane.escalation.humanAction));
});

test("deploy doctor: expected build mismatch escalates after 2 consecutive runs", async () => {
  stubSupabase.__reset();
  const env = { VERCEL_GIT_COMMIT_SHA: SHA_A, RI_EXPECTED_BUILD_SHA: SHA_EXPECTED };
  const h1 = await ledger.keeperJobStart("keeper_run");
  const first = await keeper.checkDeployDoctor(env, [], h1);
  assert.equal(first.status, "degraded", "first mismatch only watches");
  assert.equal(first.evidence.consecutiveMismatches, 1);

  const h2 = await ledger.keeperJobStart("keeper_run");
  const second = await keeper.checkDeployDoctor(env, [], h2);
  assert.equal(second.status, "down");
  assert.ok(/not live after 2 consecutive/i.test(second.message));
  assert.ok(second.escalation);
  assert.ok(/build logs/i.test(second.escalation.humanAction));
});

test("deploy doctor: expected build matching reads healthy", async () => {
  stubSupabase.__reset();
  const env = { VERCEL_GIT_COMMIT_SHA: SHA_A, RI_EXPECTED_BUILD_SHA: SHA_A };
  const lane = await keeper.checkDeployDoctor(env, [], null);
  assert.equal(lane.status, "healthy");
});

// ── Social Postman ───────────────────────────────────────────────────────

function failedPost(id, platform, topic, error, hoursAgo) {
  return {
    id,
    platform,
    topic,
    status: "failed",
    error,
    created_at: hoursAgo == null ? isoHoursAgo(5) : isoHoursAgo(hoursAgo),
  };
}

test("social postman: no failed posts → healthy", async () => {
  stubSupabase.__reset();
  const lane = await keeper.checkSocialPostman(null, FIXED_NOW);
  assert.equal(lane.lane, "social_postman");
  assert.equal(lane.status, "healthy");
  assert.ok(/no failed social posts/i.test(lane.message));
});

test("social postman: real failure reads DOWN with platform/topic/error", async () => {
  stubSupabase.__reset();
  stubSupabase.__seed("admin_social_posts", [
    failedPost("p1", "facebook", "weighted blanket", "Facebook Reel publish failed.", 5),
  ]);
  const handle = await ledger.keeperJobStart("keeper_run");
  const lane = await keeper.checkSocialPostman(handle, FIXED_NOW);
  assert.equal(lane.status, "down");
  assert.ok(lane.message.includes("facebook/weighted blanket"));
  const failure = lane.evidence.failures[0];
  assert.equal(failure.id, "p1");
  assert.equal(failure.error, "Facebook Reel publish failed.");
  assert.ok(lane.escalation);
  assert.ok(lane.escalation.humanAction.includes("Facebook Reel publish failed."), "escalation carries the failure text");
});

test("social postman: does not re-escalate the same post twice", async () => {
  stubSupabase.__reset();
  stubSupabase.__seed("admin_social_posts", [
    failedPost("p1", "facebook", "weighted blanket", "Facebook Reel publish failed.", 5),
  ]);
  const h1 = await ledger.keeperJobStart("keeper_run");
  const first = await keeper.checkSocialPostman(h1, FIXED_NOW);
  assert.equal(first.status, "down");

  const h2 = await ledger.keeperJobStart("keeper_run");
  const second = await keeper.checkSocialPostman(h2, FIXED_NOW);
  assert.equal(second.status, "healthy");
  assert.ok(/already escalated/i.test(second.message));
});

test("social postman: old failures outside the lookback are ignored", async () => {
  stubSupabase.__reset();
  stubSupabase.__seed("admin_social_posts", [
    { id: "old1", platform: "tiktok", topic: "airpods", status: "failed", error: "TikTok upload failed.", created_at: isoDaysAgo(30) },
  ]);
  const lane = await keeper.checkSocialPostman(null, FIXED_NOW);
  assert.equal(lane.status, "healthy");
  assert.equal(lane.evidence.failedPostsFound, 0);
});

test("social postman: status labels are never failures", async () => {
  stubSupabase.__reset();
  stubSupabase.__seed("admin_social_posts", [
    { id: "l1", platform: "facebook", topic: "blanket", status: "needs_attention", error: "low engagement", created_at: isoHoursAgo(5) },
    { id: "l2", platform: "instagram", topic: "heater", status: "draft_ready", error: null, created_at: isoHoursAgo(5) },
  ]);
  const lane = await keeper.checkSocialPostman(null, FIXED_NOW);
  assert.equal(lane.status, "healthy");
  assert.equal(lane.evidence.failedPostsFound, 0, "labels are not matched by the failed query");
});

// ── End-to-end: runKeeper carries the new lanes ──────────────────────────

test("runKeeper: new lanes run inside the suite and stay silent when clean", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  stubSupabase.__seed("product_review_library", [
    libraryRow("amazon.ca:KEY01", 54, 2, 1),
  ]);
  const report = await keeper.runKeeper({ env: { RI_KEEPER_ENABLED: "1" }, now: () => FIXED_NOW });
  const names = report.lanes.map((l) => l.lane);
  assert.ok(names.includes("library_guardian"), "guardian lane runs");
  assert.ok(names.includes("social_postman"), "postman lane runs");
  assert.ok(names.includes("deploy_doctor"), "deploy doctor lane runs");
  assert.equal(report.lanes.find((l) => l.lane === "library_guardian").status, "healthy");
  assert.equal(report.lanes.find((l) => l.lane === "social_postman").status, "healthy");
  assert.equal(report.lanes.find((l) => l.lane === "deploy_doctor").status, "unknown", "no stamp off Vercel");
  assert.equal(report.openAiCalls, 0);
});

test("runKeeper: a guardian finding flows into escalations + the email", async () => {
  stubSupabase.__reset();
  stubEmail.__reset();
  stubSupabase.__seed("product_review_library", [libraryRow("amazon.ca:KEY01", 54)]);
  const h1 = await ledger.keeperJobStart("keeper_run");
  await keeper.checkLibraryGuardian(h1);

  // Simulate the shrink between runs WITHOUT wiping the ledger (the
  // snapshot lives in the ops evidence table).
  stubSupabase.__tables().set("product_review_library", [libraryRow("amazon.ca:KEY01", 7)]);
  const report = await keeper.runKeeper({ env: { RI_KEEPER_ENABLED: "1" }, now: () => FIXED_NOW });
  const guardian = report.lanes.find((l) => l.lane === "library_guardian");
  assert.equal(guardian.status, "down");
  assert.ok(report.escalations.some((e) => e.lane === "library_guardian"), "escalation recorded");
  assert.ok(stubEmail.__sent().length >= 1, "escalation email sent");
  assert.ok(
    report.escalations.some((e) => e.lane === "library_guardian" && /amazon.ca:KEY01/.test(e.message)),
    "escalation names the product key"
  );
});

// ── Rescue Prep ──────────────────────────────────────────────────────────

const PREP_URL = "https://www.amazon.ca/dp/B0DGJDKHRQ"; // parses canonically to amazon.ca:B0DGJDKHRQ

function prepItem(id, scanRef) {
  return {
    id,
    scan_ref: scanRef,
    account_email: "shopper@example.com",
    product_key: null,
    product_name: "Test Product",
    product_url: PREP_URL,
    reason: "thin written reviews",
    created_at: "2026-10-16T12:00:00.000Z",
  };
}

function prepRow(id, scanRef) {
  return {
    id,
    scan_ref: scanRef,
    account_email: "shopper@example.com",
    product_key: null,
    product_name: "Test Product",
    product_url: PREP_URL,
    reason: "thin written reviews",
    status: "pending",
    created_at: isoHoursAgo(2),
    updated_at: isoHoursAgo(2),
  };
}

/** Mocked RescuePrepStore: in-memory, records everything it is asked to do. */
function mockPrepStore(items, { saveResult = true, alreadyStored = new Set() } = {}) {
  const byRef = new Map();
  for (const it of items) {
    byRef.set(String(it.scan_ref), it);
    byRef.set(String(it.id), it);
  }
  const saved = [];
  let loadCalls = 0;
  const store = {
    loadRescueQueueItem: async (ref) => {
      loadCalls += 1;
      return byRef.get(String(ref)) ?? null;
    },
    loadLibraryCorpusSize: async () => ({ size: 12, scanCount: 2 }),
    loadPriorScans: async () => [],
    loadAggregateSnapshot: async () => ({ rating: 4.2, count: 100 }),
    loadPrepPack: async (queueId) =>
      alreadyStored.has(String(queueId)) ? { queueId: String(queueId) } : null,
    savePrepPack: async (pack) => {
      saved.push(pack);
      return saveResult;
    },
  };
  return { store, saved, loadCalls: () => loadCalls };
}

test("rescue prep: pending item gets a pack prepared (mocked store)", async () => {
  stubSupabase.__reset();
  const items = [prepItem("q1", "scan-a"), prepItem("q2", "scan-b"), prepItem("q3", "scan-c")];
  const { store, saved } = mockPrepStore(items, { alreadyStored: new Set(["q3"]) });

  const lane = await keeper.checkRescuePrep(null, {
    store,
    listPendingItems: async () => items,
  });

  assert.equal(lane.lane, "rescue_prep");
  assert.equal(lane.status, "healthy");
  assert.deepEqual(lane.evidence.prepared, ["q1", "q2"]);
  assert.deepEqual(lane.evidence.alreadyHadPacks, ["q3"]);
  assert.equal(saved.length, 2, "exactly the two new packs persisted");
  assert.equal(saved[0].productKey, "amazon.ca:B0DGJDKHRQ", "pack keyed by the canonical link parse");
  assert.equal(saved[0].customerWaiting, true, "account email marks a waiting customer");
  assert.ok(!("repairKey" in lane), "escalate-only: no repair key named");
});

test("rescue prep: storage absent completes with the honest note, degraded", async () => {
  stubSupabase.__reset();
  const items = [prepItem("q1", "scan-a")];
  const { store } = mockPrepStore(items, { saveResult: false }); // migration not applied

  const lane = await keeper.checkRescuePrep(null, {
    store,
    listPendingItems: async () => items,
  });

  assert.equal(lane.status, "degraded");
  assert.equal(lane.evidence.storagePresent, false);
  assert.ok(lane.message.includes("not provisioned"), "honest note, not an error");
  assert.ok(lane.message.includes("20261016_rescue_prep_packs.sql"), "names the migration file");
  assert.ok(lane.escalation, "escalates the human action");
  assert.ok(
    lane.escalation.humanAction.includes("20261016_rescue_prep_packs.sql"),
    "escalation tells Junel exactly what to paste"
  );
});

test("rescue prep: queue rows untouched by the lane", async () => {
  stubSupabase.__reset();
  stubSupabase.__seed("scan_rescue_queue", [prepRow("q1", "scan-a"), prepRow("q2", "scan-b")]);
  const before = JSON.stringify(stubSupabase.__tables().get("scan_rescue_queue"));
  const items = [prepItem("q1", "scan-a"), prepItem("q2", "scan-b")];
  const { store } = mockPrepStore(items, { saveResult: true });

  // Default enumeration: reads the REAL stubbed queue (no listPendingItems override).
  const lane = await keeper.checkRescuePrep(null, { store });

  assert.equal(lane.status, "healthy");
  assert.deepEqual(lane.evidence.prepared, ["q1", "q2"]);
  const after = JSON.stringify(stubSupabase.__tables().get("scan_rescue_queue"));
  assert.equal(after, before, "no queue row was written, statused, or deleted");
  const rows = stubSupabase.__tables().get("scan_rescue_queue");
  assert.ok(rows.every((r) => r.status === "pending"), "both rows still pending");
});

test("rescue prep: cap enforced — 5 pending items, 3 packs, 2 deferred", async () => {
  stubSupabase.__reset();
  const items = ["a", "b", "c", "d", "e"].map((s, i) => prepItem(`q${i + 1}`, `scan-${s}`));
  const mock = mockPrepStore(items, { saveResult: true });

  const lane = await keeper.checkRescuePrep(null, {
    store: mock.store,
    listPendingItems: async () => items,
  });

  assert.equal(lane.status, "healthy");
  assert.equal(mock.loadCalls(), 3, "only 3 items touched this run");
  assert.deepEqual(lane.evidence.prepared, ["q1", "q2", "q3"]);
  assert.equal(lane.evidence.capped, 2, "2 deferred to the next run");
  assert.ok(lane.message.includes("deferred"), "message says the rest wait for the next run");
});
