// Realistic browser request profiles for public product pages.
// These are ordinary Chrome header sets. They do not solve CAPTCHAs,
// do not submit credentials, and do not impersonate a signed-in shopper.

export type FetchTier =
  | "primary-profile"
  | "alternate-profile"
  | "alternate-url"
  | "mobile-url"
  | "reviews-endpoint"
  | "sibling-domain"
  | "chromium";

export type BrowserProfile = {
  id: "chrome-win" | "chrome-mac" | "chrome-android";
  userAgent: string;
  secChUa: string;
  secChUaMobile: "?0" | "?1";
  secChUaPlatform: string;
};

export const BROWSER_PROFILES: BrowserProfile[] = [
  {
    id: "chrome-win",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="140", "Google Chrome";v="140", "Not?A_Brand";v="99"',
    secChUaMobile: "?0",
    secChUaPlatform: '"Windows"',
  },
  {
    id: "chrome-mac",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    secChUa: '"Chromium";v="140", "Google Chrome";v="140", "Not?A_Brand";v="99"',
    secChUaMobile: "?0",
    secChUaPlatform: '"macOS"',
  },
  {
    id: "chrome-android",
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
    secChUa: '"Chromium";v="140", "Google Chrome";v="140", "Not?A_Brand";v="99"',
    secChUaMobile: "?1",
    secChUaPlatform: '"Android"',
  },
];

export function profileById(id: string): BrowserProfile {
  return BROWSER_PROFILES.find((profile) => profile.id === id) || BROWSER_PROFILES[0];
}

/** Accept-Language follows the storefront the URL is actually on. */
export function acceptLanguageForHost(host: string): string {
  const name = host.toLowerCase().replace(/^www\./, "");
  if (name.endsWith(".co.uk") || name.endsWith(".uk")) return "en-GB,en;q=0.9";
  if (name.endsWith(".ca")) return "en-CA,en;q=0.9,fr-CA;q=0.8";
  if (name.endsWith(".com.au")) return "en-AU,en;q=0.9";
  return "en-US,en;q=0.9";
}

function registrableHost(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  if (parts.length >= 3 && parts[parts.length - 2] === "co") return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

/** One cookie jar per scan. Later requests to the same storefront send cookies the store already set. */
export class ScanCookieJar {
  private readonly cookies = new Map<string, Map<string, string>>();

  addFromSetCookie(requestUrl: string, setCookies: string[]) {
    let fallback = "";
    try { fallback = registrableHost(new URL(requestUrl).hostname); } catch { return; }
    for (const raw of setCookies) {
      const [pair] = String(raw || "").split(";");
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!name || /^(?:path|expires|max-age|secure|httponly|samesite)$/i.test(name)) continue;
      const domainAttr = String(raw).match(/;\s*domain=([^;]+)/i)?.[1]?.trim().replace(/^\./, "").toLowerCase();
      const domain = domainAttr || fallback;
      const jar = this.cookies.get(domain) || new Map<string, string>();
      jar.set(name, value);
      this.cookies.set(domain, jar);
    }
  }

  headerFor(url: string): string {
    let host = "";
    try { host = new URL(url).hostname.toLowerCase(); } catch { return ""; }
    const pairs: string[] = [];
    for (const [domain, jar] of this.cookies) {
      if (host === domain || host.endsWith(`.${domain}`)) {
        for (const [name, value] of jar) pairs.push(`${name}=${value}`);
      }
    }
    return pairs.join("; ");
  }
}

export function headersForAttempt(input: {
  url: string;
  tier: FetchTier;
  profileId: string;
  jar: ScanCookieJar;
  referer?: string;
}): Record<string, string> {
  const profile = profileById(input.profileId);
  const cookie = input.jar.headerFor(input.url);
  let host = "";
  try { host = new URL(input.url).hostname; } catch { host = ""; }
  const jsonApi = /\/ugc\/v2\/|\/api\/reviews\/|r2d2\.target\.com|api\.bazaarvoice\.com|redsky\.target\.com/i.test(input.url);
  const ajax = /\/ajax\/reviews\//i.test(input.url);
  const dataRequest = jsonApi || ajax;
  // Client hints, fetch metadata, and an explicit accept-encoding made Amazon
  // serve a bot-check page. The runtime still decompresses when it negotiates
  // encoding itself. Do not put those headers back on the ladder.
  const headers: Record<string, string> = {
    "user-agent": profile.userAgent,
    accept: jsonApi
      ? "application/json,text/plain,*/*;q=0.8"
      : "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language": acceptLanguageForHost(host),
    "cache-control": "max-age=0",
    // Stripped by the polite fetcher before the request leaves. It only splits the cache by profile.
    "x-ri-profile": profile.id,
  };
  if (!dataRequest) headers["upgrade-insecure-requests"] = "1";
  if (cookie) headers.cookie = cookie;
  if (dataRequest && input.referer) headers.referer = input.referer;
  return headers;
}
