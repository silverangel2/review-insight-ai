import { NextRequest, NextResponse } from "next/server";
import { runSocialAutoPost } from "@/lib/socialAutoPost";

export async function GET(request: NextRequest) {
  const secret = process.env.SOCIAL_CRON_SECRET || process.env.CRON_SECRET;
  const vercelCronSchedule = request.headers.get("x-vercel-cron-schedule") || "";
  const isExpectedVercelCron = vercelCronSchedule === "0 13 * * *";

  if (secret) {
    const authorization = request.headers.get("authorization") || "";
    const provided = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : authorization.trim();
    const querySecret = request.nextUrl.searchParams.get("secret");

    if (provided !== secret && querySecret !== secret && !isExpectedVercelCron) {
      return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
    }
  }

  try {
    const result = await runSocialAutoPost();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Social auto-post cron failed." },
      { status: 500 }
    );
  }
}
