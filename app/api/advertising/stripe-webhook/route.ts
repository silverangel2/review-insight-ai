import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseFetch } from "@/lib/supabaseServer";
import { stripeTestKey, verifyStripeSignature } from "@/lib/advertiserFlow";

export const runtime = "nodejs";

// Stripe webhook (test mode). checkout.session.completed -> mark campaign paid.
// The ad goes live automatically inside its scheduled window (settings route filters by starts_at/ends_at).
export async function POST(request: Request) {
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET)) return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  if (!stripeTestKey().key) return NextResponse.json({ error: "Test mode only." }, { status: 400 });
  const event = JSON.parse(payload) as { type?: string; livemode?: boolean; data?: { object?: { id?: string; payment_status?: string; metadata?: { campaign_id?: string }; client_reference_id?: string } } };
  if (event.livemode) return NextResponse.json({ error: "Live events are refused in this build." }, { status: 400 });
  if (event.type !== "checkout.session.completed") return NextResponse.json({ ok: true, ignored: event.type });
  const s = event.data?.object || {};
  const id = s.metadata?.campaign_id || s.client_reference_id;
  if (!id || s.payment_status !== "paid" || !isSupabaseConfigured()) return NextResponse.json({ ok: true, ignored: "not paid" });
  const now = new Date().toISOString();
  const app = await supabaseFetch(`/rest/v1/advertiser_applications?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ payment_status: "paid", paid_at: now, stripe_session_id: s.id, updated_at: now }) });
  const ad = await supabaseFetch(`/rest/v1/sponsor_ads?application_id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ payment_status: "paid", paid_at: now, stripe_session_id: s.id, active: true, status: "approved", updated_at: now }) });
  return NextResponse.json({ ok: app.ok && ad.ok });
}
