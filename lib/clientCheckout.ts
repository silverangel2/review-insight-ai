"use client";
import { accountHeaders, getClientAccount } from "@/lib/clientAccount";
import { trackTrafficEvent } from "@/lib/clientTraffic";

/** Starts the EXISTING Stripe checkout (/api/stripe/checkout). Logged-out users go to login first. */
export async function startPlanCheckout(plan: string, source: string, currency = "USD"): Promise<string | null> {
  const account = getClientAccount();
  if (!account?.email || account.email === "guest") {
    window.location.href = `/login?next=${encodeURIComponent(`/pricing?plan=${plan}`)}`;
    return null;
  }
  trackTrafficEvent({ eventType: "checkout_start", metadata: { plan, source } });
  const response = await fetch("/api/stripe/checkout", {
    method: "POST", headers: { "Content-Type": "application/json", ...accountHeaders() },
    body: JSON.stringify({ plan, email: account.email, currency, userId: account.profileId || account.authUserId || account.userId || account.email, customerId: account.stripeCustomerId }),
  }).catch(() => null);
  const data = response ? await response.json().catch(() => ({})) : {};
  if (response?.ok && data.url) { window.location.href = data.url; return null; }
  return "Checkout is temporarily unavailable. Please try again or contact support@getreviewintel.com.";
}
