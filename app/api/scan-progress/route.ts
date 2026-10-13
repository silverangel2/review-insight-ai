import { NextResponse } from "next/server";
import { getScanProgress } from "@/lib/scanProgress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live progress for a running scan (polled by the scan overlay). Unknown ids return 404, never invented data. */
export async function GET(request: Request) {
  const scanId = new URL(request.url).searchParams.get("scanId") || "";
  const progress = getScanProgress(scanId);
  if (!progress) return NextResponse.json({ scanId, progress: null }, { status: 404, headers: { "cache-control": "no-store" } });
  return NextResponse.json({ scanId, progress }, { headers: { "cache-control": "no-store" } });
}
