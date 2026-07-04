import { NextRequest, NextResponse } from "next/server";
import { recordTrafficEvent } from "@/lib/trafficAnalytics";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await recordTrafficEvent(request, body);

  if (!result.ok && result.error) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
