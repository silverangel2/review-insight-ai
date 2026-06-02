"use client";

import Link from "next/link";
import { useState } from "react";
import { accountHeaders, getClientAccount } from "@/lib/clientAccount";
import { BILLING_EMAIL } from "@/lib/trustContent";

export function ManageSubscriptionPanel() {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function openPortal() {
    setError("");
    setStatus("Opening billing portal...");

    const account = getClientAccount();
    if (!account) {
      setStatus("");
      setError("Log in first so ReviewIntel can locate your subscription.");
      return;
    }

    const response = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...accountHeaders() },
      body: JSON.stringify({ customerId: account.stripeCustomerId })
    }).catch(() => null);

    if (!response) {
      setStatus("");
      setError("Billing portal is unavailable. Email billing support and include your account email.");
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      setStatus("");
      setError(data.error || "Billing portal failed. Email billing support and include your account email.");
      return;
    }

    window.location.href = data.url;
  }


  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_0.86fr]">
      <article className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <p className="text-xs font-black uppercase text-ocean dark:text-cyan-300">Subscription controls</p>
        <h2 className="mt-3 text-3xl font-black text-ink dark:text-white">Manage billing or upgrade your plan.</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Use the billing portal for payment cards, invoices, cancellation, and subscription status. Free Shopper accounts can upgrade anytime from the pricing page.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void openPortal()}
            className="rounded-2xl bg-[linear-gradient(135deg,#2356a3,#08b7a8)] px-6 py-3 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5"
          >
            Open Billing Portal
          </button>
          <Link
            href="/pricing"
            className="rounded-2xl border border-line bg-white px-6 py-3 text-center text-sm font-black text-ink transition hover:border-ocean hover:text-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          >
            Upgrade to Premium
          </Link>
        </div>
        {status ? <p className="mt-4 rounded-2xl border border-teal/20 bg-teal/10 px-4 py-3 text-sm font-bold text-teal">{status}</p> : null}
        {error ? <p className="mt-4 rounded-2xl border border-coral/25 bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{error}</p> : null}
      </article>

      <article className="rounded-[2rem] border border-line bg-mist p-6 shadow-soft dark:border-white/10 dark:bg-white/[0.04]">
        <p className="text-xs font-black uppercase text-amber">Need a person?</p>
        <h3 className="mt-3 text-2xl font-black text-ink dark:text-white">Billing support</h3>
        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Include your account email, plan name, charge date, and what you want changed.
        </p>
        <div className="mt-5 grid gap-3">
          <a className="rounded-2xl bg-ink px-5 py-3 text-center text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink" href={`mailto:${BILLING_EMAIL}`}>
            Email Billing Support
          </a>
          <Link className="rounded-2xl border border-line bg-white px-5 py-3 text-center text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/[0.05] dark:text-white" href="/refunds">
            Read Refund Policy
          </Link>
        </div>
      </article>
    </section>
  );
}
