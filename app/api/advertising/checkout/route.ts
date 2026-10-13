import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseFetch } from "@/lib/supabaseServer";
import { createCheckoutSession, verifyCampaignToken } from "@/lib/advertiserFlow";
import { adPackages } from "@/lib/adConfig";

export const runtime = "nodejs";

// Signed payment link (emailed on approval) -> Stripe Checkout (test mode only).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = verifyCampaignToken(url.searchParams.get("t") || "", "pay");
  if (!id || !isSupabaseConfigured()) return NextResponse.json({ error: "Invalid or expired payment link." }, { status: 400 });
  const res = await supabaseFetch(`/rest/v1/advertiser_applications?id=eq.${encodeURIComponent(id)}&select=id,status,payment_status,package_id,contact_email&limit=1`, { method: "GET" });
  const row = res.ok ? ((await res.json()) as Record<string, string>[])[0] : null;
  if (!row || row.status !== "approved") return NextResponse.json({ error: "This campaign isn't approved for payment." }, { status: 400 });
  if (row.payment_status === "paid") return NextResponse.redirect(new URL("/advertise?paid=1", url.origin));
  const pkg = adPackages[(row.package_id as keyof typeof adPackages)] || adPackages.sponsored_monthly;
  const session = await createCheckoutSession({ campaignId: id, packageId: pkg.id, packageName: pkg.name, email: row.contact_email, origin: url.origin });
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: 503 });
  await supabaseFetch(`/rest/v1/advertiser_applications?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ stripe_session_id: session.id, updated_at: new Date().toISOString() }) }).catch(() => null);
  return NextResponse.redirect(session.url, 303);
}
