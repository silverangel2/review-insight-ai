import LayoutModeProvider from "@/components/LayoutModeProvider";
import MobileGlobalNav from "@/components/MobileGlobalNav";
import {NextIntlClientProvider} from "next-intl";
import {getLocale, getMessages} from "next-intl/server";
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { ClientTextLocalizer } from "@/components/ClientTextLocalizer";
import { LocaleSync } from "@/components/LocaleSync";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";
import { IdleLogoutGuard } from "@/components/IdleLogoutGuard";
import { SmartAdSlot } from "@/components/advertising/SmartAdSlot";
import { SellerResultHistoryCorner } from "@/components/SellerResultHistoryCorner";

const googleAdsenseClient = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT || "ca-pub-5711144364755686";

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
    "AI shopping assistant"
  ],
  openGraph: {
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "ReviewIntel AI Review Intelligence" }],
    title: "ReviewIntel",
    description: "AI-powered review intelligence for shoppers and ecommerce sellers.",
    url: "/",
    siteName: "ReviewIntel",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "ReviewIntel",
    description: "Upload a product screenshot or paste a product link. ReviewIntel checks public review signals, complaints, ratings, and AI-like review patterns to give a fast BUY, CONSIDER, or AVOID verdict."
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      {googleAdsenseClient ? (
        <script
          id="google-adsense"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${googleAdsenseClient}`}
          crossOrigin="anonymous"
        />
      ) : null}

<body>
        <NextIntlClientProvider locale={locale} messages={messages}>
        <LocaleSync initialLocale={locale} />
        <ClientTextLocalizer />
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
                priceCurrency: "CAD"
              }
            })
          }}
        />
        <Header initialLocale={locale} />
        <LayoutModeProvider>{children}<MobileGlobalNav /></LayoutModeProvider>
          <SellerResultHistoryCorner />
          <SmartAdSlot className="mx-auto my-8 max-w-6xl px-4" compact />
        <SiteFooter />
              </NextIntlClientProvider>
      </body>
    </html>
  );
}
