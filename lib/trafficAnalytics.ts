import crypto from "crypto";
import { readAccountSession } from "@/lib/accountSession";
import { isSupabaseConfigured, supabaseCount, supabaseInsert, supabaseSelect } from "@/lib/supabaseServer";

type TrafficEventType = "page_view" | "affiliate_impression" | "affiliate_click" | "pricing_click" | "signup_intent" | "upsell_view" | "upsell_click" | "upsell_dismiss" | "checkout_start" | "sign_in" | "sign_up";

/** Events only the server may record (sign-ins and signups); the public beacon cannot fake them. */
const SERVER_ONLY_EVENTS = new Set<string>(["sign_in", "sign_up"]);

type TrafficEventBody = {
  eventType?: string;
  event_type?: string;
  path?: string;
  url?: string;
  title?: string;
  referrer?: string;
  visitorId?: string;
  visitor_key?: string;
  consentChoice?: string;
  consent_choice?: string;
  metadata?: Record<string, unknown>;
};

type TrafficRow = {
  event_type?: string | null;
  path?: string | null;
  url?: string | null;
  title?: string | null;
  referrer?: string | null;
  referrer_host?: string | null;
  visitor_key?: string | null;
  account_role?: string | null;
  account_plan?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  device_type?: string | null;
  platform?: string | null;
  browser?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

const allowedEvents = new Set<TrafficEventType>([
  "page_view",
  "affiliate_impression",
  "affiliate_click",
  "pricing_click",
  "signup_intent",
  "upsell_view",
  "upsell_click",
  "upsell_dismiss",
  "checkout_start",
  "sign_in",
  "sign_up",
]);

/** Do Not Track / Global Privacy Control: when either is on, nothing is recorded. */
export function requestOptsOut(request: Request) {
  return request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1";
}

function referrerWithoutQuery(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, 800);
  } catch {
    return "";
  }
}

