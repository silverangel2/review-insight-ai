import { NextRequest, NextResponse } from "next/server";
import {
  exchangeTikTokCodeForToken,
  getTikTokUserInfo,
  getTikTokScopes,
  storeTikTokConnection,
} from "@/lib/tiktokConnector";

export const dynamic = "force-dynamic";

function publicBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://getreviewintel.com";
  const value = raw.replace(/\/$/, "");

  if (value.includes("localhost") || value.includes("127.0.0.1")) {
    return "https://getreviewintel.com";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const savedState = request.cookies.get("tiktok_oauth_state")?.value;

  const baseUrl = publicBaseUrl();

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/admin/social?tiktok=error&message=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/admin/social?tiktok=error&message=${encodeURIComponent("Missing TikTok authorization code")}`
    );
  }

  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(
      `${baseUrl}/admin/social?tiktok=error&message=${encodeURIComponent("TikTok OAuth state mismatch")}`
    );
  }

  try {
    const token = await exchangeTikTokCodeForToken(code);
    const user = await getTikTokUserInfo(token.access_token);

    const openId = user?.open_id || token.open_id;
    if (!openId) {
      throw new Error("TikTok account open_id missing");
    }

    await storeTikTokConnection({
      openId,
      accountName: user?.display_name || "TikTok",
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenType: token.token_type,
      expiresIn: token.expires_in,
      scopes: token.scope ? token.scope.split(",") : getTikTokScopes(),
      metadata: {
        avatar_url: user?.avatar_url || null,
        union_id: user?.union_id || null,
      },
    });

    const response = NextResponse.redirect(`${baseUrl}/admin/social?tiktok=connected`);
    response.cookies.delete("tiktok_oauth_state");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "TikTok callback failed";
    return NextResponse.redirect(
      `${baseUrl}/admin/social?tiktok=error&message=${encodeURIComponent(message)}`
    );
  }
}
