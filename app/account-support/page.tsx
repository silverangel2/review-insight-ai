import type { Metadata } from "next";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("account-support")!;

export const metadata: Metadata = {
  title: "Account Support",
  description: page.summary
};

export default function AccountSupportPage() {
  return <TrustPage page={page} />;
}
