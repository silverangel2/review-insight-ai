import type { Metadata } from "next";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("billing-support")!;

export const metadata: Metadata = {
  title: "Billing Support",
  description: page.summary
};

export default function BillingSupportPage() {
  return <TrustPage page={page} />;
}
