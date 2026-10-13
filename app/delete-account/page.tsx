import type { Metadata } from "next";
import { TrustPage } from "@/components/TrustPage";
import { getTrustPage } from "@/lib/trustContent";

const page = getTrustPage("delete-account")!;

export const metadata: Metadata = {
  title: "Delete Account / Data Request",
  description: page.summary
};

export default function DeleteAccountPage() {
  return <TrustPage page={page} />;
}
