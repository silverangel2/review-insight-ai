import { NextResponse } from "next/server";
import { readScanProgress, scanProgressHttp } from "@/lib/scanProgress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live progress for a running scan. A known id with no snapshot yet is pending, not a 404. */
export async function GET(request: Request) {
  const scanId = new URL(request.url).searchParams.get("scanId") || "";
  const progress = await readScanProgress(scanId);
  const http = scanProgressHttp(scanId, progress);
  return NextResponse.json(http.body, { status: http.status, headers: { "cache-control": "no-store" } });
}
