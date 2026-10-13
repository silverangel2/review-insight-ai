import type { Metadata } from "next";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("faq")!;

export const metadata: Metadata = {
  title: "FAQ",
  description: page.summary
};

export default function FAQPage() {
  return <TrustPage page={page} />;
}
