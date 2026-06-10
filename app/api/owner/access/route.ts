import { NextResponse } from "next/server";
import {
  createOwnerSessionCookie,
  OWNER_SESSION_COOKIE,
  OWNER_SESSION_MAX_AGE_SECONDS,
  verifyOwnerAccessCode
} from "@/lib/ownerAccess";

export const runtime = "nodejs";

const attemptStore = ((globalThis as typeof globalThis & { __reviewintelOwnerAttempts?: Map<string, { resetAt: number; count: number }> })
  .__reviewintelOwnerAttempts ??= new Map<string, { resetAt: number; count: number }>());

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 6;

function requestKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-owner";
}

function tooManyAttempts(request: Request) {
  const key = requestKey(request);
  const now = Date.now();
  const existing = attemptStore.get(key);

  if (!existing || existing.resetAt <= now) {
    attemptStore.set(key, { resetAt: now + WINDOW_MS, count: 1 });
    return false;
  }

  existing.count += 1;
  attemptStore.set(key, existing);
  return existing.count > MAX_ATTEMPTS;
}

function clearAttempts(request: Request) {
  attemptStore.delete(requestKey(request));
}

export async function POST(request: Request) {
  if (tooManyAttempts(request)) {
    return NextResponse.json({ error: "Too many owner access attempts. Wait a few minutes and try again." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";

  if (!verifyOwnerAccessCode(code)) {
    return NextResponse.json({ error: "Owner access code is incorrect." }, { status: 401 });
  }

  clearAttempts(request);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(OWNER_SESSION_COOKIE, createOwnerSessionCookie(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OWNER_SESSION_MAX_AGE_SECONDS
  });

  return response;
}
