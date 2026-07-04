"use client";

import { COOKIE_CONSENT_EVENT, readCookieConsentChoice } from "@/lib/cookieConsent";

type TrafficEventInput = {
  eventType?: string;
  path?: string;
  url?: string;
  title?: string;
  metadata?: Record<string, unknown>;
};

const VISITOR_ID_STORAGE_KEY = "reviewintel:traffic-visitor";

function canUseBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function randomVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function readVisitorId(consentChoice: string) {
  if (!canUseBrowser() || consentChoice !== "accepted") return "";

  try {
    const existing = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (existing) return existing;

    const next = randomVisitorId();
    window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return "";
  }
}

export function canTrackTraffic() {
  return canUseBrowser() && Boolean(readCookieConsentChoice());
}

export function trackTrafficEvent(input: TrafficEventInput = {}) {
  if (!canUseBrowser()) return false;

  const consentChoice = readCookieConsentChoice();
  if (!consentChoice) return false;

  const url = input.url || window.location.href;
  const path = input.path || `${window.location.pathname}${window.location.search}`;
  const payload = JSON.stringify({
    eventType: input.eventType || "page_view",
    url,
    path,
    title: input.title || document.title || "",
    referrer: document.referrer || "",
    visitorId: readVisitorId(consentChoice),
    consentChoice,
    metadata: input.metadata || {},
  });

  try {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/traffic-event", blob)) return true;
  } catch {
    // Fall through to fetch.
  }

  void fetch("/api/traffic-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => null);

  return true;
}

export function listenForTrafficConsent(callback: () => void) {
  if (!canUseBrowser()) return () => {};

  window.addEventListener(COOKIE_CONSENT_EVENT, callback);
  return () => window.removeEventListener(COOKIE_CONSENT_EVENT, callback);
}
