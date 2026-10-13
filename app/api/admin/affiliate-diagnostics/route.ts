import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { buildAffiliateDiagnostics } from "@/lib/affiliateDiagnostics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!adminSessionFromRequest(request)) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 401 });
  }
  return NextResponse.json(buildAffiliateDiagnostics());
}
