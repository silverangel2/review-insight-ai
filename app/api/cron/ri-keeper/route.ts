import { NextRequest, NextResponse } from "next/server";
import { runKeeper } from "@/lib/riKeeper";

/**
 * RI Keeper cron route.
 *
 * ReviewIntel's internal maintenance bot: watches RI's own lanes
 * (owner-feed reconciliation, community flow, library growth, rescue
 * queue, scan activity), runs whitelisted idempotent repairs when
 * enabled, and escalates the rest with a diagnosis.
 *
 * Residency rule: this bot lives within the website — it acts as RI, on
 * RI's own data, through RI's own configured channels only. It never
 * operates accounts on external platforms and never acts outside RI.
 *
 * Fail-soft: returns 200 with a skipped status when the store is not
 * provisioned. This route never throws. Zero OpenAI calls.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Matches the vercel.json schedule entry for /api/cron/ri-keeper.
const EXPECTED_SCHEDULE = "0 */6 * * *";

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
    const report = await runKeeper();
    return NextResponse.json({ ...report, ok: true });
  } catch (error) {
    // The keeper itself never throws; this is the belt-and-suspenders net.
    return NextResponse.json({
      ok: false,
      openAiCalls: 0,
      error: error instanceof Error ? error.message : "The keeper run failed safely.",
    });
  }
}
