"use client";

import { useEffect } from "react";

function sendSponsorEvent(type: "impression" | "click", sponsorId: string, placement: string) {
  const payload = JSON.stringify({
    type,
    sponsorId,
    placement,
    path: window.location.pathname,
    occurredAt: new Date().toISOString()
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/sponsor-events", new Blob([payload], { type: "application/json" }));
    return;
  }

  void fetch("/api/sponsor-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  });
}

export function SponsorAnalytics({ placement }: { placement: string }) {
  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-sponsor-id]"));
    for (const card of cards) {
      const sponsorId = card.dataset.sponsorId;
      if (sponsorId) sendSponsorEvent("impression", sponsorId, placement);
    }

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-sponsor-click]") : null;
      const sponsorId = target?.dataset.sponsorClick;
      if (sponsorId) sendSponsorEvent("click", sponsorId, placement);
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [placement]);

  return null;
}
