import LayoutModeProvider from "@/components/LayoutModeProvider";
import AccountWorkspacePermission from "@/components/AccountWorkspacePermission";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import {NextIntlClientProvider} from "next-intl";
import {getLocale, getMessages} from "next-intl/server";
import { cookies } from "next/headers";
import { ACCOUNT_SESSION_COOKIE, verifyAccountSessionToken } from "@/lib/accountSession";
import { COOKIE_CONSENT_COOKIE } from "@/lib/cookieConsent";
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { ClientTextLocalizer } from "@/components/ClientTextLocalizer";
import { LocaleSync } from "@/components/LocaleSync";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";
import { IdleLogoutGuard } from "@/components/IdleLogoutGuard";
import { SmartAdSlot } from "@/components/advertising/SmartAdSlot";
import { SellerResultHistoryCorner } from "@/components/SellerResultHistoryCorner";
import MobileTinyNav from "@/components/mobile/MobileTinyNav";
import MobileUtilityMenu from "@/components/mobile/MobileUtilityMenu";
import SessionIdleLogout from "@/components/SessionIdleLogout";
import { TrafficTracker } from "@/components/TrafficTracker";
import { seoBaseUrl } from "@/lib/seoAutomation";

export const metadata: Metadata = {
  metadataBase: new URL(seoBaseUrl()),
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
    description: "Upload a product screenshot or paste a product link. ReviewIntel checks public review signals, complaints, ratings, and AI-like review patterns to give a fast BUY, REVIEW FIRST, or AVOID verdict."
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const cookieStore = await cookies();
  const consentChoice = cookieStore.get(COOKIE_CONSENT_COOKIE)?.value || "";
  const sessionToken = cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value;
  const serverSession = sessionToken ? verifyAccountSessionToken(decodeURIComponent(sessionToken)) : null;
  // Same rule as SmartAdSlot.canShowAds: guests and Shopper Free see ads; paid plans and sellers don't.
  const serverShowsAds = !serverSession || (serverSession.role === "buyer" && serverSession.plan === "free_buyer");
  const messages = await getMessages();

  return (
    <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        {/* Resolve the layout mode before first paint so mobile CSS doesn't shift the page after hydration (CLS). */}
        <script
          suppressHydrationWarning
          id="reviewintel-layout-mode-init"
          dangerouslySetInnerHTML={{ __html: `(function(){try{var d=document.documentElement;var m=${process.env.NODE_ENV !== "production" ? 'localStorage.getItem("reviewintel_layout_mode")' : "null"};if(m!=="mobile"&&m!=="desktop"&&m!=="desktop-mini"){m="auto"}var r=m==="auto"?(matchMedia("(max-width: 767px)").matches?"mobile":"desktop"):m;d.dataset.layoutMode=r;d.dataset.layoutPreference=m;}catch(e){}})();` }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
        <LocaleSync initialLocale={locale} />
        <ClientTextLocalizer />
        <TrafficTracker />
        <IdleLogoutGuard />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "ReviewIntel",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: seoBaseUrl(),
              description: "Review intelligence for shoppers and ecommerce sellers. The free plan has a daily scan limit. Paid plans are listed on the pricing page.",
              offers: {
                "@type": "Offer",
                name: "Shopper Free",
                price: "0",
                priceCurrency: "CAD",
                description: "Free plan with a daily scan limit."
              }
            })
          }}
        />
        <Header initialLocale={locale} />
        <LayoutModeProvider>
          <MobileTinyNav />
          <SessionIdleLogout />
          <MobileUtilityMenu />{children}<AccountWorkspacePermission /><CookieConsentBanner initialVisible={!consentChoice} serverLocale={locale} /></LayoutModeProvider>
          <SellerResultHistoryCorner />
          <SmartAdSlot className="mx-auto my-8 max-w-6xl px-4" compact initialShowAds={serverShowsAds} />
        <SiteFooter />
              </NextIntlClientProvider>
      </body>
    </html>
  );
}
