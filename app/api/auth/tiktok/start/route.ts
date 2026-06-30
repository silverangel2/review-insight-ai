import { NextResponse } from "next/server";
import crypto from "crypto";
import { getTikTokAuthUrl } from "@/lib/tiktokConnector";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = crypto.randomBytes(24).toString("hex");
    const response = NextResponse.redirect(getTikTokAuthUrl(state));

    response.cookies.set("tiktok_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "TikTok connection failed";
    return NextResponse.redirect(
      `https://getreviewintel.com/admin/social?tiktok=error&message=${encodeURIComponent(message)}`
    );
  }
}
