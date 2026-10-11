import type { Metadata } from "next";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("ad-policy")!;
export const metadata: Metadata = { title: "Ad content policy", description: page.summary };

export default function Page() {
  return <TrustPage page={page} />;
}
