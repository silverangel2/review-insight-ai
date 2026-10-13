import { NextResponse } from "next/server";
import { readAccountSession } from "@/lib/accountSession";
import { emailLinkSecret, normalizeMailbox, readEmailToken } from "@/lib/emailLinks";
import { readStoredEmailPrefs, saveEmailPrefs } from "@/lib/emailPreferenceStore";
import { rateLimitRequest } from "@/lib/security";

export const runtime = "nodejs";

function resolveEmail(request: Request, token: string) {
  if (token) return readEmailToken(token, emailLinkSecret());
  return normalizeMailbox(readAccountSession(request)?.email);
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const email = resolveEmail(request, token);
  if (!email) {
    return NextResponse.json({ error: "Open the link from your email, or log in first." }, { status: 401 });
  }
  const prefs = await readStoredEmailPrefs(email);
  if (!prefs?.found) {
    return NextResponse.json({ error: "We could not find email settings for that address yet." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    email: prefs.email,
    productUpdates: prefs.productUpdates,
    upgradeTips: prefs.upgradeTips,
    columnsReady: prefs.columnsReady,
  });
}

export async function POST(request: Request) {
  const limit = await rateLimitRequest(request, {
    key: "email_preferences",
    limit: 20,
    windowMs: 15 * 60 * 1000,
    eventType: "email_preferences_rate_limited",
  });
  if (!limit.allowed) {
    return limit.response ?? NextResponse.json({ error: "Too many updates. Please wait a few minutes." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const token = String(body.token ?? "");
  const email = resolveEmail(request, token);
  if (!email) {
    return NextResponse.json({ error: "Open the link from your email, or log in first." }, { status: 401 });
  }
  if (typeof body.productUpdates !== "boolean" || typeof body.upgradeTips !== "boolean") {
    return NextResponse.json({ error: "Choose both email settings before saving." }, { status: 400 });
  }

  const saved = await saveEmailPrefs(email, {
    productUpdates: body.productUpdates,
    upgradeTips: body.upgradeTips,
  });
  if (saved.reason === "not-configured") {
    return NextResponse.json({ error: "Email settings are not connected yet." }, { status: 503 });
  }
  if (!saved.ok) {
    return NextResponse.json({ error: "We could not save those email settings." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    columnsReady: saved.columnsReady,
    message: saved.columnsReady
      ? "Email settings saved."
      : "Product updates were saved. The newer choices need the email database update before they stick.",
  });
}
