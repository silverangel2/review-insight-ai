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
import { normalizePlan, normalizeRole, roleForPlan } from "@/lib/account";

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

export async function supabaseDelete(table: string, query: string) {
  if (!isSupabaseConfigured()) return false;
  const response = await fetch(tableUrl(table, query), {
    method: "DELETE",
    headers: headers("return=minimal"),
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    console.error(`[Supabase] delete ${table} failed`, response.status, message);
    return false;
  }

  return true;
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
  const userId = headers.get("x-reviewintel-profile-id") || headers.get("x-reviewintel-auth-user-id") || null;
  const authUserId = headers.get("x-reviewintel-auth-user-id") || null;
  const stripeCustomerId = headers.get("x-reviewintel-stripe-customer") || null;

  if (!email || email === "guest") return null;

  return {
    email,
    name,
    plan,
    role,
    userId,
    authUserId,
    stripeCustomerId,
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



function normalizeProfileEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

function dayStart(date = new Date()) {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function monthStart(date = new Date()) {
  const next = new Date(date);
  next.setUTCDate(1);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function dailyFreeQuota(used: number, resetAt: Date | null = null) {
  const todayStart = dayStart();
  return {
    used,
    remaining: Math.max(0, 3 - used),
    limit: 3,
    resetAt: resetAt?.toISOString() ?? `${todayStart.toISOString().slice(0, 10)}T23:59:59.999Z`
  };
}

function latestDate(...values: Array<string | null | undefined>) {
  let latest: Date | null = null;

  for (const value of values) {
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    if (!latest || date > latest) latest = date;
  }

  return latest;
}

function compactText(value: unknown, fallback: string | null = null) {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

async function readQuotaResetAt(email?: string | null, plan = "free_buyer") {
  if (!email || !isSupabaseConfigured()) return null;
  void plan;

  const variants = Array.from(
    new Set([
      String(email).trim(),
      String(email).trim().toLowerCase()
    ].filter(Boolean))
  );

  let latest: string | null = null;

  for (const candidate of variants) {
    const query = [
      `profile_email=eq.${encodeURIComponent(candidate)}`,
      "event_type=eq.quota_reset",
      "select=created_at",
      "order=created_at.desc",
      "limit=1"
    ].join("&");

    const response = await fetch(tableUrl("usage_events", query), {
      headers: headers(),
      cache: "no-store"
    });

    if (!response.ok) continue;

    const rows = await response.json().catch(() => []);
    const value = Array.isArray(rows) ? rows[0]?.created_at : null;

    if (typeof value === "string" && value) {
      if (!latest || new Date(value) > new Date(latest)) {
        latest = value;
      }
    }
  }

  return latest;
}

async function readProfileQuotaResetRow(email: string) {
  const response = await fetch(
    tableUrl(
      "profiles",
      [
        "select=quota_reset_at,daily_scan_count,last_scan_at,updated_at",
        `email=eq.${encodeURIComponent(email)}`,
        "limit=1"
      ].join("&")
    ),
    {
      headers: headers(),
      cache: "no-store"
    }
  ).catch(() => null);

  if (!response?.ok) return null;
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function readProfileQuotaResetAt(email?: string | null) {
  const normalizedEmail = normalizeProfileEmail(email);
  if (!normalizedEmail || !isSupabaseConfigured()) return null;

  const profileWithReset = await readProfileQuotaResetRow(normalizedEmail);

  if (profileWithReset) {
    const profile = profileWithReset as {
      quota_reset_at?: string | null;
      daily_scan_count?: number | null;
      last_scan_at?: string | null;
      updated_at?: string | null;
    };
    const legacyResetAt =
      Number(profile.daily_scan_count ?? 0) === 0 &&
      !profile.last_scan_at &&
      typeof profile.updated_at === "string" &&
      profile.updated_at
        ? profile.updated_at
        : null;

    return latestDate(profile.quota_reset_at, legacyResetAt)?.toISOString() ?? null;
  }

  const rows = await supabaseSelect<{
    daily_scan_count?: number | null;
    last_scan_at?: string | null;
    updated_at?: string | null;
  }>(
    "profiles",
    [
      "select=daily_scan_count,last_scan_at,updated_at",
      `email=eq.${encodeURIComponent(normalizedEmail)}`,
      "limit=1"
    ].join("&")
  );

  const profile = rows[0];
  if (!profile) return null;

  const wasReset =
    Number(profile.daily_scan_count ?? 0) === 0 &&
    !profile.last_scan_at &&
    typeof profile.updated_at === "string" &&
    profile.updated_at;

  return wasReset ? profile.updated_at || null : null;
}

async function writeProfileQuotaResetAt(email: string, resetAt: string) {
  if (!email || !isSupabaseConfigured()) return false;

  const response = await fetch(tableUrl("profiles", `email=eq.${encodeURIComponent(email)}`), {
    method: "PATCH",
    headers: headers("return=minimal"),
    body: JSON.stringify({
      quota_reset_at: resetAt,
      quota_reset_reason: "admin_reset"
    }),
    cache: "no-store"
  }).catch(() => null);

  return Boolean(response?.ok);
}


export async function readPersistentQuota(emailOrAccount?: string | { email?: string; plan?: string } | null) {
  const rawEmail = typeof emailOrAccount === "string" ? emailOrAccount : emailOrAccount?.email;
  const plan = normalizePlan(typeof emailOrAccount === "string" ? "free_buyer" : emailOrAccount?.plan ?? "free_buyer");
  const email = normalizeProfileEmail(rawEmail);

  if (plan !== "free_buyer") {
    return {
      used: 0,
      remaining: null,
      limit: null,
      resetAt: null
    };
  }

  if (!email || !isSupabaseConfigured()) {
    return {
      used: 0,
      remaining: 3,
      limit: 3,
      resetAt: null
    };
  }

  const todayStart = dayStart();

  const latestResetAt = latestDate(
    await readQuotaResetAt(email, plan),
    await readProfileQuotaResetAt(email)
  );
  const countFrom =
    latestResetAt && latestResetAt > todayStart
      ? latestResetAt
      : todayStart;

  const rows = await supabaseSelect(
    "usage_events",
    [
      "select=*",
      `profile_email=eq.${encodeURIComponent(email)}`,
      "event_type=eq.analysis",
      `created_at=gte.${encodeURIComponent(countFrom.toISOString())}`
    ].join("&")
  );

  return dailyFreeQuota(rows.length);
}


export async function consumePersistentQuota(emailOrAccount?: string | { email?: string; plan?: string } | null, metadata: SupabaseRow = {}) {
  const rawEmail = typeof emailOrAccount === "string" ? emailOrAccount : emailOrAccount?.email;
  const email = normalizeProfileEmail(rawEmail);
  const plan = normalizePlan(typeof emailOrAccount === "string" ? "free_buyer" : emailOrAccount?.plan ?? "free_buyer");

  if (!email || !isSupabaseConfigured()) {
    return {
      ok: true,
      mode: "local",
      quota: null
    };
  }

  const now = new Date().toISOString();
  const row = await supabaseInsert("usage_events", {
    profile_email: email,
    event_type: "analysis",
    plan,
    estimated_cost: Number(metadata.estimated_cost ?? metadata.estimatedCost ?? 0),
    metadata,
    created_at: now
  });
  const usage = await scanUsageForEmail(email, plan);

  await supabaseUpsert("profiles", {
    email,
    plan,
    daily_scan_count: usage.dailyScanCount,
    monthly_scan_count: usage.monthlyScanCount,
    last_scan_at: usage.lastScanAt || now,
    updated_at: now
  }).catch(() => null);

  return {
    ok: true,
    mode: "supabase",
    row,
    quota: plan === "free_buyer" ? await readPersistentQuota({ email, plan }) : {
      used: 0,
      remaining: null,
      limit: null,
      resetAt: null
    }
  };
}


export async function resetPersistentQuota(emailOrAccount?: string | { email?: string; plan?: string } | null) {
  const email = normalizeProfileEmail(typeof emailOrAccount === "string" ? emailOrAccount : emailOrAccount?.email);
  const plan = normalizePlan(typeof emailOrAccount === "string" ? "free_buyer" : emailOrAccount?.plan ?? "free_buyer");

  if (!email || !isSupabaseConfigured()) {
    return {
      ok: true,
      mode: "local",
      quota: null
    };
  }

  const now = new Date();
  const todayStart = dayStart(now);
  const query = [
    `profile_email=eq.${encodeURIComponent(email)}`,
    "event_type=eq.analysis",
    `created_at=gte.${encodeURIComponent(todayStart.toISOString())}`
  ].join("&");

  const deleted = await supabaseDelete("usage_events", query);

  const resetEvent = await supabaseInsert("usage_events", {
    profile_email: email,
    event_type: "quota_reset",
    plan,
    metadata: { reset_scope: "daily", reset_by: "admin", unlock_free_scans: true },
    created_at: now.toISOString()
  }).catch(() => null);

  const resetProfile = await supabaseUpsert("profiles", {
    email,
    plan,
    daily_scan_count: 0,
    monthly_scan_count: 0,
    last_scan_at: null,
    updated_at: now.toISOString()
  }).catch(() => null);
  const profileResetMarker = await writeProfileQuotaResetAt(email, now.toISOString());

  const quota =
    plan === "free_buyer"
      ? dailyFreeQuota(0)
      : {
          used: 0,
          remaining: null,
          limit: null,
          resetAt: null
        };

  if (!deleted && !resetEvent && !resetProfile && !profileResetMarker) {
    return {
      ok: false,
      mode: "supabase",
      quota: await readPersistentQuota({ email, plan })
    };
  }

  return {
    ok: true,
    mode: "supabase",
    quota
  };
}

export async function scanUsageForEmail(emailInput?: string | null, plan = "free_buyer") {
  const email = normalizeProfileEmail(emailInput);
  const normalizedPlan = normalizePlan(plan);

  if (!email || !isSupabaseConfigured()) {
    return {
      dailyScanCount: 0,
      monthlyScanCount: 0,
      totalScanCount: 0,
      lastScanAt: ""
    };
  }

  const todayStart = dayStart();
  const monthStartAt = monthStart();
  const latestResetAt = latestDate(
    await readQuotaResetAt(email, normalizedPlan),
    await readProfileQuotaResetAt(email)
  );
  const countDailyFrom =
    latestResetAt && latestResetAt > todayStart
      ? latestResetAt
      : todayStart;

  const rows = await supabaseSelect(
    "usage_events",
    [
      "select=id,created_at,event_type",
      `profile_email=eq.${encodeURIComponent(email)}`,
      "event_type=eq.analysis",
      `created_at=gte.${encodeURIComponent(monthStartAt.toISOString())}`,
      "order=created_at.desc"
    ].join("&")
  );

  const monthlyRows = Array.isArray(rows) ? rows : [];
  const dailyScanCount = monthlyRows.filter((row) => {
    const createdAt = new Date(String(row.created_at || ""));
    return !Number.isNaN(createdAt.getTime()) && createdAt >= countDailyFrom;
  }).length;

  return {
    dailyScanCount,
    monthlyScanCount: monthlyRows.length,
    totalScanCount: monthlyRows.length,
    lastScanAt: typeof monthlyRows[0]?.created_at === "string" ? monthlyRows[0].created_at : ""
  };
}

export async function deleteAnalysisHistory(input: { email?: string | null; id?: string | null; all?: boolean }) {
  const email = normalizeProfileEmail(input.email);
  const id = String(input.id || "").trim();

  if (!email || !isSupabaseConfigured()) {
    return { ok: false, deleted: false };
  }

  const emailQuery = `profile_email=eq.${encodeURIComponent(email)}`;
  const analysisQuery = input.all
    ? emailQuery
    : [emailQuery, `id=eq.${encodeURIComponent(id)}`].join("&");

  const usageQuery = input.all
    ? [emailQuery, "event_type=eq.analysis"].join("&")
    : [
        emailQuery,
        "event_type=eq.analysis",
        `${encodeURIComponent("metadata->>analysis_id")}=eq.${encodeURIComponent(id)}`
      ].join("&");

  const analysesDeleted = input.all || id ? await supabaseDelete("analyses", analysisQuery) : false;
  const usageDeleted = input.all || id ? await supabaseDelete("usage_events", usageQuery) : false;

  const usage = await scanUsageForEmail(email);

  await supabaseUpsert("profiles", {
    email,
    daily_scan_count: usage.dailyScanCount,
    monthly_scan_count: usage.monthlyScanCount,
    last_scan_at: usage.lastScanAt || null,
    updated_at: new Date().toISOString()
  });

  return {
    ok: analysesDeleted || usageDeleted,
    analysesDeleted,
    usageDeleted,
    usage
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
    product_name: compactText(input.product_name ?? input.productName),
    platform: compactText(input.platform, "other"),
    product_score: input.product_score ?? input.productScore ?? analysis?.product_score ?? null,
    recommendation: compactText(input.recommendation ?? analysis?.buyer_recommendation),
    summary: compactText(input.summary ?? input.overall_summary ?? analysis?.overall_summary),
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
  const profileId = String(input.userId ?? input.user_id ?? input.profile_id ?? "").trim();
  const rawPlan = normalizePlan(String(input.plan ?? (input.metadata as Record<string, unknown> | undefined)?.["plan"] ?? "free_buyer"));
  const subscriptionStatus = String(input.status ?? "active");
  const inactive = !["active", "trialing"].includes(subscriptionStatus);
  const plan = inactive ? "free_buyer" : rawPlan;
  const role = rawPlan === "seller_premium" || rawPlan === "seller_pro" ? "seller" : roleForPlan(plan);
  const stripeCustomerId = input.stripe_customer_id ?? input.customer ?? input.customerId ?? null;

  if (email) {
    await supabaseUpsert("profiles", {
      email,
      plan,
      role,
      subscription_status: subscriptionStatus,
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString()
    });
  } else if (profileId) {
    await supabaseUpdate("profiles", `id=eq.${encodeURIComponent(profileId)}`, {
      plan,
      role,
      subscription_status: subscriptionStatus,
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString()
    });
  }

  return supabaseInsert("payments", {
    profile_email: email || null,
    stripe_customer_id: stripeCustomerId,
    stripe_payment_id: input.stripe_payment_id ?? input.subscription ?? input.id ?? null,
    plan: rawPlan,
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
