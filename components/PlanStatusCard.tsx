"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FREE_DAILY_REVIEW_LIMIT, normalizePlan, planLabel } from "@/lib/account";
import type { SubscriptionPlan } from "@/lib/types";
import { getClientAccount } from "@/lib/clientAccount";

// Benefits mirror what each plan actually enforces today.
const BENEFITS: Partial<Record<SubscriptionPlan, string[]>> = {
  free_buyer: [`${FREE_DAILY_REVIEW_LIMIT} product scans a day`, "Full verdict for the current scan"],
  buyer_pro: ["Unlimited product scans", "Saved scans for 30 days", "Compare products and an avoid list"],
  seller_premium: ["Seller review analysis and reports", "Track up to 10 products", "Improvement planning"],
  seller_pro: ["Everything in Seller Starter", "Competitor compare", "Improvement calendar, track up to 50 products"],
};

export function PlanStatusCard() {
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  useEffect(() => {
    const account = getClientAccount();
    if (account?.email && account.email !== "guest") setPlan(normalizePlan(account.plan));
  }, []);
  if (!plan) return null;
  const benefits = BENEFITS[plan] ?? [];
  const paid = plan !== "free_buyer";
  return (
    <section data-testid="plan-status" className="mx-auto mt-8 max-w-6xl px-6">
      <div className="rounded-[1.75rem] bg-white p-6 ring-1 ring-slate-900/5 sm:p-8">
        <p className="text-sm font-semibold text-teal">Your plan</p>
        <h2 className="mt-1 text-3xl font-semibold text-slate-900">{planLabel(plan)}</h2>
        {benefits.length ? (
          <ul className="mt-4 grid gap-2 text-slate-700 sm:grid-cols-3">
            {benefits.map((b) => <li key={b} className="flex gap-2 text-sm"><span aria-hidden="true" className="text-teal">✓</span>{b}</li>)}
          </ul>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pricing" className="inline-flex rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal/90">{paid ? "Change plan" : "Upgrade"}</Link>
          <Link href="/account" className="inline-flex rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-800 hover:border-teal hover:text-teal">Account settings</Link>
        </div>
      </div>
    </section>
  );
}