function cleanText(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function decodeHeader(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hostFromUrl(url: string) {
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function parseUrl(value?: string | null) {
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    try {
      return new URL(value, "https://getreviewintel.com");
    } catch {
      return null;
    }
  }
}

function headerValue(request: Request, ...names: string[]) {
  for (const name of names) {
    const value = request.headers.get(name);
    if (value) return value;
  }

  return null;
}

function clientIp(request: Request) {
  const forwarded = headerValue(request, "x-forwarded-for", "x-real-ip", "cf-connecting-ip");
  return forwarded?.split(",")[0]?.trim() || "";
}

function hashVisitor(value: string) {
  if (!value) return null;

  const salt =
    process.env.TRAFFIC_HASH_SALT ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "reviewintel-traffic";

  return crypto.createHmac("sha256", salt).update(value).digest("hex");
}

function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const deviceType = /ipad|tablet/.test(ua)
    ? "tablet"
    : /mobile|iphone|android/.test(ua)
      ? "mobile"
      : "desktop";

  const platform = /iphone|ipad|ios/.test(ua)
    ? "iOS"
    : /android/.test(ua)
      ? "Android"
      : /windows/.test(ua)
        ? "Windows"
        : /mac os|macintosh/.test(ua)
          ? "macOS"
          : /linux/.test(ua)
            ? "Linux"
            : "Unknown";

  const browser = /edg\//.test(ua)
    ? "Edge"
    : /tiktok/.test(ua)
      ? "TikTok"
      : /instagram/.test(ua)
        ? "Instagram"
        : /fban|fbav|facebook/.test(ua)
          ? "Facebook"
          : /firefox/.test(ua)
            ? "Firefox"
            : /chrome|crios/.test(ua)
              ? "Chrome"
              : /safari/.test(ua)
                ? "Safari"
                : "Unknown";

  return { deviceType, platform, browser };
}

function geoFromHeaders(request: Request) {
  return {
    country: headerValue(request, "x-vercel-ip-country", "cf-ipcountry"),
    region: decodeHeader(headerValue(request, "x-vercel-ip-country-region")),
    city: decodeHeader(headerValue(request, "x-vercel-ip-city")),
  };
}

function numberOrZero(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function increment(map: Map<string, number>, key?: string | null) {
  const normalized = cleanText(key || "Unknown", 120) || "Unknown";
  map.set(normalized, (map.get(normalized) || 0) + 1);
}

function topItems(map: Map<string, number>, limit = 8) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function recordTrafficEvent(request: Request, rawBody: TrafficEventBody, options: { server?: boolean } = {}) {
  const eventType = cleanText(rawBody.eventType || rawBody.event_type || "page_view", 40) as TrafficEventType;
  if (!allowedEvents.has(eventType) || (SERVER_ONLY_EVENTS.has(eventType) && !options.server)) {
    return { ok: false, error: "Unsupported traffic event." };
  }

  if (requestOptsOut(request)) {
    return { ok: true, skipped: true, reason: "do-not-track" };
  }

  if (!isSupabaseConfigured()) {
    return { ok: false, source: "local", message: "Supabase is not configured." };
  }

  const parsedUrl = parseUrl(rawBody.url || rawBody.path || "");
  const path = cleanText(
    rawBody.path || `${parsedUrl?.pathname || "/"}${parsedUrl?.search || ""}`,
    600
  );

  if (path.startsWith("/admin") || path.startsWith("/api") || path.startsWith("/owner-access")) {
    return { ok: true, skipped: true };
  }

  // Only origin + path of the referrer is kept (no query strings that might carry personal data).
  const referrer = referrerWithoutQuery(cleanText(rawBody.referrer, 800));
  const userAgent = cleanText(request.headers.get("user-agent"), 1000);
  const { country, region, city } = geoFromHeaders(request);
  const { deviceType, platform, browser } = parseUserAgent(userAgent);
  const session = readAccountSession(request);
  const visitorId = cleanText(rawBody.visitorId || rawBody.visitor_key, 160);
  const visitorKey = hashVisitor(
    visitorId
      ? `visitor:${visitorId}`
      : `network:${clientIp(request)}:${userAgent.slice(0, 180)}`
  );
  const metadata = rawBody.metadata && typeof rawBody.metadata === "object" ? rawBody.metadata : {};

  const row = await supabaseInsert("site_traffic_events", {
    event_type: eventType,
    path,
    url: cleanText(rawBody.url || parsedUrl?.toString() || "", 800),
    title: cleanText(rawBody.title, 240),
    referrer,
    referrer_host: hostFromUrl(referrer),
    visitor_key: visitorKey,
    account_role: session?.role || null,
    account_plan: session?.plan || null,
    country,
    region,
    city,
    device_type: deviceType,
    platform,
    browser,
    // Raw user agent and IP are never stored: only the parsed device/platform/browser and a salted hash.
    user_agent: null,
    utm_source: cleanText(parsedUrl?.searchParams.get("utm_source"), 120),
    utm_medium: cleanText(parsedUrl?.searchParams.get("utm_medium"), 120),
    utm_campaign: cleanText(parsedUrl?.searchParams.get("utm_campaign"), 160),
    utm_content: cleanText(parsedUrl?.searchParams.get("utm_content"), 160),
    utm_term: cleanText(parsedUrl?.searchParams.get("utm_term"), 160),
    metadata: {
      ...metadata,
      consentChoice: cleanText(rawBody.consentChoice || rawBody.consent_choice, 40),
    },
    created_at: new Date().toISOString(),
  });

  return { ok: Boolean(row), row };
}

export async function readTrafficSummary(days = 30) {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      days,
      pageViews: 0,
      visitors: 0,
      affiliateClicks: 0,
      pricingClicks: 0,
      todayViews: 0,
      topPaths: [],
      topCountries: [],
      topDevices: [],
      topReferrers: [],
      topCampaigns: [],
      recentEvents: [],
    };
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const rows = await supabaseSelect<TrafficRow>(
    "site_traffic_events",
    [
      "select=event_type,path,url,title,referrer_host,visitor_key,account_role,account_plan,country,region,city,device_type,platform,browser,utm_source,utm_medium,utm_campaign,metadata,created_at",
      `created_at=gte.${encodeURIComponent(since.toISOString())}`,
      "order=created_at.desc",
      "limit=5000",
    ].join("&")
  );

  const visitors = new Set<string>();
  const paths = new Map<string, number>();
  const countries = new Map<string, number>();
  const devices = new Map<string, number>();
  const referrers = new Map<string, number>();
  const campaigns = new Map<string, number>();

  let pageViews = 0;
  let affiliateClicks = 0;
  let pricingClicks = 0;
  let todayViews = 0;

  for (const row of rows) {
    const eventType = row.event_type || "page_view";
    const createdAt = new Date(String(row.created_at || ""));

    if (row.visitor_key) visitors.add(row.visitor_key);
    if (eventType === "page_view") {
      pageViews += 1;
      increment(paths, row.path);
      increment(countries, [row.city, row.region, row.country].filter(Boolean).join(", ") || row.country);
      increment(devices, [row.device_type, row.platform, row.browser].filter(Boolean).join(" / "));
      increment(referrers, row.referrer_host || "Direct");
      if (row.utm_source || row.utm_campaign) {
        increment(campaigns, [row.utm_source, row.utm_campaign].filter(Boolean).join(" / "));
      }
      if (!Number.isNaN(createdAt.getTime()) && createdAt >= today) todayViews += 1;
    }
    if (eventType === "affiliate_click") affiliateClicks += 1;
    if (eventType === "pricing_click") pricingClicks += 1;
  }

  return {
    configured: true,
    days,
    pageViews,
    visitors: visitors.size,
    affiliateClicks,
    pricingClicks,
    todayViews,
    topPaths: topItems(paths),
    topCountries: topItems(countries),
    topDevices: topItems(devices),
    topReferrers: topItems(referrers),
    topCampaigns: topItems(campaigns),
    recentEvents: rows.slice(0, 20).map((row) => ({
      type: row.event_type || "page_view",
      path: row.path || "/",
      location: [row.city, row.region, row.country].filter(Boolean).join(", ") || "Unknown",
      platform: [row.device_type, row.platform, row.browser].filter(Boolean).join(" / ") || "Unknown",
      createdAt: row.created_at || "",
      metadata: row.metadata || {},
    })),
  };
}

/** Server-side event (sign-in, signup) recorded from an API route. Never throws. */
export async function recordServerEvent(request: Request, eventType: "sign_in" | "sign_up", metadata: Record<string, unknown> = {}) {
  try {
    const referer = request.headers.get("referer") || "";
    let path = "/login";
    try { if (referer) path = new URL(referer).pathname; } catch { /* keep default */ }
    return await recordTrafficEvent(request, { eventType, path, metadata }, { server: true });
  } catch {
    return { ok: false };
  }
}

export type AnalyticsRange = 7 | 30 | 90;

type DashboardRow = { event_type?: string | null; path?: string | null; referrer_host?: string | null; visitor_key?: string | null; account_role?: string | null; created_at?: string | null; metadata?: Record<string, unknown> | null };

function pathOnly(path?: string | null) {
  return cleanText((path || "/").split("?")[0] || "/", 160) || "/";
}

/** Everything the admin analytics dashboard shows, from first-party rows only. */
export async function readAnalyticsDashboard(days: AnalyticsRange) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const empty = { configured: isSupabaseConfigured(), days, since: since.toISOString(), daily: [] as Array<{ date: string; visits: number; visitors: number }>, totals: { visits: 0, visitors: 0, signIns: 0, signUps: 0, scans: 0, upsellViews: 0, checkouts: 0, affiliateClicks: 0 }, topPages: [] as Array<{ label: string; count: number }>, topReferrers: [] as Array<{ label: string; count: number }>, recentSignIns: [] as Array<{ at: string; role: string; method: string }>, truncated: false, error: "" };
  if (!empty.configured) return empty;

  const sinceParam = encodeURIComponent(since.toISOString());
  const LIMIT = 20000;
  let rows: DashboardRow[] = [];
  let scans = 0;
  try {
    [rows, scans] = await Promise.all([
      supabaseSelect<DashboardRow>("site_traffic_events", `select=event_type,path,referrer_host,visitor_key,account_role,created_at,metadata&created_at=gte.${sinceParam}&order=created_at.desc&limit=${LIMIT}`, { failClosed: true }),
      supabaseCount("analyses", `select=id&created_at=gte.${sinceParam}`).catch(() => 0),
    ]);
  } catch {
    return { ...empty, error: "The analytics table could not be read. Check the Supabase keys and that the site_analytics migration has been applied." };
  }

  const dayKeys: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(since.getTime() + i * 86400000);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const dayViews = new Map(dayKeys.map((k) => [k, 0]));
  const dayVisitors = new Map(dayKeys.map((k) => [k, new Set<string>()]));
  const visitors = new Set<string>();
  const pages = new Map<string, number>();
  const referrers = new Map<string, number>();
  const totals = { ...empty.totals, scans };
  const recentSignIns: Array<{ at: string; role: string; method: string }> = [];

  for (const row of rows) {
    const type = row.event_type || "page_view";
    const key = String(row.created_at || "").slice(0, 10);
    if (type === "page_view") {
      totals.visits += 1;
      if (dayViews.has(key)) dayViews.set(key, (dayViews.get(key) || 0) + 1);
      if (row.visitor_key) {
        visitors.add(row.visitor_key);
        dayVisitors.get(key)?.add(row.visitor_key);
      }
      increment(pages, pathOnly(row.path));
      increment(referrers, row.referrer_host || "Direct / none");
    } else if (type === "sign_in") {
      totals.signIns += 1;
      if (recentSignIns.length < 10) recentSignIns.push({ at: row.created_at || "", role: row.account_role || String(row.metadata?.role || "customer"), method: String(row.metadata?.method || "password") });
    } else if (type === "sign_up") totals.signUps += 1;
    else if (type === "upsell_view") totals.upsellViews += 1;
    else if (type === "checkout_start") totals.checkouts += 1;
    else if (type === "affiliate_click") totals.affiliateClicks += 1;
  }
  totals.visitors = visitors.size;

  return {
    ...empty,
    daily: dayKeys.map((date) => ({ date, visits: dayViews.get(date) || 0, visitors: dayVisitors.get(date)?.size || 0 })),
    totals,
    topPages: topItems(pages, 10),
    topReferrers: topItems(referrers, 10),
    recentSignIns,
    truncated: rows.length >= LIMIT,
  };
}

export function conversionRate(clicks: number, views: number) {
  if (!views) return "0%";
  return `${Math.round((numberOrZero(clicks) / views) * 1000) / 10}%`;
}
