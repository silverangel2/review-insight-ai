import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/* ------------------------------------------------------------------ */
/* Fixtures. POISON marks text that must never reach the payload:      */
/* review prose, emails, QA offending strings, human-action prose,     */
/* raw error strings, corpus fingerprints, intervention details.       */
/* ------------------------------------------------------------------ */

const POISON = "POISON";
// Fixture times hang off the real clock so both the injected-clock
// calls and buildSophieSitrep's own clock see the same 24h window.
const NOW = new Date();
const iso = (msAgo) => new Date(NOW.getTime() - msAgo).toISOString();
const H = 60 * 60 * 1000;

// Shaped from tonight's real record (scan_097f7c03, build b54bd121):
// the Referee held a computed BUY 76 to a printed WAIT 74 (duty D3,
// no material delta) and capped confidence at Low (duty D5).
const sonyRefereeDecision = {
  version: "make-sense-referee-v1",
  status: "HOLD",
  interventions: [
    {
      code: "VERDICT_HELD_NO_MATERIAL_DELTA",
      duty: "D3",
      detail: `${POISON} referee detail prose`,
      numbers: { newUniqueOpinions: 0, requiredNewOpinions: 2 },
    },
    {
      code: "CONFIDENCE_CAPPED",
      duty: "D5",
      detail: `${POISON} cap detail prose`,
      numbers: { uniqueOpinions: 10, independentSources: 1 },
    },
  ],
  uniqueOpinionCount: 10,
  independentSourceCount: 1,
  variantDuplicatesCollapsed: 0,
  newUniqueOpinionCount: 0,
  storedOpinionCount: 10,
  previousVerdict: "WAIT",
  newVerdict: "BUY",
  heldVerdict: "WAIT",
  computedScore: 76,
  printedScore: 74,
  confidenceCeiling: "Low",
  confidenceCapped: true,
  countsReconciled: true,
  corpusFingerprint: `${POISON}_CORPUS_FINGERPRINT`,
  decidedAt: iso(4 * H),
};

const syntheticRefereeDecision = {
  version: "make-sense-referee-v1",
  status: "PASS_WITH_CORRECTIONS",
  interventions: [
    {
      code: "VARIANT_DUPLICATE_COLLAPSED",
      duty: "D1",
      detail: `${POISON} collapse prose`,
      numbers: { collapsed: 3 },
    },
  ],
  uniqueOpinionCount: 8,
  independentSourceCount: 2,
  variantDuplicatesCollapsed: 3,
  newUniqueOpinionCount: null,
  storedOpinionCount: null,
  previousVerdict: null,
  newVerdict: "BUY",
  heldVerdict: null,
  computedScore: 81,
  printedScore: 81,
  confidenceCeiling: "High",
  confidenceCapped: false,
  countsReconciled: true,
  corpusFingerprint: `${POISON}_SECOND_FINGERPRINT`,
  decidedAt: iso(2 * H),
};

function scanOp(overrides) {
  return {
    scan_id: "scan_x",
    account_key_hash: "hash",
    operation_key: "op",
    product_url: `https://example.com/${POISON}`,
    request_hash: "rh",
    status: "COMPLETED",
    result_json: null,
    error_code: null,
    created_at: iso(5 * H),
    updated_at: iso(4 * H),
    ...overrides,
  };
}

