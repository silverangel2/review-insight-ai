import { adminSessionFromRequest } from "@/lib/adminAccess";
import {
  FREE_DAILY_REVIEW_LIMIT,
  GUEST_TOTAL_REVIEW_LIMIT,
  hasUnlimitedUsage,
  isSellerPlan,
  makeQuotaInfo,
  normalizePlan,
  normalizeRole
} from "@/lib/account";
import { hasSupabaseEnv } from "@/lib/env";
import type {
  AnalysisAudience,
  QuotaInfo,
  ReviewAnalysis,
  ReviewIngestionMode,
  ReviewPlatform,
  SubscriptionPlan,
  UploadedReviewImage,
  UserRole
} from "@/lib/types";

type SupabaseAuthUser = {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    role?: string;
  };
  email_confirmed_at?: string | null;
};

export type ServerAccount = {
  userId: string | null;
  authUserId: string | null;
  email: string;
  name: string;
  role: UserRole;
  plan: SubscriptionPlan;
  stripeCustomerId: string | null;
  subscriptionStatus: string;
  accessToken?: string;
  trusted: boolean;
};

export type UsageGate = {
  allowed: boolean;
  quota: QuotaInfo;
  consumed: boolean;
  usageId?: string;
};

type PublicUserRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
};

type ProfileRow = {
  full_name: string | null;
  role: UserRole;
};

type SubscriptionRow = {
  plan: SubscriptionPlan;
  status: string;
  stripe_customer_id: string | null;
};

type UsageRow = {
  id: string;
  analysis_count: number;
};

export type AdminCustomerRow = {
  id: string;
  email: string;
  plan: string;
  role: string;
  signupDate: string;
  lastLogin: string;
  marketingConsent: boolean;
};

type RestOptions = {
  method?: string;
  body?: unknown;
  prefer?: string;
  accessToken?: string;
  serviceRole?: boolean;
};

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
}

function anonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function hasSupabaseServiceEnv() {
  return Boolean(supabaseUrl() && anonKey() && serviceRoleKey());
}

function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

