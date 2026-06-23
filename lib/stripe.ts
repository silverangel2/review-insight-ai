import crypto from "node:crypto";
import { getPublicAppUrl, hasStripeEnv, requireEnv } from "@/lib/env";
import { normalizeCurrency, type SupportedCurrency } from "@/lib/pricing";
import type { SubscriptionPlan } from "@/lib/types";

const priceEnv: Record<Exclude<SubscriptionPlan, "free_buyer">, string> = {
  buyer_pro: "STRIPE_BUYER_PRO_PRICE_ID",
  seller_premium: "STRIPE_SELLER_PREMIUM_PRICE_ID",
  seller_pro: "STRIPE_SELLER_PRO_PRICE_ID"
};

const localizedPriceEnvKeys: Record<Exclude<SubscriptionPlan, "free_buyer">, string> = {
  buyer_pro: "STRIPE_BUYER_PRO",
  seller_premium: "STRIPE_SELLER_PREMIUM",
  seller_pro: "STRIPE_SELLER_PRO"
};

function localizedPriceEnv(plan: Exclude<SubscriptionPlan, "free_buyer">, currency: SupportedCurrency) {
  if (currency === "USD") return priceEnv[plan];
  return `${localizedPriceEnvKeys[plan]}_${currency}_PRICE_ID`;
}

export function planPriceId(plan: SubscriptionPlan, rawCurrency: unknown = "USD") {
  if (plan === "free_buyer") return null;
  const currency = normalizeCurrency(rawCurrency);
  return process.env[localizedPriceEnv(plan, currency)] || process.env[localizedPriceEnv(plan, "USD")] || null;
}

export function planFromPriceId(priceId: string | null | undefined): SubscriptionPlan {
  if (!priceId) return "free_buyer";
  for (const currency of ["USD", "CAD", "EUR", "GBP", "PHP"] as const) {
    for (const plan of ["seller_pro", "seller_premium", "buyer_pro"] as const) {
      if (priceId === process.env[localizedPriceEnv(plan, currency)]) return plan;
    }
  }
  return "free_buyer";
}

export async function createCheckoutSession(plan: SubscriptionPlan, email?: string, userId?: string | null, customerId?: string | null, rawCurrency: unknown = "USD") {
  const currency = normalizeCurrency(rawCurrency);

  if (plan === "free_buyer") {
    return { url: `${getPublicAppUrl()}/account?plan=free_buyer`, mode: "free" };
  }

  if (!hasStripeEnv()) throw new Error("Stripe Checkout is not configured for paid subscriptions.");

  const price = planPriceId(plan, currency);
  if (!price) throw new Error(`${localizedPriceEnv(plan, currency)} is not configured.`);

  const body = new URLSearchParams({
    mode: "subscription",
    success_url: `${getPublicAppUrl()}/account?plan=${plan}&checkout=success`,
    cancel_url: `${getPublicAppUrl()}/pricing?checkout=cancelled`,
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    allow_promotion_codes: "true",
    "metadata[plan]": plan,
    "metadata[currency]": currency,
    "subscription_data[metadata][plan]": plan,
    "subscription_data[metadata][currency]": currency
  });

  if (userId) {
    body.set("client_reference_id", userId);
    body.set("metadata[user_id]", userId);
    body.set("subscription_data[metadata][user_id]", userId);
  }

  if (customerId) {
    body.set("customer", customerId);
  } else if (email) {
    body.set("customer_email", email);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Stripe Checkout failed.");
  return data as { url: string };
}

export async function createBillingPortal(customerId: string) {
  if (!hasStripeEnv()) {
    throw new Error("Stripe Billing Portal is not configured.");
  }

  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      customer: customerId,
      return_url: `${getPublicAppUrl()}/account`
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Stripe Billing Portal failed.");
  return data as { url: string };
}

export function verifyStripeSignature(payload: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const entries = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );
  const timestamp = entries.t;
  const signature = entries.v1;
  if (!timestamp || !signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