const scanOperations = [
  scanOp({
    scan_id: "scan_sony",
    created_at: iso(5 * H),
    updated_at: iso(4 * H),
    result_json: {
      verdict: "WAIT",
      buyScore: 74,
      evidenceState: "usable",
      finalDecisionSource: "reviewEvidence",
      detectedProductKey: "amazon.com:B0BXYZ9876",
      corpus: [`${POISON} raw review text`],
      retrievalDiagnostics: {
        writtenReviewsAccepted: 10,
        rejectedWrittenReviews: 1,
        finalStopReason: "evidence_target_reached",
        reviewHunt: { fired: false },
        libraryFingerprintPool: { matchedProductKeys: [], pooledReviews: 0 },
        reviews: [`${POISON} another raw review`],
      },
      refereeDecision: sonyRefereeDecision,
    },
  }),
  scanOp({
    scan_id: "scan_synth",
    created_at: iso(3 * H),
    updated_at: iso(2 * H),
    result_json: {
      verdict: "BUY",
      buyScore: 81,
      evidenceState: "strong",
      finalDecisionSource: "reviewEvidence",
      detectedProductKey: "amazon.com:B0BXYZ0000",
      retrievalDiagnostics: {
        writtenReviewsAccepted: 8,
        rejectedWrittenReviews: 4,
        finalStopReason: "evidence_target_reached",
        reviewHunt: { fired: true },
        libraryFingerprintPool: {
          matchedProductKeys: ["k1", "k2"],
          pooledReviews: 13,
        },
      },
      refereeDecision: syntheticRefereeDecision,
    },
  }),
  scanOp({
    scan_id: "scan_old",
    created_at: iso(72 * H),
    updated_at: iso(70 * H),
    result_json: {
      verdict: "BUY",
      buyScore: 66,
      refereeDecision: {
        ...syntheticRefereeDecision,
        status: "PASS",
        interventions: [],
      },
    },
  }),
  scanOp({
    scan_id: "scan_null_result",
    created_at: iso(6 * H),
    updated_at: iso(6 * H),
    result_json: null,
  }),
  scanOp({
    scan_id: "scan_garbage_referee",
    created_at: iso(7 * H),
    updated_at: iso(7 * H),
    result_json: { verdict: "WAIT", refereeDecision: `${POISON} not an object` },
  }),
  scanOp({
    scan_id: "scan_failed",
    status: "FAILED",
    error_code: "SCRAPE_TIMEOUT",
    created_at: iso(1 * H),
    updated_at: iso(1 * H),
  }),
  scanOp({
    scan_id: "scan_blocked",
    status: "BLOCKED",
    error_code: `${POISON} raw prose error with email leak@example.com`,
    created_at: iso(1 * H),
    updated_at: iso(1 * H),
  }),
  scanOp({
    scan_id: "scan_running",
    status: "RUNNING",
    created_at: iso(30 * 60 * 1000),
    updated_at: iso(30 * 60 * 1000),
  }),
];

const rescueRows = [];
for (let i = 1; i <= 60; i += 1) {
  rescueRows.push({
    id: `rq-p-${i}`,
    scan_ref: `scan_ref_${i}`,
    account_email: i % 2 === 0 ? `${POISON.toLowerCase()}-person@example.com` : null,
    product_key: `amazon.com:KEY${i}`,
    product_name: `Fixture Product ${i}`,
    product_url: `https://example.com/p?x=${POISON}`,
    reason:
      i % 2 === 0
        ? "Review evidence could not be fetched for this product."
        : "Not enough written reviews to score this product fairly.",
    status: "pending",
    verdict: null,
    buying_score: null,
    created_at: iso((61 - i) * 10 * 60 * 1000),
    updated_at: iso((61 - i) * 10 * 60 * 1000),
    rescued_at: null,
    emailed_at: null,
  });
}
for (let i = 1; i <= 3; i += 1) {
  rescueRows.push({
    id: `rq-r-${i}`,
    scan_ref: `scan_ref_r${i}`,
    account_email: `${POISON.toLowerCase()}-buyer@example.com`,
    product_key: `amazon.com:RESC${i}`,
    product_name: `Rescued Product ${i}`,
    product_url: "https://example.com/r",
    reason: "Review evidence could not be fetched for this product.",
    status: "rescued",
    verdict: "WAIT",
    buying_score: 55,
    created_at: iso(20 * H),
    updated_at: iso(i * H),
    rescued_at: iso(i * H),
    emailed_at: null,
  });
}
for (let i = 1; i <= 2; i += 1) {
  rescueRows.push({
    id: `rq-e-${i}`,
    scan_ref: `scan_ref_e${i}`,
    account_email: null,
    product_key: `amazon.com:EM${i}`,
    product_name: `Emailed Product ${i}`,
    product_url: "https://example.com/e",
    reason: "Not enough written reviews to score this product fairly.",
    status: "emailed",
    verdict: "WAIT",
    buying_score: 50,
    created_at: iso(22 * H),
    updated_at: iso(2 * H),
    rescued_at: iso(3 * H),
    emailed_at: iso(2 * H),
  });
}
rescueRows.push({
  id: "rq-c-1",
  scan_ref: "scan_ref_c1",
  account_email: null,
  product_key: "amazon.com:CL1",
  product_name: "Closed Product",
  product_url: "https://example.com/c",
  reason: "some unrecognized prose reason",
  status: "closed",
  verdict: null,
  buying_score: null,
  created_at: iso(23 * H),
  updated_at: iso(23 * H),
  rescued_at: null,
  emailed_at: null,
});