async function supabaseRest<T>(path: string, options: RestOptions = {}): Promise<T> {
  if (!supabaseUrl()) throw new Error("Supabase URL is not configured.");

  const key = options.serviceRole === false ? anonKey() : serviceRoleKey();
  if (!key) throw new Error(options.serviceRole === false ? "Supabase anon key is not configured." : "Supabase service role key is not configured.");

  const headers: Record<string, string> = {
    apikey: options.serviceRole === false ? anonKey() : key,
    Authorization: `Bearer ${options.accessToken ?? key}`,
    "Content-Type": "application/json"
  };

  if (options.prefer) headers.Prefer = options.prefer;

  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${message}`);
  }

  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

async function getAuthUser(accessToken: string): Promise<SupabaseAuthUser | null> {
  if (!hasSupabaseEnv() || !accessToken) return null;

  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: anonKey(),
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) return null;
  return (await response.json()) as SupabaseAuthUser;
}

async function getPublicUserByAuthId(authUserId: string) {
  const rows = await supabaseRest<PublicUserRow[]>(
    `users?auth_user_id=eq.${encodeURIComponent(authUserId)}&select=id,auth_user_id,email&limit=1`
  );
  return rows[0] ?? null;
}

async function upsertPublicUser(authUser: SupabaseAuthUser) {
  const existing = await getPublicUserByAuthId(authUser.id);
  if (existing) return existing;

  const inserted = await supabaseRest<PublicUserRow[]>("users?on_conflict=auth_user_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      auth_user_id: authUser.id,
      email: authUser.email ?? `${authUser.id}@reviewintel.local`
    }
  });

  return firstRow(inserted);
}

async function ensureProfile(userId: string, authUser: SupabaseAuthUser, fallbackRole?: UserRole) {
  const existing = await supabaseRest<ProfileRow[]>(
    `profiles?user_id=eq.${encodeURIComponent(userId)}&select=full_name,role&limit=1`
  );

  if (existing[0]) return existing[0];

  const normalizedAuthRole = authUser.user_metadata?.role ? normalizeRole(authUser.user_metadata.role) : null;
  const role = normalizedAuthRole === "seller" || normalizedAuthRole === "buyer" ? normalizedAuthRole : fallbackRole ?? "buyer";
  const fullName = authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? authUser.email?.split("@")[0] ?? "ReviewIntel user";

  const inserted = await supabaseRest<ProfileRow[]>("profiles?on_conflict=user_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      user_id: userId,
      full_name: fullName,
      role,
      email_verified: Boolean(authUser.email_confirmed_at)
    }
  });

  await supabaseRest("settings?on_conflict=user_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: {
      user_id: userId,
      default_role: role
    }
  }).catch(() => null);

  return firstRow(inserted) ?? { full_name: fullName, role };
}

async function getSubscription(userId: string): Promise<SubscriptionRow> {
  const rows = await supabaseRest<SubscriptionRow[]>(
    `subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=plan,status,stripe_customer_id&order=created_at.desc&limit=1`
  );

  if (rows[0]) return rows[0];

  const inserted = await supabaseRest<SubscriptionRow[]>("subscriptions", {
    method: "POST",
    prefer: "return=representation",
    body: {
      user_id: userId,
      plan: "free_buyer",
      status: "active"
    }
  });

  return firstRow(inserted) ?? { plan: "free_buyer", status: "active", stripe_customer_id: null };
}

export async function accountFromAuthUser(authUser: SupabaseAuthUser, accessToken?: string): Promise<ServerAccount | null> {
  if (!authUser || !hasSupabaseServiceEnv()) return null;

  const publicUser = await upsertPublicUser(authUser);
  if (!publicUser) return null;

  const profile = await ensureProfile(publicUser.id, authUser);
  const subscription = await getSubscription(publicUser.id);
  const paidActive = subscription.status === "active" || subscription.status === "trialing";
  const plan = profile.role === "admin" ? "seller_pro" : paidActive ? normalizePlan(subscription.plan) : "free_buyer";

  return {
    userId: publicUser.id,
    authUserId: authUser.id,
    email: authUser.email ?? publicUser.email,
    name: profile.full_name ?? authUser.email?.split("@")[0] ?? "ReviewIntel user",
    role: profile.role,
    plan,
    stripeCustomerId: subscription.stripe_customer_id,
    subscriptionStatus: subscription.status,
    accessToken,
    trusted: true
  };
}

export async function accountFromAccessToken(accessToken: string): Promise<ServerAccount | null> {
  const authUser = await getAuthUser(accessToken);
  if (!authUser) return null;
  return accountFromAuthUser(authUser, accessToken);
}

export async function accountFromRequest(request: Request): Promise<ServerAccount> {
  const headerEmail = request.headers.get("x-reviewintel-user")?.trim().toLowerCase() || "guest";
  const requestedPlan = normalizePlan(request.headers.get("x-reviewintel-plan"));
  const requestedRole = normalizeRole(request.headers.get("x-reviewintel-role"));
  const hasExplicitAccountHeader =
    request.headers.has("x-reviewintel-user") ||
    request.headers.has("x-reviewintel-plan") ||
    request.headers.has("x-reviewintel-role");

  const allowLocalPlan =
    !hasSupabaseServiceEnv() ||
    headerEmail.endsWith("@reviewintel.test") ||
    headerEmail.endsWith("@reviewintel.local");

  function localHeaderAccount(): ServerAccount {
    const fallbackPlan = allowLocalPlan ? requestedPlan : "free_buyer";
    let fallbackRole: UserRole = requestedRole === "admin" ? "guest" : requestedRole;

    if (headerEmail !== "guest") {
      if (fallbackRole === "guest") fallbackRole = isSellerPlan(fallbackPlan) ? "seller" : "buyer";
      if (isSellerPlan(fallbackPlan)) fallbackRole = "seller";
      if (!isSellerPlan(fallbackPlan) && fallbackRole === "seller" && !allowLocalPlan) fallbackRole = "buyer";
    }

    return {
      userId: null,
      authUserId: null,
      email: headerEmail,
      name: headerEmail === "guest" ? "Guest" : headerEmail.split("@")[0] || "ReviewIntel user",
      role: fallbackRole,
      plan: fallbackPlan,
      stripeCustomerId: null,
      subscriptionStatus: "active",
      trusted: false
    };
  }

  // Important: QA/customer-mode headers must win over an existing admin cookie.
  // Otherwise the header/top badge and API routes stay stuck as Admin/Seller Pro
  // after testing the admin dashboard.
  if (hasExplicitAccountHeader && headerEmail !== "guest" && allowLocalPlan) {
    return localHeaderAccount();
  }

  const adminSession = adminSessionFromRequest(request);
  if (adminSession) {
    return {
      userId: null,
      authUserId: null,
      email: adminSession.email,
      name: "ReviewIntel Operator",
      role: "admin",
      plan: "seller_pro",
      stripeCustomerId: null,
      subscriptionStatus: "developer",
      trusted: true
    };
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const token = bearer || request.headers.get("x-reviewintel-access-token")?.trim() || "";
  const account = token ? await accountFromAccessToken(token) : null;
  if (account) return account;

  return localHeaderAccount();
}

function utcDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function anonymousKey(account: ServerAccount, request: Request) {
  if (account.email && account.email !== "guest") return account.email;
  return request.headers.get("x-reviewintel-guest-id")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "guest";
}

function usageDayForAccount(account: ServerAccount) {
  return account.role === "guest" ? "1970-01-01" : utcDayKey();
}

function usageFilter(account: ServerAccount, request: Request, day = usageDayForAccount(account)) {
  if (account.userId) {
    return {
      select: `user_id=eq.${encodeURIComponent(account.userId)}&usage_date=eq.${day}`,
      body: { user_id: account.userId, usage_date: day }
    };
  }

  const key = anonymousKey(account, request);
  return {
    select: `anonymous_key=eq.${encodeURIComponent(key)}&usage_date=eq.${day}`,
    body: { anonymous_key: key, usage_date: day }
  };
}

export async function readPersistentQuota(account: ServerAccount, request: Request): Promise<QuotaInfo> {
  if (hasUnlimitedUsage(account.role, account.plan)) return makeQuotaInfo(account.plan, 0);
  if (!hasSupabaseServiceEnv()) return makeQuotaInfo(account.plan, 0);

  const identity = usageFilter(account, request);
  const rows = await supabaseRest<UsageRow[]>(`usage_tracking?${identity.select}&select=id,analysis_count&limit=1`);
  return makeQuotaInfo(account.plan, rows[0]?.analysis_count ?? 0);
}

export async function consumePersistentQuota(account: ServerAccount, request: Request, screenshotCount: number): Promise<UsageGate | null> {
  if (hasUnlimitedUsage(account.role, account.plan)) {
    return {
      allowed: true,
      quota: makeQuotaInfo(account.plan, 0),
      consumed: false
    };
  }

  if (!hasSupabaseServiceEnv()) return null;

  const identity = usageFilter(account, request);
  const rows = await supabaseRest<UsageRow[]>(`usage_tracking?${identity.select}&select=id,analysis_count&limit=1`);
  const existing = rows[0];
  const used = existing?.analysis_count ?? 0;

  const limit = account.role === "guest" ? GUEST_TOTAL_REVIEW_LIMIT : FREE_DAILY_REVIEW_LIMIT;
  if (account.plan === "free_buyer" && used >= limit) {
    return {
      allowed: false,
      quota: makeQuotaInfo(account.plan, used),
      consumed: false,
      usageId: existing?.id
    };
  }

  const nextUsed = used + 1;
  if (existing) {
    await supabaseRest(`usage_tracking?id=eq.${encodeURIComponent(existing.id)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        analysis_count: nextUsed,
        screenshot_count: screenshotCount,
        updated_at: new Date().toISOString()
      }
    });
  } else {
    const inserted = await supabaseRest<UsageRow[]>("usage_tracking", {
      method: "POST",
      prefer: "return=representation",
      body: {
        ...identity.body,
        analysis_count: nextUsed,
        screenshot_count: screenshotCount
      }
    });

    return {
      allowed: true,
      quota: makeQuotaInfo(account.plan, nextUsed),
      consumed: true,
      usageId: firstRow(inserted)?.id
    };
  }

  return {
    allowed: true,
    quota: makeQuotaInfo(account.plan, nextUsed),
    consumed: true,
    usageId: existing.id
  };
}

