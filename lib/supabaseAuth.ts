import { createHash, randomBytes } from "crypto";
import { getPublicAppUrl, hasSupabaseEnv, requireEnv } from "@/lib/env";
import { accountFromAccessToken, accountFromAuthUser } from "@/lib/supabaseServer";

type AuthPayload = {
  email: string;
  password?: string;
  name?: string;
  role?: string;
};

type SupabaseAuthResponse = {
  access_token?: string;
  refresh_token?: string;
  user?: {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
      role?: string;
    };
    email_confirmed_at?: string | null;
  };
};

function base64Url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createCodeVerifier() {
  return base64Url(randomBytes(48));
}

function createCodeChallenge(codeVerifier: string) {
  return base64Url(createHash("sha256").update(codeVerifier).digest());
}


function supabaseHeaders() {
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json"
  };
}

async function supabaseAuthRequest(path: string, payload: Record<string, unknown>) {
  const baseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/auth/v1/${path}`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.msg || data.error || "Supabase Auth request failed.");
  }

  return data as SupabaseAuthResponse;
}

export async function signUpWithSupabase(payload: AuthPayload) {
  if (!hasSupabaseEnv()) return { mode: "local-development", message: "Supabase Auth is not configured; local development signup accepted." };

  const result = await supabaseAuthRequest("signup", {
    email: payload.email,
    password: payload.password,
    data: {
      full_name: payload.name,
      role: payload.role
    },
    gotrue_meta_security: {},
    redirect_to: `${getPublicAppUrl()}/auth/verify-email`
  });

  const account = result.access_token
    ? await accountFromAccessToken(result.access_token)
    : result.user
      ? await accountFromAuthUser(result.user)
      : null;

  return { ...result, account };
}

export async function loginWithSupabase(payload: AuthPayload) {
  if (!hasSupabaseEnv()) return { mode: "local-development", message: "Supabase Auth is not configured; local development login accepted." };

  const result = await supabaseAuthRequest("token?grant_type=password", {
    email: payload.email,
    password: payload.password
  });

  const account = result.access_token ? await accountFromAccessToken(result.access_token) : null;
  return { ...result, account };
}

export async function resetPasswordWithSupabase(email: string) {
  if (!hasSupabaseEnv()) return { mode: "local-development", message: "Supabase Auth is not configured; local development reset accepted." };

  return supabaseAuthRequest("recover", {
    email,
    redirect_to: `${getPublicAppUrl()}/auth/reset-password`
  });
}

export async function updatePasswordWithSupabase(accessToken: string, password: string) {
  if (!hasSupabaseEnv()) {
    return { mode: "local-development", message: "Supabase Auth is not configured; local development password update accepted." };
  }

  const baseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.msg || data.error || "Password update failed.");
  }

  return data;
}

export async function accountFromOAuthAccessToken(accessToken: string) {
  if (!hasSupabaseEnv()) return null;

  const baseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: {
      apikey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  }).catch(() => null);

  if (!response?.ok) return null;
  const user = await response.json().catch(() => null);
  const account = accountFromAuthUser(user);
  return account ? { ...account, accessToken } : null;
}

export async function accountFromOAuthCode(authCode: string, codeVerifier: string, redirectTo?: string) {
  void redirectTo;

  if (!hasSupabaseEnv()) return null;

  if (!authCode || !codeVerifier) {
    throw new Error("Google sign in expired. Please start Google login again.");
  }

  const result = await supabaseAuthRequest("token?grant_type=pkce", {
    auth_code: authCode,
    code_verifier: codeVerifier
  });

  const account = result.access_token
    ? await accountFromOAuthAccessToken(result.access_token)
    : result.user
      ? accountFromAuthUser(result.user)
      : null;

  return account ? { ...account, accessToken: result.access_token } : null;
}

export function createGoogleOAuthSession(appUrl = getPublicAppUrl(), redirectTo?: string) {
  if (!hasSupabaseEnv()) return null;

  const baseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const codeVerifier = createCodeVerifier();
  const redirectUrl = redirectTo || `${appUrl.replace(/\/$/, "")}/auth/callback`;

  const params = new URLSearchParams({
    provider: "google",
    redirect_to: redirectUrl,
    response_type: "code",
    code_challenge: createCodeChallenge(codeVerifier),
    code_challenge_method: "S256"
  });

  return {
    url: `${baseUrl}/auth/v1/authorize?${params.toString()}`,
    codeVerifier,
    redirectTo: redirectUrl,
    state: ""
  };
}

export function googleAuthUrl(appUrl = getPublicAppUrl()) {
  if (!hasSupabaseEnv()) return null;

  const baseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: `${appUrl.replace(/\/$/, "")}/auth/callback`,
    response_type: "token"
  });

  return `${baseUrl}/auth/v1/authorize?${params.toString()}`;
}
