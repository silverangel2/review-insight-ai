/**
 * Sophie Control-Center feed — sections.controlCenter (v1, 2026-10-21).
 *
 * Extends the Sophie command-door sitrep (lib/sophieCommand.ts) with the
 * control-center failure summary designed in the Empire visibility audit
 * (SOPHIE_CONTROL_CENTER_VISIBILITY.md): scan operations + Referee
 * decisions, rescue-queue detail/aging, and keeper lane results /
 * escalations / QA defects. RI steps 1+2 of the approved build order.
 *
 * Containment: this module is deliberately self-contained. All of its
 * store reads live here (table/column names mirror lib/scanBudget.ts,
 * lib/rescueQueue.ts and lib/riOpsStore.ts) so the production change
 * set for this feature is exactly this file plus the additive wiring
 * in lib/sophieCommand.ts — no store module's bytes change.
 *
 * Sanitization contract (tested in tests/controlCenter.test.mjs):
 *  - Allowlist only. Every emitted field is picked by name and cleaned.
 *    Raw store rows, raw result_json, review text, evidence messages,
 *    and free-text database errors NEVER cross this module.
 *  - Server prose is mapped to reason codes; unrecognized values become
 *    OTHER / null, never the raw text.
 *  - No customer PII: no account emails (only hasAccount), no product
 *    URLs, no subjects, no recipient data.
 *  - Keeper/QA details are forwarded only when scalar (number / boolean
 *    / null); strings, arrays, and nested objects are dropped.
 *  - Counts are exact (server count queries) and labelled through
 *    countSemantics; item lists are capped and `truncated` says so.
 *
 * Fail-soft by group: a failing store nulls only its own group and names
 * it in degradedGroups; the rest of the sitrep is unaffected. This
 * module never throws to its caller.
 */
import { supabaseCount, supabaseSelect } from "@/lib/supabaseServer";
import { listRecentOpsJobs } from "@/lib/riOpsStore";

/* Table names (owned by the store modules named in the header). */
const SCAN_OPERATIONS_TABLE = "reviewintel_scan_operations"; // lib/scanBudget.ts
const RESCUE_QUEUE_TABLE = "scan_rescue_queue"; // lib/rescueQueue.ts
const OPS_ATTEMPTS_TABLE = "ri_ops_attempts"; // lib/riOpsStore.ts
const OPS_EVIDENCE_TABLE = "ri_ops_evidence"; // lib/riOpsStore.ts

/* ------------------------------------------------------------------ */
/* Types (the v1 DTO — mirrors the audit's RI target fields A + B)     */
/* ------------------------------------------------------------------ */

export type RefereeDto = {
  status: "PASS" | "PASS_WITH_CORRECTIONS" | "HOLD" | "BLOCK";
  uniqueOpinionCount: number;
  independentSourceCount: number;
  variantDuplicatesCollapsed: number;
  newUniqueOpinionCount: number | null;
  storedOpinionCount: number | null;
  previousVerdict: string | null;
  newVerdict: string | null;
  heldVerdict: string | null;
  computedScore: number | null;
  printedScore: number | null;
  confidenceCeiling: string | null;
  confidenceCapped: boolean;
  countsReconciled: boolean;
  interventions: Array<{ code: string; duty: "D1" | "D2" | "D3" | "D4" | "D5" }>;
};

