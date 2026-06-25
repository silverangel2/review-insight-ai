import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAccess";
import { ACCOUNT_SESSION_COOKIE } from "@/lib/accountSession";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  const cookiesToClear = [
    "reviewintel_account_email",
    "reviewintel_account_role",
    "reviewintel_account_plan",
    "reviewintel_account",
    ACCOUNT_SESSION_COOKIE,
    ADMIN_SESSION_COOKIE
  ];

  for (const cookieName of cookiesToClear) {
    response.cookies.set(cookieName, "", {
      httpOnly: cookieName === ADMIN_SESSION_COOKIE || cookieName === ACCOUNT_SESSION_COOKIE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    });
  }

  return response;
}
