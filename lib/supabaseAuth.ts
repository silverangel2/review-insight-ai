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

export function googleAuthUrl() {
  if (!hasSupabaseEnv()) return null;

  const baseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const redirectTo = encodeURIComponent(`${getPublicAppUrl()}/dashboard`);
  return `${baseUrl}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
}
