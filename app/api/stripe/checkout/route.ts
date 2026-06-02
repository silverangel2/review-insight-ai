import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { normalizePlan } from "@/lib/account";
import { getRuntimeAppSettings } from "@/lib/appSettings";
import { accountFromRequest, hasSupabaseServiceEnv } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const plan = normalizePlan(body.plan);

  try {
    const account = await accountFromRequest(request);
    const appSettings = getRuntimeAppSettings();

    if (account.role === "admin") {
      return NextResponse.json({ url: `/account?plan=${plan}&mode=developer`, mode: "developer-simulated" });
    }

    if (appSettings.maintenance_mode) {
      return NextResponse.json({ error: appSettings.announcement_text || "ReviewIntel is temporarily updating. Please check back shortly." }, { status: 503 });
    }

    if (!appSettings.payments_enabled) {
      return NextResponse.json({ error: "Payments are temporarily disabled by the admin." }, { status: 503 });
    }

    if (hasSupabaseServiceEnv() && plan !== "free_buyer" && !account.userId) {
      return NextResponse.json({ error: "Log in before upgrading to Pro." }, { status: 401 });
    }

    const session = await createCheckoutSession(
      plan,
      account.email !== "guest" ? account.email : body.email,
      account.userId,
      account.stripeCustomerId,
      body.currency
    );
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed." }, { status: 400 });
  }
}
