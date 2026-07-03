function getSupabaseRest() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

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
const DEFAULT_TIKTOK_REDIRECT_URI = "https://getreviewintel.com/api/auth/tiktok/callback";
const DEFAULT_TIKTOK_SCOPES = ["user.info.basic", "video.upload"];

function cleanTikTokRedirectUri(value?: string | null) {
  const redirectUri = String(value || "").trim();

  if (!redirectUri) return DEFAULT_TIKTOK_REDIRECT_URI;
  if (redirectUri.includes("localhost") || redirectUri.includes("127.0.0.1")) {
    return DEFAULT_TIKTOK_REDIRECT_URI;
  }

  return redirectUri;
}

export function getTikTokOAuthConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY || "";
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || "";
  const redirectUri = cleanTikTokRedirectUri(process.env.TIKTOK_REDIRECT_URI);

  return {
    clientKey,
    clientSecret,
    redirectUri,
  };
}

function cleanScopeList(value?: string | null) {
  const scopes = String(value || "")
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  return Array.from(new Set(scopes.length ? scopes : DEFAULT_TIKTOK_SCOPES));
}

export function getTikTokScopes() {
  // video.upload is approval-safe for the TikTok review flow.
  // video.publish is required after TikTok approves Direct Post / full automatic posting.
  return cleanScopeList(process.env.TIKTOK_OAUTH_SCOPES || process.env.TIKTOK_SCOPES);
}

export function getTikTokOAuthHealth() {
  const config = getTikTokOAuthConfig();
  const scopes = getTikTokScopes();

  return {
    clientKeyConfigured: Boolean(config.clientKey),
    clientSecretConfigured: Boolean(config.clientSecret),
    redirectUri: config.redirectUri,
    scopes,
    directPostRequested: scopes.includes("video.publish"),
    draftUploadRequested: scopes.includes("video.upload"),
    approvalSafe:
      scopes.includes("user.info.basic") &&
      scopes.includes("video.upload") &&
      !scopes.includes("video.publish"),
  };
}

export function getTikTokAuthUrl(state: string) {
  const config = getTikTokOAuthConfig();

  if (!config.clientKey) {
    throw new Error("Missing TIKTOK_CLIENT_KEY. Add it in Vercel before connecting TikTok.");
  }

  if (!config.redirectUri) {
    throw new Error("Missing TikTok redirect URI.");
  }

  const url = new URL(TIKTOK_AUTH_BASE);
  const params = new URLSearchParams({
    client_key: config.clientKey,
    scope: getTikTokScopes().join(","),
    response_type: "code",
    redirect_uri: config.redirectUri,
    state,
  });

  return `${url.origin}${url.pathname}?${params.toString()}`;
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

export async function refreshTikTokAccessToken(refreshToken: string) {
  const config = getTikTokOAuthConfig();

  if (!config.clientKey || !config.clientSecret) {
    throw new Error("Missing TikTok OAuth configuration");
  }

  const body = new URLSearchParams();
  body.set("client_key", config.clientKey);
  body.set("client_secret", config.clientSecret);
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);

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
    throw new Error(data?.error_description || data?.message || "TikTok token refresh failed");
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

async function updateTikTokConnectionTokens(input: {
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string | null;
  expiresIn?: number | null;
  scopes?: string[] | null;
  metadata?: Record<string, unknown> | null;
}) {
  const expiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
    : null;

  await supabaseFetch("/social_connections?provider=eq.tiktok", {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      access_token: input.accessToken,
      refresh_token: input.refreshToken || undefined,
      token_type: input.tokenType || "bearer",
      expires_at: expiresAt,
      scopes: input.scopes || undefined,
      metadata: input.metadata || undefined,
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

function tokenExpiresSoon(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const expires = new Date(expiresAt).getTime();
  if (!Number.isFinite(expires)) return true;
  return expires - Date.now() < 10 * 60 * 1000;
}

export async function getTikTokAccessTokenForPosting() {
  const stored = await getStoredTikTokConnection();

  if (stored?.accessToken && !tokenExpiresSoon(stored.expiresAt)) {
    return {
      accessToken: stored.accessToken,
      source: "connected-tiktok-oauth",
      accountName: stored.accountName || "TikTok",
      openId: stored.openId || "",
      scopes: stored.scopes || [],
      expiresAt: stored.expiresAt || null,
    };
  }

  if (stored?.refreshToken) {
    try {
      const refreshed = await refreshTikTokAccessToken(stored.refreshToken);
      const scopes = refreshed.scope ? refreshed.scope.split(",") : stored.scopes || getTikTokScopes();

      await updateTikTokConnectionTokens({
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token || stored.refreshToken,
        tokenType: refreshed.token_type,
        expiresIn: refreshed.expires_in,
        scopes,
        metadata: {
          ...(stored.metadata || {}),
          refreshed_at: new Date().toISOString(),
        },
      });

      return {
        accessToken: refreshed.access_token,
        source: "connected-tiktok-oauth-refreshed",
        accountName: stored.accountName || "TikTok",
        openId: refreshed.open_id || stored.openId || "",
        scopes,
        expiresAt: refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
          : null,
      };
    } catch {
      // Env fallback below keeps diagnostics clear if the stored OAuth token cannot refresh.
    }
  }

  const envAccessToken =
    process.env.TIKTOK_ACCESS_TOKEN ||
    process.env.TIKTOK_USER_ACCESS_TOKEN ||
    process.env.TIKTOK_PAGE_ACCESS_TOKEN ||
    "";

  if (envAccessToken) {
    return {
      accessToken: envAccessToken,
      source: "env-fallback",
      accountName: "TikTok env token",
      openId: "",
      scopes: [],
      expiresAt: null,
    };
  }

  return {
    accessToken: "",
    source: "missing",
    accountName: "",
    openId: "",
    scopes: [],
    expiresAt: null,
  };
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
