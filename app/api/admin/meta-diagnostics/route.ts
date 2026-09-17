import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { runReviewIntelMetaVisibilityDiagnostic } from "@/lib/metaVisibilityDiagnostic";

export async function GET(request: Request) {
  if (!adminSessionFromRequest(request)) return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, diagnostic: await runReviewIntelMetaVisibilityDiagnostic() });
  } catch {
    return NextResponse.json({ ok: false, error: "Meta visibility diagnosis failed safely." }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ ok: false, error: "GET-only diagnostic." }, { status: 405 });
}
