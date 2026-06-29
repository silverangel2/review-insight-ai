export const COOKIE_CONSENT_STORAGE_KEY = "reviewintel:cookie-consent";
export const COOKIE_CONSENT_EVENT = "reviewintel:cookie-consent";
export const COOKIE_CONSENT_COOKIE = "reviewintel_cookie_consent";

export type CookieConsentChoice = "accepted" | "essential";

type CookieConsentRecord = {
  choice: CookieConsentChoice;
  updatedAt: string;
};

const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function canUseDocument() {
  return typeof document !== "undefined";
}

function normalizeChoice(value: unknown): CookieConsentChoice | null {
  return value === "accepted" || value === "essential" ? value : null;
}

function readConsentCookie(): CookieConsentChoice | null {
  if (!canUseDocument()) return null;

  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_CONSENT_COOKIE}=`));

  if (!entry) return null;

  try {
    return normalizeChoice(decodeURIComponent(entry.slice(COOKIE_CONSENT_COOKIE.length + 1)));
  } catch {
    return normalizeChoice(entry.slice(COOKIE_CONSENT_COOKIE.length + 1));
  }
}

function writeConsentCookie(choice: CookieConsentChoice) {
  if (!canUseDocument()) return;

  document.cookie = `${COOKIE_CONSENT_COOKIE}=${encodeURIComponent(choice)}; path=/; max-age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; samesite=lax`;
}

export function readCookieConsentChoice(): CookieConsentChoice | null {
  const cookieChoice = readConsentCookie();

  if (!canUseStorage()) return cookieChoice;

  try {
    const stored = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!stored) return cookieChoice;
    const parsed = JSON.parse(stored) as Partial<CookieConsentRecord>;
    return normalizeChoice(parsed.choice) || cookieChoice;
  } catch {
    return cookieChoice;
  }
}

export function hasOptionalCookieConsent() {
  return readCookieConsentChoice() === "accepted";
}

export function saveCookieConsentChoice(choice: CookieConsentChoice) {
  writeConsentCookie(choice);

  if (canUseStorage()) {
    window.localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      JSON.stringify({
        choice,
        updatedAt: new Date().toISOString(),
      } satisfies CookieConsentRecord)
    );
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: { choice } }));
  }
}
