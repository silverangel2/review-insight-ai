import { buildAffiliateUrl, isSupportedAffiliateUrl } from "@/lib/affiliate";

export type SocialRedirectEnv = Partial<Record<string, string | undefined>>;

const fallbackPublicBaseUrl = "https://getreviewintel.com";

const publicBaseUrlEnvNames = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "APP_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
];

const startDestinationEnvNames = [
  "REVIEWINTEL_START_URL",
  "REVIEWINTEL_DESTINATION_URL",
  ...publicBaseUrlEnvNames,
];

const affiliateDestinationEnvNames = [
  "SOCIAL_AFFILIATE_URL",
  "FACEBOOK_AFFILIATE_URL",
  "SOCIAL_QUALIFYING_LINK_URL",
  "FACEBOOK_QUALIFYING_LINK_URL",
];

function envValue(env: SocialRedirectEnv, names: string[]) {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }

  return "";
}

function withHttpsIfMissing(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isPrivateOrLocalHostname(hostname: string) {
  const host = hostname.toLowerCase();

  return (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

export function normalizePublicHttpUrl(value: string) {
  const candidate = withHttpsIfMissing(value);
  if (!candidate) return "";

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    if (isPrivateOrLocalHostname(parsed.hostname)) return "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function resolveReviewIntelPublicBaseUrl(env: SocialRedirectEnv = process.env) {
  return normalizePublicHttpUrl(envValue(env, publicBaseUrlEnvNames)) || fallbackPublicBaseUrl;
}

export function resolveReviewIntelStartDestination(env: SocialRedirectEnv = process.env) {
  return normalizePublicHttpUrl(envValue(env, startDestinationEnvNames)) || fallbackPublicBaseUrl;
}

export function resolveAmazonAffiliateDestination(env: SocialRedirectEnv = process.env) {
  const rawUrl = envValue(env, affiliateDestinationEnvNames);
  if (!rawUrl || !isSupportedAffiliateUrl(rawUrl)) return null;

  const affiliateUrl = normalizePublicHttpUrl(buildAffiliateUrl(rawUrl));
  if (!affiliateUrl || !isSupportedAffiliateUrl(affiliateUrl)) return null;

  return affiliateUrl;
}

export function shortReviewIntelUrl(env: SocialRedirectEnv = process.env) {
  return `${resolveReviewIntelPublicBaseUrl(env).replace(/\/$/, "")}/start`;
}

export function shortAffiliateUrl(env: SocialRedirectEnv = process.env) {
  return `${resolveReviewIntelPublicBaseUrl(env).replace(/\/$/, "")}/recommends`;
}

export function socialRedirectSummary(env: SocialRedirectEnv = process.env) {
  return {
    websiteDestinationUrl: resolveReviewIntelStartDestination(env),
    affiliateDestinationUrl: resolveAmazonAffiliateDestination(env),
    websiteShortUrl: shortReviewIntelUrl(env),
    affiliateShortUrl: shortAffiliateUrl(env),
  };
}
