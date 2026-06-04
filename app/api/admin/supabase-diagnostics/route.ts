import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseCount, supabaseInsert } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isSupabaseConfigured();

  if (!configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "Supabase environment variables are missing."
    });
  }

  const profiles = await supabaseCount("profiles");
  const analyses = await supabaseCount("analyses");
  const usageEvents = await supabaseCount("usage_events");

  return NextResponse.json({
    ok: true,
    configured: true,
    tables: {
      profiles,
      analyses,
      usage_events: usageEvents
    }
  });
}

export async function POST() {
  const configured = isSupabaseConfigured();

  if (!configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "Supabase environment variables are missing."
    }, { status: 500 });
  }

  const row = await supabaseInsert("usage_events", {
    profile_email: "owner@test.local",
    event_type: "supabase_connection_test",
    plan: "admin",
    estimated_cost: 0,
    metadata: {
      source: "ReviewIntel diagnostics",
      created_by: "admin"
    }
  });

  return NextResponse.json({
    ok: Boolean(row),
    inserted: Boolean(row),
    row
  });
}
