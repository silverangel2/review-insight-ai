/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_BYPASS_PREFIXES = [
  "/maintenance",
  "/admin-access",
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

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return response;
}

// Admin API routes that must stay reachable without a session (they create or clear it).
const ADMIN_API_OPEN = new Set(["/api/admin/access", "/api/admin/session", "/api/admin/logout"]);

function adminSessionSecret() {
  return (
    process.env.REVIEWINTEL_ADMIN_SESSION_SECRET ||
    process.env.REVIEWINTEL_ADMIN_CODE_HASH ||
    process.env.REVIEWINTEL_ADMIN_CODE ||
    (process.env.NODE_ENV === "production" ? "" : "reviewintel-local-admin-session")
  );
}

function base64UrlFromBytes(bytes: ArrayBuffer) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Edge-safe copy of verifyAdminSessionCookie (lib/adminAccess.ts): HMAC-SHA256 signature + expiry. */
async function hasValidAdminSession(request: NextRequest) {
  const value = request.cookies.get("reviewintel_admin_session")?.value;
  const secret = adminSessionSecret();
  if (!value || !secret) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const expected = base64UrlFromBytes(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    if (diff !== 0) return false;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { role?: string; exp?: number };
    return json.role === "admin" && typeof json.exp === "number" && json.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  // Defence in depth: every /api/admin route needs a valid admin session, even if a
  // route handler forgets its own check. Routes still verify the session themselves.
  if (pathname.startsWith("/api/admin/") && !ADMIN_API_OPEN.has(pathname) && !(await hasValidAdminSession(request))) {
    return withSecurityHeaders(NextResponse.json({ ok: false, error: "Admin access required." }, { status: 401 }));
  }

  if (
    shouldBypass(pathname) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth") ||
    pathname === "/login" ||
    pathname === "/signup"
  ) {
    return withSecurityHeaders(NextResponse.next());
  }

  const accountRole = request.cookies.get("reviewintel_account_role")?.value || "";
  const accountPlan = request.cookies.get("reviewintel_account_plan")?.value || "";
  const normalizedRole = accountRole.toLowerCase();
  const normalizedPlan = accountPlan.toLowerCase();
  const isLoggedIn = Boolean(normalizedRole && normalizedPlan);
  const isAdminAccount = normalizedRole === "admin";
  const hasSellerRole = normalizedRole === "seller";
  const hasSellerPlan =
    normalizedPlan === "seller_premium" ||
    normalizedPlan === "seller_beta" ||
    normalizedPlan === "seller_pro";
  const isPaidSellerAccount = hasSellerRole && hasSellerPlan;
  const isSellerAccount = isAdminAccount || isPaidSellerAccount;
  const isPendingSeller = hasSellerRole && !hasSellerPlan;
  const isBuyerAccount =
    normalizedRole === "buyer" ||
    normalizedPlan === "free_buyer" ||
    normalizedPlan === "buyer_pro" ||
    normalizedPlan === "buyer_beta";
  const isShopperPremium = normalizedPlan === "buyer_pro" || normalizedPlan === "buyer_beta";

  const protectedCustomerPaths = [
    "/analyze",
    "/analyze/result",
    "/compare",
    "/dashboard/customer"
  ];

  // Anonymous shoppers may use the scan page itself without signing in.
  // They get ANON_SCAN_LIMIT free scans, enforced server-side by IP hash in
  // /api/analyze (see lib/anonymousScans.ts). Every other customer path
  // still requires login, and seller/admin paths are never relaxed.
  const anonymousScanPaths = ["/analyze"];
  const isAnonymousScanPath = anonymousScanPaths.some(
    (path) => pathname === path
  );

  const protectedSellerPaths = [
    "/dashboard/seller",
    "/dashboard/seller/upload",
    "/dashboard/seller/compare",
    "/dashboard/seller/result",
    "/dashboard/seller/products",
    "/seller/analyze",
    "/seller/result"
  ];

  const isProtectedCustomerPath = protectedCustomerPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  const isProtectedSellerPath = protectedSellerPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // Hard separation: sellers must never land on shopper routes.
  if (isPaidSellerAccount) {
    const sellerRedirects: Record<string, string> = {
      "/analyze": "/seller/analyze",
      "/compare": normalizedPlan === "seller_pro" ? "/dashboard/seller/compare" : "/dashboard/seller",
      "/results": "/seller/result",
      "/dashboard/customer": "/dashboard/seller",
    };

    const sellerTarget = sellerRedirects[pathname];
    if (sellerTarget) {
      const target = request.nextUrl.clone();
      target.pathname = sellerTarget;
      target.search = "";
      return withSecurityHeaders(NextResponse.redirect(target));
    }
  }

  if ((isProtectedCustomerPath || isProtectedSellerPath) && !isLoggedIn && !isAnonymousScanPath) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.searchParams.set("next", pathname);
    return withSecurityHeaders(NextResponse.redirect(target));
  }

  // Signed-in shoppers never see seller tools: show a clean seller upsell at the same URL.
  // (Seller APIs enforce the verified session separately; this cookie check only shapes the page.)
  if (isProtectedSellerPath && isLoggedIn && !isSellerAccount) {
    const target = request.nextUrl.clone();
    target.pathname = "/seller-upsell";
    target.search = "";
    return withSecurityHeaders(NextResponse.rewrite(target));
  }

  // Seller Starter: competitor compare is Seller Pro. Show a locked preview, not a silent redirect.
  if (
    (pathname === "/dashboard/seller/compare" || pathname.startsWith("/dashboard/seller/compare/")) &&
    isPaidSellerAccount &&
    normalizedPlan !== "seller_pro"
  ) {
    const target = request.nextUrl.clone();
    target.pathname = "/seller-upsell";
    target.search = "?feature=compare";
    return withSecurityHeaders(NextResponse.rewrite(target));
  }

  if (
    (pathname === "/dashboard/customer" || pathname.startsWith("/dashboard/customer/")) &&
    isPaidSellerAccount
  ) {
    const target = request.nextUrl.clone();
    target.pathname = "/seller/analyze";
    target.search = "";
    return withSecurityHeaders(NextResponse.redirect(target));
  }

  // Free shoppers now see the hub as a preview (Premium tiles are shown locked with an upgrade path).

  try {
    const response = await fetch(`${origin}/api/app-settings`, {
      headers: {
        cookie: request.headers.get("cookie") ?? ""
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return withSecurityHeaders(NextResponse.next());
    }

    const data = await response.json();
    const maintenanceMode =
      Boolean(data?.settings?.maintenance_mode);

    if (!maintenanceMode) {
      return withSecurityHeaders(NextResponse.next());
    }

    const target = request.nextUrl.clone();
    target.pathname = "/maintenance";
    target.search = "";

    return withSecurityHeaders(NextResponse.redirect(target));
  } catch {
    return withSecurityHeaders(NextResponse.next());
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)"
  ]
};
