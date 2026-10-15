import { NextResponse } from "next/server";
import { libraryProductKeyFor } from "@/lib/productReviewLibrary";
import {
  attachRescueConsent,
  isValidRescueEmail,
  listRescueQueue,
  recordRescueCandidate,
} from "@/lib/rescueQueue";
import { rateLimitRequest } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Guest opt-in for the rescue verdict: the scan couldn't produce a verdict,
 * and the guest leaves an email so a human-researched verdict can reach them.
 * Verdict-purpose consent ONLY — this email is never added to marketing.
 *
 * One queue row per scanRef: a repeat subscribe updates the email, never
 * duplicates. If no queue row exists yet for the scan, one is created so the
 * owner's research still lands in the queue.
 */

function clean(value: unknown, max: number): string | null {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

async function findRowByScanRef(scanRef: string) {
  // Queue lookups are status-scoped; check the active lanes first.
  for (const status of ["pending", "rescued", "emailed"] as const) {
    const rows = await listRescueQueue(status, 200);
    const match = rows.find((row) => row.scan_ref === scanRef);
    if (match) return match;
  }
  return null;
}

export async function POST(request: Request) {
  const limit = await rateLimitRequest(request, {
    key: "rescue_subscribe",
    limit: 5,
    windowMs: 60 * 60 * 1000,
    eventType: "rescue_subscribe_rate_limited",
  });
  if (!limit.allowed) {
    return (
      limit.response ??
      NextResponse.json({ error: "You've reached the request limit for now. Please try again later." }, { status: 429 })
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = clean(body?.email, 320);
    if (!email || !isValidRescueEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const scanRef = clean(body?.scanRef, 120);
    const productName = clean(body?.productName, 400);
    const productUrl = clean(body?.productUrl, 2000);
    const productKey =
      clean(body?.productKey, 320) ||
      (productUrl ? libraryProductKeyFor({ listingUrl: productUrl }) : null);

    const now = new Date().toISOString();
    const lower = email.toLowerCase();

    const existing = scanRef ? await findRowByScanRef(scanRef) : null;
    if (existing) {
      const attached = await attachRescueConsent(existing.id, lower, now);
      return NextResponse.json({ ok: attached, subscribed: true, scanRef: existing.scan_ref });
    }

    const ref = scanRef || `guest-${now}-${Math.random().toString(36).slice(2, 10)}`;
    const created = await recordRescueCandidate({
      scanRef: ref,
      accountEmail: lower,
      productKey,
      productName,
      productUrl,
      reason: "guest_verdict_request",
    });
    if (created) {
      const row = await findRowByScanRef(ref);
      if (row) await attachRescueConsent(row.id, lower, now);
    }
    return NextResponse.json({ ok: created, subscribed: true, scanRef: ref });
  } catch {
    // Fail-soft: the guest sees a friendly confirmation either way.
    return NextResponse.json({ ok: true, subscribed: true });
  }
}
