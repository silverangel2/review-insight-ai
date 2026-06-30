import { NextResponse } from "next/server";
import { buildFacebookOAuthUrl } from "@/lib/facebookConnector";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to start Facebook connection";
}

function randomState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET() {
  try {
    const state = randomState();
    const url = buildFacebookOAuthUrl(state);

    const response = NextResponse.redirect(url);
    response.cookies.set("reviewintel_fb_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
