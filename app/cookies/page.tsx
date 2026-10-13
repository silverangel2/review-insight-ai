import type { Metadata } from "next";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("cookies")!;

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: page.summary
};

export default function CookiesPage() {
  return <TrustPage page={page} />;
}
