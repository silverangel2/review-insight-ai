import type { Metadata } from "next";
import { isSupabaseConfigured, supabaseSelect } from "@/lib/supabaseServer";
import { summarizeAdminAnalytics } from "@/lib/adminAnalytics";

// Admin-only: protected by app/admin/layout.tsx (admin session cookie) and middleware.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin analytics", robots: { index: false, follow: false } };

async function load(days: number) {
  if (!isSupabaseConfigured()) return null;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  try {
    const [analyses, traffic] = await Promise.all([
      supabaseSelect("analyses", `select=mode,product_name,analysis_json&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=2000`),
      supabaseSelect("site_traffic_events", `select=event_type,metadata&event_type=in.(affiliate_click,affiliate_impression)&created_at=gte.${encodeURIComponent(since)}&limit=10000`),
    ]);
    return summarizeAdminAnalytics(analyses as Record<string, unknown>[], traffic as Record<string, unknown>[], days);
  } catch { return null; }
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-900/5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-semibold text-slate-900">{value.toLocaleString()}</p></div>;
}

export default async function AdminAnalyticsPage() {
  const data = await load(30);
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
      <p className="inline-flex rounded-full bg-lavender px-3 py-1 text-sm font-semibold text-slate-700">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-900">Analytics, last 30 days</h1>
      <p className="mt-2 text-sm text-slate-600">From stored scans and tracked events only. Nothing estimated.</p>
      {!data ? <p className="mt-6 rounded-2xl bg-butter p-5 text-sm text-slate-700">Database not configured or unreachable, so no numbers to show.</p> : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Scans" value={data.scans} /><Stat label="Shopper scans" value={data.buyerScans} />
            <Stat label="Affiliate clicks" value={data.affiliateClicks} /><Stat label="Affiliate impressions" value={data.affiliateImpressions} />
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {([["Verdict mix", data.verdictMix.map(v => [v.verdict, v.count])], ["Affiliate clicks by link kind", data.clicksByKind.map(c => [c.kind, c.count])], ["Top scanned products", data.topProducts.map(p => [p.title, p.scans])]] as const).map(([title, rows]) => (
              <section key={title} className="rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-900/5">
                <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                {rows.length ? (
                  <ul className="mt-3 space-y-2 text-sm">
                    {rows.map(([k, n]) => <li key={String(k)} className="flex justify-between gap-3"><span className="min-w-0 truncate text-slate-700">{k}</span><span className="font-semibold text-slate-900">{n}</span></li>)}
                  </ul>
                ) : <p className="mt-2 text-sm text-slate-500">No data yet.</p>}
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
