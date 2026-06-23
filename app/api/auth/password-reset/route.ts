import { NextResponse } from "next/server";
import { rateLimitRequest } from "@/lib/security";
import { resetPasswordWithSupabase } from "@/lib/supabaseAuth";

export async function POST(request: Request) {
  const limit = await rateLimitRequest(request, {
    key: "password_reset",
    limit: 5,
    windowMs: 30 * 60 * 1000,
    eventType: "password_reset_rate_limited"
  });

  if (!limit.allowed) {
    return limit.response ?? NextResponse.json({ error: "Too many password reset attempts." }, { status: 429 });
  }

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
