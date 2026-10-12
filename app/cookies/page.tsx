import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("cookies")!;

export const metadata: Metadata = withSeo("/cookies", {
  title: "Cookie Policy",
  description: page.summary
});

export default function CookiesPage() {
  return <TrustPage page={page} />;
}
