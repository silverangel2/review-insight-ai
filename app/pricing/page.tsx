import { Badge } from "@/components/Badge";
import { PricingCards } from "@/components/PricingCards";
export default function PricingPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
<Badge tone="info">Stripe-ready subscriptions</Badge>
      <h1 className="mt-5 text-4xl font-black tracking-tight text-ink dark:text-white">Pricing</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
        Shopper Free users can analyze 3 products per day. Premium plans use live Stripe payment links during beta. Access is manually activated after payment until full automation is connected.
      </p>
      <div className="mt-10">
        <PricingCards />
      </div>
    </main>
  );
}
