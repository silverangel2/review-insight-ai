"use client";

import Link from "next/link";
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

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

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

function hourlySeed(placement: string) {
  const hour = Math.floor(Date.now() / (60 * 60 * 1000));
  return placement.split("").reduce((total, char) => total + char.charCodeAt(0), hour);
}

function pickRotatingAd(ads: SponsorAd[], placement: AdPlacement) {
  const candidates = ads.filter(
    (item) =>
      item.placement === placement &&
      item.active &&
      item.status === "approved" &&
      item.paymentStatus === "paid",
  );

  if (!candidates.length) return null;
  return candidates[hourlySeed(placement) % candidates.length] ?? candidates[0];
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
      className={`rounded-3xl border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500/70 ${className}`}
      aria-label="Google AdSense advertisement"
    >
      <div className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
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
          setAd(null);
          setAdSource(null);
          return;
        }

        const sponsorAds = Array.isArray(data.ads) ? (data.ads as SponsorAd[]) : [];
        const directSponsorAds = sponsorAds.filter((item) => item.sponsorType !== "affiliate");
        const affiliateAds = sponsorAds.filter((item) => item.sponsorType === "affiliate");
        const directSponsorAd =
          liveSettings.directSponsorAdsEnabled
            ? pickRotatingAd(directSponsorAds, placement)
            : null;

        if (directSponsorAd) {
          setAd(directSponsorAd);
          setAdSource("direct");
          return;
        }

        const affiliateAd =
          liveSettings.directSponsorAdsEnabled
            ? pickRotatingAd(affiliateAds, placement)
            : null;

        if (affiliateAd) {
          setAd(affiliateAd);
          setAdSource("affiliate");
          return;
        }

        if (liveSettings.googleAdsEnabled && hasGoogleAdSenseConfig()) {
          setAd(null);
          setAdSource(null);
          return;
        }

        if (liveSettings.placeholderAdsEnabled) {
          const placeholder =
            reviewIntelPlaceholderAds.find(
              (item) =>
                item.placement === placement &&
                item.active &&
                item.status === "approved",
            ) ?? null;

          setAd(placeholder);
          setAdSource(placeholder ? "placeholder" : null);
          return;
        }

        setAd(null);
        setAdSource(null);
      } catch {
        if (mounted) {
          setSettings(null);
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
    setGoogleConsent(hasOptionalCookieConsent());

    function onConsentChange() {
      setGoogleConsent(hasOptionalCookieConsent());
    }

    window.addEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsentChange);
  }, []);

  useEffect(() => {
    if (!ad) return;
    if (adSource === "direct") sendAdEvent("impression", ad.id, placement);
    if (adSource === "affiliate") {
      trackTrafficEvent({
        eventType: "affiliate_impression",
        metadata: affiliateEventMetadata(ad, placement),
      });
    }
  }, [ad, adSource, placement]);

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

  const visibleAd = ad ?? fallbackAd;
  const visibleAdSource = ad ? adSource : fallbackAd ? "placeholder" : null;

  if (!visibleAd) return null;

  const isHouseAd = visibleAdSource === "placeholder";
  const isAffiliateAd = visibleAdSource === "affiliate" || visibleAd.sponsorType === "affiliate";
  const ctaLabel =
    visibleAd.ctaLabel ||
    (isHouseAd ? "Advertise with ReviewIntel" : isAffiliateAd ? "View offer" : visibleAdSource === "direct" ? "Learn more" : "Apply for ads");
  const badgeLabels = visibleAd.labels?.length
    ? visibleAd.labels
    : [isHouseAd ? "ReviewIntel ad spot" : "Sponsored"];
  const ctaClassName =
    "inline-flex shrink-0 items-center justify-center rounded-full bg-ocean px-5 py-2 text-sm font-bold text-white transition hover:bg-cyan-700 dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200";
  const mediaUrl = visibleAd.mediaUrl || visibleAd.imageUrl;
  const media = mediaUrl ? (
    visibleAd.mediaType === "video" ? (
      <video
        src={mediaUrl}
        muted
        loop
        playsInline
        autoPlay
        className="h-24 w-full rounded-2xl border border-cyan-200/70 object-cover sm:w-36"
      />
    ) : (
      <img
        src={mediaUrl}
        alt=""
        loading="lazy"
        className="h-24 w-full rounded-2xl border border-cyan-200/70 object-cover sm:w-36"
      />
    )
  ) : null;
  const trackClick = () => {
    if (visibleAdSource === "direct") sendAdEvent("click", visibleAd.id, placement);
    if (isAffiliateAd) {
      trackTrafficEvent({
        eventType: "affiliate_click",
        metadata: {
          ...affiliateEventMetadata(visibleAd, placement),
          destinationUrl: visibleAd.destinationUrl,
        },
      });
    }
  };
  const cta = isExternalUrl(visibleAd.destinationUrl) ? (
    <a
      href={visibleAd.destinationUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={ctaClassName}
      data-sponsor-click={visibleAd.id}
      onClick={trackClick}
    >
      {ctaLabel}
    </a>
  ) : (
    <Link href={visibleAd.destinationUrl} className={ctaClassName} data-sponsor-click={visibleAd.id} onClick={trackClick}>
      {ctaLabel}
    </Link>
  );

  return (
    <aside
      className={`rounded-3xl border border-cyan-200/70 bg-[linear-gradient(135deg,rgba(232,252,255,0.96),rgba(255,255,255,0.98)_54%,rgba(255,247,226,0.9))] p-4 text-ink shadow-soft backdrop-blur-xl dark:border-cyan-300/25 dark:bg-gradient-to-r from-sky-600 to-teal-500/80 dark:text-white ${isHouseAd ? "ri-house-ad-slot" : ""} ${className}`}
      aria-label="Sponsored placement"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          {media}

          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              {badgeLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-ocean dark:border-cyan-300/25 dark:bg-cyan-300/10 dark:text-cyan-100"
                >
                  {label}
                </span>
              ))}
            </div>

            <p className="text-sm font-semibold text-ocean dark:text-cyan-100">{visibleAd.sponsorName}</p>
            <h3 className={compact ? "mt-1 text-lg font-bold" : "mt-1 text-xl font-bold"}>
              {visibleAd.headline}
            </h3>
            {visibleAd.description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {visibleAd.description}
              </p>
            ) : null}
            {visibleAd.disclosureText ? (
              <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-slate-500 dark:text-cyan-100/80">
                {visibleAd.disclosureText}
              </p>
            ) : null}
          </div>
        </div>

        {cta}
      </div>
    </aside>
  );
}
