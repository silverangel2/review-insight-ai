import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("acceptable-use")!;

export const metadata: Metadata = withSeo("/acceptable-use", {
  title: "Acceptable Use Policy",
  description: page.summary
});

export default function AcceptableUsePage() {
  return <TrustPage page={page} />;
}
