import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { SEOLandingPageView } from "@/components/SEOLandingPageView";
import { getSEOLandingPage } from "@/lib/seoLandingPages";

const page = getSEOLandingPage("seller-review-analytics")!;

export const metadata: Metadata = withSeo("/seller-review-analytics", {
  title: page.title,
  description: page.description,
  keywords: page.keywords,
  openGraph: { title: page.title, description: page.description },
  twitter: { title: page.title, description: page.description }
});

export default function SellerReviewAnalyticsPage() {
  return <SEOLandingPageView page={page} />;
}
