import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { SEOLandingPageView } from "@/components/SEOLandingPageView";
import { getSEOLandingPage } from "@/lib/seoLandingPages";

const page = getSEOLandingPage("product-complaint-analyzer")!;

export const metadata: Metadata = withSeo("/product-complaint-analyzer", {
  title: page.title,
  description: page.description,
  keywords: page.keywords,
  openGraph: { title: page.title, description: page.description },
  twitter: { title: page.title, description: page.description }
});

export default function ProductComplaintAnalyzerPage() {
  return <SEOLandingPageView page={page} />;
}
