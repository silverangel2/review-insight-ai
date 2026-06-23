import type { Metadata } from "next";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("privacy")!;

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: page.summary
};

export default function PrivacyPage() {
  return <TrustPage page={page} />;
}
