import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/accountSession";
import { isSupabaseConfigured, supabaseInsert } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const requestedEmail = String(body.email ?? body.profile_email ?? "").toLowerCase().trim();
  const session = readAccountSession(request);
  const authenticatedEmail = String(session?.email ?? "").toLowerCase().trim();

  if (requestedEmail && authenticatedEmail && requestedEmail !== authenticatedEmail) {
    return NextResponse.json(
      { ok: false, error: "You are not allowed to log usage for another account." },
      { status: 403 }
    );
  }

  const profileEmail = authenticatedEmail || requestedEmail || null;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: false,
      source: "local",
      message: "Supabase is not configured."
    });
  }

  const row = await supabaseInsert("usage_events", {
    profile_email: profileEmail,
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
