import type { Metadata } from "next";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("contact")!;

export const metadata: Metadata = {
  title: "Contact Customer Service",
  description: page.summary
};

export default function ContactPage() {
  return <TrustPage page={page} />;
}
