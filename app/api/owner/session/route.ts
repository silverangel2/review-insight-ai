import { NextResponse } from "next/server";
import { ownerSessionFromRequest } from "@/lib/ownerAccess";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!ownerSessionFromRequest(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
