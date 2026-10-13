import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { withSeo, privatePage } from "@/lib/pageSeo";

export const metadata = privatePage("/analyze/result", "Your scan result");

export default function AnalyzeResultRedirectPage() {
  redirect("/results");
}
