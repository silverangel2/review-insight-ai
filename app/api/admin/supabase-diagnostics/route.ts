import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { isSupabaseConfigured, supabaseCount, supabaseInsert } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

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

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

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
      created_by: adminSession.email
    }
  });

  return NextResponse.json({
    ok: Boolean(row),
    inserted: Boolean(row),
    row
  });
}
