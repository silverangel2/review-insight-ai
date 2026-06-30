import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { disconnectTikTokConnection } from "@/lib/tiktokConnector";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const adminSession = adminSessionFromRequest(request);
    if (!adminSession) {
      return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
    }

    await disconnectTikTokConnection();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "TikTok disconnect failed",
      },
      { status: 500 }
    );
  }
}
