"use client";

import { useEffect, useState } from "react";
import {
  type AdPlacement,
  type SponsorAd,
  defaultAdSettings,
  reviewIntelPlaceholderAds,
} from "@/lib/adConfig";
import { COOKIE_CONSENT_EVENT, hasOptionalCookieConsent } from "@/lib/cookieConsent";
import { trackTrafficEvent } from "@/lib/clientTraffic";
import type { LiveAdSettings } from "@/lib/adSettingsStore";
import { FeaturedDeals, type DealSlide } from "@/components/advertising/FeaturedDeals";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSlotProps = {
  placement: AdPlacement;
  className?: string;
  compact?: boolean;
};

type AdSource = "direct" | "affiliate" | "placeholder";

function hasGoogleAdSenseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT &&
      process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT,
  );
}

function sendAdEvent(type: "impression" | "click", sponsorId: string, placement: AdPlacement) {
  const payload = JSON.stringify({
    type,
    sponsorId,
    placement,
    path: window.location.pathname,
    occurredAt: new Date().toISOString(),
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/sponsor-events", new Blob([payload], { type: "application/json" }));
    return;
  }

  void fetch("/api/sponsor-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  });
}

function affiliateEventMetadata(ad: SponsorAd, placement: AdPlacement) {
  return {
    source: "affiliate_ad_slot",
    sponsorId: ad.id,
    campaignTitle: ad.campaignTitle || ad.headline,
    partner: ad.affiliatePartner || ad.sponsorName,
    placement,
  };
}

function affiliateBannerTone(ad: SponsorAd) {
  switch (ad.affiliatePartner) {
    case "amazon":
      return {
        brand: "Amazon",
        bg: "from-amber-100 via-white to-cyan-50",
        ring: "border-amber-200/80",
        accent: "bg-amber-400",
      };
    case "travelpayouts":
      return {
        brand: "Travelpayouts",
        bg: "from-sky-100 via-white to-teal-50",
        ring: "border-sky-200/80",
        accent: "bg-sky-400",
      };
    case "stay22":
      return {
        brand: "Stay22",
        bg: "from-teal-100 via-white to-lime-50",
        ring: "border-teal-200/80",
        accent: "bg-teal-400",
      };
    default:
      return {
        brand: ad.sponsorName || "Affiliate",
        bg: "from-cyan-100 via-white to-amber-50",
        ring: "border-cyan-200/80",
        accent: "bg-cyan-400",
      };
  }
}

function affiliateDisplayCopy(ad: SponsorAd) {
  const tone = affiliateBannerTone(ad);

  if (ad.affiliatePartner === "amazon") {
    return {
      sponsorName: "Amazon",
      headline: "Sponsored shopping options on Amazon",
      description:
        "Compare shopping options after your ReviewIntel scan. Partner compensation stays separate from review analysis.",
    };
  }

  if (ad.affiliatePartner === "travelpayouts") {
    return {
      sponsorName: "Travelpayouts",
      headline: "Sponsored flight deals",
      description: "Travelpayouts partner placement for shoppers comparing travel purchases and reviews.",
    };
  }

  if (ad.affiliatePartner === "stay22") {
    return {
      sponsorName: "Stay22",
      headline: "Sponsored hotel deals",
      description: "Stay22 partner placement for hotel options. ReviewIntel analysis remains independent.",
    };
  }

  return {
    sponsorName: tone.brand,
    headline: ad.campaignTitle || "Sponsored affiliate offer",
    description: "Sponsored affiliate placement on ReviewIntel.",
  };
}

function GoogleAdSenseBlock({ className = "" }: { className?: string }) {
  const client = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;
  const slot = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT;
  const [canLoadGoogleAds, setCanLoadGoogleAds] = useState(false);

  useEffect(() => {
    setCanLoadGoogleAds(hasOptionalCookieConsent());

    function onConsentChange() {
      setCanLoadGoogleAds(hasOptionalCookieConsent());
    }

    window.addEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
  }, []);

  useEffect(() => {
    if (!client || !slot || !canLoadGoogleAds) return;

    try {
      const scriptId = "reviewintel-google-adsense";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
        document.head.appendChild(script);
      }

      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // Google may block ads locally or before approval. Safe to ignore.
    }
  }, [canLoadGoogleAds, client, slot]);

  if (!client || !slot || !canLoadGoogleAds) {
    return null;
  }

  return (
    <aside
      className={`rounded-[1.75rem] bg-[linear-gradient(135deg,#ffffff_0%,#f1edff_100%)] p-4 ring-1 ring-slate-900/5 ${className}`}
      aria-label="Google AdSense advertisement"
    >
      <div className="mb-2 text-xs font-semibold text-slate-500">
        Advertisement
      </div>

      <ins
        className="adsbygoogle block min-h-[120px] w-full"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

export function AdSlot({ placement, className = "", compact = false }: AdSlotProps) {
  const [settings, setSettings] = useState<LiveAdSettings | null>(null);
  const [ad, setAd] = useState<SponsorAd | null>(null);
  const [adSource, setAdSource] = useState<AdSource | null>(null);
  const [rotatingAds, setRotatingAds] = useState<Array<{ ad: SponsorAd; source: AdSource }>>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [googleConsent, setGoogleConsent] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadAd() {
      try {
        const response = await fetch("/api/advertising/settings", { cache: "no-store" });
        const data = await response.json();
        const liveSettings = data.settings as LiveAdSettings;

        if (!mounted) return;

        setSettings(liveSettings);

        if (!liveSettings.adsEnabled || !liveSettings.placements?.[placement]) {
          setRotatingAds([]);
          setCurrentAdIndex(0);
          setAd(null);
          setAdSource(null);
          return;
        }

        const sponsorAds = Array.isArray(data.ads) ? (data.ads as SponsorAd[]) : [];
        const directSponsorAds = sponsorAds.filter((item) => item.sponsorType !== "affiliate");
        const affiliateAds = sponsorAds.filter((item) => item.sponsorType === "affiliate");
        const eligibleAds: Array<{ ad: SponsorAd; source: AdSource }> = [];

        if (liveSettings.directSponsorAdsEnabled) {
          eligibleAds.push(
            ...directSponsorAds
              .filter((item) => item.placement === placement && item.active && item.status === "approved" && item.paymentStatus === "paid")
              .map((item) => ({ ad: item, source: "direct" as const })),
          );
        }

        eligibleAds.push(
          ...affiliateAds
            .filter((item) => item.placement === placement && item.active && item.status === "approved" && item.paymentStatus === "paid")
            .map((item) => ({ ad: item, source: "affiliate" as const })),
        );

        if (!eligibleAds.length && liveSettings.googleAdsEnabled && hasGoogleAdSenseConfig()) {
          setRotatingAds([]);
          setCurrentAdIndex(0);
          setAd(null);
          setAdSource(null);
          return;
        }

        if (liveSettings.placeholderAdsEnabled) {
          eligibleAds.push(
            ...reviewIntelPlaceholderAds
              .filter((item) => item.placement === placement && item.active && item.status === "approved")
              .map((item) => ({ ad: item, source: "placeholder" as const })),
          );
        }

        setRotatingAds(eligibleAds);
        setCurrentAdIndex(0);
        const selected = eligibleAds[0] ?? null;
        setAd(selected?.ad ?? null);
        setAdSource(selected?.source ?? null);
      } catch {
        if (mounted) {
          setSettings(null);
          setRotatingAds([]);
          setCurrentAdIndex(0);
          setAd(null);
          setAdSource(null);
        }
      }
    }

    loadAd();

    return () => {
      mounted = false;
    };
  }, [placement]);

  useEffect(() => {
    if (rotatingAds.length <= 1) return;

    const timer = window.setInterval(() => {
      setCurrentAdIndex((index) => (index + 1) % rotatingAds.length);
    }, 10000);

    return () => window.clearInterval(timer);
  }, [rotatingAds.length]);

  useEffect(() => {
    if (!rotatingAds.length) return;
    const selected = rotatingAds[currentAdIndex % rotatingAds.length];
    setAd(selected.ad);
    setAdSource(selected.source);
  }, [currentAdIndex, rotatingAds]);

  useEffect(() => {
    setGoogleConsent(hasOptionalCookieConsent());

    function onConsentChange() {
      setGoogleConsent(hasOptionalCookieConsent());
    }

    window.addEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
  }, []);


  const effectiveSettings: LiveAdSettings = settings ?? {
    ...defaultAdSettings,
    placeholderAdsEnabled: true,
  };

  // Priority:
  // 1. Private/direct sponsor ad when available.
  // 2. Google AdSense when configured and optional consent is present.
  // 3. ReviewIntel house fallback ad.
  // 4. Nothing.
  const googleReady =
    effectiveSettings.adsEnabled &&
    effectiveSettings.googleAdsEnabled &&
    effectiveSettings.placements?.[placement] &&
    hasGoogleAdSenseConfig() &&
    googleConsent;

  if (!ad && googleReady) {
    return <GoogleAdSenseBlock className={className} />;
  }

  const fallbackAd =
    effectiveSettings.adsEnabled &&
    effectiveSettings.placeholderAdsEnabled &&
    effectiveSettings.placements?.[placement]
      ? reviewIntelPlaceholderAds.find(
          (item) =>
            item.placement === placement &&
            item.active &&
            item.status === "approved",
        ) ?? null
      : null;

  const pool: Array<{ ad: SponsorAd; source: AdSource }> = rotatingAds.length ? rotatingAds : fallbackAd ? [{ ad: fallbackAd, source: "placeholder" }] : [];
  if (!pool.length) return null;
  const slides: DealSlide[] = pool.map(({ ad: item, source }) => {
    const isHouse = source === "placeholder";
    const isAff = source === "affiliate" || item.sponsorType === "affiliate";
    const copy = isAff ? affiliateDisplayCopy(item) : null;
    return {
      ad: item, kind: isHouse ? "house" : isAff ? "affiliate" : "direct",
      partner: copy?.sponsorName || item.sponsorName,
      headline: (isAff && item.campaignTitle) || copy?.headline || item.headline,
      description: copy?.description || item.description,
      cta: item.ctaLabel || (isHouse ? "Advertise with ReviewIntel" : isAff ? "Check price" : "Learn more"),
    };
  });
  return (
    <FeaturedDeals
      slides={slides}
      className={className}
      onImpression={(slide) => {
        if (slide.kind === "direct") sendAdEvent("impression", slide.ad.id, placement);
        if (slide.kind === "affiliate") trackTrafficEvent({ eventType: "affiliate_impression", metadata: affiliateEventMetadata(slide.ad, placement) });
      }}
      onClickSlide={(slide) => {
        if (slide.kind === "direct") sendAdEvent("click", slide.ad.id, placement);
        if (slide.kind === "affiliate") trackTrafficEvent({ eventType: "affiliate_click", metadata: { ...affiliateEventMetadata(slide.ad, placement), destinationUrl: slide.ad.destinationUrl } });
      }}
    />
  );
}