export type ControlCenterScans = {
  last24hCountsByStatus: {
    RUNNING: number;
    COMPLETED: number;
    FAILED: number;
    BLOCKED: number;
  };
  failures: Array<{
    scanId: string;
    status: "FAILED" | "BLOCKED";
    errorCode: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  referee: {
    aggregates24h: {
      scansWithDecision: number;
      byStatus: {
        PASS: number;
        PASS_WITH_CORRECTIONS: number;
        HOLD: number;
        BLOCK: number;
      };
      interventionsByCode: Record<string, number>;
      variantDuplicatesCollapsed: number;
      scansWithVariantDuplicates: number;
      holds: number;
      blocks: number;
      confidenceCaps: number;
      countsMismatchBlocks: number;
    } | null;
    recent: Array<{
      scanId: string;
      productKey: string | null;
      completedAt: string;
      verdict: string | null;
      score: number | null;
      evidenceState: string | null;
      finalDecisionSource: string | null;
      acceptedWrittenReviews: number | null;
      rejectedWrittenReviews: number | null;
      finalStopReasonCode: string | null;
      huntFired: boolean | null;
      libraryPoolMatchedProducts: number | null;
      libraryPoolReviews: number | null;
      referee: RefereeDto | null;
    }>;
  };
};

export type ControlCenterRescue = {
  countsExact: { pending: number; rescued: number; emailed: number; closed: number };
  counts24h: { created: number; rescued: number; emailed: number };
  reasonCountsPending: Record<string, number>;
  oldestPendingAt: string | null;
  pendingItems: Array<{
    id: string;
    scanRef: string;
    productKey: string | null;
    productName: string | null;
    reasonCode: string;
    createdAt: string;
    updatedAt: string;
    hasAccount: boolean;
  }>;
  rescuedNotEmailed: Array<{
    id: string;
    scanRef: string;
    productKey: string | null;
    rescuedAt: string;
    ageSeconds: number;
  }>;
};

export type ControlCenterKeeper = {
  latestRun: {
    jobId: string;
    status: string;
    createdAt: string;
    finishedAt: string | null;
    checksTotal: number | null;
    checksPassed: number | null;
  } | null;
  lanes: Array<{
    evidenceId: string;
    jobId: string;
    checkId: string;
    lane: string;
    status: "pass" | "warning" | "fail" | "info";
    reasonCode: string;
    createdAt: string;
    details: Record<string, number | boolean | null>;
  }>;
  escalations: Array<{
    evidenceId: string;
    jobId: string;
    checkId: string;
    lane: string;
    reasonCode: string;
    createdAt: string;
  }>;
  qa: {
    defectCountsByClass: Record<string, number>;
    items: Array<{ scanId: string; defectClass: string; fieldPath: string }>;
  };
  repairs: Array<{
    jobId: string;
    repairKey: string;
    status: string;
    createdAt: string;
  }>;
};

export type ControlCenterSection = {
  version: 1;
  generatedAt: string;
  window: { since: string; until: string };
  countSemantics: "exact" | "partial";
  truncated: boolean;
  scans: ControlCenterScans | null;
  rescueDetail: ControlCenterRescue | null;
  keeper: ControlCenterKeeper | null;
};

export type ControlCenterBuild = {
  section: ControlCenterSection | null;
  degradedGroups: string[];
};

/* ------------------------------------------------------------------ */
/* Caps (audit rule 7: sane 15-minute payload, target <= 32 KB)        */
/* ------------------------------------------------------------------ */

const MAX_FAILURES = 10;
const MAX_RECENT = 10;
const MAX_PENDING_ITEMS = 20;
const MAX_NOT_EMAILED = 20;
const MAX_LANES = 12;
const MAX_ESCALATIONS = 20;
const MAX_QA_ITEMS = 10;
const MAX_REPAIRS = 10;
const FETCH_FAILURES = 50;
const FETCH_PENDING = 200;
const FETCH_AGGREGATES = 500;
const FETCH_EVIDENCE = 500;
const PAYLOAD_BUDGET_BYTES = 32 * 1024;
const WINDOW_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Sanitizers — the only way store data enters the DTO                 */
/* ------------------------------------------------------------------ */

const UPPER_CODE_RE = /^[A-Z][A-Z0-9_]{1,60}$/;
const IDENT_RE = /^[A-Za-z][A-Za-z0-9_]{0,60}$/;
const LANE_RE = /^[a-z][a-z0-9_]{0,40}$/;
const FIELD_PATH_RE = /^[A-Za-z0-9_.\[\]]{1,120}$/;
const VERDICT_WORDS = new Set(["BUY", "WAIT", "SKIP", "DO NOT BUY YET", "AVOID"]);
const EVIDENCE_STATES = new Set(["none", "weak", "limited", "usable", "strong"]);
const REFEREE_STATUSES = new Set(["PASS", "PASS_WITH_CORRECTIONS", "HOLD", "BLOCK"]);
const CONFIDENCE_LEVELS = new Set(["Low", "Medium", "High"]);
const REFEREE_DUTIES = new Set(["D1", "D2", "D3", "D4", "D5"]);
const QA_DEFECT_CLASSES = new Set([
  "verdict_word",
  "placeholder",
  "empty_row",
  "aggregate_twice",
  "unbacked_warning",
  "authenticity_label",
]);

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strOrNull(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function isoOrNull(value: unknown): string | null {
  const text = strOrNull(value, 40);
  if (!text) return null;
  return Number.isNaN(Date.parse(text)) ? null : text;
}

function intOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : fallback;
}

function intOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** UPPER_SNAKE server code, else null. Prose never passes. */
function codeOrNull(value: unknown): string | null {
  const text = strOrNull(value, 61);
  return text && UPPER_CODE_RE.test(text) ? text : null;
}

/** camelCase/snake identifier (finalDecisionSource etc.), else null. */
function identOrNull(value: unknown): string | null {
  const text = strOrNull(value, 61);
  return text && IDENT_RE.test(text) ? text : null;
}

/** Stop-reason code: identifier-shaped values pass; anything else is OTHER. */
function stopReasonCode(value: unknown): string | null {
  const text = strOrNull(value, 61);
  if (!text) return null;
  return IDENT_RE.test(text) ? text : "OTHER";
}

function verdictOrNull(value: unknown): string | null {
  const text = strOrNull(value, 40);
  if (!text) return null;
  const upper = text.toUpperCase();
  return VERDICT_WORDS.has(upper) ? upper : null;
}

/** Keeper/QA details: scalar values only (number / boolean / null). */
function scalarDetails(details: Record<string, unknown>): Record<string, number | boolean | null> {
  const out: Record<string, number | boolean | null> = {};
  for (const [key, value] of Object.entries(details)) {
    if (Object.keys(out).length >= 12) break;
    if (!IDENT_RE.test(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean" || value === null) out[key] = value;
  }
  return out;
}

/** The two server-generated rescue reasons, mapped to codes. */
export function rescueReasonCode(reason: unknown): string {
  const text = typeof reason === "string" ? reason : "";
  if (/could not be fetched/i.test(text)) return "REVIEW_EVIDENCE_NOT_FETCHED";
  if (/not enough written reviews/i.test(text)) return "NOT_ENOUGH_WRITTEN_REVIEWS";
  return "OTHER";
}

/* ------------------------------------------------------------------ */
/* Internal row shapes (post-normalization; never emitted as-is)       */
/* ------------------------------------------------------------------ */

type ScanOpRow = {
  scanId: string;
  status: string;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  result: {
    verdict: string | null;
    buyScore: number | null;
    evidenceState: string | null;
    finalDecisionSource: string | null;
    detectedProductKey: string | null;
    libraryProductKey: string | null;
    retrievalDiagnostics: Record<string, unknown> | null;
    refereeDecision: Record<string, unknown> | null;
  } | null;
};

type RescueRow = {
  id: string;
  scan_ref: string;
  account_email: string | null;
  product_key: string | null;
  product_name: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
  rescued_at: string | null;
};

type EvidenceRow = {
  id: string;
  job_id: string;
  check_id: string;
  status: "pass" | "warning" | "fail" | "info";
  details: Record<string, unknown>;
  created_at: string;
};

type AttemptRow = { job_id: string; checks_total: number; checks_passed: number };

/* ------------------------------------------------------------------ */
/* Pure builders (unit-tested against fixtures)                        */
/* ------------------------------------------------------------------ */

export function refereeDto(raw: unknown): RefereeDto | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const status = strOrNull(r.status, 24);
  if (!status || !REFEREE_STATUSES.has(status)) return null;
  const interventions: RefereeDto["interventions"] = [];
  if (Array.isArray(r.interventions)) {
    for (const item of r.interventions.slice(0, 12)) {
      const entry = rec(item);
      const code = codeOrNull(entry.code);
      const duty = strOrNull(entry.duty, 2);
      if (code && duty && REFEREE_DUTIES.has(duty)) {
        interventions.push({ code, duty: duty as RefereeDto["interventions"][number]["duty"] });
      }
    }
  }
  const ceiling = strOrNull(r.confidenceCeiling, 6);
  return {
    status: status as RefereeDto["status"],
    uniqueOpinionCount: intOr(r.uniqueOpinionCount, 0),
    independentSourceCount: intOr(r.independentSourceCount, 0),
    variantDuplicatesCollapsed: intOr(r.variantDuplicatesCollapsed, 0),
    newUniqueOpinionCount: intOrNull(r.newUniqueOpinionCount),
    storedOpinionCount: intOrNull(r.storedOpinionCount),
    previousVerdict: verdictOrNull(r.previousVerdict),
    newVerdict: verdictOrNull(r.newVerdict),
    heldVerdict: verdictOrNull(r.heldVerdict),
    computedScore: numOrNull(r.computedScore),
    printedScore: numOrNull(r.printedScore),
    confidenceCeiling: ceiling && CONFIDENCE_LEVELS.has(ceiling) ? ceiling : null,
    confidenceCapped: r.confidenceCapped === true,
    countsReconciled: r.countsReconciled === true,
    interventions,
  };
}

export function buildScansSection(input: {
  countsByStatus: { RUNNING: number; COMPLETED: number; FAILED: number; BLOCKED: number };
  failures: ScanOpRow[];
  recentCompleted: ScanOpRow[];
  aggregateRows: ScanOpRow[];
  aggregatesAvailable: boolean;
}): { section: ControlCenterScans; truncated: boolean } {
  let truncated = input.aggregateRows.length >= FETCH_AGGREGATES;

  const failures = input.failures.slice(0, MAX_FAILURES).map((row) => ({
    scanId: row.scanId,
    status: row.status as "FAILED" | "BLOCKED",
    errorCode: codeOrNull(row.errorCode),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
  if (input.failures.length > MAX_FAILURES) truncated = true;

  const recent = input.recentCompleted.slice(0, MAX_RECENT).map((row) => {
    const result = row.result;
    const diag = rec(result?.retrievalDiagnostics);
    const hunt = rec(diag.reviewHunt);
    const pool = rec(diag.libraryFingerprintPool);
    return {
      scanId: row.scanId,
      productKey: result?.libraryProductKey ?? result?.detectedProductKey ?? null,
      completedAt: row.updatedAt,
      verdict: verdictOrNull(result?.verdict),
      score: numOrNull(result?.buyScore),
      evidenceState:
        result?.evidenceState && EVIDENCE_STATES.has(result.evidenceState)
          ? result.evidenceState
          : null,
      finalDecisionSource: identOrNull(result?.finalDecisionSource),
      acceptedWrittenReviews: intOrNull(diag.writtenReviewsAccepted),
      rejectedWrittenReviews: intOrNull(diag.rejectedWrittenReviews),
      finalStopReasonCode: stopReasonCode(diag.finalStopReason),
      huntFired:
        diag.reviewHunt && typeof diag.reviewHunt === "object"
          ? hunt.fired === true
          : null,
      libraryPoolMatchedProducts: Array.isArray(pool.matchedProductKeys)
        ? pool.matchedProductKeys.length
        : null,
      libraryPoolReviews: intOrNull(pool.pooledReviews),
      referee: refereeDto(result?.refereeDecision),
    };
  });

  let aggregates24h: ControlCenterScans["referee"]["aggregates24h"] = null;
  if (input.aggregatesAvailable) {
    const agg = {
      scansWithDecision: 0,
      byStatus: { PASS: 0, PASS_WITH_CORRECTIONS: 0, HOLD: 0, BLOCK: 0 },
      interventionsByCode: {} as Record<string, number>,
      variantDuplicatesCollapsed: 0,
      scansWithVariantDuplicates: 0,
      holds: 0,
      blocks: 0,
      confidenceCaps: 0,
      countsMismatchBlocks: 0,
    };
    for (const row of input.aggregateRows) {
      const dto = refereeDto(row.result?.refereeDecision);
      if (!dto) continue;
      agg.scansWithDecision += 1;
      agg.byStatus[dto.status] += 1;
      if (dto.status === "HOLD") agg.holds += 1;
      if (dto.status === "BLOCK") agg.blocks += 1;
      if (dto.variantDuplicatesCollapsed > 0) {
        agg.scansWithVariantDuplicates += 1;
        agg.variantDuplicatesCollapsed += dto.variantDuplicatesCollapsed;
      }
      if (dto.confidenceCapped) agg.confidenceCaps += 1;
      let mismatch = false;
      for (const intervention of dto.interventions) {
        agg.interventionsByCode[intervention.code] =
          (agg.interventionsByCode[intervention.code] ?? 0) + 1;
        if (intervention.code === "COUNTS_MISMATCH_BLOCK") mismatch = true;
      }
      if (mismatch) agg.countsMismatchBlocks += 1;
    }
    aggregates24h = agg;
  }

  return {
    section: {
      last24hCountsByStatus: input.countsByStatus,
      failures,
      referee: { aggregates24h, recent },
    },
    truncated,
  };
}

export function buildRescueDetail(input: {
  countsExact: { pending: number; rescued: number; emailed: number; closed: number };
  counts24h: { created: number; rescued: number; emailed: number };
  pendingRows: RescueRow[];
  rescuedRows: RescueRow[];
  now: Date;
}): { section: ControlCenterRescue; truncated: boolean } {
  let truncated = input.pendingRows.length >= FETCH_PENDING;
  const reasonCountsPending: Record<string, number> = {};
  let oldestPendingAt: string | null = null;
  for (const row of input.pendingRows) {
    const code = rescueReasonCode(row.reason);
    reasonCountsPending[code] = (reasonCountsPending[code] ?? 0) + 1;
    if (row.created_at && (!oldestPendingAt || row.created_at < oldestPendingAt)) {
      oldestPendingAt = row.created_at;
    }
  }
  if (input.pendingRows.length > MAX_PENDING_ITEMS) truncated = true;

  const pendingItems = input.pendingRows.slice(0, MAX_PENDING_ITEMS).map((row) => ({
    id: row.id,
    scanRef: row.scan_ref,
    productKey: row.product_key,
    productName: strOrNull(row.product_name, 120),
    reasonCode: rescueReasonCode(row.reason),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasAccount: Boolean(row.account_email),
  }));

  const rescuedNotEmailed = input.rescuedRows
    .map((row) => {
      const rescuedAt = isoOrNull(row.rescued_at) ?? isoOrNull(row.updated_at) ?? row.created_at;
      const parsed = Date.parse(rescuedAt);
      return {
        id: row.id,
        scanRef: row.scan_ref,
        productKey: row.product_key,
        rescuedAt,
        ageSeconds: Number.isNaN(parsed)
          ? 0
          : Math.max(0, Math.round((input.now.getTime() - parsed) / 1000)),
      };
    })
    .sort((a, b) => a.rescuedAt.localeCompare(b.rescuedAt))
    .slice(0, MAX_NOT_EMAILED);
  if (input.rescuedRows.length > MAX_NOT_EMAILED) truncated = true;

  return {
    section: {
      countsExact: input.countsExact,
      counts24h: input.counts24h,
      reasonCountsPending,
      oldestPendingAt,
      pendingItems,
      rescuedNotEmailed,
    },
    truncated,
  };
}

export function buildKeeperSection(input: {
  jobs: Array<{
    id: string;
    status: string;
    created_at: string;
    finished_at: string | null;
  }>;
  attempts: AttemptRow[];
  evidence: EvidenceRow[];
  /** QA counts and repair rows are window-bound even when the latest-run
   *  fallback pulled older evidence into view. */
  sinceIso: string;
}): { section: ControlCenterKeeper; truncated: boolean } {
  const evidence = input.evidence;
  const keeperRows = evidence.filter(
    (row) => row.check_id.startsWith("keeper.") || row.check_id.startsWith("qa_inspector.")
  );
  // Evidence is newest-first; the first keeper/QA row names the latest run.
  const latestJobId = keeperRows.length > 0 ? keeperRows[0].job_id : null;
  const job = latestJobId ? input.jobs.find((j) => j.id === latestJobId) : undefined;
  const attempt = latestJobId
    ? input.attempts.find((a) => a.job_id === latestJobId)
    : undefined;

  const latestRun: ControlCenterKeeper["latestRun"] =
    latestJobId && job
      ? {
          jobId: job.id,
          status: job.status,
          createdAt: job.created_at,
          finishedAt: job.finished_at,
          checksTotal: attempt ? attempt.checks_total : null,
          checksPassed: attempt ? attempt.checks_passed : null,
        }
      : null;

  let truncated = false;
  const lanes: ControlCenterKeeper["lanes"] = [];
  const escalations: ControlCenterKeeper["escalations"] = [];
  const repairs: ControlCenterKeeper["repairs"] = [];
  const defectCountsByClass: Record<string, number> = {};
  const qaItems: ControlCenterKeeper["qa"]["items"] = [];

  for (const row of evidence) {
    if (row.check_id.startsWith("keeper.check.")) {
      if (latestJobId && row.job_id !== latestJobId) continue;
      const lane = row.check_id.slice("keeper.check.".length);
      if (!LANE_RE.test(lane) || lanes.length >= MAX_LANES) continue;
      lanes.push({
        evidenceId: row.id,
        jobId: row.job_id,
        checkId: row.check_id,
        lane,
        status: row.status,
        reasonCode:
          row.status === "pass"
            ? "OK"
            : row.status === "warning"
              ? "CHECK_WARNING"
              : row.status === "fail"
                ? "CHECK_FAIL"
                : "CHECK_INFO",
        createdAt: row.created_at,
        details: scalarDetails(row.details),
      });
    } else if (row.check_id === "keeper.escalation") {
      if (latestJobId && row.job_id !== latestJobId) continue;
      if (escalations.length >= MAX_ESCALATIONS) continue;
      const laneText = strOrNull(rec(row.details).lane, 41);
      escalations.push({
        evidenceId: row.id,
        jobId: row.job_id,
        checkId: row.check_id,
        lane: laneText && LANE_RE.test(laneText) ? laneText : "unknown",
        reasonCode: "LANE_ESCALATED",
        createdAt: row.created_at,
      });
    } else if (row.check_id.startsWith("keeper.repair.")) {
      if (row.created_at < input.sinceIso) continue;
      if (repairs.length >= MAX_REPAIRS) continue;
      const repairKey = row.check_id.slice("keeper.repair.".length);
      if (!LANE_RE.test(repairKey)) continue;
      repairs.push({
        jobId: row.job_id,
        repairKey,
        status: row.status,
        createdAt: row.created_at,
      });
    } else if (row.check_id.startsWith("qa_inspector.defect.")) {
      if (row.created_at < input.sinceIso) continue;
      const rawClass = row.check_id.slice("qa_inspector.defect.".length);
      const defectClass = QA_DEFECT_CLASSES.has(rawClass) ? rawClass : "other";
      defectCountsByClass[defectClass] = (defectCountsByClass[defectClass] ?? 0) + 1;
      if (qaItems.length < MAX_QA_ITEMS) {
        const details = rec(row.details);
        const scanId = strOrNull(details.scanId, 80);
        const field = strOrNull(details.field, 120);
        if (scanId) {
          qaItems.push({
            scanId,
            defectClass,
            fieldPath: field && FIELD_PATH_RE.test(field) ? field : "unknown",
          });
        }
      }
    }
  }
  if (evidence.length >= FETCH_EVIDENCE) truncated = true;

  return {
    section: {
      latestRun,
      lanes,
      escalations,
      qa: { defectCountsByClass, items: qaItems },
      repairs,
    },
    truncated,
  };
}

/* ------------------------------------------------------------------ */
/* Store readers (fail-closed where an outage must not look empty)     */
/* ------------------------------------------------------------------ */

async function probeTable(table: string): Promise<void> {
  await supabaseSelect(table, "select=id&limit=1", { failClosed: true });
}

/* ---- scan operations (reviewintel_scan_operations) ---- */

const SCAN_OP_BASE_SELECT = "scan_id,status,error_code,created_at,updated_at";
const SCAN_OP_RESULT_SELECT = [
  "verdict:result_json->>verdict",
  "buy_score:result_json->>buyScore",
  "evidence_state:result_json->>evidenceState",
  "decision_source:result_json->>finalDecisionSource",
  "detected_key:result_json->>detectedProductKey",
  "library_key:result_json->referee->>libraryProductKey",
  "diag:result_json->retrievalDiagnostics",
  "rd:result_json->refereeDecision",
].join(",");
const SCAN_OP_REFEREE_SELECT = "rd:result_json->refereeDecision";

function scanOpFilters(statuses: string[], sinceIso: string | null): string {
  const parts: string[] = [];
  if (statuses.length === 1) parts.push(`status=eq.${statuses[0]}`);
  else if (statuses.length > 1) parts.push(`status=in.(${statuses.join(",")})`);
  if (sinceIso) parts.push(`created_at=gte.${encodeURIComponent(sinceIso)}`);
  return parts.join("&");
}

async function countScanOps(status: string, sinceIso: string): Promise<number> {
  const filter = scanOpFilters([status], sinceIso);
  return supabaseCount(SCAN_OPERATIONS_TABLE, `select=scan_id&${filter}`);
}

function projectedNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeScanOp(row: Record<string, unknown>): ScanOpRow | null {
  const scanId = strOrNull(row.scan_id, 120);
  const status = strOrNull(row.status, 20);
  if (!scanId || !status) return null;
  // Accept both the projected shape (aliases) and a full row, so the
  // reader stays correct if the projection list ever changes.
  const full = rec(row.result_json);
  const hasResult =
    Object.keys(full).length > 0 ||
    row.rd !== undefined ||
    row.verdict !== undefined ||
    row.diag !== undefined;
  const result: ScanOpRow["result"] = hasResult
    ? {
        verdict: strOrNull(row.verdict) ?? strOrNull(full.verdict),
        buyScore: projectedNumber(row.buy_score) ?? projectedNumber(full.buyScore),
        evidenceState: strOrNull(row.evidence_state) ?? strOrNull(full.evidenceState),
        finalDecisionSource:
          strOrNull(row.decision_source) ?? strOrNull(full.finalDecisionSource),
        detectedProductKey:
          strOrNull(row.detected_key, 200) ?? strOrNull(full.detectedProductKey, 200),
        libraryProductKey:
          strOrNull(row.library_key, 200) ??
          strOrNull(rec(full.referee).libraryProductKey, 200),
        retrievalDiagnostics:
          Object.keys(rec(row.diag)).length > 0
            ? rec(row.diag)
            : Object.keys(rec(full.retrievalDiagnostics)).length > 0
              ? rec(full.retrievalDiagnostics)
              : null,
        refereeDecision:
          Object.keys(rec(row.rd)).length > 0
            ? rec(row.rd)
            : Object.keys(rec(full.refereeDecision)).length > 0
              ? rec(full.refereeDecision)
              : null,
      }
    : null;
  return {
    scanId,
    status,
    errorCode: strOrNull(row.error_code, 300),
    createdAt: strOrNull(row.created_at, 40) ?? "",
    updatedAt: strOrNull(row.updated_at, 40) ?? "",
    result,
  };
}

async function readScanOps(input: {
  statuses: string[];
  sinceIso: string | null;
  limit: number;
  withResult: boolean;
  refereeOnly?: boolean;
}): Promise<ScanOpRow[]> {
  const select = input.withResult
    ? `${SCAN_OP_BASE_SELECT},${input.refereeOnly ? SCAN_OP_REFEREE_SELECT : SCAN_OP_RESULT_SELECT}`
    : SCAN_OP_BASE_SELECT;
  const filter = scanOpFilters(input.statuses, input.sinceIso);
  const query =
    `select=${select}${filter ? `&${filter}` : ""}` +
    `&order=updated_at.desc&limit=${input.limit}`;
  const rows = await supabaseSelect<Record<string, unknown>>(
    SCAN_OPERATIONS_TABLE,
    query,
    { failClosed: true }
  );
  return rows
    .map(normalizeScanOp)
    .filter((row): row is ScanOpRow => row !== null);
}

/* ---- rescue queue (reviewintel_rescue_queue) ---- */

function normalizeRescueRow(raw: Record<string, unknown>): RescueRow | null {
  const id = strOrNull(raw.id, 120);
  const scanRef = strOrNull(raw.scan_ref, 200);
  if (!id || !scanRef) return null;
  return {
    id,
    scan_ref: scanRef,
    // The email is carried only as far as hasAccount; it is never emitted.
    account_email: strOrNull(raw.account_email, 320),
    product_key: strOrNull(raw.product_key, 200),
    product_name: strOrNull(raw.product_name, 500),
    reason: strOrNull(raw.reason, 500),
    created_at: strOrNull(raw.created_at, 40) ?? "",
    updated_at: strOrNull(raw.updated_at, 40) ?? "",
    rescued_at: strOrNull(raw.rescued_at, 40),
  };
}

async function readRescueRows(
  status: string,
  limit: number
): Promise<RescueRow[]> {
  const rows = await supabaseSelect<Record<string, unknown>>(
    RESCUE_QUEUE_TABLE,
    `select=*&status=eq.${encodeURIComponent(status)}&order=created_at.desc&limit=${limit}`,
    { failClosed: true }
  );
  return rows
    .map(normalizeRescueRow)
    .filter((row): row is RescueRow => row !== null);
}

async function countRescue(filter: string): Promise<number> {
  return supabaseCount(RESCUE_QUEUE_TABLE, `select=id&${filter}`);
}

/* ---- ops ledger (ri_ops_evidence / ri_ops_attempts) ---- */

function normalizeEvidenceRow(raw: Record<string, unknown>): EvidenceRow | null {
  const id = strOrNull(raw.id, 120);
  const jobId = strOrNull(raw.job_id, 120);
  const checkId = strOrNull(raw.check_id, 200);
  if (!id || !jobId || !checkId) return null;
  const status = strOrNull(raw.status, 10);
  return {
    id,
    job_id: jobId,
    check_id: checkId,
    status:
      status === "pass" || status === "warning" || status === "fail" || status === "info"
        ? status
        : "info",
    details: rec(raw.details),
    created_at: strOrNull(raw.created_at, 40) ?? "",
  };
}

async function readOpsEvidence(input: {
  sinceIso: string | null;
  limit: number;
}): Promise<EvidenceRow[]> {
  let query = `select=*&order=created_at.desc&limit=${input.limit}`;
  if (input.sinceIso) {
    query += `&created_at=gte.${encodeURIComponent(input.sinceIso)}`;
  }
  try {
    const rows = await supabaseSelect<Record<string, unknown>>(
      OPS_EVIDENCE_TABLE,
      query
    );
    return rows
      .map(normalizeEvidenceRow)
      .filter((row): row is EvidenceRow => row !== null);
  } catch {
    return [];
  }
}

async function readOpsAttempts(jobId: string): Promise<AttemptRow[]> {
  try {
    const rows = await supabaseSelect<Record<string, unknown>>(
      OPS_ATTEMPTS_TABLE,
      `select=*&job_id=eq.${encodeURIComponent(jobId)}&order=attempt_number.desc&limit=3`
    );
    return rows.map((raw) => ({
      job_id: strOrNull(raw.job_id, 120) ?? "",
      checks_total: intOr(raw.checks_total, 0),
      checks_passed: intOr(raw.checks_passed, 0),
    }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Group builders over live reads                                      */
/* ------------------------------------------------------------------ */

async function buildScansGroup(
  sinceIso: string
): Promise<{ section: ControlCenterScans; truncated: boolean }> {
  await probeTable(SCAN_OPERATIONS_TABLE);
  const [running, completed, failed, blocked] = await Promise.all([
    countScanOps("RUNNING", sinceIso),
    countScanOps("COMPLETED", sinceIso),
    countScanOps("FAILED", sinceIso),
    countScanOps("BLOCKED", sinceIso),
  ]);
  const [failures, recentCompleted, aggregateRows] = await Promise.all([
    readScanOps({
      statuses: ["FAILED", "BLOCKED"],
      sinceIso: null,
      limit: FETCH_FAILURES,
      withResult: false,
    }),
    readScanOps({
      statuses: ["COMPLETED"],
      sinceIso: null,
      limit: MAX_RECENT,
      withResult: true,
    }),
    readScanOps({
      statuses: ["COMPLETED"],
      sinceIso,
      limit: FETCH_AGGREGATES,
      withResult: true,
      refereeOnly: true,
    }),
  ]);
  return buildScansSection({
    countsByStatus: {
      RUNNING: running,
      COMPLETED: completed,
      FAILED: failed,
      BLOCKED: blocked,
    },
    failures,
    recentCompleted,
    aggregateRows,
    aggregatesAvailable: true,
  });
}

async function buildRescueGroup(
  sinceIso: string,
  now: Date
): Promise<{ section: ControlCenterRescue; truncated: boolean }> {
  await probeTable(RESCUE_QUEUE_TABLE);
  const since = encodeURIComponent(sinceIso);
  const [pending, rescued, emailed, closed, created24h, rescued24h, emailed24h] =
    await Promise.all([
      countRescue("status=eq.pending"),
      countRescue("status=eq.rescued"),
      countRescue("status=eq.emailed"),
      countRescue("status=eq.closed"),
      countRescue(`created_at=gte.${since}`),
      countRescue(`rescued_at=gte.${since}`),
      countRescue(`emailed_at=gte.${since}`),
    ]);
  const [pendingRows, rescuedRows] = await Promise.all([
    readRescueRows("pending", FETCH_PENDING),
    readRescueRows("rescued", FETCH_PENDING),
  ]);
  return buildRescueDetail({
    countsExact: { pending, rescued, emailed, closed },
    counts24h: { created: created24h, rescued: rescued24h, emailed: emailed24h },
    pendingRows,
    rescuedRows,
    now,
  });
}

async function buildKeeperGroup(
  sinceIso: string
): Promise<{ section: ControlCenterKeeper; truncated: boolean }> {
  await probeTable(OPS_EVIDENCE_TABLE);
  let evidence = await readOpsEvidence({ sinceIso, limit: FETCH_EVIDENCE });
  if (!evidence.some((row) => row.check_id.startsWith("keeper."))) {
    // No keeper rows inside the window: fall back to the latest rows so
    // the latest run is still visible (its timestamps mark it stale).
    const latest = await readOpsEvidence({ sinceIso: null, limit: 200 });
    if (latest.length > 0) evidence = latest;
  }
  const latestJobId =
    evidence.find(
      (row) => row.check_id.startsWith("keeper.") || row.check_id.startsWith("qa_inspector.")
    )?.job_id ?? null;
  const jobs = await listRecentOpsJobs(25);
  const attempts = latestJobId ? await readOpsAttempts(latestJobId) : [];
  return buildKeeperSection({
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      created_at: j.created_at,
      finished_at: j.finished_at,
    })),
    attempts,
    evidence,
    sinceIso,
  });
}

/* ------------------------------------------------------------------ */
/* Orchestrator                                                        */
/* ------------------------------------------------------------------ */

/** Trim item lists until the serialized section fits the payload budget. */
function enforceBudget(section: ControlCenterSection): void {
  const size = () => Buffer.byteLength(JSON.stringify(section), "utf8");
  if (size() <= PAYLOAD_BUDGET_BYTES) return;
  section.truncated = true;
  const trims: Array<() => void> = [
    () => {
      const recent = section.scans?.referee.recent;
      if (recent && recent.length > 5) recent.length = 5;
    },
    () => {
      const items = section.rescueDetail?.pendingItems;
      if (items && items.length > 10) items.length = 10;
    },
    () => {
      const items = section.rescueDetail?.rescuedNotEmailed;
      if (items && items.length > 10) items.length = 10;
    },
    () => {
      const items = section.keeper?.escalations;
      if (items && items.length > 10) items.length = 10;
    },
    () => {
      const failures = section.scans?.failures;
      if (failures && failures.length > 5) failures.length = 5;
    },
    () => {
      const lanes = section.keeper?.lanes;
      if (lanes) for (const lane of lanes) lane.details = {};
    },
  ];
  for (const trim of trims) {
    if (size() <= PAYLOAD_BUDGET_BYTES) break;
    trim();
  }
}

/**
 * Build the controlCenter section. Never throws: a group whose store
 * fails comes back null and is named in degradedGroups; if every group
 * fails, section is null.
 */
export async function buildControlCenterSection(
  now: Date = new Date()
): Promise<ControlCenterBuild> {
  const until = now.toISOString();
  const since = new Date(now.getTime() - WINDOW_MS).toISOString();
  const degradedGroups: string[] = [];
  let truncated = false;

  let scans: ControlCenterScans | null = null;
  try {
    const built = await buildScansGroup(since);
    scans = built.section;
    truncated = truncated || built.truncated;
  } catch {
    degradedGroups.push("scans");
  }

  let rescueDetail: ControlCenterRescue | null = null;
  try {
    const built = await buildRescueGroup(since, now);
    rescueDetail = built.section;
    truncated = truncated || built.truncated;
  } catch {
    degradedGroups.push("rescueDetail");
  }

  let keeper: ControlCenterKeeper | null = null;
  try {
    const built = await buildKeeperGroup(since);
    keeper = built.section;
    truncated = truncated || built.truncated;
  } catch {
    degradedGroups.push("keeper");
  }

  if (!scans && !rescueDetail && !keeper) {
    return { section: null, degradedGroups };
  }

  const section: ControlCenterSection = {
    version: 1,
    generatedAt: until,
    window: { since, until },
    countSemantics: degradedGroups.length === 0 ? "exact" : "partial",
    truncated,
    scans,
    rescueDetail,
    keeper,
  };
  enforceBudget(section);
  return { section, degradedGroups };
}
