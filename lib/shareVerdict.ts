// Shareable verdict links. The token is a compact, HMAC-signed summary of a REAL
// scan (derived by deriveShopperAnswer), so the share page and its OG image render
// without a database read, and the summary cannot be forged or edited.
import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { deriveShopperAnswer } from "./shopperAnswer";

export type SharedPoint = { claim: string; quote: string | null; sourceUrl: string | null };
export type SharedVerdict = {
  v: 1;
  scanId: string;
  product: string;
  label: string;
  kind: string;
  why: string;
  score: number | null;
  confidencePercent: number | null;
  confidenceWords: string;
  reviewCount: number;
  sources: string[];
  love: SharedPoint | null;
  complaint: SharedPoint | null;
  listingUrl: string | null;
  createdAt: string;
};

export function shareSecret(env: Record<string, string | undefined> = process.env): string | null {
  const base = env.REVIEWINTEL_SHARE_SECRET || env.REVIEWINTEL_SESSION_SECRET || env.NEXTAUTH_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
  if (base) return createHmac("sha256", base).update("reviewintel-share-v1").digest("hex");
  // Local development only; production without a secret disables sharing.
  return env.NODE_ENV === "production" ? null : "reviewintel-dev-share-secret";
}

const b64u = (buf: Buffer) => buf.toString("base64url");

export function sharedVerdictFromResult(result: Record<string, unknown>, scanId: string, now = new Date()): SharedVerdict {
  const a = deriveShopperAnswer(result as never);
  const product = result.product && typeof result.product === "object" ? result.product as Record<string, unknown> : {};
  const title = String(product.title || product.name || result.productName || "This product").slice(0, 140);
  const point = (p: (typeof a.loves)[number] | undefined): SharedPoint | null =>
    p ? { claim: p.claim, quote: p.quote ? p.quote.slice(0, 220) : null, sourceUrl: p.sourceUrl } : null;
  const listing = typeof result.exactListingUrl === "string" ? result.exactListingUrl : null;
  return {
    v: 1, scanId, product: title, label: a.label, kind: a.kind, why: a.why.slice(0, 260), score: a.score,
    confidencePercent: a.confidencePercent, confidenceWords: a.confidenceWords, reviewCount: a.reviewCount,
    sources: a.sources.slice(0, 4), love: point(a.loves[0]), complaint: point(a.complaints[0]),
    listingUrl: listing, createdAt: now.toISOString(),
  };
}

export function signSharedVerdict(data: SharedVerdict, secret = shareSecret()): string | null {
  if (!secret) return null;
  const body = b64u(deflateRawSync(Buffer.from(JSON.stringify(data))));
  const sig = b64u(createHmac("sha256", secret).update(body).digest()).slice(0, 22);
  return `${body}.${sig}`;
}

export function verifySharedVerdict(token: string, secret = shareSecret()): SharedVerdict | null {
  if (!secret || typeof token !== "string" || token.length > 6000) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64u(createHmac("sha256", secret).update(body).digest()).slice(0, 22);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(inflateRawSync(Buffer.from(body, "base64url"), { maxOutputLength: 20000 }).toString("utf8"));
    return data && data.v === 1 && typeof data.product === "string" ? data as SharedVerdict : null;
  } catch { return null; }
}
