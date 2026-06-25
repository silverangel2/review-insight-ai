import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseInsert } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: false,
      source: "local",
      message: "Supabase is not configured."
    });
  }

  const row = await supabaseInsert("usage_events", {
    profile_email: body.email ?? body.profile_email ?? null,
    event_type: body.eventType ?? body.event_type ?? "manual_event",
    plan: body.plan ?? null,
    estimated_cost: Number(body.estimatedCost ?? body.estimated_cost ?? 0),
    metadata: body.metadata ?? {},
    created_at: new Date().toISOString()
  });

  return NextResponse.json({
    ok: Boolean(row),
    row
  });
}
