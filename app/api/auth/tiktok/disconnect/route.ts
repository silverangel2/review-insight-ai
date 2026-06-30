import { NextResponse } from "next/server";
import { disconnectTikTokConnection } from "@/lib/tiktokConnector";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
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
