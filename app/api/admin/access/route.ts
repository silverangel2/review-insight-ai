import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionCookie,
} from "@/lib/adminAccess";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));

    const submittedCode = String(
      body.code ??
      body.adminCode ??
      body.accessCode ??
      body.passcode ??
      body.password ??
      "",
    ).trim();

    const configuredCode = String(process.env.REVIEWINTEL_ADMIN_CODE ?? "").trim();

    if (!configuredCode) {
      return NextResponse.json(
        { error: "Admin code is not configured in .env.local." },
        { status: 500 },
      );
    }

    if (!submittedCode || submittedCode !== configuredCode) {
      return NextResponse.json(
        { error: "Incorrect admin code." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      authenticated: true,
    });

    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: await createAdminSessionCookie(),
      httpOnly: true,
      sameSite: "lax",
      secure: false,
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
