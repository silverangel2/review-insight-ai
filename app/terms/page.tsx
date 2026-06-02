import type { Metadata } from "next";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("terms")!;

export const metadata: Metadata = {
  title: "Terms of Use",
  description: page.summary
};

export default function TermsPage() {
  return <TrustPage page={page} />;
}
