import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { TrustPage } from "@/components/TrustPage";
import { PlanStatusCard } from "@/components/PlanStatusCard";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("manage-subscription")!;

export const metadata: Metadata = withSeo("/manage-subscription", {
  title: "Manage Subscription",
  description: page.summary
}, { noindex: true });

export default function ManageSubscriptionPage() {
  return (
    <>
      <PlanStatusCard />
      <TrustPage page={page} />
    </>
  );
}
