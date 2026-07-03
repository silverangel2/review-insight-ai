import { NextResponse } from "next/server";
import { rateLimitRequest } from "@/lib/security";
import { updatePasswordWithSupabase } from "@/lib/supabaseAuth";

export async function POST(request: Request) {
  const limit = await rateLimitRequest(request, {
    key: "password_update",
    limit: 8,
    windowMs: 30 * 60 * 1000,
    eventType: "password_update_rate_limited",
  });

  if (!limit.allowed) {
    return limit.response ?? NextResponse.json({ error: "Too many password update attempts." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!accessToken) {
    return NextResponse.json({ error: "Password reset token is missing or expired." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Use at least 8 characters for your new password." }, { status: 400 });
  }

  try {
    const result = await updatePasswordWithSupabase(accessToken, password);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Password update failed." },
      { status: 400 }
    );
  }
}
