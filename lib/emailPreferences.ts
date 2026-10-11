// Email preferences + one-click unsubscribe (RFC 8058). Transactional mail is always allowed.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { EmailCategory } from "./emailTemplate";

export const OPTIONAL_CATEGORIES = ["tips", "upgrade", "watch_alerts", "marketing"] as const;
export type OptionalCategory = (typeof OPTIONAL_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<OptionalCategory, string> = {
  tips: "Tips for getting the most from ReviewIntel",
  upgrade: "Plan and upgrade suggestions",
  watch_alerts: "Watch alerts for products you follow",
  marketing: "News and occasional announcements",
};
export type EmailPreferences = Record<OptionalCategory, boolean>;
export const DEFAULT_PREFERENCES: EmailPreferences = { tips: true, upgrade: true, watch_alerts: true, marketing: true };

function secret(env: Record<string, string | undefined> = process.env) {
  const base = env.REVIEWINTEL_EMAIL_SECRET || env.REVIEWINTEL_SESSION_SECRET || env.NEXTAUTH_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
  if (base) return createHmac("sha256", base).update("reviewintel-email-prefs-v1").digest("hex");
  return env.NODE_ENV === "production" ? null : "reviewintel-local-email-secret";
}

export function signEmailToken(email: string, s = secret()): string | null {
  const e = email.toLowerCase().trim();
  if (!s || !e) return null;
  const body = Buffer.from(e).toString("base64url");
  return `${body}.${createHmac("sha256", s).update(body).digest("base64url")}`;
}
export function verifyEmailToken(token: string, s = secret()): string | null {
  if (!s || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const exp = createHmac("sha256", s).update(body).digest("base64url");
  if (sig.length !== exp.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null;
  return Buffer.from(body, "base64url").toString();
}

export function appOrigin(env: Record<string, string | undefined> = process.env) {
  return (env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_SITE_URL || "https://getreviewintel.com").replace(/\/$/, "");
}
export function preferencesUrl(email: string) {
  const t = signEmailToken(email); return t ? `${appOrigin()}/email-preferences?t=${encodeURIComponent(t)}` : undefined;
}
export function unsubscribeUrl(email: string, category: OptionalCategory) {
  const t = signEmailToken(email); return t ? `${appOrigin()}/api/email/unsubscribe?t=${encodeURIComponent(t)}&c=${category}` : undefined;
}

/** List-Unsubscribe headers for optional (alert/marketing) mail. */
export function unsubscribeHeaders(email: string, category: EmailCategory): Record<string, string> {
  if (category === "transactional") return {};
  const url = unsubscribeUrl(email, category);
  if (!url) return {};
  return { "List-Unsubscribe": `<${url}>, <mailto:support@getreviewintel.com?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

export function normalizePreferences(row: Record<string, unknown> | null | undefined): EmailPreferences {
  const out = { ...DEFAULT_PREFERENCES };
  if (row) for (const c of OPTIONAL_CATEGORIES) if (typeof row[c] === "boolean") out[c] = row[c] as boolean;
  if (row && row.unsubscribed_all === true) for (const c of OPTIONAL_CATEGORIES) out[c] = false;
  return out;
}
