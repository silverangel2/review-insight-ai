import { NextResponse } from "next/server";
import { supabaseUpsert } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const email = String(url.searchParams.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }

  await supabaseUpsert("profiles", {
    email,
    marketing_consent: false,
    updated_at: new Date().toISOString()
  });

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }

  await supabaseUpsert("profiles", {
    email,
    marketing_consent: false,
    updated_at: new Date().toISOString()
  });

  return NextResponse.json({ ok: true });
}
