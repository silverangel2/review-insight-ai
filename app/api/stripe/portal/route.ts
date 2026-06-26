import { NextResponse } from "next/server";
import { createBillingPortal } from "@/lib/stripe";
import { accountFromRequest } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const account = await accountFromRequest(request);

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
