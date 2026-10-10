import { NextResponse } from "next/server";
import { readAccountSession } from "@/lib/accountSession";
import { MAX_ACTIVE_WATCHES, productKeyFromUrl, verifyUnwatchToken, watchAlertsEnabled } from "@/lib/productWatches";
import { isSupabaseConfigured, supabaseSelect, supabaseUpdate, supabaseUpsert } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
const off = () => NextResponse.json({ ok: false, enabled: false, error: "Watch alerts are not enabled." }, { status: 404 });

export async function POST(request: Request) {
  if (!watchAlertsEnabled()) return off();
  const session = readAccountSession(request);
  if (!session?.email) return NextResponse.json({ ok: false, error: "Sign in to watch a product." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { listingUrl?: string; productName?: string; verdict?: string; acceptedCount?: number; resultHash?: string };
  const productKey = productKeyFromUrl(String(body.listingUrl || ""));
  if (!productKey) return NextResponse.json({ ok: false, error: "A valid product link is required." }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: "Storage unavailable." }, { status: 503 });
  const email = session.email.trim().toLowerCase();
  const active = await supabaseSelect("product_watches", `select=product_key&profile_email=eq.${encodeURIComponent(email)}&unsubscribed_at=is.null`);
  if (active.length >= MAX_ACTIVE_WATCHES && !active.some((r) => r.product_key === productKey)) {
    return NextResponse.json({ ok: false, error: `You can watch up to ${MAX_ACTIVE_WATCHES} products.` }, { status: 409 });
  }
  const saved = await supabaseUpsert("product_watches", {
    profile_email: email, listing_url: String(body.listingUrl).slice(0, 2000), product_key: productKey,
    product_name: String(body.productName || "").slice(0, 300) || null, last_verdict: body.verdict || null,
    last_accepted_count: Number.isFinite(body.acceptedCount) ? body.acceptedCount : 0, last_result_hash: body.resultHash || null,
    unsubscribed_at: null,
  }, "profile_email,product_key");
  if (!saved) return NextResponse.json({ ok: false, error: "Could not save the watch." }, { status: 503 });
  return NextResponse.json({ ok: true, productKey });
}

/** One-click unwatch from the email link: /api/product-watches?token=... */
export async function GET(request: Request) {
  if (!watchAlertsEnabled()) return off();
  const token = new URL(request.url).searchParams.get("token") || "";
  const who = verifyUnwatchToken(token);
  if (!who) return NextResponse.json({ ok: false, error: "This link is not valid." }, { status: 400 });
  await supabaseUpdate("product_watches", `profile_email=eq.${encodeURIComponent(who.email)}&product_key=eq.${encodeURIComponent(who.productKey)}`, { unsubscribed_at: new Date().toISOString() });
  return new NextResponse("<p style=\"font-family:system-ui;padding:2rem\">You will no longer get updates for this product.</p>", { headers: { "content-type": "text/html; charset=utf-8" } });
}
