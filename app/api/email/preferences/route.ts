import { NextResponse } from "next/server";
import { OPTIONAL_CATEGORIES, verifyEmailToken } from "@/lib/emailPreferences";
import { savePreferences } from "@/lib/emailPreferencesStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const t = String(form?.get("t") || "");
  const email = verifyEmailToken(t);
  if (!email || !form) return NextResponse.json({ error: "Invalid link." }, { status: 400 });
  const patch: Record<string, boolean> = { unsubscribed_all: false };
  for (const c of OPTIONAL_CATEGORIES) patch[c] = form.get(c) === "on";
  const ok = await savePreferences(email, patch);
  return NextResponse.redirect(new URL(`/email-preferences?t=${encodeURIComponent(t)}&saved=${ok ? "1" : "0"}`, new URL(request.url).origin), 303);
}
