"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  type AdPlacement,
  type SponsorAd,
  reviewIntelPlaceholderAds,
} from "@/lib/adConfig";
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

function GoogleAdSenseBlock({ className = "" }: { className?: string }) {
  const client = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;
  const slot = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT;

  useEffect(() => {
    if (!client || !slot) return;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // Google may block ads locally or before approval. Safe to ignore.
    }
  }, [client, slot]);

  if (!client || !slot) {
    return null;
  }

  return (
    <aside
      className={`rounded-3xl border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-950/70 ${className}`}
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
          return;
        }

        setAd(null);
      } catch {
        if (mounted) {
          setSettings(null);
          setAd(null);
        }
      }
    }

    loadAd();

    return () => {
      mounted = false;
    };
  }, [placement]);

  if (!settings) return null;

  if (settings.adsEnabled && settings.googleAdsEnabled && settings.placements?.[placement]) {
    return <GoogleAdSenseBlock className={className} />;
  }

  if (!ad) return null;

  return (
    <aside
      className={`rounded-3xl border border-cyan-200/20 bg-slate-950/70 p-4 text-white shadow-[0_0_30px_rgba(34,211,238,0.10)] backdrop-blur-xl ${className}`}
      aria-label="Sponsored placement"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100">
            Sponsored
          </div>

          <p className="text-sm font-semibold text-cyan-100">{ad.sponsorName}</p>
          <h3 className={compact ? "mt-1 text-lg font-bold" : "mt-1 text-xl font-bold"}>
            {ad.headline}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            {ad.description}
          </p>
        </div>

        <Link
          href={ad.destinationUrl}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-cyan-300 px-5 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
        >
          Apply now
        </Link>
      </div>
    </aside>
  );
}
