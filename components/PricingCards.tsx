"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/Badge";
import { accountHeaders, getClientAccount, setClientPlan } from "@/lib/clientAccount";
import { pricingLabelForPlan, type SupportedCurrency } from "@/lib/pricing";
import type { SubscriptionPlan } from "@/lib/types";

const tiers: Array<{
  plan: SubscriptionPlan;
  name: string;
  description: string;
  cta: string;
  features: string[];
}> = [
  {
    plan: "free_buyer",
    name: "Shopper Free",
    description: "For shoppers testing products before buying.",
    cta: "Use Shopper Free",
    features: ["3 product analyses per day", "Limited screenshots", "Basic summaries", "Shopper recommendation"]
  },
  {
    plan: "buyer_pro",
    name: "Shopper Premium",
    description: "For frequent shoppers comparing multiple products.",
    cta: "Upgrade Shopper Premium",
    features: ["Unlimited shopper analyses", "Product history", "Favorites", "Comparison tools", "Higher screenshot usage"]
  },
  {
    plan: "seller_premium",
    name: "Seller Premium",
    description: "For small ecommerce sellers diagnosing reviews.",
    cta: "Upgrade Seller Premium",
    features: ["Seller trust snapshot", "Complaint clustering", "Keyword analysis", "Improvement suggestions", "Export-ready reports"]
  },
  {
    plan: "seller_pro",
    name: "Seller Pro",
    description: "For sellers comparing competitors and finding market gaps.",
    cta: "Upgrade Seller Pro",
    features: ["Competitor comparison", "Market gap analysis", "Product improvement calendar tracker", "Advanced seller recommendations", "Unlimited analysis", "Priority workflows"]
  }
];

export function PricingCards() {
  const [error, setError] = useState("");
  const [busyPlan, setBusyPlan] = useState<SubscriptionPlan | null>(null);
  const currency: SupportedCurrency = "CAD";

  async function choosePlan(plan: SubscriptionPlan) {
    setError("");

    if (plan === "free_buyer") {
      setClientPlan("free_buyer");
      window.location.href = "/account?plan=free_buyer";
      return;
    }

    const account = getClientAccount();
    if (!account?.email) {
      window.location.href = `/login?next=${encodeURIComponent(`/pricing?plan=${plan}`)}`;
      return;
    }

    setBusyPlan(plan);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...accountHeaders() },
        body: JSON.stringify({
          plan,
          email: account.email,
          currency,
          userId: account.profileId || account.authUserId || account.userId || account.email,
          customerId: account.stripeCustomerId
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url) {
        setError("Checkout is temporarily unavailable. Please try again or contact support@getreviewintel.com.");
        return;
      }

      window.location.href = data.url;
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <section>
      {error ? <p className="mb-5 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier) => (
          <article key={tier.name} className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
            <Badge tone={tier.plan === "seller_pro" || tier.plan === "seller_premium" ? "good" : tier.plan === "free_buyer" ? "neutral" : "info"}>
              {tier.plan === "free_buyer" ? "Starter" : "Subscription"}
            </Badge>
            <h2 className="mt-5 text-xl font-black text-ink dark:text-white">{tier.name}</h2>
            <p className="mt-4 text-4xl font-black text-ocean dark:text-cyan-300">{pricingLabelForPlan(tier.plan, currency)}</p>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{tier.description}</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              {tier.features.map((feature) => (
                <li key={feature} className="rounded-xl border border-line px-3 py-2 dark:border-white/10">
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => void choosePlan(tier.plan)}
              disabled={busyPlan === tier.plan}
              className="mt-6 inline-flex w-full justify-center rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean disabled:cursor-wait disabled:bg-slate-400 dark:bg-white dark:text-ink"
            >
              {busyPlan === tier.plan ? "Opening checkout..." : tier.cta}
            </button>
          </article>
        ))}
      </div>
      <div className="mt-6 grid gap-3 rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-sm font-black text-ink dark:text-white">Need subscription help before checkout?</p>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Review refund terms, billing support, and cancellation controls before upgrading.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/manage-subscription" className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
            Manage Subscription
          </Link>
          <Link href="/billing-support" className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
            Billing Support
          </Link>
          <Link href="/refunds" className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
            Refund Policy
          </Link>
        </div>
      </div>
    </section>
  );
}