const opsJobs = [
  {
    id: "job-keeper-1",
    job_type: "ops_sweep",
    level: 1,
    status: "COMPLETED",
    payload: { source: "keeper", lane: "all" },
    error: null,
    result_summary: "sweep complete",
    created_at: iso(1 * H),
    updated_at: iso(1 * H),
    started_at: iso(1 * H),
    finished_at: iso(55 * 60 * 1000),
  },
];
const opsAttempts = [
  {
    id: "att-1",
    job_id: "job-keeper-1",
    attempt_number: 1,
    status: "completed",
    checks_total: 9,
    checks_passed: 7,
    checks_failed: 2,
    summary: {},
    started_at: iso(1 * H),
    finished_at: iso(55 * 60 * 1000),
  },
];
const opsEvidence = [
  {
    id: "ev-qa-1",
    job_id: "job-keeper-1",
    attempt_id: "att-1",
    check_id: "qa_inspector.defect.aggregate_twice",
    label: "QA",
    status: "fail",
    message: `${POISON} qa message prose`,
    details: {
      scanId: "scan_sony",
      defectClass: "aggregate_twice",
      offendingString: `${POISON} OFFENDING STRING`,
      field: "decisionBrief.factRows",
    },
    created_at: iso(50 * 60 * 1000),
  },
  {
    id: "ev-qa-2",
    job_id: "job-keeper-1",
    attempt_id: "att-1",
    check_id: "qa_inspector.defect.aggregate_twice",
    label: "QA",
    status: "fail",
    message: `${POISON} qa message prose`,
    details: {
      scanId: "scan_synth",
      defectClass: "aggregate_twice",
      offendingString: `${POISON} OFFENDING STRING 2`,
      field: "decisionBrief.factRows[1]",
    },
    created_at: iso(51 * 60 * 1000),
  },
  {
    id: "ev-esc-1",
    job_id: "job-keeper-1",
    attempt_id: "att-1",
    check_id: "keeper.escalation",
    label: "Escalation",
    status: "warning",
    message: `${POISON} escalation prose`,
    details: { lane: "qa_inspector", humanAction: `${POISON} human action prose` },
    created_at: iso(52 * 60 * 1000),
  },
  {
    id: "ev-lane-1",
    job_id: "job-keeper-1",
    attempt_id: "att-1",
    check_id: "keeper.check.rescue_queue",
    label: "Rescue queue lane",
    status: "pass",
    message: "ok",
    details: { pending: 60, threshold: 25, note: `${POISON} string detail` },
    created_at: iso(53 * 60 * 1000),
  },
  {
    id: "ev-lane-2",
    job_id: "job-keeper-1",
    attempt_id: "att-1",
    check_id: "keeper.check.library",
    label: "Library lane",
    status: "warning",
    message: `${POISON} lane prose`,
    details: { missingBatches: 2 },
    created_at: iso(53 * 60 * 1000),
  },
  {
    id: "ev-lane-3",
    job_id: "job-keeper-1",
    attempt_id: "att-1",
    check_id: "keeper.check.signed_in_scan",
    label: "Signed-in scan lane",
    status: "fail",
    message: `${POISON} lane prose`,
    details: {},
    created_at: iso(53 * 60 * 1000),
  },
  {
    id: "ev-repair-1",
    job_id: "job-keeper-1",
    attempt_id: "att-1",
    check_id: "keeper.repair.rescue_requeue",
    label: "Repair",
    status: "pass",
    message: "repaired",
    details: { lane: "rescue", before: 3, after: 0 },
    created_at: iso(54 * 60 * 1000),
  },
  {
    id: "ev-old-lane",
    job_id: "job-old",
    attempt_id: null,
    check_id: "keeper.check.rescue_queue",
    label: "Old lane",
    status: "fail",
    message: "old",
    details: { pending: 999 },
    created_at: iso(30 * H),
  },
];

