import AnalyzerForm from "@/components/AnalyzerForm";
import type { Metadata } from "next";
import { withSeo, privatePage } from "@/lib/pageSeo";

export const metadata: Metadata = withSeo("/analyze", { title: "Scan a product: Buy, Wait or Skip from real reviews", description: "Paste an Amazon product link and get a plain Buy, Wait or Skip answer built from real written buyer reviews, with quotes and an honest confidence level." });

export default function AnalyzePage() {
  return <AnalyzerForm />;
}
