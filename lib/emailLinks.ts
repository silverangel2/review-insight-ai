import { createHmac, timingSafeEqual } from "crypto";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeMailbox(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : "";
}

export function publicEmailSiteUrl(env: Record<string, string | undefined> = process.env) {
  return String(env.NEXT_PUBLIC_SITE_URL || env.NEXT_PUBLIC_APP_URL || "https://getreviewintel.com").replace(/\/$/, "");
}

/** Prefer EMAIL_LINK_SECRET. If it is unset, derive a stable secret from the database key so links still work. */
export function emailLinkSecret(env: Record<string, string | undefined> = process.env) {
  const explicit = String(env.EMAIL_LINK_SECRET || env.UNSUBSCRIBE_SECRET || "").trim();
  if (explicit) return explicit;
  const service = String(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || "").trim();
  if (!service) return "";
  return createHmac("sha256", "reviewintel-email-links-v1").update(service).digest("hex");
}

export function signEmailToken(email: string, secret: string) {
  const normalized = normalizeMailbox(email);
  if (!normalized || !secret) return "";
  const payload = Buffer.from(normalized, "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readEmailToken(token: unknown, secret: string) {
  if (!secret) return "";
  const [payload, signature] = String(token ?? "").split(".");
  if (!payload || !signature) return "";
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return "";
  try {
    return normalizeMailbox(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return "";
  }
}

export function emailActionLinks(email: string, siteUrl: string, secret: string) {
  const token = signEmailToken(email, secret);
  if (!token) {
    return {
      preferencesUrl: `${siteUrl}/email-preferences`,
      unsubscribeUrl: `${siteUrl}/unsubscribe`,
      oneClickUrl: ""
    };
  }
  const encoded = encodeURIComponent(token);
  return {
    preferencesUrl: `${siteUrl}/email-preferences?token=${encoded}`,
    unsubscribeUrl: `${siteUrl}/unsubscribe?token=${encoded}`,
    oneClickUrl: `${siteUrl}/api/unsubscribe?token=${encoded}`
  };
}

export function unsubscribeHeaders(oneClickUrl: string): Record<string, string> {
  if (!oneClickUrl) return {};
  return {
    "List-Unsubscribe": `<${oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
  };
}
