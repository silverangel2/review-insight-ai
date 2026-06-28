import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionCookie,
  verifyAdminAccessCode,
} from "@/lib/adminAccess";

const attemptStore = ((globalThis as typeof globalThis & { __reviewintelAdminAttempts?: Map<string, { resetAt: number; count: number }> })
  .__reviewintelAdminAttempts ??= new Map<string, { resetAt: number; count: number }>());

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function requestKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-admin";
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

export async function POST(request: Request): Promise<Response> {
  try {
    if (tooManyAttempts(request)) {
      return NextResponse.json({ error: "Too many admin access attempts. Wait a few minutes and try again." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));

    const submittedCode = String(
      body.code ??
      body.adminCode ??
      body.accessCode ??
      body.passcode ??
      body.password ??
      "",
    ).trim();

    if (!process.env.REVIEWINTEL_ADMIN_CODE && !process.env.REVIEWINTEL_ADMIN_CODE_HASH && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Admin code is not configured in .env.local." },
        { status: 500 },
      );
    }

    if (!verifyAdminAccessCode(submittedCode)) {
      return NextResponse.json(
        { error: "Incorrect admin code." },
        { status: 401 },
      );
    }

    clearAttempts(request);

    const response = NextResponse.json({
      ok: true,
      authenticated: true,
    });

    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: await createAdminSessionCookie(),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: "Admin access failed.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
