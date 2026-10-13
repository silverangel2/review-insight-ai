import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("faq")!;

export const metadata: Metadata = withSeo("/faq", {
  title: "FAQ",
  description: page.summary
});

export default function FAQPage() {
  return <TrustPage page={page} />;
}
