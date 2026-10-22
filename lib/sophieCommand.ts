/**
 * Sophie Command Door — ReviewIntel's side of the Empire Central Command
 * contract (v1, 2026-10-17; sitrep v1.2, 2026-10-18).
 *
 * Sophie (Junel's local AI) connects OUTBOUND from his iMac to this door.
 * She can read the keeper/ops picture (sitrep) and enqueue whitelisted jobs
 * into RI's OWN ri_ops_* ledger, where the existing ri-ops-worker executes
 * them under its own authority ceiling:
 *   - "run_sweep"      → ops_sweep, level 1: the read-only check suite.
 *   - "prepare_repair" → repair_prep, level 3: preparation-only evidence.
 *     Level-3 jobs are NEVER executed by the worker — a human reviews.
 *
 * Residency rule holds: the door writes only to RI's own ledger through
 * RI's own store functions. It deploys nothing, repairs nothing, spends
 * nothing, and touches no customer. Repairs stay OFF (the worker's
 * auto-deploy gate is untouched by this module).
 *
 * Auth: Sophie's cryptogram pass first — a one-time Ed25519 signature
 * verified by lib/verifySophiePass.ts against SOPHIE_PUBLIC_KEY — with
 * the legacy Bearer SOPHIE_COMMAND_KEY (per-site key, set by Junel in
 * Vercel env) accepted as a transition fallback. Deleting
 * SOPHIE_COMMAND_KEY at cutover retires the old password for good.
 * Constant-time comparison for the legacy key. Fail-closed.
 *
 * This module never throws to its routes; failures are values.
 */
import { timingSafeEqual } from "crypto";
import { verifySophiePass } from "@/lib/verifySophiePass";
import {
  enqueueOpsJob,
  listRecentOpsJobs,
  riOpsTablesReady,
  type OpsJob,
  type OpsJobType,
} from "@/lib/riOpsStore";
import { listRescueQueue } from "@/lib/rescueQueue";
import {
  buildControlCenterSection,
  type ControlCenterSection,
} from "@/lib/controlCenter";

export const SOPHIE_ORDER_TYPES = ["run_sweep", "prepare_repair"] as const;
export type SophieOrderType = (typeof SOPHIE_ORDER_TYPES)[number];

const MAX_QUEUED_SOPHIE_JOBS = 3;

function keyMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Returns an error message when the caller is not Sophie, else null. */
export function sophieAuthError(request: Request): string | null {
  // Cryptogram pass first: her one-time Ed25519 signature (see
  // lib/verifySophiePass.ts). A verified pass authorizes the knock.
  const pass = verifySophiePass(request.headers, "reviewintel");
  if (pass.ok) return null;
  // Legacy fallback: the per-site shared key, until cutover deletes it.
  const expected = process.env.SOPHIE_COMMAND_KEY;
  if (!expected) {
    return pass.attempted
      ? pass.error
      : "Sophie command door is not configured.";
  }
  const authorization = request.headers.get("authorization") || "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!provided || !keyMatches(provided, expected)) {
    return "Unauthorized command request.";
  }
  return null;
}

export type OrderValidation =
  | {
      ok: true;
      jobType: OpsJobType;
      level: number;
      payload: Record<string, unknown>;
    }
  | { ok: false; error: string };

/** Pure validation of an order body against the v1 whitelist. */
export function validateSophieOrder(body: unknown): OrderValidation {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Order body must be a JSON object." };
  }
  const { type, reason, detail } = body as {
    type?: unknown;
    reason?: unknown;
    detail?: unknown;
  };
  if (
    typeof type !== "string" ||
    !(SOPHIE_ORDER_TYPES as readonly string[]).includes(type)
  ) {
    return {
      ok: false,
      error: `Order type not whitelisted. Allowed: ${SOPHIE_ORDER_TYPES.join(", ")}.`,
    };
  }
  const cleanReason =
    typeof reason === "string" && reason.trim()
      ? reason.trim().slice(0, 300)
      : "No reason given.";
  const cleanDetail =
    detail && typeof detail === "object" && !Array.isArray(detail)
      ? (detail as Record<string, unknown>)
      : {};
  const payload: Record<string, unknown> = {
    source: "sophie",
    reason: cleanReason,
    detail: cleanDetail,
  };
  if (type === "run_sweep") {
    return { ok: true, jobType: "ops_sweep", level: 1, payload };
  }
  return { ok: true, jobType: "repair_prep", level: 3, payload };
}

export type SophieOrderResult =
  | { ok: true; job: OpsJob }
  | { ok: false; status: number; error: string };

