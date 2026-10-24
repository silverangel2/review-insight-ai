import AnalyzerForm from "@/components/AnalyzerForm";
import type { Metadata } from "next";
import { withSeo, privatePage } from "@/lib/pageSeo";

export const metadata: Metadata = withSeo("/analyze", { title: "Scan a product: Buy, Wait or Skip from real reviews", description: "Screenshot a product page and get a plain Buy, Wait or Skip answer built from real written buyer reviews. A product link is optional." });

export default function AnalyzePage() {
  return <AnalyzerForm />;
}
