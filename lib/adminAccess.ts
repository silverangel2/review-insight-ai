import { createHash, createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "reviewintel_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 4;

type AdminSessionPayload = {
  role: "admin";
  email: string;
  iat: number;
  exp: number;
};

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sessionSecret() {
  return (
    process.env.REVIEWINTEL_ADMIN_SESSION_SECRET ||
    process.env.REVIEWINTEL_ADMIN_CODE_HASH ||
    process.env.REVIEWINTEL_ADMIN_CODE ||
    "reviewintel-local-admin-session"
  );
}

function configuredAdminCode() {
  if (process.env.REVIEWINTEL_ADMIN_CODE) return process.env.REVIEWINTEL_ADMIN_CODE;
  if (process.env.NODE_ENV !== "production") return "reviewintel-dev-admin";
  return "";
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", sessionSecret()).update(encodedPayload).digest("base64url");
}

function parseCookieHeader(cookieHeader: string | null) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || !rawValue.length) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }

  return cookies;
}

export function hashAdminAccessCode(code: string) {
  return sha256(code);
}

export function verifyAdminAccessCode(code: string) {
  const cleanCode = code.trim();
  if (!cleanCode) return false;

  const configuredHash = process.env.REVIEWINTEL_ADMIN_CODE_HASH?.trim();
  if (configuredHash) return safeEqual(sha256(cleanCode), configuredHash);

  const plainCode = configuredAdminCode();
  return Boolean(plainCode) && safeEqual(cleanCode, plainCode);
}

export function createAdminSessionCookie(email = process.env.REVIEWINTEL_ADMIN_EMAIL || "developer@reviewintel.local") {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    role: "admin",
    email,
    iat: now,
    exp: now + ADMIN_SESSION_MAX_AGE_SECONDS
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyAdminSessionCookie(value: string | undefined | null): AdminSessionPayload | null {
  if (!value) return null;

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature || !safeEqual(signPayload(encodedPayload), signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AdminSessionPayload;
    if (payload.role !== "admin" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function adminSessionFromRequest(request: Request) {
  return verifyAdminSessionCookie(parseCookieHeader(request.headers.get("cookie")).get(ADMIN_SESSION_COOKIE));
}