/** Enqueue a validated order, with the anti-flood guard. */
export async function placeSophieOrder(
  validation: Extract<OrderValidation, { ok: true }>
): Promise<SophieOrderResult> {
  if (!(await riOpsTablesReady())) {
    return {
      ok: false,
      status: 503,
      error: "RI ops ledger is not provisioned yet; orders cannot be recorded.",
    };
  }
  const recent = await listRecentOpsJobs(25);
  const queuedSophie = recent.filter(
    (j) => j.status === "QUEUED" && j.payload?.source === "sophie"
  ).length;
  if (queuedSophie >= MAX_QUEUED_SOPHIE_JOBS) {
    return {
      ok: false,
      status: 429,
      error: `Too many Sophie orders already queued (${queuedSophie}). Wait for the worker to drain them.`,
    };
  }
  const job = await enqueueOpsJob({
    jobType: validation.jobType,
    level: validation.level,
    payload: validation.payload,
  });
  if (!job) {
    return { ok: false, status: 500, error: "The order could not be recorded." };
  }
  return { ok: true, job };
}

/**
 * Per-bot activity entry for the sitrep (v1.2).
 * RI's ri_ops_jobs ledger carries no role/subsystem/objective fields —
 * its own terms for the bot are the job_type values below, so `name` is
 * the job_type and `action` is what the job reported (result_summary),
 * falling back to the job type's standing purpose when nothing was
 * reported yet. Nothing here is invented: both come from the ledger.
 */
export type BotActivity = {
  name: string;
  action: string;
  status: string;
  at: string;
};

/** Standing purpose of each RI ops job type (see module header). */
const JOB_TYPE_PURPOSE: Record<OpsJobType, string> = {
  ops_sweep: "read-only ops sweep",
  repair_prep: "repair preparation (evidence only)",
};

function botActivity(j: OpsJob): BotActivity {
  const reported =
    typeof j.result_summary === "string" && j.result_summary.trim()
      ? j.result_summary.trim()
      : "";
  return {
    name: j.job_type,
    action: (reported || JOB_TYPE_PURPOSE[j.job_type] || j.job_type).slice(
      0,
      160
    ),
    status: j.status,
    at: j.created_at,
  };
}

export type SophieSitrep = {
  ok: boolean;
  site: "reviewintel";
  at: string;
  sections: {
    rescue: { pending: number; rescued: number; emailed: number } | null;
    ops: {
      tablesReady: boolean;
      bots: BotActivity[];
      recentJobs: Array<{
        id: string;
        job_type: OpsJobType;
        level: number;
        status: string;
        source: string | null;
        created_at: string;
        finished_at: string | null;
        result_summary: string | null;
      }>;
    } | null;
    /**
     * Control-center failure feed v1 (audit build order RI 1+2):
     * scans + Referee, rescue detail/aging, keeper lanes/escalations.
     * Additive — the sections above keep their original shape. Null when
     * every control-center store is unreachable (see `degraded`).
     */
    controlCenter: ControlCenterSection | null;
  };
  degraded: string[];
};

/** The watch picture: rescue queue + ops ledger, fail-soft per section. */
export async function buildSophieSitrep(): Promise<SophieSitrep> {
  const degraded: string[] = [];
  let rescue: SophieSitrep["sections"]["rescue"] = null;
  try {
    const [pending, rescued, emailed] = await Promise.all([
      listRescueQueue("pending", 50),
      listRescueQueue("rescued", 20),
      listRescueQueue("emailed", 20),
    ]);
    rescue = {
      pending: pending.length,
      rescued: rescued.length,
      emailed: emailed.length,
    };
  } catch {
    degraded.push("rescue");
  }

  let ops: SophieSitrep["sections"]["ops"] = null;
  try {
    const tablesReady = await riOpsTablesReady();
    const jobs = tablesReady ? await listRecentOpsJobs(10) : [];
    ops = {
      tablesReady,
      bots: jobs.slice(0, 8).map(botActivity),
      recentJobs: jobs.map((j) => ({
        id: j.id,
        job_type: j.job_type,
        level: j.level,
        status: j.status,
        source:
          typeof j.payload?.source === "string" ? j.payload.source : null,
        created_at: j.created_at,
        finished_at: j.finished_at,
        result_summary: j.result_summary,
      })),
    };
  } catch {
    degraded.push("ops");
  }

  // Headline `ok` reflects the CORE sections only (rescue + ops — the
  // pre-controlCenter v1.2 semantics), so it is snapshotted here, before
  // any controlCenter names are pushed. Control-center degradation is
  // still reported in `degraded` (Sophie's consumer reads it), but an
  // add-on feed failure must not turn the whole door red on its own.
  const coreOk = degraded.length === 0;

  let controlCenter: ControlCenterSection | null = null;
  try {
    const built = await buildControlCenterSection();
    controlCenter = built.section;
    for (const group of built.degradedGroups) {
      degraded.push(`controlCenter.${group}`);
    }
  } catch {
    degraded.push("controlCenter");
  }

  return {
    ok: coreOk,
    site: "reviewintel",
    at: new Date().toISOString(),
    sections: { rescue, ops, controlCenter },
    degraded,
  };
}