export async function rollbackPersistentQuota(usageId: string | undefined) {
  if (!hasSupabaseServiceEnv() || !usageId) return;

  const rows = await supabaseRest<UsageRow[]>(`usage_tracking?id=eq.${encodeURIComponent(usageId)}&select=id,analysis_count&limit=1`);
  const row = rows[0];
  if (!row) return;

  await supabaseRest(`usage_tracking?id=eq.${encodeURIComponent(row.id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: {
      analysis_count: Math.max(0, row.analysis_count - 1),
      updated_at: new Date().toISOString()
    }
  });
}

function sourceType(reviews: string, imageCount: number, sectionCount: number) {
  if (reviews && imageCount > 0) return "manual_upload";
  if (imageCount > 0) return "screenshot_upload";
  if (sectionCount > 1 || reviews.length > 5000) return "bulk_text_upload";
  return "manual_paste";
}

function safeImagePath(analysisId: string, image: UploadedReviewImage, index: number) {
  const cleanName = image.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || `screenshot-${index + 1}.png`;
  return `${analysisId}/${Date.now()}-${index + 1}-${cleanName}`;
}

export async function saveAnalysisRecord({
  account,
  productName,
  productUrl,
  platform,
  audience,
  reviews,
  images,
  analysis,
  model,
  mode,
  reviewCountEstimate,
  sectionCount,
  ingestionMode
}: {
  account: ServerAccount;
  productName?: string;
  productUrl?: string;
  platform: ReviewPlatform;
  audience: AnalysisAudience;
  reviews: string;
  images: UploadedReviewImage[];
  analysis: ReviewAnalysis;
  model: string;
  mode: "openai" | "local-fallback";
  reviewCountEstimate: number;
  sectionCount: number;
  ingestionMode: ReviewIngestionMode;
}) {
  if (!hasSupabaseServiceEnv()) return null;

  const inserted = await supabaseRest<Array<{ id: string }>>("review_analyses", {
    method: "POST",
    prefer: "return=representation",
    body: {
      user_id: account.userId,
      product_name: productName?.trim() || null,
      product_url: productUrl?.trim() || null,
      platform,
      audience,
      source_type: sourceType(reviews, images.length, sectionCount),
      source_metadata: {
        ingestion_mode: ingestionMode,
        review_section_count: sectionCount,
        image_aggregation_ready: images.length > 1
      },
      review_text: reviews || null,
      review_count_estimate: reviewCountEstimate,
      image_count: images.length,
      model,
      mode,
      overall_summary: analysis.overall_summary,
      buyer_recommendation: analysis.buyer_recommendation,
      seller_insights: analysis.seller_insights,
      positive_points: analysis.positive_points,
      negative_points: analysis.negative_points,
      common_complaints: analysis.common_complaints,
      praised_features: analysis.praised_features,
      quality_concerns: analysis.quality_concerns,
      improvement_suggestions: analysis.improvement_suggestions,
      fake_review_indicators: analysis.fake_review_indicators,
      packaging_issues: analysis.packaging_issues,
      durability_issues: analysis.durability_issues,
      support_issues: analysis.support_issues,
      keyword_analysis: analysis.keyword_analysis,
      sentiment_score: analysis.sentiment_score,
      confidence_score: analysis.confidence_score,
      product_score: analysis.product_score
    }
  });

  const analysisId = firstRow(inserted)?.id;
  if (!analysisId || images.length === 0) return analysisId ?? null;

  await supabaseRest("uploaded_images", {
    method: "POST",
    prefer: "return=minimal",
    body: images.map((image, index) => ({
      user_id: account.userId,
      analysis_id: analysisId,
      storage_path: safeImagePath(analysisId, image, index),
      file_name: image.name,
      mime_type: image.type,
      file_size: image.size,
      display_order: index
    }))
  });

  return analysisId;
}


export type AdminUsageSummary = {
  source: "supabase" | "local";
  totalScans: number;
  shopperScans: number;
  sellerScans: number;
  openAiScans: number;
  localFallbackScans: number;
  estimatedAiCostUsd: number;
  costPerOpenAiScanUsd: number;
  sampleSize: number;
  note: string;
};

export async function adminUsageSummary(limit = 500): Promise<AdminUsageSummary> {
  const costPerOpenAiScanUsd = Number(process.env.REVIEWINTEL_ESTIMATED_AI_COST_PER_SCAN_USD ?? "0.03");

  if (!hasSupabaseServiceEnv()) {
    return {
      source: "local",
      totalScans: 0,
      shopperScans: 0,
      sellerScans: 0,
      openAiScans: 0,
      localFallbackScans: 0,
      estimatedAiCostUsd: 0,
      costPerOpenAiScanUsd,
      sampleSize: 0,
      note: "Supabase service role is not configured. Live admin usage will start after the database is connected."
    };
  }

  const rows = await supabaseRest<Array<{
    id: string;
    audience: AnalysisAudience | null;
    mode: "openai" | "local-fallback" | null;
    model: string | null;
    review_count_estimate: number | null;
    created_at: string;
  }>>(
    `review_analyses?select=id,audience,mode,model,review_count_estimate,created_at&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 1000))}`
  );

  const totalScans = rows.length;
  const sellerScans = rows.filter((row) => row.audience === "seller" || row.audience === "both").length;
  const shopperScans = rows.filter((row) => row.audience === "buyer").length;
  const openAiScans = rows.filter((row) => row.mode === "openai").length;
  const localFallbackScans = rows.filter((row) => row.mode === "local-fallback").length;

  return {
    source: "supabase",
    totalScans,
    shopperScans,
    sellerScans,
    openAiScans,
    localFallbackScans,
    estimatedAiCostUsd: Number((openAiScans * costPerOpenAiScanUsd).toFixed(4)),
    costPerOpenAiScanUsd,
    sampleSize: totalScans,
    note: totalScans >= limit ? `Showing latest ${limit} scans.` : "Showing all scans returned by Supabase."
  };
}


export async function recentAnalyses(account: ServerAccount, limit = 8) {
  if (!hasSupabaseServiceEnv() || !account.userId) return [];

  return supabaseRest<Array<{
    id: string;
    product_name: string | null;
    platform: ReviewPlatform;
    overall_summary: string;
    product_score: number;
    created_at: string;
  }>>(
    `review_analyses?user_id=eq.${encodeURIComponent(account.userId)}&select=id,product_name,platform,overall_summary,product_score,created_at&order=created_at.desc&limit=${limit}`
  );
}

function firstEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function adminCustomerRows(limit = 100): Promise<AdminCustomerRow[]> {
  if (!hasSupabaseServiceEnv()) return [];

  type EmbeddedUser = {
    id: string;
    email: string;
    created_at: string;
    profiles?: Array<{ role: string | null }> | { role: string | null } | null;
    subscriptions?: Array<{ plan: string | null; status: string | null; created_at: string | null }> | { plan: string | null; status: string | null; created_at: string | null } | null;
    settings?: Array<{ marketing_emails: boolean | null }> | { marketing_emails: boolean | null } | null;
    review_analyses?: Array<{ created_at: string | null }> | null;
  };

  const rows = await supabaseRest<EmbeddedUser[]>(
    `users?select=id,email,created_at,profiles(role),subscriptions(plan,status,created_at),settings(marketing_emails),review_analyses(created_at)&order=created_at.desc&limit=${limit}`
  );

  return rows.map((row) => {
    const profile = firstEmbedded(row.profiles);
    const subscription = firstEmbedded(row.subscriptions);
    const settings = firstEmbedded(row.settings);
    const analyses = Array.isArray(row.review_analyses) ? row.review_analyses : [];
    const lastAnalysis = analyses
      .map((analysis) => analysis.created_at)
      .filter((date): date is string => Boolean(date))
      .sort()
      .at(-1);

    return {
      id: row.id,
      email: row.email,
      role: profile?.role ?? "buyer",
      plan: subscription?.plan ?? "free_buyer",
      signupDate: row.created_at,
      lastLogin: lastAnalysis ?? subscription?.created_at ?? row.created_at,
      marketingConsent: Boolean(settings?.marketing_emails)
    };
  });
}

export async function upsertSubscriptionByStripeCustomer({
  customerId,
  subscriptionId,
  priceId,
  plan,
  status,
  currentPeriodStart,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  userId
}: {
  customerId: string;
  subscriptionId?: string | null;
  priceId?: string | null;
  plan: SubscriptionPlan;
  status: string;
  currentPeriodStart?: number | null;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  userId?: string | null;
}) {
  if (!hasSupabaseServiceEnv()) return;

  let resolvedUserId = userId ?? null;
  if (!resolvedUserId && customerId) {
    const existing = await supabaseRest<Array<{ user_id: string }>>(
      `subscriptions?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=user_id&limit=1`
    );
    resolvedUserId = existing[0]?.user_id ?? null;
  }

  if (!resolvedUserId) return;

  await supabaseRest("subscriptions?on_conflict=stripe_subscription_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      user_id: resolvedUserId,
      plan,
      status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      current_period_start: currentPeriodStart ? new Date(currentPeriodStart * 1000).toISOString() : null,
      current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      cancel_at_period_end: Boolean(cancelAtPeriodEnd),
      updated_at: new Date().toISOString()
    }
  });
}

export async function recordBillingEvent(event: {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
}) {
  if (!hasSupabaseServiceEnv() || !event.id) return;

  const object = event.data?.object ?? {};
  const customerId = typeof object.customer === "string" ? object.customer : null;
  let userId: string | null = null;

  if (customerId) {
    const rows = await supabaseRest<Array<{ user_id: string }>>(
      `subscriptions?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=user_id&limit=1`
    );
    userId = rows[0]?.user_id ?? null;
  }

  await supabaseRest("billing_history?on_conflict=stripe_event_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      user_id: userId,
      stripe_event_id: event.id,
      stripe_invoice_id: typeof object.id === "string" ? object.id : null,
      amount_paid: typeof object.amount_paid === "number" ? object.amount_paid : null,
      currency: typeof object.currency === "string" ? object.currency : "usd",
      status: typeof object.status === "string" ? object.status : null,
      event_type: event.type,
      raw_event: event
    }
  });
}
