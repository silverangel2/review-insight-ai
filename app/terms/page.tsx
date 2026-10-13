import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("terms")!;

export const metadata: Metadata = withSeo("/terms", {
  title: "Terms of Service",
  description: page.summary
});

export default function TermsPage() {
  return <TrustPage page={page} />;
}
