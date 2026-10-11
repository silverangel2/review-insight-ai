"use client";
// Soft limit-reached screen: explains the free limit honestly (resets tomorrow) and offers Premium.
import { useEffect, useState } from "react";
import { trackTrafficEvent } from "@/lib/clientTraffic";
import { startPlanCheckout } from "@/lib/clientCheckout";
import { shopperBenefits } from "@/lib/upsell";
import { pricingLabelForPlan } from "@/lib/pricing";
import { FREE_DAILY_REVIEW_LIMIT } from "@/lib/account";

export function LimitReachedCard({ guest }: { guest: boolean }) {
  const [error, setError] = useState("");
  useEffect(() => { trackTrafficEvent({ eventType: "upsell_view", metadata: { placement: "limit_reached", guest } }); }, [guest]);
  return (
    <section data-testid="limit-reached" className="ri-fade-in rounded-[2rem] bg-[linear-gradient(135deg,#f1edff_0%,#ffffff_60%,#e6f7f1_100%)] p-6 text-left ring-1 ring-slate-900/5 sm:p-8">
      <p className="text-sm font-semibold text-teal">You&apos;ve used today&apos;s free scans</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">That&apos;s all {FREE_DAILY_REVIEW_LIMIT} for today. They come back tomorrow.</h2>
      <p className="mt-2 text-sm text-slate-600">Want to keep going now? Premium is {pricingLabelForPlan("buyer_pro", "CAD")} a month.</p>
      <ul className="mt-4 space-y-2 text-sm text-slate-700">{shopperBenefits().map(b => <li key={b}>• {b}</li>)}</ul>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={async () => { trackTrafficEvent({ eventType: "upsell_click", metadata: { placement: "limit_reached", plan: "buyer_pro" } }); const e = await startPlanCheckout("buyer_pro", "limit_reached", "CAD"); if (e) setError(e); }}
          className="ri-lift rounded-full bg-teal px-6 py-3 text-sm font-semibold text-white">Upgrade to Premium</button>
        {guest ? <a href="/signup?next=/analyze" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700">Create a free account</a> : <a href="/" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700">Come back tomorrow</a>}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-coralink">{error}</p> : null}
    </section>
  );
}
