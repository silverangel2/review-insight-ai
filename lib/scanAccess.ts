// Proves a signed-out browser may open the scan it just ran. The cookie is httpOnly.
// A different scan id, or a token signed with another secret, does not grant access.
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const SCAN_ACCESS_COOKIE = "reviewintel_scan_access";

function accessSecret() {
  return (
    process.env.REVIEWINTEL_SCAN_ACCESS_SECRET ||
    process.env.REVIEWINTEL_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

export function scanAccessToken(scanId: string) {
  const secret = accessSecret();
  if (!secret || !scanId) return "";
  return createHmac("sha256", secret).update(`scan-access:v1:${scanId}`).digest("base64url");
}

function splitGrant(part: string) {
  const dot = part.indexOf(".");
  if (dot <= 0) return null;
  return { scanId: part.slice(0, dot), token: part.slice(dot + 1) };
}

export function cookieGrantsScan(cookieValue: string | undefined | null, scanId: string) {
  const id = String(scanId || "").trim();
  if (!id || !cookieValue) return false;
  const expected = scanAccessToken(id);
  if (!expected) return false;
  for (const part of cookieValue.split(",")) {
    const grant = splitGrant(part.trim());
    if (!grant || grant.scanId !== id || grant.token.length !== expected.length) continue;
    const left = Buffer.from(grant.token);
    const right = Buffer.from(expected);
    if (left.length === right.length && timingSafeEqual(left, right)) return true;
  }
  return false;
}

export function withScanGrant(existing: string | undefined | null, scanId: string) {
  const id = String(scanId || "").trim();
  const token = scanAccessToken(id);
  if (!id || !token) return String(existing || "");
  const grant = `${id}.${token}`;
  const kept = String(existing || "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => {
      const parsed = splitGrant(part);
      return Boolean(parsed && parsed.scanId && parsed.scanId !== id);
    })
    .slice(-7);
  return [...kept, grant].join(",");
}

function cookieFromRequest(request: Request) {
  const entry = (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SCAN_ACCESS_COOKIE}=`));
  if (!entry) return "";
  const raw = entry.slice(SCAN_ACCESS_COOKIE.length + 1);
  try { return decodeURIComponent(raw); } catch { return raw; }
}

/** Attach the anonymous scan-owner cookie and a readable token header on a finished scan. */
export async function attachScanAccess(request: Request, response: Response): Promise<Response> {
  if (!(response instanceof NextResponse) || response.status !== 200) return response;
  const data = await response.clone().json().catch(() => null) as { scanId?: unknown } | null;
  const scanId = String(data?.scanId || "").trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(scanId)) return response;
  const token = scanAccessToken(scanId);
  if (!token) return response;
  const value = withScanGrant(cookieFromRequest(request), scanId);
  response.cookies.set(SCAN_ACCESS_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.set("x-reviewintel-scan-token", token);
  return response;
}
