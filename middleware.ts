import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_BYPASS_PREFIXES = [
  "/maintenance",
  "/admin",
  "/api/admin",
  "/api/app-settings",
  "/api/auth",
  "/auth/callback",
  "/auth/verify-email",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml"
];

function shouldBypass(pathname: string) {
  return PUBLIC_BYPASS_PREFIXES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  if (shouldBypass(pathname)) {
    return NextResponse.next();
  }

  try {
    const response = await fetch(`${origin}/api/app-settings`, {
      headers: {
        cookie: request.headers.get("cookie") ?? ""
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.next();
    }

    const data = await response.json();
    const maintenanceMode =
      Boolean(data?.settings?.maintenance_mode);

    if (!maintenanceMode) {
      return NextResponse.next();
    }

    const target = request.nextUrl.clone();
    target.pathname = "/maintenance";
    target.search = "";

    return NextResponse.redirect(target);
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)"
  ]
};
