import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("disclaimer")!;

export const metadata: Metadata = withSeo("/disclaimer", {
  title: "Disclaimer",
  description: page.summary
});

export default function DisclaimerPage() {
  return <TrustPage page={page} />;
}
