import { NextResponse } from "next/server";
import { sendReviewIntelEmail } from "@/lib/emailDelivery";
import { decideWatchAlert, productKeyFromUrl, signUnwatchToken, watchAlertEmail, watchAlertsEnabled, type WatchSnapshot } from "@/lib/productWatches";
import { isSupabaseConfigured, supabaseSelect, supabaseUpdate } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
const MAX_PRODUCTS_PER_RUN = 25;
type Row = Record<string, unknown>;
const obj = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? v as Row : {});

/** Snapshot from a stored real-review result (no live scan, no OpenAI in this version). */
function snapshotFromStoredResult(result: Row): WatchSnapshot & { scanId: string | null } {
  const adjudication = obj(obj(result.reviewEvidence).evidenceAdjudication);
  const accepted = Array.isArray(adjudication.acceptedRecords) ? adjudication.acceptedRecords.length : 0;
  return {
    verdict: typeof result.verdict === "string" ? result.verdict : null,
    acceptedCount: accepted,
    resultHash: typeof result.resultHash === "string" ? result.resultHash : typeof result.scanId === "string" ? result.scanId : null,
    scanId: typeof result.scanId === "string" ? result.scanId : null,
  };
}

export async function GET(request: Request) {
  if (!watchAlertsEnabled()) return NextResponse.json({ ok: false, enabled: false }, { status: 404 });
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: "storage unavailable" }, { status: 503 });

  const watches = await supabaseSelect("product_watches", "select=*&unsubscribed_at=is.null&order=last_checked_at.asc.nullsfirst&limit=500");
  const byProduct = new Map<string, Row[]>();
  for (const w of watches) { const k = String(w.product_key); if (!byProduct.has(k)) byProduct.set(k, []); byProduct.get(k)!.push(w); }
  const keys = [...byProduct.keys()].slice(0, MAX_PRODUCTS_PER_RUN);

  // Newest stored real-review result per product key (one lookup per product, not per watcher).
  const recent = await supabaseSelect("analyses", "select=analysis_json,created_at&mode=eq.buyer&order=created_at.desc&limit=400");
  const latest = new Map<string, Row>();
  for (const row of recent) {
    const result = obj(obj(row.analysis_json).result);
    const url = String(result.exactListingUrl || obj(result.product).url || "");
    const key = url ? productKeyFromUrl(url) : null;
    if (key && !latest.has(key)) latest.set(key, result);
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  let alerts = 0;
  for (const key of keys) {
    const stored = latest.get(key);
    const next = stored ? snapshotFromStoredResult(stored) : null;
    for (const w of byProduct.get(key)!) {
      const prev: WatchSnapshot = { verdict: (w.last_verdict as string) || null, acceptedCount: Number(w.last_accepted_count) || 0, resultHash: (w.last_result_hash as string) || null };
      const decision = decideWatchAlert(prev, next);
      const now = new Date().toISOString();
      const email = String(w.profile_email);
      const filter = `profile_email=eq.${encodeURIComponent(email)}&product_key=eq.${encodeURIComponent(key)}`;
      if (decision.alert && next) {
        const token = signUnwatchToken(email, key);
        if (!token) continue;
        const msg = watchAlertEmail({
          productName: String(w.product_name || "a product you watch"), reason: decision.reason,
          previousVerdict: prev.verdict, verdict: next.verdict, acceptedCount: next.acceptedCount,
          resultUrl: next.scanId ? `${origin}/results?scanId=${encodeURIComponent(next.scanId)}` : String(w.listing_url),
          unwatchUrl: `${origin}/api/product-watches?token=${encodeURIComponent(token)}`,
        });
        await sendReviewIntelEmail({ emailType: "product_watch_alert", to: email, ...msg });
        alerts += 1;
        await supabaseUpdate("product_watches", filter, { last_verdict: next.verdict, last_accepted_count: next.acceptedCount, last_result_hash: next.resultHash, last_checked_at: now, last_alerted_at: now });
      } else {
        await supabaseUpdate("product_watches", filter, { last_checked_at: now });
      }
    }
  }
  return NextResponse.json({ ok: true, products: keys.length, alerts, openAiCalls: 0 });
}