/* ------------------------------------------------------------------ */
/* supabaseServer stub: a tiny PostgREST interpreter over fixtures     */
/* ------------------------------------------------------------------ */

const stubSource = `
const TABLES = () => globalThis.__ccTables;
function project(row, select) {
  const out = {};
  for (const item of select.split(",")) {
    const colon = item.indexOf(":");
    if (colon === -1) { out[item] = row[item] === undefined ? null : row[item]; continue; }
    const alias = item.slice(0, colon);
    const parts = item.slice(colon + 1).split(/->>?/);
    let cur = row[parts[0]];
    for (let i = 1; i < parts.length; i += 1) {
      if (cur === null || cur === undefined) { cur = null; break; }
      cur = cur[parts[i]];
    }
    out[alias] = cur === undefined ? null : cur;
  }
  return out;
}
function applyQuery(rows, query) {
  const params = new URLSearchParams(query || "");
  let out = rows.slice();
  for (const [key, value] of params.entries()) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    // PostgREST semantics: a NULL column never satisfies a comparison.
    if (value.startsWith("eq.")) out = out.filter((r) => r[key] !== null && r[key] !== undefined && String(r[key]) === value.slice(3));
    else if (value.startsWith("in.(")) {
      const set = value.slice(4, -1).split(",");
      out = out.filter((r) => r[key] !== null && r[key] !== undefined && set.includes(String(r[key])));
    } else if (value.startsWith("gte.")) out = out.filter((r) => r[key] !== null && r[key] !== undefined && String(r[key]) >= value.slice(4));
    else if (value.startsWith("like.")) {
      const prefix = value.slice(5).replace(/\\*$/, "");
      out = out.filter((r) => r[key] !== null && r[key] !== undefined && String(r[key]).startsWith(prefix));
    }
  }
  const order = params.get("order");
  if (order) {
    const [col, dir] = order.split(".");
    out.sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (dir === "desc" ? -1 : 1));
  }
  const limit = params.get("limit");
  if (limit) out = out.slice(0, Number(limit));
  const select = params.get("select");
  if (select && select !== "*") out = out.map((r) => project(r, select));
  return out;
}
export async function supabaseSelect(table, query = "select=*", options = {}) {
  if (globalThis.__ccDown.has(table)) {
    if (options.failClosed) throw new Error("SUPABASE_READ_FAILED");
    return [];
  }
  return applyQuery(TABLES()[table] || [], query);
}
export async function supabaseCount(table, query = "select=*") {
  if (globalThis.__ccDown.has(table)) return 0;
  return applyQuery(TABLES()[table] || [], query).length;
}
export async function supabaseUpsert() { return null; }
export async function supabaseInsert() { return null; }
export async function supabaseUpdate() { return null; }
export async function postgrestTableExists(table) { return !globalThis.__ccDown.has(table); }
export function isSupabaseConfigured() { return true; }
`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = (s) => `data:text/javascript,${encodeURIComponent(s)}`;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@/lib/supabaseServer") {
      return { url: data(stubSource), shortCircuit: true };
    }
    if (specifier === "server-only") {
      return { url: data("export {};"), shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      return {
        url: pathToFileURL(path.join(root, specifier.slice(2) + ".ts")).href,
        shortCircuit: true,
      };
    }
    return next(specifier, context);
  },
});

