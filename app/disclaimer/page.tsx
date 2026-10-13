import type { Metadata } from "next";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("disclaimer")!;

export const metadata: Metadata = {
  title: "Disclaimer",
  description: page.summary
};

export default function DisclaimerPage() {
  return <TrustPage page={page} />;
}
