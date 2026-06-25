import crypto from "crypto";
import { NextResponse } from "next/server";

export const ACCOUNT_SESSION_COOKIE = "reviewintel_account_session";

export type AccountSession = {
  email: string;
  role: string;
  plan: string;
  name?: string;
  userId?: string;
  exp: number;
};

function sessionSecret() {
  const secret =
    process.env.REVIEWINTEL_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("REVIEWINTEL_SESSION_SECRET is required in production.");
  }

  return secret || "reviewintel-local-dev-session-secret-change-before-production";
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createAccountSession(account: {
  email?: string;
  role?: string;
  plan?: string;
  name?: string;
  userId?: string;
}) {
  const session: AccountSession = {
    email: String(account.email ?? "").toLowerCase().trim(),
    role: String(account.role ?? "").toLowerCase().trim(),
    plan: String(account.plan ?? "").toLowerCase().trim(),
    name: account.name,
    userId: account.userId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  };

  if (!session.email) {
    throw new Error("Cannot create account session without email.");
  }

  const payload = base64url(JSON.stringify(session));
  return `${payload}.${sign(payload)}`;
}

export function verifyAccountSessionToken(token: string): AccountSession | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const safeA = Buffer.from(signature);
  const safeB = Buffer.from(expected);

  if (safeA.length !== safeB.length || !crypto.timingSafeEqual(safeA, safeB)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AccountSession;
    if (!session.email || !session.exp || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function readAccountSession(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCOUNT_SESSION_COOKIE}=`));

  if (!cookie) return null;

  const token = decodeURIComponent(cookie.slice(ACCOUNT_SESSION_COOKIE.length + 1));
  return verifyAccountSessionToken(token);
}

export function setAccountSessionCookie(
  response: NextResponse,
  account: {
    email?: string;
    role?: string;
    plan?: string;
    name?: string;
    userId?: string;
  }
) {
  response.cookies.set(ACCOUNT_SESSION_COOKIE, createAccountSession(account), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60
  });
}

export function clearAccountSessionCookie(response: NextResponse) {
  response.cookies.set(ACCOUNT_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
