import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("billing-support")!;

export const metadata: Metadata = withSeo("/billing-support", {
  title: "Billing Support",
  description: page.summary
});

export default function BillingSupportPage() {
  return <TrustPage page={page} />;
}
