import { createHash, createHmac, timingSafeEqual } from "crypto";

export const OWNER_SESSION_COOKIE = "reviewintel_owner_session";
export const OWNER_SESSION_MAX_AGE_SECONDS = 60 * 60;

type OwnerSessionPayload = {
  role: "owner";
  iat: number;
  exp: number;
};

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function configuredOwnerCode() {
  if (process.env.REVIEWINTEL_OWNER_CODE) return process.env.REVIEWINTEL_OWNER_CODE;
  if (process.env.NODE_ENV !== "production") return "reviewintel-owner-2026";
  return "";
}

function ownerSecret() {
  return (
    process.env.REVIEWINTEL_OWNER_SESSION_SECRET ||
    process.env.REVIEWINTEL_OWNER_CODE_HASH ||
    process.env.REVIEWINTEL_OWNER_CODE ||
    process.env.REVIEWINTEL_ADMIN_SESSION_SECRET ||
    "reviewintel-local-owner-session"
  );
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", ownerSecret()).update(encodedPayload).digest("base64url");
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

export function verifyOwnerAccessCode(code: string) {
  const cleanCode = code.trim();
  if (!cleanCode) return false;

  const configuredHash = process.env.REVIEWINTEL_OWNER_CODE_HASH?.trim();
  if (configuredHash) return safeEqual(sha256(cleanCode), configuredHash);

  const plainCode = configuredOwnerCode();
  return Boolean(plainCode) && safeEqual(cleanCode, plainCode);
}

export function createOwnerSessionCookie() {
  const now = Math.floor(Date.now() / 1000);
  const payload: OwnerSessionPayload = {
    role: "owner",
    iat: now,
    exp: now + OWNER_SESSION_MAX_AGE_SECONDS
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyOwnerSessionCookie(value: string | undefined | null): OwnerSessionPayload | null {
  if (!value) return null;

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature || !safeEqual(signPayload(encodedPayload), signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as OwnerSessionPayload;
    if (payload.role !== "owner" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function ownerSessionFromRequest(request: Request) {
  return verifyOwnerSessionCookie(parseCookieHeader(request.headers.get("cookie")).get(OWNER_SESSION_COOKIE));
}
