import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("affiliate-disclosure")!;
export const metadata: Metadata = withSeo("/affiliate-disclosure", { title: "Affiliate disclosure", description: page.summary });

export default function Page() {
  return <TrustPage page={page} />;
}
