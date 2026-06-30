import { NextResponse } from "next/server";
import crypto from "crypto";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { getTikTokAuthUrl } from "@/lib/tiktokConnector";

export const dynamic = "force-dynamic";

function publicBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://getreviewintel.com";
  const value = raw.replace(/\/$/, "");

  if (value.includes("localhost") || value.includes("127.0.0.1")) {
    return "https://getreviewintel.com";
  }

  return value;
}

export async function GET(request: Request) {
  try {
    const adminSession = adminSessionFromRequest(request);
    if (!adminSession) {
      return NextResponse.redirect(`${publicBaseUrl()}/admin-access`);
    }

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
