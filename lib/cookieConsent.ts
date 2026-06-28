export const COOKIE_CONSENT_STORAGE_KEY = "reviewintel:cookie-consent";
export const COOKIE_CONSENT_EVENT = "reviewintel:cookie-consent";

export type CookieConsentChoice = "accepted" | "essential";

type CookieConsentRecord = {
  choice: CookieConsentChoice;
  updatedAt: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readCookieConsentChoice(): CookieConsentChoice | null {
  if (!canUseStorage()) return null;

  try {
    const stored = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<CookieConsentRecord>;
    return parsed.choice === "accepted" || parsed.choice === "essential" ? parsed.choice : null;
  } catch {
    return null;
  }
}

export function hasOptionalCookieConsent() {
  return readCookieConsentChoice() === "accepted";
}

export function saveCookieConsentChoice(choice: CookieConsentChoice) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(
    COOKIE_CONSENT_STORAGE_KEY,
    JSON.stringify({
      choice,
      updatedAt: new Date().toISOString(),
    } satisfies CookieConsentRecord)
  );

  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: { choice } }));
}
