import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { disconnectFacebookConnection } from "@/lib/facebookConnector";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to disconnect Facebook.";
}

export async function POST(request: Request) {
  try {
    const adminSession = adminSessionFromRequest(request);
    if (!adminSession) {
      return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
    }

    await disconnectFacebookConnection();

    return NextResponse.json({
      ok: true,
      message: "Facebook disconnected.",
    });
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
