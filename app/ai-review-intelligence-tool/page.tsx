import type { Metadata } from "next";
import { SEOLandingPageView } from "@/components/SEOLandingPageView";
import { getSEOLandingPage } from "@/lib/seoLandingPages";

const page = getSEOLandingPage("ai-review-intelligence-tool")!;

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  keywords: page.keywords,
  openGraph: { title: page.title, description: page.description },
  twitter: { title: page.title, description: page.description }
};

export default function AIReviewIntelligenceToolPage() {
  return <SEOLandingPageView page={page} />;
}
