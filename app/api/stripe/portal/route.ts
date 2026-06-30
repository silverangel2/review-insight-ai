import { NextResponse } from "next/server";
import { createBillingPortal } from "@/lib/stripe";
import { normalizePlan, normalizeRole } from "@/lib/account";
import { readAccountSession } from "@/lib/accountSession";
import { supabaseSelect } from "@/lib/supabaseServer";

async function portalAccountFromSession(request: Request) {
  const session = readAccountSession(request);
  const email = String(session?.email || "").toLowerCase().trim();

  if (!email) return null;

  const rows = await supabaseSelect(
    "profiles",
    `select=email,role,plan,stripe_customer_id&email=eq.${encodeURIComponent(email)}&limit=1`
  ).catch(() => []);
  const profile = rows[0] as Record<string, unknown> | undefined;
  const plan = normalizePlan(String(profile?.plan || session?.plan || "free_buyer"));
  const role = normalizeRole(String(profile?.role || session?.role || (plan.includes("seller") ? "seller" : "buyer")));

  return {
    email,
    role,
    plan,
    stripeCustomerId: String(profile?.stripe_customer_id || "") || null,
  };
}

export async function POST(request: Request) {
  const account = await portalAccountFromSession(request);

  if (account?.role === "admin") {
    return NextResponse.json({ url: "/admin?billing=developer", mode: "developer-simulated" });
  }

  if (!account?.email) {
    return NextResponse.json({ error: "Log in to manage your subscription." }, { status: 401 });
  }

  const customerId = account.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json({ error: "No Stripe customer is linked to this account." }, { status: 400 });
  }

  try {
    const session = await createBillingPortal(customerId);
    return NextResponse.json(session);
  } catch (error) {
    console.error("Stripe billing portal failed", error);
    return NextResponse.json({ error: "Billing portal is temporarily unavailable. Please contact support@getreviewintel.com." }, { status: 400 });
  }
}
