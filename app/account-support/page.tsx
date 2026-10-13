import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("account-support")!;

export const metadata: Metadata = withSeo("/account-support", {
  title: "Account Support",
  description: page.summary
});

export default function AccountSupportPage() {
  return <TrustPage page={page} />;
}
