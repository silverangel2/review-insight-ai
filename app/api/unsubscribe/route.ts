import { NextResponse } from "next/server";
import { readUnsubscribeInput, unsubscribeTarget } from "@/lib/emailUnsubscribe";
import { saveEmailPrefs } from "@/lib/emailPreferenceStore";
import { rateLimitRequest } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dest = new URL("/unsubscribe", url.origin);
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");
  if (token) dest.searchParams.set("token", token);
  if (email) dest.searchParams.set("email", email);
  return NextResponse.redirect(dest, 303);
}

export async function POST(request: Request) {
  const limit = await rateLimitRequest(request, {
    key: "email_unsubscribe",
    limit: 10,
    windowMs: 15 * 60 * 1000,
    eventType: "unsubscribe_rate_limited",
  });
  if (!limit.allowed) {
    return limit.response ?? NextResponse.json({ error: "Too many unsubscribe attempts." }, { status: 429 });
  }

  const input = await readUnsubscribeInput(request);
  const email = unsubscribeTarget(input);
  if (!email) {
    return NextResponse.json({ error: "A valid unsubscribe link is required." }, { status: 400 });
  }

  const saved = await saveEmailPrefs(email, { productUpdates: false, upgradeTips: false });
  if (saved.reason === "not-configured") {
    return NextResponse.json({ error: "Email settings are not connected yet. Nothing was changed." }, { status: 503 });
  }

  if (input.formPost && !input.oneClick) {
    const dest = new URL("/unsubscribe", new URL(request.url).origin);
    dest.searchParams.set("done", "1");
    return NextResponse.redirect(dest, 303);
  }

  return NextResponse.json({
    ok: true,
    message: "Product updates and scan tips are off. Account and billing messages can still be sent when they are needed.",
  });
}