const { buildControlCenterSection, buildKeeperSection, rescueReasonCode } =
  await import("../lib/controlCenter.ts");
const { buildSophieSitrep } = await import("../lib/sophieCommand.ts");

function resetFixtures(down = []) {
  globalThis.__ccTables = {
    reviewintel_scan_operations: scanOperations,
    scan_rescue_queue: rescueRows,
    ri_ops_jobs: opsJobs,
    ri_ops_attempts: opsAttempts,
    ri_ops_evidence: opsEvidence,
  };
  globalThis.__ccDown = new Set(down);
}

test("controlCenter: referee shape from tonight's Sony record (HOLD, D3 + D5)", async () => {
  resetFixtures();
  const { section, degradedGroups } = await buildControlCenterSection(NOW);
  assert.ok(section);
  assert.deepEqual(degradedGroups, []);
  const sony = section.scans.referee.recent.find((r) => r.scanId === "scan_sony");
  assert.ok(sony);
  assert.equal(sony.verdict, "WAIT");
  assert.equal(sony.score, 74);
  assert.equal(sony.productKey, "amazon.com:B0BXYZ9876");
  assert.equal(sony.acceptedWrittenReviews, 10);
  assert.equal(sony.rejectedWrittenReviews, 1);
  assert.equal(sony.finalStopReasonCode, "evidence_target_reached");
  assert.equal(sony.huntFired, false);
  assert.deepEqual(sony.referee, {
    status: "HOLD",
    uniqueOpinionCount: 10,
    independentSourceCount: 1,
    variantDuplicatesCollapsed: 0,
    newUniqueOpinionCount: 0,
    storedOpinionCount: 10,
    previousVerdict: "WAIT",
    newVerdict: "BUY",
    heldVerdict: "WAIT",
    computedScore: 76,
    printedScore: 74,
    confidenceCeiling: "Low",
    confidenceCapped: true,
    countsReconciled: true,
    interventions: [
      { code: "VERDICT_HELD_NO_MATERIAL_DELTA", duty: "D3" },
      { code: "CONFIDENCE_CAPPED", duty: "D5" },
    ],
  });
});

test("controlCenter: referee aggregates cover the window only", async () => {
  resetFixtures();
  const { section } = await buildControlCenterSection(NOW);
  const agg = section.scans.referee.aggregates24h;
  assert.ok(agg);
  assert.equal(agg.scansWithDecision, 2); // old PASS record is outside the window
  assert.equal(agg.byStatus.HOLD, 1);
  assert.equal(agg.byStatus.PASS_WITH_CORRECTIONS, 1);
  assert.equal(agg.byStatus.PASS, 0);
  assert.equal(agg.variantDuplicatesCollapsed, 3);
  assert.equal(agg.scansWithVariantDuplicates, 1);
  assert.equal(agg.holds, 1);
  assert.equal(agg.blocks, 0);
  assert.equal(agg.confidenceCaps, 1);
  assert.equal(agg.countsMismatchBlocks, 0);
  assert.deepEqual(agg.interventionsByCode, {
    VERDICT_HELD_NO_MATERIAL_DELTA: 1,
    CONFIDENCE_CAPPED: 1,
    VARIANT_DUPLICATE_COLLAPSED: 1,
  });
  // ...while recent still surfaces the older decision, marked by its time.
  const old = section.scans.referee.recent.find((r) => r.scanId === "scan_old");
  assert.ok(old);
  assert.equal(old.referee.status, "PASS");
});

