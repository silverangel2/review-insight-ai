import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { normalizePlan, normalizeRole } from "@/lib/account";
import { readAccountSession } from "@/lib/accountSession";
import { getRuntimeAppSettings } from "@/lib/appSettings";
import { supabaseSelect } from "@/lib/supabaseServer";

async function checkoutAccountFromSession(request: Request) {
  const session = readAccountSession(request);
  const email = String(session?.email || "").toLowerCase().trim();

  if (!email) return null;

  const rows = await supabaseSelect(
    "profiles",
    `select=id,auth_user_id,email,role,plan,stripe_customer_id&email=eq.${encodeURIComponent(email)}&limit=1`
  ).catch(() => []);
  const profile = rows[0] as Record<string, unknown> | undefined;
  const plan = normalizePlan(String(profile?.plan || session?.plan || "free_buyer"));
  const role = normalizeRole(String(profile?.role || session?.role || (plan.includes("seller") ? "seller" : "buyer")));

  return {
    email,
    role,
    plan,
    userId: String(profile?.id || session?.userId || email),
    authUserId: String(profile?.auth_user_id || session?.userId || ""),
    stripeCustomerId: String(profile?.stripe_customer_id || "") || null,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const plan = normalizePlan(body.plan);

  try {
    const account = await checkoutAccountFromSession(request);
    const appSettings = await getRuntimeAppSettings();

    if (account?.role === "admin") {
      return NextResponse.json({ url: `/account?plan=${plan}&mode=developer`, mode: "developer-simulated" });
    }

    if (appSettings.maintenance_mode) {
      return NextResponse.json({ error: appSettings.announcement_text || "ReviewIntel is temporarily updating. Please check back shortly." }, { status: 503 });
    }

    if (!appSettings.payments_enabled) {
      return NextResponse.json({ error: "Payments are temporarily disabled by the admin." }, { status: 503 });
    }

    const checkoutEmail = account?.email && account.email !== "guest" ? account.email : String(body.email || "").trim();

    if (plan !== "free_buyer" && !checkoutEmail) {
      return NextResponse.json({ error: "Log in before upgrading to Pro." }, { status: 401 });
    }

    const session = await createCheckoutSession(
      plan,
      checkoutEmail,
      String(account?.userId || account?.authUserId || checkoutEmail || ""),
      account?.stripeCustomerId,
      body.currency
    );
    return NextResponse.json(session);
  } catch (error) {
    console.error("Stripe checkout failed", error);
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Please try again or contact support@getreviewintel.com." }, { status: 400 });
  }
}
