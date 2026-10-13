import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("privacy")!;

export const metadata: Metadata = withSeo("/privacy", {
  title: "Privacy Policy",
  description: page.summary
});

export default function PrivacyPage() {
  return <TrustPage page={page} />;
}
