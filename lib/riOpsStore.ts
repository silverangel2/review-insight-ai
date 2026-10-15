/**
 * ReviewIntel autobot ops ledger: append-only job / attempt / evidence
 * persistence for the RI ops worker (mirrors the Roamly opsStore pattern).
 *
 * Tables (see supabase/migrations/20261015_ri_ops_ledger.sql — apply manually):
 *   ri_ops_jobs      — one row per ops job (sweep, repair prep, ...)
 *   ri_ops_attempts  — one row per worker attempt at a job
 *   ri_ops_evidence  — one row per check result inside an attempt
 *
 * Fail-soft contract: every function returns null / [] / false when Supabase
 * is unconfigured or the ri_ops_* tables are not provisioned yet. Nothing
 * here ever throws.
 */

import {
  isSupabaseConfigured,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/supabaseServer";

export const RI_OPS_JOBS_TABLE = "ri_ops_jobs";
export const RI_OPS_ATTEMPTS_TABLE = "ri_ops_attempts";
export const RI_OPS_EVIDENCE_TABLE = "ri_ops_evidence";

export type OpsJobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
export type OpsJobType = "ops_sweep" | "repair_prep";

export type OpsJob = {
  id: string;
  job_type: OpsJobType;
  level: number;
  status: OpsJobStatus;
  payload: Record<string, unknown>;
  result_summary: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  finished_at: string | null;
};

export type OpsAttempt = {
  id: string;
  job_id: string;
  attempt_number: number;
  status: string;
  checks_total: number;
  checks_passed: number;
  started_at: string;
  finished_at: string | null;
};

export type OpsEvidence = {
  id: string;
  job_id: string;
  attempt_id: string;
  check_id: string;
  label: string;
  status: "pass" | "warning" | "fail" | "info";
  message: string;
  details: Record<string, unknown>;
  created_at: string;
};

type Row = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

function rowToOpsJob(row: Row): OpsJob {
  return {
    id: str(row.id),
    job_type: (row.job_type === "repair_prep" ? "repair_prep" : "ops_sweep") as OpsJobType,
    level: num(row.level) || 1,
    status: (["QUEUED", "RUNNING", "COMPLETED", "FAILED"].includes(str(row.status))
      ? str(row.status)
      : "QUEUED") as OpsJobStatus,
    payload: rec(row.payload),
    result_summary: typeof row.result_summary === "string" ? row.result_summary : null,
    claimed_by: typeof row.claimed_by === "string" ? row.claimed_by : null,
    claimed_at: typeof row.claimed_at === "string" ? row.claimed_at : null,
    created_at: str(row.created_at),
    finished_at: typeof row.finished_at === "string" ? row.finished_at : null,
  };
}

/**
 * True only when the named table actually exists and answers.
 * Uses a raw PostgREST probe (not the fail-soft supabaseSelect) so a
 * missing table (404 / PGRST205) is distinguishable from an empty one.
 */
export async function postgrestTableExists(table: string): Promise<boolean> {
  try {
    if (!isSupabaseConfigured()) return false;
    const base = (
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ""
    ).replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!base || !key) return false;
    const response = await fetch(
      `${base}/rest/v1/${table}?select=id&limit=1`,
      {
        method: "GET",
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * True only when the ri_ops_jobs table actually exists and answers.
 * Uses a raw PostgREST probe (not the fail-soft supabaseSelect) so a
 * missing table (404 / PGRST205) is distinguishable from an empty one.
 */
export async function riOpsTablesReady(): Promise<boolean> {
  return postgrestTableExists(RI_OPS_JOBS_TABLE);
}

export async function listQueuedOpsJobs(limit = 10): Promise<OpsJob[]> {
  try {
    const rows = await supabaseSelect<Row>(
      RI_OPS_JOBS_TABLE,
      "select=*&status=eq.QUEUED&order=created_at.asc&limit=" + Math.max(1, limit)
    );
    return (Array.isArray(rows) ? rows : []).map(rowToOpsJob).filter((j) => j.id);
  } catch {
    return [];
  }
}

export async function listRecentOpsJobs(limit = 25): Promise<OpsJob[]> {
  try {
    const rows = await supabaseSelect<Row>(
      RI_OPS_JOBS_TABLE,
      "select=*&order=created_at.desc&limit=" + Math.max(1, limit)
    );
    return (Array.isArray(rows) ? rows : []).map(rowToOpsJob).filter((j) => j.id);
  } catch {
    return [];
  }
}

export async function enqueueOpsJob(input: {
  jobType: OpsJobType;
  level?: number;
  payload?: Record<string, unknown>;
}): Promise<OpsJob | null> {
  try {
    const row = await supabaseInsert<Row>(RI_OPS_JOBS_TABLE, {
      job_type: input.jobType,
      level: Math.max(1, Math.min(4, Math.floor(input.level ?? 1))),
      status: "QUEUED",
      payload: input.payload ?? {},
    });
    return row ? rowToOpsJob(row) : null;
  } catch {
    return null;
  }
}

/**
 * Optimistic claim: only the worker whose claimed_by token sticks wins.
 * Returns the claimed job, or null when another worker claimed it first
 * (or the tables are missing).
 */
export async function claimOpsJob(
  jobId: string,
  workerId: string
): Promise<OpsJob | null> {
  try {
    if (!jobId || !workerId) return null;
    const now = new Date().toISOString();
    await supabaseUpdate(
      RI_OPS_JOBS_TABLE,
      `id=eq.${encodeURIComponent(jobId)}&status=eq.QUEUED`,
      { status: "RUNNING", claimed_by: workerId, claimed_at: now }
    );
    const rows = await supabaseSelect<Row>(
      RI_OPS_JOBS_TABLE,
      `select=*&id=eq.${encodeURIComponent(jobId)}&limit=1`
    );
    const job = Array.isArray(rows) && rows[0] ? rowToOpsJob(rows[0]) : null;
    if (job && job.claimed_by === workerId && job.status === "RUNNING") return job;
    return null;
  } catch {
    return null;
  }
}

export async function finishOpsJob(
  jobId: string,
  status: OpsJobStatus,
  resultSummary: string
): Promise<boolean> {
  try {
    const updated = await supabaseUpdate(
      RI_OPS_JOBS_TABLE,
      `id=eq.${encodeURIComponent(jobId)}`,
      {
        status,
        result_summary: resultSummary.slice(0, 2000),
        finished_at: new Date().toISOString(),
      }
    );
    return updated !== null;
  } catch {
    return false;
  }
}

export async function insertOpsAttempt(input: {
  jobId: string;
  attemptNumber: number;
}): Promise<OpsAttempt | null> {
  try {
    const row = await supabaseInsert<Row>(RI_OPS_ATTEMPTS_TABLE, {
      job_id: input.jobId,
      attempt_number: input.attemptNumber,
      status: "RUNNING",
      checks_total: 0,
      checks_passed: 0,
      started_at: new Date().toISOString(),
    });
    if (!row) return null;
    return {
      id: str(row.id),
      job_id: str(row.job_id),
      attempt_number: num(row.attempt_number),
      status: str(row.status) || "RUNNING",
      checks_total: num(row.checks_total),
      checks_passed: num(row.checks_passed),
      started_at: str(row.started_at),
      finished_at: typeof row.finished_at === "string" ? row.finished_at : null,
    };
  } catch {
    return null;
  }
}

export async function finishOpsAttempt(input: {
  attemptId: string;
  status: "COMPLETED" | "FAILED";
  checksTotal: number;
  checksPassed: number;
}): Promise<boolean> {
  try {
    const updated = await supabaseUpdate(
      RI_OPS_ATTEMPTS_TABLE,
      `id=eq.${encodeURIComponent(input.attemptId)}`,
      {
        status: input.status,
        checks_total: input.checksTotal,
        checks_passed: input.checksPassed,
        finished_at: new Date().toISOString(),
      }
    );
    return updated !== null;
  } catch {
    return false;
  }
}

export async function insertOpsEvidence(input: {
  jobId: string;
  attemptId: string;
  checkId: string;
  label: string;
  status: OpsEvidence["status"];
  message: string;
  details?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const row = await supabaseInsert(RI_OPS_EVIDENCE_TABLE, {
      job_id: input.jobId,
      attempt_id: input.attemptId,
      check_id: input.checkId.slice(0, 120),
      label: input.label.slice(0, 200),
      status: input.status,
      message: input.message.slice(0, 2000),
      details: input.details ?? {},
    });
    return row !== null;
  } catch {
    return false;
  }
}

/** Latest finished sweep attempt, for the self-scheduling cadence guard. */
export async function latestFinishedSweepAt(): Promise<string | null> {
  try {
    const rows = await supabaseSelect<Row>(
      RI_OPS_JOBS_TABLE,
      "select=finished_at&job_type=eq.ops_sweep&status=eq.COMPLETED&order=finished_at.desc&limit=1"
    );
    const at = Array.isArray(rows) && rows[0] ? str(rows[0].finished_at) : "";
    return at || null;
  } catch {
    return null;
  }
}
