/**
 * RI Keeper — ops-ledger writer.
 *
 * The keeper writes to the SAME append-only tables the PR #31 ops worker
 * uses (ri_ops_jobs / ri_ops_attempts / ri_ops_evidence, migration
 * supabase/migrations/20261015_ri_ops_ledger.sql) so the admin Operations /
 * Daily-Check-Center views show keeper activity alongside the bot family's.
 *
 * Conventions:
 *   - keeper runs open a job with job_type = "keeper_run" (level 1).
 *   - every lane check, repair attempt, and escalation is an evidence row.
 *   - batch registrations live as evidence rows with
 *     check_id = "keeper.batch_registered" (no schema change needed).
 *   - repair history rows use check_id = "keeper.repair.<repairKey>".
 *   - run summaries use check_id = "keeper.run_summary" (previous totals
 *     for the library-growth check).
 *
 * Fail-soft throughout: when the tables are not provisioned (or the
 * writes fail), every function resolves a null/false instead of throwing.
 * The keeper then reports "ledger unavailable" and still returns its report.
 */
import {
  isSupabaseConfigured,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/supabaseServer";

export const KEEPER_JOB_TYPE = "keeper_run";
export const KEEPER_EVENT_JOB_TYPE = "keeper_event";

export const RI_OPS_JOBS_TABLE = "ri_ops_jobs";
export const RI_OPS_ATTEMPTS_TABLE = "ri_ops_attempts";
export const RI_OPS_EVIDENCE_TABLE = "ri_ops_evidence";

export const CHECK_BATCH_REGISTERED = "keeper.batch_registered";
export const CHECK_RUN_SUMMARY = "keeper.run_summary";
export const repairCheckId = (repairKey: string) => `keeper.repair.${repairKey}`;

export type KeeperLedgerHandle = {
  jobId: string;
  attemptId: string;
};

function isStoreReady(): boolean {
  try {
    return isSupabaseConfigured();
  } catch {
    return false;
  }
}

/** Open a keeper run: job row + first attempt. Null when the store is down. */
export async function keeperJobStart(
  jobType: string = KEEPER_JOB_TYPE
): Promise<KeeperLedgerHandle | null> {
  if (!isStoreReady()) return null;
  const job = await supabaseInsert<Record<string, unknown>>(RI_OPS_JOBS_TABLE, [
    { job_type: jobType, level: 1, status: "RUNNING", payload: { keeper: "v1" } },
  ]);
  if (!job || !job.id) return null;
  const attempt = await supabaseInsert<Record<string, unknown>>(
    RI_OPS_ATTEMPTS_TABLE,
    [{ job_id: job.id, attempt_number: 1, status: "RUNNING" }]
  );
  if (!attempt || !attempt.id) return null;
  return { jobId: String(job.id), attemptId: String(attempt.id) };
}

export async function keeperEvidence(
  handle: KeeperLedgerHandle,
  checkId: string,
  label: string,
  status: "pass" | "warning" | "fail" | "info",
  message: string,
  details: Record<string, unknown> = {}
): Promise<boolean> {
  if (!isStoreReady()) return false;
  const row = await supabaseInsert<Record<string, unknown>>(
    RI_OPS_EVIDENCE_TABLE,
    [
      {
        job_id: handle.jobId,
        attempt_id: handle.attemptId,
        check_id: checkId,
        label,
        status,
        message,
        details,
      },
    ]
  );
  return row !== null;
}

export async function keeperJobFinish(
  handle: KeeperLedgerHandle,
  status: "COMPLETED" | "FAILED",
  checksTotal: number,
  checksPassed: number,
  summary: string
): Promise<void> {
  if (!isStoreReady()) return;
  await supabaseUpdate(
    RI_OPS_ATTEMPTS_TABLE,
    `id=eq.${encodeURIComponent(handle.attemptId)}`,
    { status, checks_total: checksTotal, checks_passed: checksPassed, finished_at: new Date().toISOString() }
  );
  await supabaseUpdate(
    RI_OPS_JOBS_TABLE,
    `id=eq.${encodeURIComponent(handle.jobId)}`,
    { status, result_summary: summary.slice(0, 500), finished_at: new Date().toISOString() }
  );
}

/**
 * One-shot registration event (used by the owner-feed ingest route after a
 * successful ingest): its own lightweight COMPLETED job so keeper_run
 * history stays clean. The batch text is stored in details so the keeper
 * can self-repair a future fed-but-not-ingested state.
 */
export async function keeperRegistrationEvent(
  registration: Record<string, unknown>
): Promise<boolean> {
  const handle = await keeperJobStart(KEEPER_EVENT_JOB_TYPE);
  if (!handle) return false;
  const ok = await keeperEvidence(
    handle,
    CHECK_BATCH_REGISTERED,
    "Owner-feed batch registered",
    "info",
    `Batch ${String(registration.batchId || "?")} registered for keeper reconciliation.`,
    registration
  );
  await keeperJobFinish(handle, ok ? "COMPLETED" : "FAILED", 1, ok ? 1 : 0, "Batch registration recorded.");
  return ok;
}

/** Latest evidence rows for one check_id (newest first). */
export async function keeperLatestEvidence(
  checkId: string,
  limit = 200
): Promise<Array<Record<string, unknown>>> {
  if (!isStoreReady()) return [];
  const rows = await supabaseSelect<Record<string, unknown>>(
    RI_OPS_EVIDENCE_TABLE,
    `select=*&check_id=eq.${encodeURIComponent(checkId)}&order=created_at.desc&limit=${Math.max(1, Math.min(500, limit))}`
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * Consecutive "fail" outcomes for a repair key, counting back from the
 * newest row and stopping at the first non-fail. Used for the fail-twice
 * stop rule.
 */
export async function keeperConsecutiveRepairFailures(repairKey: string): Promise<number> {
  const rows = await keeperLatestEvidence(repairCheckId(repairKey), 10);
  let failures = 0;
  for (const row of rows) {
    if (String(row.status) === "fail") failures += 1;
    else break;
  }
  return failures;
}
