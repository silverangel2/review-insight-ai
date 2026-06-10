import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS, createAdminSessionCookie } from "@/lib/adminAccess";
import { ownerSessionFromRequest } from "@/lib/ownerAccess";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!ownerSessionFromRequest(request)) {
    return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionCookie(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS
  });

  return response;
}
