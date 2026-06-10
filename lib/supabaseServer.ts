export type ServerAccount = {
  email: string;
  name?: string;
  plan: string;
  role: string;
  trusted?: boolean;
  authUserId?: string | null;
  userId?: string | null;
  stripeCustomerId?: string | null;
};

import { NextRequest } from "next/server";
import { normalizePlan, normalizeRole } from "@/lib/account";

type SupabaseRow = Record<string, unknown>;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

export function hasSupabaseServiceEnv() {
  return isSupabaseConfigured();
}

function tableUrl(table: string, query = "") {
  if (!SUPABASE_URL) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  const base = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}`;
  return query ? `${base}?${query}` : base;
}

function headers(prefer?: string) {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  const nextHeaders: Record<string, string> = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
  if (prefer) nextHeaders.Prefer = prefer;
  return nextHeaders;
}

export async function supabaseSelect<T = SupabaseRow>(table: string, query = "select=*") {
  if (!isSupabaseConfigured()) return [];
  const response = await fetch(tableUrl(table, query), {
    method: "GET",
    headers: headers(),
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    console.error(`[Supabase] select ${table} failed`, response.status, message);
    return [];
  }

  return (await response.json()) as T[];
}

export async function supabaseInsert<T = SupabaseRow>(table: string, rows: SupabaseRow | SupabaseRow[]) {
  if (!isSupabaseConfigured()) return null;
  const response = await fetch(tableUrl(table), {
    method: "POST",
    headers: headers("return=representation"),
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    console.error(`[Supabase] insert ${table} failed`, response.status, message);
    return null;
  }

  const data = (await response.json()) as T[];
  return data[0] ?? null;
}

export async function supabaseUpsert<T = SupabaseRow>(table: string, rows: SupabaseRow | SupabaseRow[], conflict = "email") {
  if (!isSupabaseConfigured()) return null;
  const response = await fetch(tableUrl(table, `on_conflict=${encodeURIComponent(conflict)}`), {
    method: "POST",
    headers: headers("resolution=merge-duplicates,return=representation"),
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    console.error(`[Supabase] upsert ${table} failed`, response.status, message);
    return null;
  }

  const data = (await response.json()) as T[];
  return data[0] ?? null;
}


function supabaseHeaders(): Record<string, string> {
  const key = SUPABASE_SERVICE_ROLE_KEY || "";

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };
}

export async function supabaseUpdate<T = SupabaseRow>(
  table: string,
  query: string,
  rows: SupabaseRow
) {
  if (!isSupabaseConfigured()) return null;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: supabaseHeaders(),
    body: JSON.stringify(rows),
    cache: "no-store"
  });

  if (!response.ok) {
    console.error(`Supabase update failed for ${table}:`, await response.text());
    return null;
  }

  return (await response.json().catch(() => null)) as T | null;
}

export async function supabaseCount(table: string, query = "select=*") {
  if (!isSupabaseConfigured()) return 0;
  const response = await fetch(tableUrl(table, query), {
    method: "GET",
    headers: {
      ...headers(),
      Prefer: "count=exact"
    },
    cache: "no-store"
  });

  if (!response.ok) return 0;
  const range = response.headers.get("content-range");
  const total = range?.split("/")?.[1];
  return total && total !== "*" ? Number(total) : 0;
}

export function accountFromRequest(request: NextRequest | Request) {
  const headers = request.headers;

  const email =
    headers.get("x-reviewintel-email") ||
    headers.get("x-reviewintel-user") ||
    headers.get("x-user-email") ||
    headers.get("x-customer-email") ||
    "";

  const plan = normalizePlan(headers.get("x-reviewintel-plan"));
  const role = normalizeRole(headers.get("x-reviewintel-role") || (plan.includes("seller") ? "seller" : "buyer"));
  const name = headers.get("x-reviewintel-name") || "";

  if (!email || email === "guest") return null;

  return {
    email,
    name,
    plan,
    role,
    trusted: false
  };
}

export async function accountFromAccessToken(accessToken?: string | null) {
  if (!accessToken || !isSupabaseConfigured()) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY || "",
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  }).catch(() => null);

  if (!response?.ok) return null;
  const user = await response.json().catch(() => null);
  return accountFromAuthUser(user);
}

type SupabaseAuthLikeUser = {
  id?: string | null;
  email?: string | null;
  user_metadata?: {
    name?: string | null;
    plan?: string | null;
    role?: string | null;
  } | null;
  user?: {
    id?: string | null;
    email?: string | null;
    user_metadata?: {
      name?: string | null;
      plan?: string | null;
      role?: string | null;
    } | null;
  } | null;
};

export function accountFromAuthUser(user: unknown) {
  const authUser = user as SupabaseAuthLikeUser | null;
  const nestedUser = authUser?.user ?? null;
  const metadata = authUser?.user_metadata ?? nestedUser?.user_metadata ?? null;
  const email = authUser?.email ?? nestedUser?.email ?? "";

  if (!email) return null;

  return {
    email,
    name: metadata?.name ?? "",
    plan: metadata?.plan ?? "free_buyer",
    role: metadata?.role ?? "buyer",
    trusted: true,
    authUserId: authUser?.id ?? nestedUser?.id ?? null
  };
}

export async function readPersistentQuota(emailOrAccount?: string | { email?: string; plan?: string } | null) {
  const email = typeof emailOrAccount === "string" ? emailOrAccount : emailOrAccount?.email;
  const plan = typeof emailOrAccount === "string" ? "free_buyer" : emailOrAccount?.plan ?? "free_buyer";

  // Only Shopper Free / guest-style usage should use the 3-scan daily quota.
  // Paid shopper, seller, and admin flows should not be limited here.
  if (plan !== "free_buyer") {
    return {
      used: 0,
      remaining: null,
      limit: null,
      resetAt: null
    };
  }

  if (!email || !isSupabaseConfigured()) return null;

  const today = new Date().toISOString().slice(0, 10);
  const rows = await supabaseSelect(
    "usage_events",
    `select=*&profile_email=eq.${encodeURIComponent(email)}&created_at=gte.${today}T00:00:00.000Z`
  );

  return {
    used: rows.length,
    remaining: Math.max(0, 3 - rows.length),
    limit: 3,
    resetAt: `${today}T23:59:59.999Z`
  };
}

export async function consumePersistentQuota(emailOrAccount?: string | { email?: string; plan?: string } | null, metadata: SupabaseRow = {}) {
  const email = typeof emailOrAccount === "string" ? emailOrAccount : emailOrAccount?.email;
  const plan = typeof emailOrAccount === "string" ? "free_buyer" : emailOrAccount?.plan ?? "free_buyer";

  // Paid accounts should not consume the Shopper Free 3-scan quota.
  if (plan !== "free_buyer") {
    return {
      ok: true,
      mode: "supabase",
      quota: {
        used: 0,
        remaining: null,
        limit: null,
        resetAt: null
      }
    };
  }

  if (!email || !isSupabaseConfigured()) {
    return {
      ok: true,
      mode: "local",
      quota: null
    };
  }

  const row = await supabaseInsert("usage_events", {
    profile_email: email,
    event_type: "analysis",
    plan: typeof emailOrAccount === "string" ? null : emailOrAccount?.plan ?? null,
    estimated_cost: Number(metadata.estimated_cost ?? metadata.estimatedCost ?? 0),
    metadata,
    created_at: new Date().toISOString()
  });

  return {
    ok: true,
    mode: "supabase",
    row,
    quota: await readPersistentQuota(email)
  };
}

export async function rollbackPersistentQuota(eventIdOrRow?: string | { id?: string } | null) {
  // Safe no-op for beta. We are not deleting usage rows automatically yet.
  return {
    ok: true,
    rolledBack: false,
    id: typeof eventIdOrRow === "string" ? eventIdOrRow : eventIdOrRow?.id ?? null
  };
}

export async function saveAnalysisRecord(input: SupabaseRow) {
  if (!isSupabaseConfigured()) return null;

  const account = input.account && typeof input.account === "object" ? (input.account as SupabaseRow) : null;
  const analysis = input.analysis && typeof input.analysis === "object" ? (input.analysis as SupabaseRow) : null;

  const profileEmail =
    input.profile_email ??
    input.email ??
    account?.email ??
    "unknown@reviewintel.local";

  return supabaseInsert("analyses", {
    profile_email: profileEmail,
    mode: input.mode ?? input.audience ?? "buyer",
    product_name: input.product_name ?? input.productName ?? null,
    platform: input.platform ?? "other",
    product_score: input.product_score ?? input.productScore ?? analysis?.product_score ?? null,
    recommendation: input.recommendation ?? analysis?.buyer_recommendation ?? null,
    summary: input.summary ?? input.overall_summary ?? analysis?.overall_summary ?? null,
    analysis_json: input.analysis_json ?? input.analysis ?? input,
    created_at: new Date().toISOString()
  });
}

export async function adminUsageSummary() {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      profiles: 0,
      analyses: 0,
      usageEvents: 0,
      estimatedCost: 0
    };
  }

  const profiles = await supabaseCount("profiles");
  const analyses = await supabaseCount("analyses");
  const usageEvents = await supabaseCount("usage_events");

  return {
    configured: true,
    profiles,
    analyses,
    usageEvents,
    estimatedCost: 0
  };
}

export async function upsertSubscriptionByStripeCustomer(input: SupabaseRow) {
  if (!isSupabaseConfigured()) return null;

  const email = String(input.profile_email ?? input.email ?? input.customer_email ?? "").trim();

  if (email) {
    await supabaseUpsert("profiles", {
      email,
      plan: input.plan ?? (input.metadata as Record<string, unknown> | undefined)?.["plan"] ?? "free_buyer",
      updated_at: new Date().toISOString()
    });
  }

  return supabaseInsert("payments", {
    profile_email: email || null,
    stripe_customer_id: input.stripe_customer_id ?? input.customer ?? null,
    stripe_payment_id: input.stripe_payment_id ?? input.subscription ?? input.id ?? null,
    plan: input.plan ?? (input.metadata as Record<string, unknown> | undefined)?.["plan"] ?? null,
    amount: input.amount ?? input.amount_total ?? null,
    currency: input.currency ?? "CAD",
    status: input.status ?? "active",
    created_at: new Date().toISOString()
  });
}

export async function recordBillingEvent(input: SupabaseRow) {
  if (!isSupabaseConfigured()) return null;

  return supabaseInsert("payments", {
    profile_email: input.profile_email ?? input.email ?? null,
    stripe_customer_id: input.stripe_customer_id ?? input.customer ?? null,
    stripe_payment_id: input.stripe_payment_id ?? input.payment_intent ?? input.id ?? null,
    plan: input.plan ?? (input.metadata as Record<string, unknown> | undefined)?.["plan"] ?? null,
    amount: input.amount ?? input.amount_total ?? null,
    currency: input.currency ?? "CAD",
    status: input.status ?? input.type ?? "recorded",
    created_at: new Date().toISOString()
  });
}

export async function supabaseFetch(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not configured.");
  }

  const baseUrl = SUPABASE_URL.replace(/\/$/, "");
  const endpoint = path.startsWith("http") ? path : `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  return fetch(endpoint, {
    ...init,
    headers: {
      ...supabaseHeaders(),
      ...(init.headers ?? {}),
    },
  });
}
