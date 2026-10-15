/**
 * ReviewIntel autobot ops worker: claims QUEUED jobs from the ri_ops_*
 * ledger, runs REAL read-only checks (never the admin page's canned
 * one-click runners), and writes attempts + evidence back so the admin
 * Operations / Daily-Check-Center view shows real statuses.
 *
 * Authority ceiling: Level-3 jobs get preparation-only evidence rows and
 * are NEVER executed. The auto-deploy gate ships DISABLED — it only arms
 * when RI_OPS_AUTODEPLOY is explicitly set, and even then the worker
 * itself never deploys anything (read-only by design).
 *
 * Zero OpenAI. Every check is fail-soft: a probe that throws becomes a
 * failed check row, never a crashed run.
 */

import {
  claimOpsJob,
  enqueueOpsJob,
  finishOpsAttempt,
  finishOpsJob,
  insertOpsAttempt,
  insertOpsEvidence,
  latestFinishedSweepAt,
  listQueuedOpsJobs,
  riOpsTablesReady,
  type OpsEvidence,
  type OpsJob,
} from "@/lib/riOpsStore";
import { supabaseSelect } from "@/lib/supabaseServer";

export type OpsCheckStatus = "pass" | "warning" | "fail";

export type OpsCheckResult = {
  id: string;
  label: string;
  status: OpsCheckStatus;
  message: string;
  details?: Record<string, unknown>;
};

export type ProbeResponse = { status: number; text: string };
export type ProbeGet = (
  url: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> }
) => Promise<ProbeResponse>;

export type WorkerCheckContext = {
  baseUrl: string;
  get: ProbeGet;
  /** Null when the library table is unreadable/unprovisioned. */
  libraryRowCount: () => Promise<number | null>;
};

export const OPS_SWEEP_INTERVAL_MS = 45 * 60 * 1000;
export const MAX_JOBS_PER_RUN = 3;
const PROBE_TIMEOUT_MS = 10_000;

export function riOpsBaseUrl(env: Record<string, string | undefined> = process.env): string {
  return (
    env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://getreviewintel.com"
  );
}

/** Auto-deploy gate: DISABLED unless explicitly armed. Never deploys by itself. */
export function riOpsAutoDeployEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return ["1", "on", "true", "yes"].includes(
    String(env.RI_OPS_AUTODEPLOY || "").trim().toLowerCase()
  );
}

function defaultProbe(): ProbeGet {
  return async (url, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: init?.method || "GET",
        headers: init?.headers,
        body: init?.body,
        signal: controller.signal,
        redirect: "manual",
      });
      const text = await response.text().catch(() => "");
      return { status: response.status, text: text.slice(0, 20_000) };
    } finally {
      clearTimeout(timer);
    }
  };
}

async function defaultLibraryRowCount(): Promise<number | null> {
  try {
    const rows = await supabaseSelect<{ product_key?: unknown }>(
      "product_review_library",
      "select=product_key&limit=1001"
    );
    if (!Array.isArray(rows)) return null;
    return rows.length >= 1001 ? 1001 : rows.length;
  } catch {
    return null;
  }
}

function check(
  id: string,
  label: string,
  status: OpsCheckStatus,
  message: string,
  details?: Record<string, unknown>
): OpsCheckResult {
  return { id, label, status, message, details };
}

