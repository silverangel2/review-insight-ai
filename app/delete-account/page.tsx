import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("delete-account")!;

export const metadata: Metadata = withSeo("/delete-account", {
  title: "Delete Account / Data Request",
  description: page.summary
}, { noindex: true });

export default function DeleteAccountPage() {
  return <TrustPage page={page} />;
}
