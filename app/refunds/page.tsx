import type { Metadata } from "next";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("refunds")!;

export const metadata: Metadata = {
  title: "Refund Policy",
  description: page.summary
};

export default function RefundsPage() {
  return <TrustPage page={page} />;
}
