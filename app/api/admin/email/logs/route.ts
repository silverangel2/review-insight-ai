import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";

export const runtime = "nodejs";

const TABLE = "admin_email_logs";

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function supabaseServiceKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    ""
  );
}

function headers() {
  const key = supabaseServiceKey();

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  if (!supabaseUrl() || !supabaseServiceKey()) {
    return NextResponse.json({
      ok: true,
      logs: [],
      deploymentReady: false,
      error: "Supabase service role env is missing.",
    });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);

  const response = await fetch(
    `${supabaseUrl()}/rest/v1/${TABLE}?select=*&order=created_at.desc&limit=${limit}`,
    {
      method: "GET",
      headers: headers(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    return NextResponse.json(
      {
        ok: false,
        logs: [],
        deploymentReady: false,
        error: `Email logs read failed: ${response.status} ${message}`,
      },
      { status: 500 }
    );
  }

  const logs = await response.json();

  return NextResponse.json({
    ok: true,
    logs,
    deploymentReady: true,
  });
}
