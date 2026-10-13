import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("contact")!;

export const metadata: Metadata = withSeo("/contact", {
  title: "Contact Customer Service",
  description: page.summary
});

export default function ContactPage() {
  return <TrustPage page={page} />;
}
