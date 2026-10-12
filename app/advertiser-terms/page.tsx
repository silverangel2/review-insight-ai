import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("advertiser-terms")!;
export const metadata: Metadata = withSeo("/advertiser-terms", { title: "Advertiser terms", description: page.summary });

export default function Page() {
  return <TrustPage page={page} />;
}
