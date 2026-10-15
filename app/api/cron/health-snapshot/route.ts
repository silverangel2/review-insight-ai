import { NextRequest, NextResponse } from "next/server";
import { supabaseSelect, supabaseUpsert, isSupabaseConfigured } from "@/lib/supabaseServer";
import { summarizeAdminAnalytics } from "@/lib/adminAnalytics";

/**
 * Daily App Health snapshot writer.
 *
 * Computes ReviewIntel's key health metrics from EXISTING tables only
 * (no new instrumentation) and upserts one row per UTC day into
 * `admin_health_snapshots`. Every read is fail-soft: a missing or
 * unreadable table degrades that metric to null instead of failing
 * the run. This route never throws.
 */
export const runtime = "nodejs";

const TABLE = "admin_health_snapshots";
const EXPECTED_SCHEDULE = "30 11 * * *";
const DAY_MS = 86_400_000;

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;
const msOf = (v: unknown): number => {
  const t = new Date(str(v)).getTime();
  return Number.isNaN(t) ? 0 : t;
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function isoGte(d: Date): string {
  return encodeURIComponent(d.toISOString());
}

interface WindowCounts {
  pageViews: number;
  uniqueVisitors: number;
  signIns: number;
  signUps: number;
  affiliateClicks: number;
  affiliateImpressions: number;
  checkoutsStarted: number;
  scans: number;
  scansBuyer: number;
  scansSeller: number;
  linkScans: number;
  screenshotScans: number;
  aggregatePresent: number;
  aggregateMissing: number;
  paidCount: number;
  revenueByCurrency: Record<string, number>;
  emailsSent: number;
  emailsFailed: number;
}

function emptyWindow(): WindowCounts {
  return {
    pageViews: 0,
    uniqueVisitors: 0,
    signIns: 0,
    signUps: 0,
    affiliateClicks: 0,
    affiliateImpressions: 0,
    checkoutsStarted: 0,
    scans: 0,
    scansBuyer: 0,
    scansSeller: 0,
    linkScans: 0,
    screenshotScans: 0,
    aggregatePresent: 0,
    aggregateMissing: 0,
    paidCount: 0,
    revenueByCurrency: {},
    emailsSent: 0,
    emailsFailed: 0,
  };
}

interface HealthAlert {
  code: string;
  severity: "warn" | "info";
  message: string;
  count: number;
  detail?: string;
}

function isWelcomeType(emailType: string): boolean {
  return /WELCOME/i.test(emailType);
}

function isSentStatus(status: string): boolean {
  return /^(sent|delivered)$/i.test(status.trim());
}

function isFailedStatus(status: string): boolean {
  return /^(failed|bounced|error)$/i.test(status.trim());
}

function isPaidStatus(status: string): boolean {
  return /^(paid|succeeded|recorded|complete|completed)$/i.test(status.trim());
}

function isUnresolvedMessage(status: string): boolean {
  return !/^(archived|replied|resolved|closed|done)$/i.test(status.trim());
}

export async function GET(request: NextRequest) {
  // Same cron-auth pattern as /api/cron/social-autopost.
  const secret = process.env.SOCIAL_CRON_SECRET || process.env.CRON_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Cron secret is not configured." },
      { status: 401 }
    );
  }
  const vercelCronSchedule = request.headers.get("x-vercel-cron-schedule") || "";
  const isExpectedVercelCron = vercelCronSchedule === EXPECTED_SCHEDULE;

  if (secret) {
    const authorization = request.headers.get("authorization") || "";
    const provided = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : authorization.trim();
    const querySecret = request.nextUrl.searchParams.get("secret");

    if (provided !== secret && querySecret !== secret && !isExpectedVercelCron) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized cron request." },
        { status: 401 }
      );
    }
  }

  const startedAt = Date.now();
  const now = new Date();
  const todayStart = startOfUtcDay(now).getTime();
  const yesterdayStart = todayStart - DAY_MS;
  const window7Start = now.getTime() - 7 * DAY_MS;
  const window8Start = now.getTime() - 8 * DAY_MS;
  const snapshotDate = startOfUtcDay(now).toISOString().slice(0, 10);

  const sources: Record<string, number | null> = {};
  const alerts: HealthAlert[] = [];

  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Supabase is not configured; snapshot skipped." },
        { status: 200 }
      );
    }

    const since8 = new Date(window8Start);

    // ---- Pull raw rows (each fail-soft) ----
    const trafficRows = await safe(
      () =>
        supabaseSelect<Rec>(
          "site_traffic_events",
          `select=event_type,path,referrer_host,visitor_key,created_at,metadata&created_at=gte.${isoGte(since8)}&order=created_at.desc&limit=20000`,
          { failClosed: true }
        ),
      null
    );
    sources.traffic = trafficRows ? trafficRows.length : null;

    const analysesRows = await safe(
      () =>
        supabaseSelect<Rec>(
          "analyses",
          `select=mode,product_name,analysis_json,created_at&created_at=gte.${isoGte(since8)}&order=created_at.desc&limit=2000`,
          { failClosed: true }
        ),
      null
    );
    sources.analyses = analysesRows ? analysesRows.length : null;

    const libraryRows = await safe(
      () =>
        supabaseSelect<Rec>(
          "product_review_library",
          "select=review_count,scan_count&limit=5000"
        ),
      null
    );
    sources.library = libraryRows ? libraryRows.length : null;

    const paymentRows = await safe(
      () =>
        supabaseSelect<Rec>(
          "payments",
          `select=amount,currency,plan,status,created_at&created_at=gte.${isoGte(since8)}&order=created_at.desc&limit=1000`,
          { failClosed: true }
        ),
      null
    );
    sources.payments = paymentRows ? paymentRows.length : null;

    const emailRows = await safe(
      () =>
        supabaseSelect<Rec>(
          "admin_email_logs",
          `select=email_type,status,recipient,subject,error,created_at&created_at=gte.${isoGte(since8)}&order=created_at.desc&limit=500`,
          { failClosed: true }
        ),
      null
    );
    sources.emails = emailRows ? emailRows.length : null;

    const welcomeRows = await safe(
      () =>
        supabaseSelect<Rec>(
          "admin_email_logs",
          `select=email_type,recipient,created_at&created_at=gte.${isoGte(new Date(now.getTime() - 90 * DAY_MS))}&order=created_at.desc&limit=2000`,
          { failClosed: true }
        ),
      null
    );

    const securityRows = await safe(
      () =>
        supabaseSelect<Rec>(
          "security_events",
          `select=event_type,severity,created_at&created_at=gte.${isoGte(since8)}&order=created_at.desc&limit=500`,
          { failClosed: true }
        ),
      null
    );
    sources.security = securityRows ? securityRows.length : null;

    const messageRows = await safe(
      () =>
        supabaseSelect<Rec>(
          "contact_messages",
          "select=status,created_at&order=created_at.desc&limit=200"
        ),
      null
    );
    sources.messages = messageRows ? messageRows.length : null;

    const profileRows = await safe(
      () =>
        supabaseSelect<Rec>("profiles", "select=email&limit=5000"),
      null
    );
    sources.profiles = profileRows ? profileRows.length : null;

    // ---- Bucket into windows ----
    const today = emptyWindow();
    const yesterday = emptyWindow();
    const last7d = emptyWindow();
    const visitorsToday = new Set<string>();
    const visitorsYesterday = new Set<string>();
    const visitors7d = new Set<string>();

    const bucketFor = (t: number): Array<{ w: WindowCounts; visitors: Set<string> } | { w: WindowCounts }> | null => {
      const out: Array<{ w: WindowCounts; visitors: Set<string> } | { w: WindowCounts }> = [];
      if (t >= todayStart) out.push({ w: today, visitors: visitorsToday });
      if (t >= yesterdayStart && t < todayStart) out.push({ w: yesterday, visitors: visitorsYesterday });
      if (t >= window7Start) out.push({ w: last7d, visitors: visitors7d });
      return out.length ? out : null;
    };

    if (trafficRows) {
      for (const row of trafficRows) {
        const t = msOf(row.created_at);
        if (!t) continue;
        const buckets = bucketFor(t);
        if (!buckets) continue;
        const eventType = str(row.event_type) || "page_view";
        for (const b of buckets) {
          const w = b.w;
          if ("visitors" in b && row.visitor_key) b.visitors.add(str(row.visitor_key));
          if (eventType === "page_view") w.pageViews += 1;
          else if (eventType === "sign_in") w.signIns += 1;
          else if (eventType === "sign_up") w.signUps += 1;
          else if (eventType === "affiliate_click") w.affiliateClicks += 1;
          else if (eventType === "affiliate_impression") w.affiliateImpressions += 1;
          else if (eventType === "checkout_start") w.checkoutsStarted += 1;
        }
      }
    }
    today.uniqueVisitors = visitorsToday.size;
    yesterday.uniqueVisitors = visitorsYesterday.size;
    last7d.uniqueVisitors = visitors7d.size;

    const verdictRows7d: Rec[] = [];
    const topPages7d = new Map<string, number>();
    let missingProductName7d = 0;

    if (analysesRows) {
      for (const row of analysesRows) {
        const t = msOf(row.created_at);
        if (!t) continue;
        const buckets = bucketFor(t);
        if (!buckets) continue;
        const mode = str(row.mode) || "buyer";
        const trace = isRec(row.analysis_json)
          ? (isRec((row.analysis_json as Rec).reviewIntelTrace)
              ? ((row.analysis_json as Rec).reviewIntelTrace as Rec)
              : {})
          : {};
        const isScreenshot = Boolean(trace.screenshotIdentity);
        const agg = trace.marketplaceReviewCount;
        const hasAggregate =
          typeof agg === "number" && agg >= 0;
        for (const b of buckets) {
          const w = b.w;
          w.scans += 1;
          if (mode === "seller") w.scansSeller += 1;
          else w.scansBuyer += 1;
          if (isScreenshot) w.screenshotScans += 1;
          else w.linkScans += 1;
          if (hasAggregate) w.aggregatePresent += 1;
          else w.aggregateMissing += 1;
        }
        if (t >= window7Start) {
          verdictRows7d.push(row);
          if (!str(row.product_name)) missingProductName7d += 1;
        }
      }
    }

    if (trafficRows) {
      for (const row of trafficRows) {
        const t = msOf(row.created_at);
        if (t < window7Start) continue;
        if (str(row.event_type) === "page_view" || !row.event_type) {
          const p = str(row.path) || "/";
          topPages7d.set(p, (topPages7d.get(p) ?? 0) + 1);
        }
      }
    }

    if (paymentRows) {
      for (const row of paymentRows) {
        const t = msOf(row.created_at);
        if (!t) continue;
        const buckets = bucketFor(t);
        if (!buckets) continue;
        if (!isPaidStatus(str(row.status))) continue;
        const currency = str(row.currency) || "CAD";
        for (const b of buckets) {
          const w = b.w;
          w.paidCount += 1;
          w.revenueByCurrency[currency] =
            (w.revenueByCurrency[currency] ?? 0) + num(row.amount);
        }
      }
    }

    let emailsSentToday = 0;
    let emailsFailedToday = 0;
    let newestEmailError: string | null = null;
    if (emailRows) {
      for (const row of emailRows) {
        const t = msOf(row.created_at);
        const status = str(row.status);
        const sent = isSentStatus(status);
        const failed = isFailedStatus(status);
        if (t >= todayStart) {
          if (sent) emailsSentToday += 1;
          if (failed) emailsFailedToday += 1;
        }
        if (failed && newestEmailError === null) {
          const err = str(row.error) || str(row.subject);
          if (err) newestEmailError = `${str(row.created_at)} — ${err}`.slice(0, 200);
        }
      }
    }
    today.emailsSent = emailsSentToday;
    today.emailsFailed = emailsFailedToday;
    if (emailRows) {
      for (const row of emailRows) {
        const t = msOf(row.created_at);
        const status = str(row.status);
        if (t < window7Start) continue;
        if (isSentStatus(status)) last7d.emailsSent += 1;
        if (isFailedStatus(status)) last7d.emailsFailed += 1;
        if (t >= yesterdayStart && t < todayStart) {
          if (isSentStatus(status)) yesterday.emailsSent += 1;
          if (isFailedStatus(status)) yesterday.emailsFailed += 1;
        }
      }
    }

    // ---- Derived summaries ----
    const analytics = summarizeAdminAnalytics(verdictRows7d, trafficRows ?? [], 7);

    const library = libraryRows
      ? {
          products: libraryRows.length,
          storedReviews: libraryRows.reduce((a, r) => a + num(r.review_count), 0),
          consolidatedScans: libraryRows.reduce((a, r) => a + num(r.scan_count), 0),
        }
      : null;

    const severityTally: Record<string, number> = {};
    let securityCritical7d = 0;
    if (securityRows) {
      for (const row of securityRows) {
        const t = msOf(row.created_at);
        if (t < window7Start) continue;
        const sev = str(row.severity) || "low";
        severityTally[sev] = (severityTally[sev] ?? 0) + 1;
        if (sev === "critical" || sev === "high") securityCritical7d += 1;
      }
    }

    const unresolvedMessages = messageRows
      ? messageRows.filter((r) => isUnresolvedMessage(str(r.status))).length
      : null;

    // ---- R21 data-integrity alerts ----
    const profileEmails = new Set(
      (profileRows ?? []).map((r) => str(r.email).toLowerCase()).filter(Boolean)
    );
    const welcomeWithoutProfile = new Set<string>();
    if (welcomeRows) {
      for (const row of welcomeRows) {
        if (!isWelcomeType(str(row.email_type))) continue;
        const email = str(row.recipient).toLowerCase();
        if (email && !profileEmails.has(email)) welcomeWithoutProfile.add(email);
      }
    }
    if (welcomeWithoutProfile.size > 0) {
      alerts.push({
        code: "welcome_without_profile",
        severity: "warn",
        message: `${welcomeWithoutProfile.size} welcome email(s) sent to addresses with no profile row`,
        count: welcomeWithoutProfile.size,
        detail: [...welcomeWithoutProfile].slice(0, 3).join(", "),
      });
    }

    if ((profileRows?.length ?? 0) === 0 && last7d.signIns > 0) {
      alerts.push({
        code: "customers_zero_with_signins",
        severity: "warn",
        message: `Admin Customers shows 0 users while ${last7d.signIns} sign-in event(s) were recorded in 7 days`,
        count: last7d.signIns,
      });
    }

    if (missingProductName7d > 0) {
      alerts.push({
        code: "analyses_missing_product_name",
        severity: "warn",
        message: `${missingProductName7d} completed scan(s) in 7 days have no product name`,
        count: missingProductName7d,
      });
    }

    if (emailsFailedToday > 0) {
      alerts.push({
        code: "email_failures_today",
        severity: "warn",
        message: `${emailsFailedToday} email(s) failed today`,
        count: emailsFailedToday,
        detail: newestEmailError ?? undefined,
      });
    }

    if (securityCritical7d > 0) {
      alerts.push({
        code: "security_critical_7d",
        severity: "warn",
        message: `${securityCritical7d} critical/high security event(s) in 7 days`,
        count: securityCritical7d,
      });
    }

    const metrics = {
      generatedAt: now.toISOString(),
      today,
      yesterday,
      last7d,
      verdictMix: analytics.verdictMix,
      topProducts: analytics.topProducts,
      topPages: [...topPages7d.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      library,
      security: { severityTally, criticalHigh7d: securityCritical7d },
      emails: { newestError: newestEmailError },
      support: { unresolvedMessages },
      money: {
        paidCount7d: last7d.paidCount,
        revenueByCurrency7d: last7d.revenueByCurrency,
      },
      services: {
        supabaseConfigured: isSupabaseConfigured(),
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      },
    };

    const saved = await safe(
      () =>
        supabaseUpsert(
          TABLE,
          {
            snapshot_date: snapshotDate,
            metrics,
            alerts,
            updated_at: now.toISOString(),
          },
          "snapshot_date"
        ),
      null
    );

    return NextResponse.json({
      ok: saved !== null,
      snapshotDate,
      durationMs: Date.now() - startedAt,
      sources,
      alerts: alerts.map((a) => ({ code: a.code, count: a.count })),
      saved: saved !== null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        snapshotDate,
        error: error instanceof Error ? error.message : "Snapshot failed.",
        sources,
        alerts: alerts.map((a) => ({ code: a.code, count: a.count })),
      },
      { status: 200 }
    );
  }
}
