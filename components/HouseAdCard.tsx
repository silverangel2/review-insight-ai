"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  houseAdClickPath,
  pickHouseAd,
  type HouseAdContext,
  type HouseAdCreative,
} from "@/lib/houseAds";

/**
 * House Ads Engine (Phase 1) — the sponsored photo card.
 *
 * Agoda-format unit: photo, headline, sponsor line, a visible "Sponsored"
 * label, and a close (X) that hides the card for the session. The whole
 * card is one tap through /api/ads/click/<id> (records, then redirects).
 * An impression is counted only when the card actually scrolls into view.
 */

const HIDE_KEY = "house-ad-hidden:";
const IMP_KEY = "house-ad-impression:";

function sessionGet(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function sessionSet(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* private mode — counting/dismissal just becomes per-render */
  }
}

export function HouseAdCard({
  creative,
  placement,
}: {
  creative: HouseAdCreative;
  placement: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [hidden, setHidden] = useState(false);
  const impressionSent = useRef(false);

  useEffect(() => {
    if (sessionGet(HIDE_KEY + placement)) setHidden(true);
  }, [placement]);

  useEffect(() => {
    const node = ref.current;
    if (!node || hidden) return;
    const impKey = `${IMP_KEY}${placement}:${creative.id}`;
    if (sessionGet(impKey)) {
      impressionSent.current = true;
      return;
    }
    const send = () => {
      if (impressionSent.current) return;
      impressionSent.current = true;
      sessionSet(impKey, "1");
      const payload = JSON.stringify({
        creativeId: creative.id,
        eventType: "impression",
        pagePath: window.location.pathname,
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/ads/event",
            new Blob([payload], { type: "application/json" }),
          );
          return;
        }
      } catch {
        /* fall through to fetch */
      }
      fetch("/api/ads/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    };
    if (typeof IntersectionObserver === "undefined") {
      send();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          send();
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [creative.id, placement, hidden]);

  if (hidden) return null;

  const dismiss = () => {
    sessionSet(HIDE_KEY + placement, "1");
    setHidden(true);
  };

  return (
    <aside
      ref={ref}
      aria-label={`Sponsored: ${creative.sponsorLabel}`}
      className="relative overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_60px_rgba(16,32,51,0.10)] ring-1 ring-slate-900/5"
      data-house-ad={creative.id}
    >
      <a
        href={houseAdClickPath(creative.id)}
        rel="sponsored noopener"
        className="group flex flex-col sm:flex-row"
      >
        <span className="relative block shrink-0 overflow-hidden sm:w-64">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={creative.image}
            alt={creative.imageAlt}
            loading="lazy"
            className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03] sm:h-full sm:min-h-44"
          />
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white backdrop-blur-sm">
            Sponsored
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-5 sm:p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {creative.sponsorLabel}
          </span>
          <span className="text-lg font-black leading-snug text-ink sm:text-xl">
            {creative.headline}
          </span>
          <span className="text-sm leading-relaxed text-slate-600">{creative.body}</span>
          <span
            className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white"
            style={{ backgroundImage: "linear-gradient(135deg,#0a6cff,#5b3df0)" }}
          >
            {creative.ctaLabel}
            <span aria-hidden="true">→</span>
          </span>
        </span>
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide this sponsored card"
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-base leading-none text-white backdrop-blur-sm transition hover:bg-black/65"
      >
        ×
      </button>
    </aside>
  );
}

/** Picks one creative for the placement by page context and renders it.
 * Seed = hourly bucket, so rotation is even across the day and stable
 * within the hour (no flicker between renders). */
export function HouseAdSlot({
  context,
  placement,
  className,
}: {
  context: HouseAdContext;
  placement?: string;
  className?: string;
}) {
  const seed = useMemo(() => Math.floor(Date.now() / 3_600_000), []);
  const creative = pickHouseAd(context, seed);
  if (!creative) return null;
  return (
    <div className={className}>
      <HouseAdCard creative={creative} placement={placement || context} />
    </div>
  );
}
