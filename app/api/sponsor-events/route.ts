import { NextResponse } from "next/server";
import { supabaseInsert } from "@/lib/supabaseServer";
import type { SponsorEventType } from "@/lib/sponsors";

const allowedEvents: SponsorEventType[] = ["impression", "click"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const type = body?.type as SponsorEventType | undefined;
  const sponsorId = typeof body?.sponsorId === "string" ? body.sponsorId : "";

  if (!type || !allowedEvents.includes(type) || !sponsorId) {
    return NextResponse.json({ error: "Invalid sponsor event." }, { status: 400 });
  }

  await supabaseInsert("sponsor_ad_events", {
    sponsor_id: sponsorId,
    event_type: type,
    placement: typeof body?.placement === "string" ? body.placement : null,
    path: typeof body?.path === "string" ? body.path : null,
    occurred_at: typeof body?.occurredAt === "string" ? body.occurredAt : new Date().toISOString(),
    user_agent: request.headers.get("user-agent") || null,
    created_at: new Date().toISOString()
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
