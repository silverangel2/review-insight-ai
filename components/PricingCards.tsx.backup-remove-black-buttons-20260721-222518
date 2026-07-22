"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/Badge";
import { trackTrafficEvent } from "@/lib/clientTraffic";
import { accountHeaders, getClientAccount, setClientPlan } from "@/lib/clientAccount";
import { pricingLabelForPlan, type SupportedCurrency } from "@/lib/pricing";
import type { SubscriptionPlan } from "@/lib/types";

const tiers: Array<{
  plan: SubscriptionPlan;
  name: string;
  label: string;
  description: string;
  cta: string;
  features: string[];
  bestFor: string;
  highlight?: boolean;
}> = [
  {
    plan: "free_buyer",
    name: "Shopper Free",
    label: "Start simple",
    description: "For quick product checks before you buy.",
    cta: "Use Shopper Free",
    bestFor: "Trying ReviewIntel without a subscription.",
    features: [
      "3 product scans per day",
      "Screenshot or product-link scan",
      "BUY / CONSIDER / AVOID verdict",
      "Latest result only"
    ]
  },
  {
    plan: "buyer_pro",
    name: "Shopper Premium",
    label: "Best for shoppers",
    description: "For people who compare often and want stronger buying confidence.",
    cta: "Upgrade Shopper Premium",
    bestFor: "Frequent online shopping, deal checks, and product comparison.",
    highlight: true,
    features: [
      "Unlimited shopper scans",
      "Saved scan history",
      "Product A vs B compare",
      "Amazon Better Picks",
      "Affiliate-ready source links"
    ]
  },
  {
    plan: "seller_premium",
    name: "Seller Premium",
    label: "Seller intelligence",
    description: "For sellers who need to understand what buyers keep praising or complaining about.",
    cta: "Upgrade Seller Premium",
    bestFor: "Finding product issues, review patterns, and listing fixes.",
    features: [
      "Seller product health scan",
      "Complaint clustering",
      "Buyer psychology signals",
      "Export-ready insights",
      "Seller dashboard history"
    ]
  },
  {
    plan: "seller_pro",
    name: "Seller Pro",
    label: "Growth command",
    description: "For serious sellers tracking improvement over time and learning how to outgrow competitors.",
    cta: "Upgrade Seller Pro",
    bestFor: "Product improvement tracking, competitor positioning, and growth planning.",
    highlight: true,
    features: [
      "Competitor compare intelligence",
      "Improvement calendar",
      "Seller Pro growth graph",
      "Product score movement",
      "Deeper action planning"
    ]
  }
];

export function PricingCards() {
  const [error, setError] = useState("");
  const [busyPlan, setBusyPlan] = useState<SubscriptionPlan | null>(null);
  const currency: SupportedCurrency = "CAD";

  async function choosePlan(plan: SubscriptionPlan) {
    setError("");
    trackTrafficEvent({
      eventType: "pricing_click",
      metadata: { plan },
    });

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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier) => (
          <article
            key={tier.name}
            className={`rounded-3xl border p-5 shadow-soft ${
              tier.highlight
                ? "border-cyan-200 bg-[linear-gradient(145deg,#ffffff,#ecfeff)] dark:border-cyan-300/30 dark:bg-[linear-gradient(145deg,rgba(8,145,178,0.20),rgba(15,23,42,0.96))]"
                : "border-line bg-white dark:border-white/10 dark:bg-slate-950"
            }`}
          >
            <Badge tone={tier.plan === "seller_pro" || tier.plan === "seller_premium" ? "good" : tier.plan === "free_buyer" ? "neutral" : "info"}>
              {tier.label}
            </Badge>
            <h2 className="mt-4 text-xl font-black text-ink dark:text-white">{tier.name}</h2>
            <p className="mt-3 text-3xl font-black text-ocean dark:text-cyan-300">{pricingLabelForPlan(tier.plan, currency)}</p>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{tier.description}</p>
            <p className="mt-3 rounded-2xl bg-mist px-4 py-3 text-xs font-black leading-5 text-slate-700 dark:bg-white/[0.05] dark:text-slate-200">
              {tier.bestFor}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {tier.features.map((feature) => (
                <li key={feature} className="rounded-2xl border border-line bg-white/70 px-3 py-2 font-bold dark:border-white/10 dark:bg-white/[0.04]">
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
