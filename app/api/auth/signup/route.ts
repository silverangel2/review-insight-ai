import { NextResponse } from "next/server";
import { getRuntimeAppSettings } from "@/lib/appSettings";
import { signUpWithSupabase } from "@/lib/supabaseAuth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (body.role !== "buyer" && body.role !== "seller") {
    return NextResponse.json({ error: "Choose Shopper or Seller account type." }, { status: 400 });
  }

  const appSettings = getRuntimeAppSettings();

  if (appSettings.maintenance_mode) {
    return NextResponse.json({ error: appSettings.announcement_text || "ReviewIntel is temporarily updating. Please check back shortly." }, { status: 503 });
  }

  if (!appSettings.allow_new_signups) {
    return NextResponse.json({ error: "New signups are temporarily closed." }, { status: 503 });
  }

  try {
    const result = await signUpWithSupabase(body);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Signup failed." }, { status: 400 });
  }
}