test("controlCenter: scan counts are exact 24h counts; failure codes are sanitized", async () => {
  resetFixtures();
  const { section } = await buildControlCenterSection(NOW);
  assert.deepEqual(section.scans.last24hCountsByStatus, {
    RUNNING: 1,
    COMPLETED: 4,
    FAILED: 1,
    BLOCKED: 1,
  });
  const failed = section.scans.failures.find((f) => f.scanId === "scan_failed");
  assert.equal(failed.errorCode, "SCRAPE_TIMEOUT");
  const blocked = section.scans.failures.find((f) => f.scanId === "scan_blocked");
  assert.equal(blocked.errorCode, null); // prose error never passes through
});

test("controlCenter: malformed scan records degrade to nulls, not crashes", async () => {
  resetFixtures();
  const { section } = await buildControlCenterSection(NOW);
  const nullResult = section.scans.referee.recent.find((r) => r.scanId === "scan_null_result");
  assert.equal(nullResult.referee, null);
  assert.equal(nullResult.verdict, null);
  const garbage = section.scans.referee.recent.find((r) => r.scanId === "scan_garbage_referee");
  assert.equal(garbage.referee, null);
});

test("controlCenter: rescue counts are exact beyond the old 50/20/20 list caps", async () => {
  resetFixtures();
  const { section } = await buildControlCenterSection(NOW);
  const rescue = section.rescueDetail;
  assert.equal(rescue.countsExact.pending, 60);
  assert.equal(rescue.countsExact.rescued, 3);
  assert.equal(rescue.countsExact.emailed, 2);
  assert.equal(rescue.countsExact.closed, 1);
  assert.equal(rescue.counts24h.created, 66);
  assert.equal(rescue.counts24h.rescued, 5); // 3 still rescued + 2 rescued-then-emailed in window
  assert.equal(rescue.counts24h.emailed, 2);
  assert.deepEqual(rescue.reasonCountsPending, {
    REVIEW_EVIDENCE_NOT_FETCHED: 30,
    NOT_ENOUGH_WRITTEN_REVIEWS: 30,
  });
  assert.equal(rescue.oldestPendingAt, rescueRows[0].created_at);
  assert.equal(rescue.pendingItems.length, 20);
  assert.equal(rescue.pendingItems[0].hasAccount, true);
  assert.equal(rescue.rescuedNotEmailed.length, 3);
  assert.ok(rescue.rescuedNotEmailed[0].ageSeconds >= rescue.rescuedNotEmailed[2].ageSeconds);
  assert.equal(rescueReasonCode("unrecognized prose"), "OTHER");
});

test("controlCenter: keeper lanes, escalations, QA and repairs are shaped + filtered", async () => {
  resetFixtures();
  const { section } = await buildControlCenterSection(NOW);
  const keeper = section.keeper;
  assert.equal(keeper.latestRun.jobId, "job-keeper-1");
  assert.equal(keeper.latestRun.status, "COMPLETED");
  assert.equal(keeper.latestRun.checksTotal, 9);
  assert.equal(keeper.latestRun.checksPassed, 7);
  assert.deepEqual(
    keeper.lanes.map((l) => [l.lane, l.reasonCode]),
    [
      ["rescue_queue", "OK"],
      ["library", "CHECK_WARNING"],
      ["signed_in_scan", "CHECK_FAIL"],
    ]
  );
  // Scalar details only: the string note is dropped, the counts stay.
  assert.deepEqual(keeper.lanes[0].details, { pending: 60, threshold: 25 });
  assert.equal(keeper.escalations.length, 1);
  assert.equal(keeper.escalations[0].lane, "qa_inspector");
  assert.equal(keeper.escalations[0].reasonCode, "LANE_ESCALATED");
  assert.deepEqual(keeper.qa.defectCountsByClass, { aggregate_twice: 2 });
  assert.equal(keeper.qa.items[0].fieldPath, "decisionBrief.factRows");
  assert.equal(keeper.repairs.length, 1);
  assert.equal(keeper.repairs[0].repairKey, "rescue_requeue");
});

