import { NextResponse } from "next/server";
import { setAccountSessionCookie } from "@/lib/accountSession";
import { normalizePlan, normalizeRole } from "@/lib/account";
import { accountFromOAuthAccessToken, accountFromOAuthCode } from "@/lib/supabaseAuth";
import { supabaseFetch, supabaseUpsert } from "@/lib/supabaseServer";

const OAUTH_VERIFIER_COOKIE = "reviewintel_oauth_verifier";
const OAUTH_MODE_COOKIE = "reviewintel_oauth_mode";
const OAUTH_MARKETING_COOKIE = "reviewintel_oauth_marketing";
const OAUTH_ROLE_COOKIE = "reviewintel_oauth_role";
const OAUTH_STATE_COOKIE = "reviewintel_oauth_state";

function readCookie(cookieHeader: string, name: string) {
  const match = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));

  if (!match) return "";

  return decodeURIComponent(match.slice(name.length + 1));
}

function jsonWithClearedOAuthCookies(body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status });

  response.cookies.set(OAUTH_VERIFIER_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(OAUTH_MODE_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(OAUTH_MARKETING_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(OAUTH_ROLE_COOKIE, "", { maxAge: 0, path: "/" });

  return response;
}

async function readProfileByFilter(column: "email" | "auth_user_id", value: string) {
  if (!value) return null;

  try {
    const response = await supabaseFetch(
      `/rest/v1/profiles?select=*&${column}=eq.${encodeURIComponent(value)}&limit=1`,
      { cache: "no-store" }
    );

    if (!response.ok) return null;

    const rows = await response.json().catch(() => []);

    return Array.isArray(rows) && rows[0] && typeof rows[0] === "object"
      ? (rows[0] as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function readExistingReviewIntelProfile(account: Record<string, unknown>, email: string) {
  const authUserId = String(
    account.authUserId ??
    account.auth_user_id ??
    account.userId ??
    account.id ??
    ""
  ).trim();

  const byAuthId = authUserId
    ? await readProfileByFilter("auth_user_id", authUserId)
    : null;

  if (byAuthId) return byAuthId;

  return readProfileByFilter("email", email);
}

function valueAsString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const origin =
    forwardedProto && forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : requestUrl.origin;

  const cookieHeader = request.headers.get("cookie") || "";
  const intent =
    readCookie(cookieHeader, OAUTH_MODE_COOKIE) === "signup" || body?.intent === "signup"
      ? "signup"
      : "login";
  const marketingConsentFromBody =
    readCookie(cookieHeader, OAUTH_MARKETING_COOKIE) === "true" || body?.marketingConsent === true;
  const requestedRole =
    intent === "signup" && (readCookie(cookieHeader, OAUTH_ROLE_COOKIE) === "seller" || body?.role === "seller")
      ? "seller"
      : "buyer";
  const requestedPlan = "free_buyer";
  const requestedSubscriptionStatus = requestedRole === "seller" ? "pending_payment" : "free";
  const accessToken = String(body?.accessToken || "").trim();
  const authCode = String(body?.code || "").trim();

  if (!accessToken && !authCode) {
    return jsonWithClearedOAuthCookies({ error: "Google login did not return a usable session token." }, 400);
  }

  let account = null;

  try {
    if (accessToken) {
      account = await accountFromOAuthAccessToken(accessToken);
    } else {
        const codeVerifier = readCookie(cookieHeader, OAUTH_VERIFIER_COOKIE);

      if (!codeVerifier) {
        return jsonWithClearedOAuthCookies({ error: "Google sign in expired. Please start Google login again." }, 400);
      }

      const callbackUrl = new URL("/auth/callback", origin);
      callbackUrl.searchParams.set("intent", intent);
      callbackUrl.searchParams.set("marketingConsent", marketingConsentFromBody ? "true" : "false");

      account = await accountFromOAuthCode(authCode, codeVerifier, callbackUrl.toString());
    }
  } catch (error) {
    return jsonWithClearedOAuthCookies(
      { error: error instanceof Error ? error.message : "Google sign in could not be completed." },
      401
    );
  }

  if (!account?.email) {
    return jsonWithClearedOAuthCookies({ error: "Could not read the Google account from Supabase Auth." }, 401);
  }

  const oauthAccount = account as Record<string, unknown>;
  const normalizedEmail = account.email.trim().toLowerCase();
  const existingProfile = await readExistingReviewIntelProfile(oauthAccount, normalizedEmail);

  if (intent === "signup" && existingProfile) {
    return jsonWithClearedOAuthCookies(
      {
        error: "An account with this Google email already exists. Please log in instead.",
        code: "account_exists"
      },
      409
    );
  }

  if (intent === "login" && !existingProfile) {
    return jsonWithClearedOAuthCookies(
      {
        error: "No ReviewIntel account exists for this Google email yet. Choose Sign up with Google and accept the Terms first.",
        code: "account_not_found"
      },
      404
    );
  }

  const authUserId = valueAsString(
    oauthAccount.authUserId ??
    oauthAccount.auth_user_id ??
    oauthAccount.userId ??
    oauthAccount.id
  );

  const fallbackName =
    valueAsString(oauthAccount.name) ||
    normalizedEmail.split("@")[0] ||
    "ReviewIntel user";

  let profile =
    existingProfile ??
    await supabaseUpsert("profiles", {
      email: normalizedEmail,
      auth_user_id: authUserId || null,
      name: fallbackName,
      role: requestedRole,
      plan: requestedPlan,
      subscription_status: requestedSubscriptionStatus,
      marketing_consent: marketingConsentFromBody,
      terms_accepted: intent === "signup",
      email_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login: new Date().toISOString()
    });

  if (existingProfile) {
    const updatedProfile = await supabaseUpsert("profiles", {
      email: normalizedEmail,
      auth_user_id: authUserId || null,
      marketing_consent: Boolean(existingProfile.marketing_consent ?? marketingConsentFromBody),
      terms_accepted: Boolean(existingProfile.terms_accepted ?? (intent === "signup")),
      email_verified: true,
      updated_at: new Date().toISOString(),
      last_login: new Date().toISOString()
    });

    if (updatedProfile) profile = updatedProfile;
  }

  const role = normalizeRole(
    valueAsString(profile?.role) ||
    valueAsString(oauthAccount.role) ||
    "buyer"
  );

  const plan = normalizePlan(
    valueAsString(profile?.plan) ||
    valueAsString(oauthAccount.plan) ||
    requestedPlan
  );

  const finalRole = role === "guest" ? "buyer" : role;
  const finalName =
    valueAsString(profile?.name) ||
    valueAsString(oauthAccount.name) ||
    fallbackName;

  const profileId = valueAsString(profile?.id) || valueAsString(oauthAccount.profileId);
  const finalUserId =
    profileId ||
    authUserId ||
    valueAsString(oauthAccount.userId) ||
    valueAsString(oauthAccount.id) ||
    normalizedEmail;

  const finalAccount = {
    ...account,
    userId: finalUserId,
    authUserId: authUserId || finalUserId,
    profileId,
    email: normalizedEmail,
    role: finalRole,
    plan,
    name: finalName,
    createdAt:
      valueAsString(profile?.created_at) ||
      valueAsString(oauthAccount.createdAt) ||
      new Date().toISOString(),
    subscriptionStatus:
      valueAsString(profile?.subscription_status) ||
      (plan === "free_buyer" ? requestedSubscriptionStatus : "active"),
    marketingConsent: Boolean(profile?.marketing_consent)
  };
  const response = jsonWithClearedOAuthCookies({ ok: true, account: finalAccount });
  setAccountSessionCookie(response, finalAccount);
  return response;
}
