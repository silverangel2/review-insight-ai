// Advertiser flow helpers: signed links (payment, report), inquiry validation, a small rate limiter,
// and Stripe Checkout/webhook helpers. Stripe is TEST MODE ONLY: live keys are refused.
import { createHmac, timingSafeEqual } from "node:crypto";

export function advertiserSecret(env: Record<string, string | undefined> = process.env): string | null {
  const base = env.REVIEWINTEL_ADVERTISER_SECRET || env.REVIEWINTEL_SESSION_SECRET || env.NEXTAUTH_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
  if (base) return createHmac("sha256", base).update("reviewintel-advertiser-v1").digest("hex");
  return env.NODE_ENV === "production" ? null : "reviewintel-local-advertiser-secret";
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
export function signCampaignToken(purpose: "pay" | "report", campaignId: string, secret = advertiserSecret()): string | null {
  if (!secret || !/^[A-Za-z0-9_-]{1,80}$/.test(campaignId)) return null;
  const body = b64(`${purpose}:${campaignId}`);
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
export function verifyCampaignToken(token: string, purpose: "pay" | "report", secret = advertiserSecret()): string | null {
  if (!secret || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [p, id] = Buffer.from(body, "base64url").toString().split(":");
  return p === purpose && id ? id : null;
}

export type Inquiry = { name: string; email: string; company: string; website: string; budget: string; placement: string; message: string };
const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
export const BUDGETS = ["Under $100", "$100–$500", "$500–$2,000", "$2,000+", "Not sure yet"];
export const INQUIRY_PLACEMENTS = ["results_below_verdict", "analyze_below_card", "homepage_mid", "footer", "not_sure"];

export function validateInquiry(input: Record<string, unknown>): { ok: true; value: Inquiry } | { ok: false; error: string; spam?: boolean } {
  if (clean(input.company_website_confirm, 200)) return { ok: false, error: "Rejected.", spam: true }; // honeypot
  const v: Inquiry = {
    name: clean(input.name, 120), email: clean(input.email, 200).toLowerCase(), company: clean(input.company, 160),
    website: clean(input.website, 300), budget: clean(input.budget, 40), placement: clean(input.placement, 40), message: clean(input.message, 2000),
  };
  if (!v.name || !v.email || !v.company) return { ok: false, error: "Name, email and company are required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) return { ok: false, error: "Enter a valid email." };
  if (v.website && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(v.website)) return { ok: false, error: "Website must start with http(s)://" };
  if (v.budget && !BUDGETS.includes(v.budget)) v.budget = "Not sure yet";
  if (v.placement && !INQUIRY_PLACEMENTS.includes(v.placement)) v.placement = "not_sure";
  return { ok: true, value: v };
}

/** Fixed-window limiter per key (per server instance; the DB is the durable record). */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max = 3, windowMs = 10 * 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
  recent.push(now); hits.set(key, recent);
  return recent.length > max;
}

export function stripeTestKey(env: Record<string, string | undefined> = process.env): { key: string | null; error?: string } {
  const key = (env.STRIPE_SECRET_KEY || "").trim();
  if (!key) return { key: null, error: "Stripe is not configured." };
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) return { key: null, error: "Only Stripe TEST keys are allowed in this build." };
  return { key };
}

export const PACKAGE_CENTS: Record<string, number> = { sponsored_monthly: 4999, featured_monthly: 9999 };

export async function createCheckoutSession(input: { campaignId: string; packageId: string; packageName: string; email?: string | null; origin: string }, env = process.env, fetchImpl: typeof fetch = fetch) {
  const { key, error } = stripeTestKey(env);
  if (!key) return { ok: false as const, error };
  const amount = PACKAGE_CENTS[input.packageId] || PACKAGE_CENTS.sponsored_monthly;
  const form = new URLSearchParams({
    mode: "payment", success_url: `${input.origin}/advertise?paid=1`, cancel_url: `${input.origin}/advertise?paid=0`,
    "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "cad",
    "line_items[0][price_data][unit_amount]": String(amount), "line_items[0][price_data][product_data][name]": `ReviewIntel ${input.packageName}`,
    "metadata[campaign_id]": input.campaignId, client_reference_id: input.campaignId,
  });
  if (input.email) form.set("customer_email", input.email);
  const res = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const data = await res.json().catch(() => ({})) as { url?: string; id?: string; error?: { message?: string } };
  return res.ok && data.url ? { ok: true as const, url: data.url, id: data.id } : { ok: false as const, error: data.error?.message || `Stripe error ${res.status}` };
}

/** Verify a Stripe-Signature header (v1 HMAC-SHA256 of `${t}.${payload}`) with tolerance. */
export function verifyStripeSignature(payload: string, header: string | null, secret: string | undefined, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=") as [string, string]).filter(([k]) => k === "t")) as Record<string, string>;
  const t = Number(parts.t);
  const sigs = header.split(",").filter(p => p.startsWith("v1=")).map(p => p.slice(3));
  if (!t || !sigs.length || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return sigs.some(s => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

export function ctr(impressions: number, clicks: number): string {
  return impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : "–";
}
