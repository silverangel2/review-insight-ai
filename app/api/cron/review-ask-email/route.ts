/**
 * The community review ask: one single, value-first email to signed-in
 * shoppers ~7 days after a scan, inviting them to review the product they
 * scanned. Guards: only accounts with marketing_consent on file (CASL),
 * one email per account per product (community_review_asks), never a
 * reminder series, no compensation promised.
 */
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseSelect } from "@/lib/supabaseServer";
import { hasEmailProvider, sendReviewIntelEmail, SUPPORT_EMAIL } from "@/lib/emailDelivery";
import { escapeHtml } from "@/lib/emailHtml";
import {
  COMMUNITY_REVIEW_ASKS_TABLE,
  COMMUNITY_REVIEWS_TABLE,
  communityReviewSubmittedBy,
  normalizeProductKey,
  recordReviewAsk,
  reviewAskAlreadySent,
} from "@/lib/communityReviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_SCHEDULE = "0 12 * * *"; // 09:00 ADT daily
const ASK_AFTER_DAYS = 7;
const MAX_SENDS_PER_RUN = 40;

function requireCron(request: NextRequest) {
  const secret = process.env.SOCIAL_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Cron secret is not configured." }, { status: 401 });
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
      return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
    }
  }
  return null;
}

function emailHtml(input: { productName: string; reviewLink: string }) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
<p style="font-size:16px;line-height:1.7">About a week ago you scanned <strong>${escapeHtml(
    input.productName
  )}</strong> on ReviewIntel.</p>
<p style="font-size:16px;line-height:1.7">Did you end up buying it? If so, your experience could help the next shopper decide — it takes about a minute, and verified reviews strengthen this product's verdict for everyone who scans it after you.</p>
<p style="margin:24px 0"><a href="${escapeHtml(input.reviewLink)}" style="display:inline-block;background:#0e7490;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px">Share your review</a></p>
<p style="font-size:13px;line-height:1.7;color:#6b7280">One email, one ask — you'll never hear about this product from us again. Prefer no review invitations at all? Just reply to this email with the word <strong>unsubscribe</strong> and we'll stop.</p>
</div>`;
}

export async function GET(request: NextRequest) {
  const unauthorized = requireCron(request);
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured() || !hasEmailProvider()) {
    return NextResponse.json({ ok: false, skipped: true, reason: "Email or storage is not configured." });
  }

  try {
    const now = Date.now();
    const windowStart = new Date(now - (ASK_AFTER_DAYS + 1) * 86400 * 1000).toISOString();
    const windowEnd = new Date(now - ASK_AFTER_DAYS * 86400 * 1000).toISOString();

    const scans = await supabaseSelect<Record<string, unknown>>(
      "analyses",
      `select=id,profile_email,product_name,analysis_json,created_at&mode=eq.buyer&created_at=gte.${encodeURIComponent(
        windowStart
      )}&created_at=lte.${encodeURIComponent(windowEnd)}&order=created_at.desc&limit=100`
    );

    let sent = 0;
    let skipped = 0;
    const seenEmails = new Set<string>();

    for (const scan of Array.isArray(scans) ? scans : []) {
      if (sent >= MAX_SENDS_PER_RUN) break;
      const email = String(scan.profile_email || "").toLowerCase().trim();
      if (!email || !email.includes("@") || seenEmails.has(email)) {
        skipped += 1;
        continue;
      }

      const analysisJson =
        scan.analysis_json && typeof scan.analysis_json === "object"
          ? (scan.analysis_json as Record<string, unknown>)
          : {};
      const productKey = normalizeProductKey(analysisJson.detectedProductKey);
      if (!productKey) {
        skipped += 1;
        continue;
      }

      // CASL: only accounts that consented to marketing email.
      const profiles = await supabaseSelect<Record<string, unknown>>(
        "profiles",
        `select=email,marketing_consent&email=eq.${encodeURIComponent(email)}&limit=1`
      );
      if (!profiles[0] || (profiles[0] as Record<string, unknown>).marketing_consent !== true) {
        skipped += 1;
        continue;
      }

      // Never ask twice, and never ask someone who already reviewed.
      if (await reviewAskAlreadySent(email, productKey)) {
        skipped += 1;
        continue;
      }
      if (await communityReviewSubmittedBy(email, productKey)) {
        await recordReviewAsk({ accountEmail: email, productKey });
        skipped += 1;
        continue;
      }
      seenEmails.add(email);

      const productName = String(scan.product_name || "the product you scanned").slice(0, 120);
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://getreviewintel.com").replace(/\/$/, "");
      const scanId = String(analysisJson.scanId || scan.id || "");
      const reviewLink = `${siteUrl}/results?scanId=${encodeURIComponent(scanId)}#community-reviews`;

      const result = await sendReviewIntelEmail({
        emailType: "community_review_ask",
        to: email,
        replyTo: SUPPORT_EMAIL,
        subject: "Did you end up buying it? Tell the next shopper",
        html: emailHtml({ productName, reviewLink }),
        text: `About a week ago you scanned ${productName} on ReviewIntel. Did you end up buying it? If so, your experience could help the next shopper decide — it takes about a minute: ${reviewLink}\n\nOne email, one ask — you'll never hear about this product from us again. Prefer no review invitations? Reply with the word unsubscribe and we'll stop.`,
        metadata: { product_key: productKey, analysis_id: String(scan.id || "") },
      });

      await recordReviewAsk({ accountEmail: email, productKey, analysisId: String(scan.id || "") });
      if (result.ok) sent += 1;
      else skipped += 1;
    }

    return NextResponse.json({ ok: true, sent, skipped });
  } catch {
    return NextResponse.json({ ok: false, error: "The review-ask run failed safely." }, { status: 500 });
  }
}
