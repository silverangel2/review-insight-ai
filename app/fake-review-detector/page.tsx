import type { Metadata } from "next";
import { SEOLandingPageView } from "@/components/SEOLandingPageView";
import { getSEOLandingPage } from "@/lib/seoLandingPages";

const page = getSEOLandingPage("fake-review-detector")!;

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  keywords: page.keywords,
  openGraph: { title: page.title, description: page.description },
  twitter: { title: page.title, description: page.description }
};

export default function FakeReviewDetectorPage() {
  return <SEOLandingPageView page={page} />;
}
