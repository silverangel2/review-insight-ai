import { NextResponse } from "next/server";
import type { SponsorEventType } from "@/lib/sponsors";

const allowedEvents: SponsorEventType[] = ["impression", "click"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const type = body?.type as SponsorEventType | undefined;
  const sponsorId = typeof body?.sponsorId === "string" ? body.sponsorId : "";

  if (!type || !allowedEvents.includes(type) || !sponsorId) {
    return NextResponse.json({ error: "Invalid sponsor event." }, { status: 400 });
  }

  // Future production hook:
  // Insert into Supabase sponsor_events or forward to analytics when enabled.
  return NextResponse.json({ ok: true });
}
