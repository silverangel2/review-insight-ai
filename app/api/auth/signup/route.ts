import { NextResponse } from "next/server";
import { getRuntimeAppSettings } from "@/lib/appSettings";
import { signUpWithSupabase } from "@/lib/supabaseAuth";
import { supabaseUpsert } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const termsAccepted = Boolean(body.termsAccepted);
  const marketingConsent = Boolean(body.marketingConsent);

  if (!termsAccepted) {
    return NextResponse.json(
      { error: "You must accept the Terms of Service and Privacy Policy to create an account." },
      { status: 400 }
    );
  }

  if (body.role !== "buyer" && body.role !== "seller") {
    return NextResponse.json({ error: "Choose Shopper or Seller account type." }, { status: 400 });
  }

  const appSettings = await getRuntimeAppSettings();

  if (appSettings.maintenance_mode) {
    return NextResponse.json({ error: appSettings.announcement_text || "ReviewIntel is temporarily updating. Please check back shortly." }, { status: 503 });
  }

  if (!appSettings.allow_new_signups) {
    return NextResponse.json({ error: "New signups are temporarily closed." }, { status: 503 });
  }

  try {
    const result = await signUpWithSupabase({
      ...body,
      termsAccepted,
      marketingConsent,
    });

    const email = String(body.email).toLowerCase().trim();
    const role = body.role === "seller" ? "seller" : "buyer";
    const plan = role === "seller" ? "seller_starter" : "free_buyer";
    const now = new Date().toISOString();

    await supabaseUpsert("profiles", {
      email,
      name: body.name ? String(body.name).trim() : "",
      role,
      plan,
      marketing_consent: marketingConsent,
      terms_accepted: termsAccepted,
      created_at: now,
      last_login: now,
    }).catch((profileError) => {
      console.error("Signup profile save failed:", profileError);
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Signup failed." }, { status: 400 });
  }
}
