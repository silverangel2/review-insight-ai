import { notFound } from "next/navigation";
import { LimitReachedCard } from "@/components/upsell/LimitReachedCard";
import { ShareFooterNudge } from "@/components/upsell/ShareFooterNudge";
import { UpgradeMoment } from "@/components/upsell/UpgradeMoment";

// Development-only preview of the upgrade surfaces (404 in production).
export default function UpsellPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-5 py-10">
      <h1 className="text-xl font-semibold text-slate-900">Upsell surfaces (dev preview)</h1>
      <div data-testid="preview-limit-guest"><LimitReachedCard guest /></div>
      <UpgradeMoment placement="dev_preview" sellerIntent />
      <ShareFooterNudge />
    </main>
  );
}
