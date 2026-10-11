import { NextResponse } from "next/server";
import { OPTIONAL_CATEGORIES, verifyEmailToken, type OptionalCategory } from "@/lib/emailPreferences";
import { savePreferences } from "@/lib/emailPreferencesStore";

export const runtime = "nodejs";

async function apply(url: URL) {
  const email = verifyEmailToken(url.searchParams.get("t") || "");
  if (!email) return { ok: false as const, email: null };
  const c = url.searchParams.get("c") as OptionalCategory | null;
  const patch = c && (OPTIONAL_CATEGORIES as readonly string[]).includes(c) ? { [c]: false } : { unsubscribed_all: true };
  return { ok: await savePreferences(email, patch), email };
}

// RFC 8058 one-click (mail clients POST here without user interaction).
export async function POST(request: Request) {
  const r = await apply(new URL(request.url));
  return NextResponse.json({ ok: r.ok }, { status: r.email ? 200 : 400 });
}

// Link click: apply, then show the preferences page.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const r = await apply(url);
  if (!r.email) return NextResponse.json({ error: "Invalid unsubscribe link." }, { status: 400 });
  return NextResponse.redirect(new URL(`/email-preferences?t=${encodeURIComponent(url.searchParams.get("t") || "")}&done=${r.ok ? "1" : "0"}`, url.origin), 303);
}