test("controlCenter: sanitization — no poison text, PII, or raw fields anywhere", async () => {
  resetFixtures();
  const { section } = await buildControlCenterSection(NOW);
  const json = JSON.stringify(section);
  assert.ok(!json.includes(POISON), "poison marker leaked into payload");
  assert.ok(!json.includes("leak@example.com"));
  assert.ok(!json.includes("person@example.com"));
  assert.ok(!json.includes("buyer@example.com"));
  assert.ok(!json.includes("offendingString"));
  assert.ok(!json.includes("humanAction"));
  assert.ok(!json.includes("account_email"));
  assert.ok(!json.includes("product_url"));
  assert.ok(!json.includes("result_json"));
  assert.ok(!json.includes('"detail":'), "intervention prose detail leaked");
  assert.ok(!json.includes('"message"'), "evidence message prose leaked");
  assert.ok(!json.includes("raw review text"));
});

test("controlCenter: one store down degrades only its group", async () => {
  resetFixtures(["ri_ops_evidence"]);
  const { section, degradedGroups } = await buildControlCenterSection(NOW);
  assert.ok(section);
  assert.equal(section.keeper, null);
  assert.ok(section.scans);
  assert.ok(section.rescueDetail);
  assert.deepEqual(degradedGroups, ["keeper"]);
  assert.equal(section.countSemantics, "partial");
});

test("controlCenter: payload stays inside the 32 KB budget", async () => {
  resetFixtures();
  const { section } = await buildControlCenterSection(NOW);
  const bytes = Buffer.byteLength(JSON.stringify(section), "utf8");
  assert.ok(bytes <= 32 * 1024, `payload was ${bytes} bytes`);
  assert.equal(section.version, 1);
  assert.equal(section.countSemantics, "exact");
});

test("controlCenter: buildKeeperSection ignores older jobs' lane rows", () => {
  const { section } = buildKeeperSection({
    jobs: opsJobs.map((j) => ({
      id: j.id,
      status: j.status,
      created_at: j.created_at,
      finished_at: j.finished_at,
    })),
    attempts: opsAttempts.map((a) => ({
      job_id: a.job_id,
      checks_total: a.checks_total,
      checks_passed: a.checks_passed,
    })),
    evidence: [...opsEvidence]
      .map((row) => ({
        id: row.id,
        job_id: row.job_id,
        check_id: row.check_id,
        status: row.status,
        details: row.details,
        created_at: row.created_at,
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    sinceIso: iso(24 * H),
  });
  assert.ok(!section.lanes.some((l) => l.details.pending === 999));
});

test("sitrep: controlCenter rides along; existing sections keep their shape", async () => {
  resetFixtures();
  const sitrep = await buildSophieSitrep();
  assert.equal(sitrep.site, "reviewintel");
  assert.ok(sitrep.sections.controlCenter);
  assert.equal(sitrep.sections.controlCenter.scans.last24hCountsByStatus.COMPLETED, 4);
  // The pre-existing rescue section keeps its original (list-length) shape:
  // 60 pending rows in the store, capped at 50 by the legacy reader.
  assert.equal(sitrep.sections.rescue.pending, 50);
  assert.equal(sitrep.sections.rescue.rescued, 3);
  assert.ok(Array.isArray(sitrep.sections.ops.bots));
  assert.ok(Array.isArray(sitrep.sections.ops.recentJobs));
  assert.ok(!sitrep.degraded.some((d) => d.startsWith("controlCenter")));
  const json = JSON.stringify(sitrep);
  assert.ok(!json.includes(POISON));
});
