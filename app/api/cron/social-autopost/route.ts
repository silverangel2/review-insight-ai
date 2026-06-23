import { NextRequest, NextResponse } from "next/server";
import { runSocialAutoPost } from "@/lib/socialAutoPost";

export async function GET(request: NextRequest) {
  const secret = process.env.SOCIAL_CRON_SECRET;

  if (secret) {
    const provided = request.headers.get("authorization")?.replace("Bearer ", "");
    const querySecret = request.nextUrl.searchParams.get("secret");

    if (provided !== secret && querySecret !== secret) {
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