async function probePage(
  ctx: WorkerCheckContext,
  id: string,
  label: string,
  path: string,
  validate: (status: number, html: string) => OpsCheckResult
): Promise<OpsCheckResult> {
  try {
    const res = await ctx.get(`${ctx.baseUrl}${path}`);
    return validate(res.status, res.text);
  } catch (error) {
    return check(id, label, "fail", `Probe failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** The read-only check suite. Pure given the injected context (unit-testable). */
export async function runOpsChecks(ctx: WorkerCheckContext): Promise<OpsCheckResult[]> {
  const results: OpsCheckResult[] = [];

  results.push(
    await probePage(ctx, "home_get", "Homepage loads", "/", (status, html) =>
      status === 200 && /<title[^>]*>/i.test(html)
        ? check("home_get", "Homepage loads", "pass", `GET / → 200 with <title> (${html.length} bytes).`)
        : check("home_get", "Homepage loads", "fail", `GET / → ${status}; expected 200 with <title>.`)
    )
  );

  results.push(
    await probePage(ctx, "home_meta", "Homepage SEO meta", "/", (status, html) => {
      if (status !== 200) return check("home_meta", "Homepage SEO meta", "fail", `GET / → ${status}.`);
      const hasDescription = /<meta[^>]+name=["']description["']/i.test(html);
      const hasOgTitle = /<meta[^>]+property=["']og:title["']/i.test(html);
      return hasDescription || hasOgTitle
        ? check("home_meta", "Homepage SEO meta", "pass", "Meta description/og:title present.", { hasDescription, hasOgTitle })
        : check("home_meta", "Homepage SEO meta", "warning", "200 OK but no meta description or og:title found.");
    })
  );

  for (const [id, label, path] of [
    ["pricing_get", "Pricing page loads", "/pricing"],
    ["faq_get", "FAQ page loads", "/faq"],
  ] as const) {
    results.push(
      await probePage(ctx, id, label, path, (status) =>
        status === 200
          ? check(id, label, "pass", `GET ${path} → 200.`)
          : check(id, label, "fail", `GET ${path} → ${status}; expected 200.`)
      )
    );
  }

  results.push(
    await probePage(ctx, "scan_form_get", "Scan form page loads", "/analyze", (status, html) => {
      if (status !== 200) return check("scan_form_get", "Scan form page loads", "fail", `GET /analyze → ${status}; expected 200.`);
      const looksLikeForm = /<form|<textarea|paste/i.test(html);
      return looksLikeForm
        ? check("scan_form_get", "Scan form page loads", "pass", "GET /analyze → 200 with scan form markers.")
        : check("scan_form_get", "Scan form page loads", "warning", "200 OK but no form markers found in HTML.");
    })
  );

  // Admin doors must reject anonymous callers.
  try {
    const res = await ctx.get(`${ctx.baseUrl}/api/admin/daily-checks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ check: "api" }),
    });
    results.push(
      res.status === 401 || res.status === 403
        ? check("admin_door_rejects_anonymous", "Admin API rejects anonymous", "pass", `POST /api/admin/daily-checks → ${res.status} without a session.`)
        : res.status === 200
          ? check("admin_door_rejects_anonymous", "Admin API rejects anonymous", "fail", "Anonymous POST returned 200 — admin door may be open.")
          : check("admin_door_rejects_anonymous", "Admin API rejects anonymous", "warning", `Unexpected status ${res.status}.`)
    );
  } catch (error) {
    results.push(check("admin_door_rejects_anonymous", "Admin API rejects anonymous", "fail", `Probe failed: ${error instanceof Error ? error.message : String(error)}`));
  }

  // Cron routes must reject unsigned requests.
  for (const [id, label, path] of [
    ["cron_rejects_unsigned", "Ops worker cron rejects unsigned", "/api/cron/ri-ops-worker"],
    ["cron_review_ask_rejects_unsigned", "Review-ask cron rejects unsigned", "/api/cron/review-ask-email"],
  ] as const) {
    try {
      const res = await ctx.get(`${ctx.baseUrl}${path}`);
      results.push(
        res.status === 401
          ? check(id, label, "pass", `GET ${path} → 401 without a secret.`)
          : res.status === 404
            ? check(id, label, "warning", `GET ${path} → 404 (route not deployed?).`)
            : check(id, label, "fail", `GET ${path} → ${res.status}; expected 401.`)
      );
    } catch (error) {
      results.push(check(id, label, "fail", `Probe failed: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  results.push(
    await probePage(ctx, "sitemap", "Sitemap serves", "/sitemap.xml", (status, xml) =>
      status === 200 && /<url/i.test(xml)
        ? check("sitemap", "Sitemap serves", "pass", "GET /sitemap.xml → 200 with <url> entries.")
        : check("sitemap", "Sitemap serves", status === 200 ? "warning" : "fail", `GET /sitemap.xml → ${status}.`)
    )
  );

  results.push(
    await probePage(ctx, "robots", "Robots serves", "/robots.txt", (status) =>
      status === 200
        ? check("robots", "Robots serves", "pass", "GET /robots.txt → 200.")
        : check("robots", "Robots serves", "fail", `GET /robots.txt → ${status}; expected 200.`)
    )
  );

  try {
    const count = await ctx.libraryRowCount();
    results.push(
      count === null
        ? check("library_nonempty", "Review library has rows", "warning", "product_review_library is unreadable (unprovisioned or Supabase unavailable).")
        : count > 0
          ? check("library_nonempty", "Review library has rows", "pass", `product_review_library holds ${count}+ rows.`, { rows: count })
          : check("library_nonempty", "Review library has rows", "warning", "product_review_library is empty — the receive lanes have not written yet.")
    );
  } catch (error) {
    results.push(check("library_nonempty", "Review library has rows", "warning", `Check failed softly: ${error instanceof Error ? error.message : String(error)}`));
  }

  return results;
}

/**
 * Level-3 preparation evidence: recorded, never executed.
 * Returns evidence rows (status "info") describing what preparation was
 * recorded plus the auto-deploy gate verdict.
 */
export function level3PreparationEvidence(input: {
  job: OpsJob;
  autoDeployEnabled: boolean;
}): Array<Pick<OpsEvidence, "check_id" | "label" | "status" | "message" | "details">> {
  return [
    {
      check_id: "l3_preparation",
      label: "Level-3 preparation recorded",
      status: "info",
      message:
        "Preparation recorded only. Level-3 jobs are NEVER executed by the worker — a human reviews and applies any repair.",
      details: { job_type: input.job.job_type, level: input.job.level },
    },
    {
      check_id: "l3_autodeploy_gate",
      label: "Auto-deploy gate verdict",
      status: "info",
      message: input.autoDeployEnabled
        ? "RI_OPS_AUTODEPLOY is set: gate would be ARMED for an approved repair class. No deploy was performed by this run."
        : "RI_OPS_AUTODEPLOY is unset: auto-deploy gate is DISABLED. No deploy was performed by this run.",
      details: { auto_deploy_enabled: input.autoDeployEnabled },
    },
  ];
}

export type WorkerBatchSummary = {
  ok: boolean;
  skipped?: boolean;
  idle?: boolean;
  reason?: string;
  jobsProcessed?: number;
  jobsCompleted?: number;
  jobsFailed?: number;
  checksRun?: number;
  checksPassed?: number;
};

/**
 * One worker batch: ensure a sweep job exists, claim QUEUED jobs, run the
 * read-only suite (levels 1–2) or record preparation-only evidence
 * (level 3+), and write attempts + evidence to the ledger.
 */
export async function runWorkerBatch(input: {
  baseUrl?: string;
  workerId?: string;
  get?: ProbeGet;
  libraryRowCount?: () => Promise<number | null>;
  autoDeployEnabled?: boolean;
} = {}): Promise<WorkerBatchSummary> {
  if (!(await riOpsTablesReady())) {
    return { ok: true, skipped: true, reason: "ri_ops tables are not provisioned yet." };
  }

  const workerId =
    input.workerId || `ri-ops-worker-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const autoDeployEnabled = input.autoDeployEnabled ?? riOpsAutoDeployEnabled();
  const ctx: WorkerCheckContext = {
    baseUrl: input.baseUrl || riOpsBaseUrl(),
    get: input.get || defaultProbe(),
    libraryRowCount: input.libraryRowCount || defaultLibraryRowCount,
  };

  // Self-scheduling heartbeat: keep a fresh sweep queued when the last
  // finished sweep is older than the cadence (or none ever finished).
  const queued = await listQueuedOpsJobs(10);
  if (queued.length === 0) {
    const lastFinished = await latestFinishedSweepAt();
    const lastMs = lastFinished ? new Date(lastFinished).getTime() : 0;
    if (!lastMs || Date.now() - lastMs > OPS_SWEEP_INTERVAL_MS) {
      await enqueueOpsJob({ jobType: "ops_sweep", level: 1, payload: { cadence: "self-scheduled" } });
    }
  }

  const jobs = await listQueuedOpsJobs(MAX_JOBS_PER_RUN);
  if (jobs.length === 0) return { ok: true, idle: true, reason: "No QUEUED jobs." };

  let jobsCompleted = 0;
  let jobsFailed = 0;
  let checksRun = 0;
  let checksPassed = 0;

  for (const job of jobs) {
    const claimed = await claimOpsJob(job.id, workerId);
    if (!claimed) continue; // another worker claimed it first

    const attempt = await insertOpsAttempt({ jobId: job.id, attemptNumber: 1 });
    const attemptId = attempt?.id || "";

    if (job.level >= 3) {
      // LEVEL 3+: preparation only. NEVER executed.
      for (const ev of level3PreparationEvidence({ job, autoDeployEnabled })) {
        await insertOpsEvidence({
          jobId: job.id,
          attemptId,
          checkId: ev.check_id,
          label: ev.label,
          status: ev.status,
          message: ev.message,
          details: ev.details,
        });
      }
      if (attempt) {
        await finishOpsAttempt({ attemptId: attempt.id, status: "COMPLETED", checksTotal: 0, checksPassed: 0 });
      }
      await finishOpsJob(job.id, "COMPLETED", "Preparation recorded only — level-3 jobs are never executed by the worker.");
      jobsCompleted += 1;
      continue;
    }

    const results = await runOpsChecks(ctx);
    checksRun += results.length;
    const passed = results.filter((r) => r.status === "pass").length;
    checksPassed += passed;

    for (const r of results) {
      await insertOpsEvidence({
        jobId: job.id,
        attemptId,
        checkId: r.id,
        label: r.label,
        status: r.status,
        message: r.message,
        details: r.details ?? {},
      });
    }

    const allFailed = results.length > 0 && passed === 0;
    if (attempt) {
      await finishOpsAttempt({
        attemptId: attempt.id,
        status: allFailed ? "FAILED" : "COMPLETED",
        checksTotal: results.length,
        checksPassed: passed,
      });
    }
    if (allFailed) {
      await finishOpsJob(job.id, "FAILED", `Sweep ran but every check failed (${results.length}/${results.length}). Escalation: COMPLETION_EVIDENCE_REQUIRED.`);
      jobsFailed += 1;
    } else {
      await finishOpsJob(job.id, "COMPLETED", `Sweep completed: ${passed}/${results.length} checks passed.`);
      jobsCompleted += 1;
    }
  }

  return {
    ok: true,
    jobsProcessed: jobsCompleted + jobsFailed,
    jobsCompleted,
    jobsFailed,
    checksRun,
    checksPassed,
  };
}
