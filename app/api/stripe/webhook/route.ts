import { NextResponse } from "next/server";
import { planFromPriceId, verifyStripeSignature } from "@/lib/stripe";
import { recordBillingEvent, upsertSubscriptionByStripeCustomer } from "@/lib/supabaseServer";
import { normalizePlan } from "@/lib/account";

type StripeEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function subscriptionPriceId(subscription: Record<string, unknown>) {
  const items = asObject(subscription.items);
  const data = Array.isArray(items.data) ? items.data : [];
  const firstItem = asObject(data[0]);
  const price = asObject(firstItem.price);
  return asString(price.id);
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!verifyStripeSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEvent;
  const object = asObject(event.data?.object);

  if (event.type === "checkout.session.completed") {
    const metadata = asObject(object.metadata);
    await upsertSubscriptionByStripeCustomer({
      customerId: asString(object.customer) ?? "",
      subscriptionId: asString(object.subscription),
      plan: normalizePlan(asString(metadata.plan)),
      status: "active",
      userId: asString(metadata.user_id) ?? asString(object.client_reference_id)
    });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const metadata = asObject(object.metadata);
    const priceId = subscriptionPriceId(object);
    const metadataPlan = asString(metadata.plan);
    await upsertSubscriptionByStripeCustomer({
      customerId: asString(object.customer) ?? "",
      subscriptionId: asString(object.id),
      priceId,
      plan: metadataPlan ? normalizePlan(metadataPlan) : planFromPriceId(priceId),
      status: event.type === "customer.subscription.deleted" ? "canceled" : asString(object.status) ?? "active",
      currentPeriodStart: asNumber(object.current_period_start),
      currentPeriodEnd: asNumber(object.current_period_end),
      cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
      userId: asString(metadata.user_id)
    });
  }

  if (event.type?.startsWith("invoice.")) {
    await recordBillingEvent(event);
  }

  return NextResponse.json({ received: true, type: event.type });
}
