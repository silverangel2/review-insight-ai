import type { Metadata } from "next";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("advertiser-terms")!;
export const metadata: Metadata = { title: "Advertiser terms", description: page.summary };

export default function Page() {
  return <TrustPage page={page} />;
}
