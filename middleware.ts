import { NextResponse, type NextRequest } from "next/server";

const ADMIN_SESSION_COOKIE = "reviewintel_admin_session";

function loginRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const role = request.cookies.get("reviewintel_account_role")?.value;
  const adminSession = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (path.startsWith("/admin") && path !== "/admin-access" && !adminSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin-access";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (path === "/account" && !role) {
    return loginRedirect(request);
  }

  if (path === "/dashboard" && !role) {
    return loginRedirect(request);
  }

  if (path.startsWith("/dashboard/customer") && role !== "buyer" && role !== "admin") {
    if (role === "seller") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/seller";
      return NextResponse.redirect(url);
    }
    return loginRedirect(request);
  }

  if (path.startsWith("/dashboard/seller") && role !== "seller" && role !== "admin") {
    if (role === "buyer") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/customer";
      return NextResponse.redirect(url);
    }
    return loginRedirect(request);
  }

  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (path.startsWith("/dashboard") || path.startsWith("/admin")) {
    response.headers.set("Cache-Control", "no-store");
  }

  if (path.startsWith("/admin")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
