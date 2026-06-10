import Script from "next/script";
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";
import { IdleLogoutGuard } from "@/components/IdleLogoutGuard";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "ReviewIntel | AI Review Intelligence Platform",
    template: "%s | ReviewIntel"
  },
  description: "AI review intelligence for ecommerce shoppers and sellers. Analyze pasted reviews, TXT batches, and quick screenshots from any platform without scraping.",
  keywords: [
    "AI review summarizer",
    "ecommerce review analytics",
    "seller insights",
    "shopper recommendation",
    "bulk review analysis",
    "review screenshot analysis",
    "sentiment analysis"
  ],
  openGraph: {
    title: "ReviewIntel",
    description: "AI-powered review intelligence for shoppers and ecommerce sellers.",
    url: "/",
    siteName: "ReviewIntel",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "ReviewIntel",
    description: "Analyze pasted review text, TXT batches, and quick screenshots from any ecommerce or review platform."
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      
      {process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT ? (
        <Script
          id="google-adsense"
          async
          strategy="afterInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      ) : null}

<body>
        <IdleLogoutGuard />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "ReviewIntel",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description: "AI review intelligence platform for ecommerce shoppers and sellers.",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD"
              }
            })
          }}
        />
        <Header />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
