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

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

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
  const hasSellerPlan = normalizedPlan === "seller_premium" || normalizedPlan === "seller_pro";
  const isPaidSellerAccount = hasSellerRole && hasSellerPlan;
  const isSellerAccount = isAdminAccount || isPaidSellerAccount;
  const isPendingSeller = hasSellerRole && !hasSellerPlan;
  const isBuyerAccount = normalizedRole === "buyer" || normalizedPlan === "free_buyer" || normalizedPlan === "buyer_pro";
  const isShopperPremium = normalizedPlan === "buyer_pro";

  const protectedCustomerPaths = [
    "/analyze",
    "/analyze/result",
    "/compare",
    "/dashboard/customer"
  ];

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

  if ((isProtectedCustomerPath || isProtectedSellerPath) && !isLoggedIn) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.searchParams.set("next", pathname);
    return withSecurityHeaders(NextResponse.redirect(target));
  }

  if (
    (pathname === "/dashboard/seller/compare" || pathname.startsWith("/dashboard/seller/compare/")) &&
    isPaidSellerAccount &&
    normalizedPlan !== "seller_pro"
  ) {
    const target = request.nextUrl.clone();
    target.pathname = "/seller/analyze";
    target.search = "";
    return withSecurityHeaders(NextResponse.redirect(target));
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

  if (
    (pathname === "/dashboard/customer" || pathname.startsWith("/dashboard/customer/")) &&
    isBuyerAccount &&
    !isShopperPremium
  ) {
    const target = request.nextUrl.clone();
    target.pathname = "/analyze";
    target.search = "";
    return withSecurityHeaders(NextResponse.redirect(target));
  }

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
