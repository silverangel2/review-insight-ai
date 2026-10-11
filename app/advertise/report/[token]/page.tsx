import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSupabaseConfigured, supabaseFetch } from "@/lib/supabaseServer";
import { ctr, verifyCampaignToken } from "@/lib/advertiserFlow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Campaign report", robots: { index: false, follow: false } };

async function rows<T>(path: string): Promise<T[]> {
  const res = await supabaseFetch(path, { method: "GET" }).catch(() => null);
  return res?.ok ? ((await res.json()) as T[]) : [];
}

// Private, read-only report for one advertiser (signed link; no login, no edits).
export default async function CampaignReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = verifyCampaignToken(decodeURIComponent(token), "report");
  if (!id || !isSupabaseConfigured()) notFound();
  const [app] = await rows<Record<string, string>>(`/rest/v1/advertiser_applications?id=eq.${encodeURIComponent(id)}&select=brand_name,status,payment_status,package_name&limit=1`);
  if (!app) notFound();
  const [ad] = await rows<Record<string, string>>(`/rest/v1/sponsor_ads?application_id=eq.${encodeURIComponent(id)}&select=id,headline,placement,starts_at,ends_at,active,status,payment_status&limit=1`);
  const events = ad ? await rows<{ event_type: string }>(`/rest/v1/sponsor_ad_events?sponsor_id=eq.${encodeURIComponent(ad.id)}&select=event_type&limit=100000`) : [];
  const impressions = events.filter(e => e.event_type === "impression").length;
  const clicks = events.filter(e => e.event_type === "click").length;
  const day = (v?: string) => (v ? new Date(v).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "Not scheduled");
  const live = ad && ad.active && ad.payment_status === "paid" && (!ad.starts_at || Date.parse(ad.starts_at) <= Date.now()) && (!ad.ends_at || Date.parse(ad.ends_at) > Date.now());
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
      <p className="inline-flex rounded-full bg-lavender px-3 py-1 text-sm font-semibold text-slate-700">Campaign report</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-900">{app.brand_name}</h1>
      <p className="mt-2 text-sm text-slate-600">{ad?.headline || "Campaign not created yet"} · {app.package_name || "Sponsored placement"} · {live ? "Live" : app.payment_status === "paid" ? "Paid, scheduled" : app.status === "approved" ? "Approved, awaiting payment" : "In review"}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[["Impressions", impressions.toLocaleString()], ["Clicks", clicks.toLocaleString()], ["Click-through rate", ctr(impressions, clicks)]].map(([k, v]) => (
          <div key={k} className="rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-900/5"><p className="text-sm text-slate-500">{k}</p><p className="mt-1 text-3xl font-semibold text-slate-900">{v}</p></div>
        ))}
      </div>
      <dl className="mt-6 grid gap-3 rounded-[1.5rem] bg-mint p-5 text-sm sm:grid-cols-3">
        <div><dt className="text-slate-600">Starts</dt><dd className="font-semibold text-slate-900">{day(ad?.starts_at)}</dd></div>
        <div><dt className="text-slate-600">Ends</dt><dd className="font-semibold text-slate-900">{day(ad?.ends_at)}</dd></div>
        <div><dt className="text-slate-600">Placement</dt><dd className="font-semibold text-slate-900">{ad?.placement || "-"}</dd></div>
      </dl>
      <p className="mt-6 text-xs text-slate-500">Counts come from ReviewIntel&apos;s own counters and may differ from your analytics. This link is private; don&apos;t share it publicly.</p>
    </main>
  );
}
