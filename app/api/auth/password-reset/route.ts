import { NextResponse } from "next/server";
import { resetPasswordWithSupabase } from "@/lib/supabaseAuth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    const result = await resetPasswordWithSupabase(body.email);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Password reset failed." }, { status: 400 });
  }
}
