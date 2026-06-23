import type { Metadata } from "next";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("manage-subscription")!;

export const metadata: Metadata = {
  title: "Manage Subscription",
  description: page.summary
};

export default function ManageSubscriptionPage() {
  return <TrustPage page={page} />;
}
