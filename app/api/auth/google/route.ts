import { NextResponse } from "next/server";
import { getRuntimeAppSettings } from "@/lib/appSettings";
import { rateLimitRequest } from "@/lib/security";
import { createGoogleOAuthSession } from "@/lib/supabaseAuth";

const OAUTH_VERIFIER_COOKIE = "reviewintel_oauth_verifier";
const OAUTH_MODE_COOKIE = "reviewintel_oauth_mode";
const OAUTH_MARKETING_COOKIE = "reviewintel_oauth_marketing";
const OAUTH_ROLE_COOKIE = "reviewintel_oauth_role";
const OAUTH_STATE_COOKIE = "reviewintel_oauth_state";

export async function GET(request: Request) {
  const limit = await rateLimitRequest(request, {
    key: "auth_google",
    limit: 12,
    windowMs: 10 * 60 * 1000,
    eventType: "google_auth_rate_limited"
  });

  if (!limit.allowed) {
    return limit.response ?? NextResponse.json({ error: "Too many Google sign-in attempts." }, { status: 429 });
  }

  const appSettings = await getRuntimeAppSettings();

  if (appSettings.maintenance_mode) {
    return NextResponse.json({ error: appSettings.announcement_text || "ReviewIntel is temporarily updating. Please check back shortly." }, { status: 503 });
  }
  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");

  const appUrl =
    forwardedProto && forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : requestUrl.origin;

  const intent = requestUrl.searchParams.get("intent") === "signup" ? "signup" : "login";
  const termsAccepted = requestUrl.searchParams.get("termsAccepted") === "true";
  const marketingConsent = requestUrl.searchParams.get("marketingConsent") === "true";
  const role = intent === "signup" && requestUrl.searchParams.get("role") === "seller" ? "seller" : "buyer";

  if (intent === "signup" && !termsAccepted) {
    return NextResponse.json(
      { error: "Please accept the Terms of Service and Privacy Policy before creating an account with Google." },
      { status: 400 }
    );
  }

  if (intent === "signup" && !appSettings.allow_new_signups) {
    return NextResponse.json({ error: "New signups are temporarily closed." }, { status: 503 });
  }

  const callbackUrl = new URL("/auth/callback", appUrl);
  callbackUrl.searchParams.set("intent", intent);
  callbackUrl.searchParams.set("marketingConsent", marketingConsent ? "true" : "false");
  callbackUrl.searchParams.set("role", role);

  const oauth = createGoogleOAuthSession(appUrl, callbackUrl.toString());
  if (!oauth) {
    return NextResponse.json(
      { error: "Google login needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY configured." },
      { status: 503 }
    );
  }

  const response = NextResponse.json({ url: oauth.url });
  const cookieOptions = {
    httpOnly: true,
    maxAge: 60 * 5,
    path: "/",
    sameSite: "lax" as const,
    secure: appUrl.startsWith("https://")
  };

  response.cookies.set(OAUTH_VERIFIER_COOKIE, oauth.codeVerifier, cookieOptions);
  response.cookies.set(OAUTH_MODE_COOKIE, intent, cookieOptions);
  response.cookies.set(OAUTH_MARKETING_COOKIE, marketingConsent ? "true" : "false", cookieOptions);
  response.cookies.set(OAUTH_ROLE_COOKIE, role, cookieOptions);
  response.cookies.set(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });

  return response;
}
