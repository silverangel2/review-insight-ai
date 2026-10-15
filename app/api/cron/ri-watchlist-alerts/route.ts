import { NextRequest, NextResponse } from "next/server";
import {
  hasEmailProvider,
  sendReviewIntelEmail,
  SUPPORT_EMAIL,
} from "@/lib/emailDelivery";
import {
  libraryProductKeyFor,
  PRODUCT_REVIEW_LIBRARY_TABLE,
} from "@/lib/productReviewLibrary";
import {
  signUnwatchToken,
  watchAlertsEnabled,
} from "@/lib/productWatches";
import {
  decideLibraryWatchAlert,
  snapshotFromLibraryRow,
  watchAlertEmailContent,
  WATCH_MAX_PRODUCTS_PER_RUN,
  type LibrarySnapshot,
  type StoredWatchSnapshot,
} from "@/lib/riWatchAlerts";
import {
  isSupabaseConfigured,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "@/lib/supabaseServer";
import { postgrestTableExists } from "@/lib/riOpsStore";

/**
 * ReviewIntel FYI watchlist alerts (daily).
 *
 * Compares the CURRENT product_review_library snapshot (aggregate rating +
 * review count) against each watch's STORED snapshot. On a meaningful
 * change, sends ONE email per watcher via lib/emailDelivery — never a
 * series (the product_watch_alert_log dedup table guarantees one email
 * per watch per change).
 *
 * Guards: watch alerts feature flag on, marketing_consent=true only
 * (CASL), one-click unwatch link + email-preferences link in every email,
 * fail-soft 200 with a skipped status when the tables are not provisioned
 * yet. Zero OpenAI. This route never throws.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EXPECTED_SCHEDULE = "0 14 * * *"; // 11:00 ADT daily
const WATCHES_TABLE = "product_watches";
const WATCH_ALERT_LOG_TABLE = "product_watch_alert_log";

function requireCron(request: NextRequest) {
  const secret = process.env.SOCIAL_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Cron secret is not configured." },
      { status: 401 }
    );
  }
  const cronScheduleHeader = request.headers.get("x-vercel-cron-schedule") || "";
  const isExpectedCron = cronScheduleHeader === EXPECTED_SCHEDULE;
  if (secret) {
    const authorization = request.headers.get("authorization") || "";
    const provided = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : authorization.trim();
    const querySecret = request.nextUrl.searchParams.get("secret");
    if (provided !== secret && querySecret !== secret && !isExpectedCron) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized cron request." },
        { status: 401 }
      );
    }
  }
  return null;
}

type Row = Record<string, unknown>;
const obj = (v: unknown): Row =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function storedSnapshot(watch: Row): StoredWatchSnapshot {
  const hash = str(watch.last_library_hash);
  return {
    aggregateRating: num(watch.last_aggregate_rating),
    reviewCount:
      typeof watch.last_review_count === "number" && Number.isFinite(watch.last_review_count)
        ? Math.floor(watch.last_review_count as number)
        : 0,
    hash: hash || null,
  };
}

function snapshotPatch(next: LibrarySnapshot, alerted: boolean) {
  const now = new Date().toISOString();
  const patch: Row = {
    last_aggregate_rating: next.aggregateRating,
    last_review_count: next.reviewCount,
    last_library_hash: next.hash,
    last_checked_at: now,
  };
  if (alerted) patch.last_alerted_at = now;
  return patch;
}

async function hasMarketingConsent(email: string): Promise<boolean> {
  try {
    const profiles = await supabaseSelect<Row>(
      "profiles",
      `select=email,marketing_consent&email=eq.${encodeURIComponent(email)}&limit=1`
    );
    return Boolean(Array.isArray(profiles) && profiles[0] && (profiles[0] as Row).marketing_consent === true);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const unauthorized = requireCron(request);
  if (unauthorized) return unauthorized;

  if (!watchAlertsEnabled()) {
    return NextResponse.json({ ok: false, enabled: false }, { status: 404 });
  }
  if (!isSupabaseConfigured() || !hasEmailProvider()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Email or storage is not configured.",
    });
  }
  // Fail-soft: without the watchlist tables there is nothing truthful to
  // compare — skip the run instead of crashing or guessing.
  const [watchesReady, logReady] = await Promise.all([
    postgrestTableExists(WATCHES_TABLE),
    postgrestTableExists(WATCH_ALERT_LOG_TABLE),
  ]);
  if (!watchesReady || !logReady) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Watchlist tables are not provisioned yet.",
    });
  }

  try {
    const watches = await supabaseSelect<Row>(
      WATCHES_TABLE,
      "select=*&unsubscribed_at=is.null&order=last_checked_at.asc.nullsfirst&limit=500"
    );
    const byProduct = new Map<string, Row[]>();
    for (const w of Array.isArray(watches) ? watches : []) {
      const k = str(w.product_key);
      if (!k) continue;
      if (!byProduct.has(k)) byProduct.set(k, []);
      byProduct.get(k)!.push(w);
    }
    const keys = [...byProduct.keys()].slice(0, WATCH_MAX_PRODUCTS_PER_RUN);

    const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://getreviewintel.com").replace(/\/$/, "");
    let alerts = 0;
    let skippedConsent = 0;
    let baselines = 0;

    for (const key of keys) {
      const group = byProduct.get(key)!;
      const first = group[0];
      const listingUrl = str(first.listing_url);
      const libraryKey = listingUrl ? libraryProductKeyFor({ listingUrl }) : null;

      const touchFilter = (w: Row) =>
        `profile_email=eq.${encodeURIComponent(str(w.profile_email))}&product_key=eq.${encodeURIComponent(key)}`;

      if (!libraryKey) {
        // Not a library-addressable product: just mark checked, stay silent.
        for (const w of group) {
          await supabaseUpdate(WATCHES_TABLE, touchFilter(w), {
            last_checked_at: new Date().toISOString(),
          });
        }
        continue;
      }

      let next: LibrarySnapshot | null = null;
      try {
        const rows = await supabaseSelect<Row>(
          PRODUCT_REVIEW_LIBRARY_TABLE,
          `select=product_key,aggregate_rating,review_count,scan_count&product_key=eq.${encodeURIComponent(libraryKey)}&limit=1`
        );
        if (Array.isArray(rows) && rows[0]) next = snapshotFromLibraryRow(obj(rows[0]));
      } catch {
        next = null;
      }
      if (!next) {
        for (const w of group) {
          await supabaseUpdate(WATCHES_TABLE, touchFilter(w), {
            last_checked_at: new Date().toISOString(),
          });
        }
        continue;
      }

      const prev = storedSnapshot(first);
      const decision = decideLibraryWatchAlert(prev, next);

      if (!decision.alert) {
        // First sighting (or no meaningful move): record/refresh the
        // baseline silently — never an alert storm.
        for (const w of group) {
          await supabaseUpdate(WATCHES_TABLE, touchFilter(w), snapshotPatch(next, false));
        }
        if (decision.reason === "no_baseline") baselines += group.length;
        continue;
      }

      // Meaningful change: one email per watcher, consent-gated, deduped.
      for (const w of group) {
        const email = str(w.profile_email).toLowerCase().trim();
        if (!email || !email.includes("@")) continue;
        if (!(await hasMarketingConsent(email))) {
          skippedConsent += 1;
          continue;
        }
        const logFilter =
          `profile_email=eq.${encodeURIComponent(email)}` +
          `&product_key=eq.${encodeURIComponent(key)}` +
          `&result_hash=eq.${encodeURIComponent(next.hash)}`;
        let alreadySent = false;
        try {
          const existing = await supabaseSelect(
            WATCH_ALERT_LOG_TABLE,
            `select=id&${logFilter}&limit=1`
          );
          alreadySent = Array.isArray(existing) && existing.length > 0;
        } catch {
          alreadySent = false;
        }
        if (alreadySent) {
          await supabaseUpdate(WATCHES_TABLE, touchFilter(w), snapshotPatch(next, false));
          continue;
        }

        const token = signUnwatchToken(email, key);
        const productName = str(w.product_name).slice(0, 120) || "a product you watch";
        const content = watchAlertEmailContent({
          productName,
          reason: decision.reason,
          previousRating: prev.aggregateRating,
          rating: next.aggregateRating,
          reviewCount: next.reviewCount,
          resultUrl: listingUrl || `${origin}/`,
          unwatchUrl: token ? `${origin}/api/product-watches?token=${token}` : `${origin}/email-preferences`,
          preferencesUrl: `${origin}/email-preferences`,
        });
        const result = await sendReviewIntelEmail({
          emailType: "product_watch_alert",
          to: email,
          replyTo: SUPPORT_EMAIL,
          subject: content.subject,
          html: content.html,
          text: content.text,
          headers: token
            ? { "List-Unsubscribe": `<${origin}/api/product-watches?token=${token}>` }
            : undefined,
          metadata: { product_key: key, library_key: libraryKey, reason: decision.reason },
        });
        if (result.ok) {
          alerts += 1;
          try {
            await supabaseInsert(WATCH_ALERT_LOG_TABLE, {
              profile_email: email,
              product_key: key,
              library_key: libraryKey,
              result_hash: next.hash,
              reason: decision.reason,
            });
          } catch {
            // Dedup write failed — the snapshot update below still moves
            // the baseline forward so we never spam on retry.
          }
          await supabaseUpdate(WATCHES_TABLE, touchFilter(w), snapshotPatch(next, true));
        } else {
          // Send failed: leave the baseline alone so tomorrow's run retries
          // instead of silently dropping the alert.
          await supabaseUpdate(WATCHES_TABLE, touchFilter(w), {
            last_checked_at: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      products: keys.length,
      alerts,
      baselines,
      skippedConsent,
      openAiCalls: 0,
    });
  } catch {
    return NextResponse.json({
      ok: false,
      error: "The watchlist-alert run failed safely.",
    });
  }
}
