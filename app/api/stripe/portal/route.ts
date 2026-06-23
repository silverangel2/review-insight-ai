import { NextResponse } from "next/server";
import { createBillingPortal } from "@/lib/stripe";
import { accountFromRequest } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const account = await accountFromRequest(request);
  const customerId = body.customerId;

  if (account?.role === "admin") {
    return NextResponse.json({ url: "/admin?billing=developer", mode: "developer-simulated" });
  }

  if (!customerId) {
    return NextResponse.json({ error: "customerId is required for billing portal." }, { status: 400 });
  }

  try {
    const session = await createBillingPortal(customerId);
    return NextResponse.json(session);
  } catch (error) {
    console.error("Stripe billing portal failed", error);
    return NextResponse.json({ error: "Billing portal is temporarily unavailable. Please contact support@getreviewintel.com." }, { status: 400 });
  }
}
