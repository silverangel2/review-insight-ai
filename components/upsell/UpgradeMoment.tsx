"use client";
// Post-verdict upgrade moment. Inline (never a modal), shown only to free/logged-out users,
// after the answer above it. One CTA into the existing checkout; "Maybe later" snoozes it for a few days.
// No timers and no fake scarcity.
import { useEffect, useRef, useState } from "react";
import { getClientAccount } from "@/lib/clientAccount";
import { trackTrafficEvent } from "@/lib/clientTraffic";
import { startPlanCheckout } from "@/lib/clientCheckout";
import { snooze, snoozed, upsellOffer, type UpsellAudience } from "@/lib/upsell";

function isPaid(plan: string | null | undefined) {
  return Boolean(plan && plan !== "free_buyer");
}

export function UpgradeMoment({ placement = "results", sellerIntent = false }: { placement?: string; sellerIntent?: boolean }) {
  const [state, setState] = useState<"hidden" | "show" | "dismissed">("hidden");
  const [audience, setAudience] = useState<UpsellAudience>("shopper");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const viewed = useRef(false);

  useEffect(() => {
    const account = getClientAccount();
    const plan = account?.plan as string | undefined;
    if (isPaid(plan) || snoozed()) return;
    setAudience(sellerIntent || account?.role === "seller" ? "seller" : "shopper");
    setState("show");
  }, [sellerIntent]);

  useEffect(() => {
    if (state !== "show" || !ref.current) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting) && !viewed.current) {
        viewed.current = true;
        trackTrafficEvent({ eventType: "upsell_view", metadata: { placement, audience } });
      }
    }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [state, placement, audience]);

  if (state !== "show") return null;
  const offer = upsellOffer(audience, "CAD");

  async function go(plan: string) {
    trackTrafficEvent({ eventType: "upsell_click", metadata: { placement, audience, plan } });
    setBusy(true); setError("");
    const err = await startPlanCheckout(plan, `upsell_${placement}`, "CAD");
    if (err) setError(err);
    setBusy(false);
  }

  return (
    <section ref={ref} data-testid="upgrade-moment" aria-labelledby="upgrade-title"
      className="ri-fade-in rounded-[2rem] bg-[linear-gradient(135deg,#e6f7f1_0%,#ffffff_55%,#fff6d6_100%)] p-6 ring-1 ring-slate-900/5 sm:p-8">
      <p className="text-sm font-semibold text-teal">{audience === "seller" ? "ReviewIntel for sellers" : "ReviewIntel Premium"}</p>
      <h2 id="upgrade-title" className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{offer.title}</h2>
      <div className={`mt-4 grid gap-4 ${offer.plans.length > 1 ? "md:grid-cols-2" : ""}`}>
        {offer.plans.map((p, i) => (
          <div key={p.plan} className="rounded-[1.5rem] bg-white/90 p-5 ring-1 ring-slate-900/5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold text-slate-900">{p.name}</p>
              <p className="text-slate-900"><span className="text-2xl font-semibold">{p.price}</span><span className="text-sm text-slate-500"> / month</span></p>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {p.benefits.map(b => (
                <li key={b} className="flex gap-2"><svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-teal" fill="currentColor"><path d="M7.7 13.3 4.4 10l-1.2 1.2 4.5 4.5 9.1-9.1-1.2-1.2z" /></svg>{b}</li>
              ))}
            </ul>
            <button type="button" disabled={busy} onClick={() => void go(p.plan)}
              className={`ri-lift mt-5 w-full rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-60 ${i === 0 ? "bg-teal text-white" : "border border-teal/40 bg-white text-teal"}`}>
              {audience === "seller" ? `Start ${p.name}` : "Upgrade to Premium"}
            </button>
          </div>
        ))}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-coralink">{error}</p> : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-500">Cancel anytime. Your verdicts stay free.</p>
        <button type="button" onClick={() => { snooze(); setState("dismissed"); trackTrafficEvent({ eventType: "upsell_dismiss", metadata: { placement, audience } }); }}
          className="rounded-full px-3 py-1.5 font-medium text-slate-600 underline-offset-2 hover:underline">Maybe later</button>
      </div>
    </section>
  );
}
