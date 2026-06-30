function getSupabaseRest() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase service credentials");
  }

  return {
    url: url.replace(/\/$/, ""),
    serviceKey,
  };
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  const { url, serviceKey } = getSupabaseRest();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const response = await fetch(`${url}/rest/v1${normalizedPath}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message)
        : `Supabase request failed: ${response.status}`
    );
  }

  return data;
}

const TIKTOK_AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

export function getTikTokOAuthConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY || "";
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || "";
  const redirectUri =
    process.env.TIKTOK_REDIRECT_URI || "https://getreviewintel.com/api/auth/tiktok/callback";

  return {
    clientKey,
    clientSecret,
    redirectUri,
  };
}

export function getTikTokScopes() {
  // video.upload = upload to TikTok inbox/draft flow.
  // user.info.basic = lets us verify which TikTok account connected.
  return ["user.info.basic", "video.upload"];
}

export function getTikTokAuthUrl(state: string) {
  const config = getTikTokOAuthConfig();

  if (!config.clientKey || !config.redirectUri) {
    throw new Error("Missing TikTok OAuth configuration");
  }

  const url = new URL(TIKTOK_AUTH_BASE);
  url.searchParams.set("client_key", config.clientKey);
  url.searchParams.set("scope", getTikTokScopes().join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);

  return url.toString();
}

export async function exchangeTikTokCodeForToken(code: string) {
  const config = getTikTokOAuthConfig();

  if (!config.clientKey || !config.clientSecret || !config.redirectUri) {
    throw new Error("Missing TikTok OAuth configuration");
  }

  const body = new URLSearchParams();
  body.set("client_key", config.clientKey);
  body.set("client_secret", config.clientSecret);
  body.set("code", code);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", config.redirectUri);

  const response = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(data?.error_description || data?.message || "TikTok token exchange failed");
  }

  return data as {
    access_token: string;
    refresh_token?: string;
    open_id?: string;
    scope?: string;
    token_type?: string;
    expires_in?: number;
    refresh_expires_in?: number;
  };
}

export async function getTikTokUserInfo(accessToken: string) {
  const url = new URL(`${TIKTOK_API_BASE}/user/info/`);
  url.searchParams.set("fields", "open_id,union_id,avatar_url,display_name");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || data?.error?.code !== "ok") {
    throw new Error(data?.error?.message || "Failed to fetch TikTok user info");
  }

  return data?.data?.user as {
    open_id?: string;
    union_id?: string;
    avatar_url?: string;
    display_name?: string;
  };
}

export async function storeTikTokConnection(input: {
  openId: string;
  accountName: string;
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}) {
  const expiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
    : null;

  await supabaseFetch("/social_connections?on_conflict=provider", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      provider: "tiktok",
      account_id: input.openId,
      account_name: input.accountName,
      access_token: input.accessToken,
      refresh_token: input.refreshToken || null,
      token_type: input.tokenType || "bearer",
      expires_at: expiresAt,
      scopes: input.scopes || getTikTokScopes(),
      metadata: input.metadata || {},
      is_connected: true,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function getStoredTikTokConnection() {
  try {
    const rows = await supabaseFetch(
      "/social_connections?provider=eq.tiktok&is_connected=eq.true&select=access_token,refresh_token,account_id,account_name,expires_at,scopes,metadata&limit=1",
      { method: "GET" }
    );

    const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown>) : null;
    if (!row?.["access_token"]) return null;

    return {
      accessToken: row["access_token"] as string,
      refreshToken: row["refresh_token"] as string | null,
      openId: row["account_id"] as string | null,
      accountName: row["account_name"] as string | null,
      expiresAt: row["expires_at"] as string | null,
      scopes: row["scopes"] as string[] | null,
      metadata: row["metadata"] as Record<string, unknown> | null,
    };
  } catch {
    return null;
  }
}

export async function disconnectTikTokConnection() {
  await supabaseFetch("/social_connections?provider=eq.tiktok", {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      is_connected: false,
      access_token: null,
      refresh_token: null,
      updated_at: new Date().toISOString(),
    }),
  });
}
