import { NextRequest, NextResponse } from "next/server";
import { riOpsBaseUrl, runWorkerBatch } from "@/lib/riOpsWorker";

/**
 * ReviewIntel autobot ops worker (every 15 min).
 *
 * Claims QUEUED jobs from the ri_ops_* ledger, runs REAL read-only checks,
 * and writes attempts + evidence back so the admin Operations /
 * Daily-Check-Center view shows real statuses. Level-3 jobs get
 * preparation-only rows and are NEVER executed. The auto-deploy gate ships
 * DISABLED (RI_OPS_AUTODEPLOY unset).
 *
 * Fail-soft: when the ri_ops_* tables are not provisioned yet the route
 * returns 200 with a skipped status instead of crashing. This route never
 * throws.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EXPECTED_SCHEDULE = "*/15 * * * *";

function requireCron(request: NextRequest) {
  const secret = process.env.SOCIAL_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Cron secret is not configured." },
      { status: 401 }
    );
  }
  const cronScheduleHeader = request.headers.get("x-vercel-cron-schedule") || "";
  const isExpectedCron = cronScheduleHeader === EXPECTED_SCHEDULE;
  if (secret) {
    const authorization = request.headers.get("authorization") || "";
    const provided = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : authorization.trim();
    const querySecret = request.nextUrl.searchParams.get("secret");
    if (provided !== secret && querySecret !== secret && !isExpectedCron) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized cron request." },
        { status: 401 }
      );
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const unauthorized = requireCron(request);
  if (unauthorized) return unauthorized;

  try {
    const summary = await runWorkerBatch({ baseUrl: riOpsBaseUrl() });
    return NextResponse.json({ openAiCalls: 0, ...summary, ok: true });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "The ops worker run failed safely.",
    });
  }
}
