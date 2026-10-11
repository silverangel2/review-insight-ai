"use client";
import { useEffect } from "react";
import { trackTrafficEvent } from "@/lib/clientTraffic";
import { pricingLabelForPlan } from "@/lib/pricing";

export function ShareFooterNudge() {
  useEffect(() => { trackTrafficEvent({ eventType: "upsell_view", metadata: { placement: "share_footer" } }); }, []);
  return (
    <aside data-testid="share-upsell" className="mt-8 rounded-[1.5rem] bg-[linear-gradient(135deg,#e6f7f1_0%,#fff6d6_100%)] p-5 ring-1 ring-slate-900/5 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div>
        <p className="font-semibold text-slate-900">Check your own product in seconds</p>
        <p className="mt-1 text-sm text-slate-600">3 free scans a day. Premium ({pricingLabelForPlan("buyer_pro", "CAD")}/month) adds unlimited scans, history and side-by-side compare.</p>
      </div>
      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
        <a href="/analyze" className="ri-lift rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white">Scan a product</a>
        <a href="/pricing?plan=buyer_pro" onClick={() => trackTrafficEvent({ eventType: "upsell_click", metadata: { placement: "share_footer", plan: "buyer_pro" } })} className="rounded-full border border-teal/40 bg-white px-5 py-2.5 text-sm font-semibold text-teal">See Premium</a>
      </div>
    </aside>
  );
}
