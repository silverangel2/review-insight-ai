// "Watch this product" alerts. Off unless REVIEWINTEL_WATCH_ALERTS=on. Zero OpenAI.
// Email only on a real verdict change or a meaningful amount of new accepted evidence.
import crypto from "node:crypto";

export const MAX_ACTIVE_WATCHES = 10;
export const NEW_EVIDENCE_THRESHOLD = 10;

export function watchAlertsEnabled(env: Record<string, string | undefined> = process.env) {
  return ["1", "on", "true", "yes"].includes(String(env.REVIEWINTEL_WATCH_ALERTS || "").trim().toLowerCase());
}

/** Normalized product identity: Amazon ASIN when present, else the cleaned URL. */
export function productKeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const asin = u.pathname.match(/\/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})(?:[/?]|$)/i);
    if (asin) return `asin:${asin[1].toUpperCase()}`;
    return `url:${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}

export type WatchSnapshot = { verdict: string | null; acceptedCount: number; resultHash: string | null };
export type WatchDecision = { alert: boolean; reason: "verdict_changed" | "new_evidence" | "no_change" | "no_new_result" };

export function decideWatchAlert(previous: WatchSnapshot, next: WatchSnapshot | null): WatchDecision {
  if (!next || !next.resultHash || next.resultHash === previous.resultHash) return { alert: false, reason: next ? "no_change" : "no_new_result" };
  const norm = (v: string | null) => String(v || "").trim().toUpperCase();
  if (norm(previous.verdict) && norm(next.verdict) && norm(previous.verdict) !== norm(next.verdict)) return { alert: true, reason: "verdict_changed" };
  if (next.acceptedCount - previous.acceptedCount >= NEW_EVIDENCE_THRESHOLD) return { alert: true, reason: "new_evidence" };
  return { alert: false, reason: "no_change" };
}

function secret(env: Record<string, string | undefined> = process.env) {
  return env.REVIEWINTEL_WATCH_SECRET || env.ACCOUNT_SESSION_SECRET || "";
}

/** One-click unwatch token: HMAC over email + product key. */
export function signUnwatchToken(email: string, productKey: string, key = secret()): string | null {
  if (!key) return null;
  const payload = Buffer.from(JSON.stringify({ e: email.toLowerCase(), k: productKey })).toString("base64url");
  return `${payload}.${crypto.createHmac("sha256", key).update(payload).digest("base64url")}`;
}

export function verifyUnwatchToken(token: string, key = secret()): { email: string; productKey: string } | null {
  if (!key) return null;
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); return d?.e && d?.k ? { email: d.e, productKey: d.k } : null; } catch { return null; }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function watchAlertEmail(input: { productName: string; reason: WatchDecision["reason"]; previousVerdict: string | null; verdict: string | null; acceptedCount: number; resultUrl: string; unwatchUrl: string }) {
  const why = input.reason === "verdict_changed"
    ? `The verdict changed from ${input.previousVerdict || "unknown"} to ${input.verdict || "unknown"}.`
    : `${input.acceptedCount} real buyer reviews are now included.`;
  const subject = `Update on ${input.productName}`;
  const text = `${why}\n\nSee the full result: ${input.resultUrl}\n\nStop watching this product: ${input.unwatchUrl}`;
  const html = `<p>${esc(why)}</p><p><a href="${esc(input.resultUrl)}">See the full result</a></p><p style="color:#64748b;font-size:13px"><a href="${esc(input.unwatchUrl)}">Stop watching this product</a></p>`;
  return { subject, text, html };
}
