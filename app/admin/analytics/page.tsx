import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured, supabaseSelect } from "@/lib/supabaseServer";
import { summarizeAdminAnalytics } from "@/lib/adminAnalytics";
import { readAnalyticsDashboard, type AnalyticsRange } from "@/lib/trafficAnalytics";

// Admin-only: protected by app/admin/layout.tsx (admin session cookie) and middleware.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin analytics", robots: { index: false, follow: false } };

const RANGES: AnalyticsRange[] = [7, 30, 90];

async function loadScanDetail(days: number) {
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

function Stat({ label, value, hint, tint }: { label: string; value: number; hint?: string; tint: string }) {
  return (
    <div className={`rounded-[1.5rem] ${tint} p-4 ring-1 ring-slate-900/5 sm:p-5`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{value.toLocaleString()}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function ListCard({ title, rows, empty }: { title: string; rows: Array<[string, number]>; empty: string }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <section className="rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-900/5">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {rows.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map(([k, n]) => (
            <li key={k} className="relative overflow-hidden rounded-xl px-3 py-2">
              <span className="absolute inset-y-0 left-0 rounded-xl bg-teal/10" style={{ width: `${(n / max) * 100}%` }} aria-hidden="true" />
              <span className="relative flex justify-between gap-3"><span className="min-w-0 truncate text-slate-700">{k}</span><span className="font-semibold text-slate-900">{n.toLocaleString()}</span></span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">{empty}</p>}
    </section>
  );
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const requested = Number((await searchParams).range);
  const days: AnalyticsRange = (RANGES as number[]).includes(requested) ? (requested as AnalyticsRange) : 30;
  const [dash, detail] = await Promise.all([readAnalyticsDashboard(days), loadScanDetail(days)]);
  const maxDay = Math.max(1, ...dash.daily.map((d) => d.visits));
  const t = dash.totals;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6" data-testid="admin-analytics">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-teal underline-offset-2 hover:underline">← Admin</Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-600">First-party data from your own database. No outside trackers, no raw IPs, and visitors with Do Not Track are never counted.</p>
        </div>
        <nav aria-label="Date range" className="inline-flex rounded-full bg-white p-1 ring-1 ring-slate-900/10">
          {RANGES.map((r) => (
            <Link key={r} href={`/admin/analytics?range=${r}`} aria-current={r === days ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${r === days ? "bg-teal text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
              {r} days
            </Link>
          ))}
        </nav>
      </div>

      {!dash.configured ? (
        <p className="mt-6 rounded-2xl bg-butter p-5 text-sm text-slate-700">The database isn&apos;t connected here, so there are no numbers to show yet. Add the Supabase keys to see live analytics.</p>
      ) : dash.error ? (
        <p className="mt-6 rounded-2xl bg-peach p-5 text-sm text-slate-700">{dash.error}</p>
      ) : null}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Visitors</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Visits (page views)" value={t.visits} tint="bg-mint" />
        <Stat label="Unique visitors" value={t.visitors} hint="Counted by a salted hash, never an IP" tint="bg-mint" />
        <Stat label="Sign-ins" value={t.signIns} tint="bg-lavender" />
        <Stat label="New signups" value={t.signUps} tint="bg-lavender" />
      </div>
      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Money path</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Scans" value={t.scans} hint="Saved scans in this period" tint="bg-butter" />
        <Stat label="Upsell views" value={t.upsellViews} tint="bg-butter" />
        <Stat label="Checkouts started" value={t.checkouts} tint="bg-peach" />
        <Stat label="Affiliate clicks" value={t.affiliateClicks} tint="bg-peach" />
      </div>

      <section className="mt-6 rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-900/5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Daily visits and unique visitors</h2>
          <p className="text-xs text-slate-500">UTC days · <span className="inline-block h-2 w-3 rounded-sm bg-teal align-middle" /> visits <span className="ml-2 inline-block h-2 w-3 rounded-sm bg-coral align-middle" /> unique visitors</p>
        </div>
        {t.visits ? (
          <div className="mt-4 flex h-44 items-end gap-[3px]" role="img" aria-label={`Daily visits over the last ${days} days`}>
            {dash.daily.map((d) => (
              <div key={d.date} className="group relative flex h-full flex-1 items-end justify-center gap-[1px]" title={`${d.date}: ${d.visits} visits, ${d.visitors} unique`}>
                <span className="w-1/2 rounded-t bg-teal/80" style={{ height: `${(d.visits / maxDay) * 100}%`, minHeight: d.visits ? 3 : 0 }} />
                <span className="w-1/2 rounded-t bg-coral/80" style={{ height: `${(d.visitors / maxDay) * 100}%`, minHeight: d.visitors ? 3 : 0 }} />
              </div>
            ))}
          </div>
        ) : <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No visits recorded in this period yet. Visits appear here as soon as people browse the public site.</p>}
        {dash.daily.length ? <div className="mt-2 flex justify-between text-[11px] text-slate-400"><span>{dash.daily[0].date}</span><span>{dash.daily[dash.daily.length - 1].date}</span></div> : null}
        {dash.truncated ? <p className="mt-2 text-xs text-slate-500">Showing the most recent 20,000 events in this range.</p> : null}
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ListCard title="Top pages" rows={dash.topPages.map((p) => [p.label, p.count])} empty="No page views yet." />
        <ListCard title="Referrers" rows={dash.topReferrers.map((p) => [p.label, p.count])} empty="No referrers yet." />
      </div>

      <section className="mt-6 rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-900/5">
        <h2 className="text-base font-semibold text-slate-900">Recent sign-ins</h2>
        {dash.recentSignIns.length ? (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {dash.recentSignIns.map((s, i) => (
              <li key={`${s.at}-${i}`} className="flex justify-between gap-3 py-2"><span className="text-slate-700">{s.role || "customer"} · {s.method}</span><span className="text-slate-500">{s.at ? new Date(s.at).toLocaleString("en-CA", { timeZone: "America/Moncton" }) : ""}</span></li>
            ))}
          </ul>
        ) : <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No sign-ins in this period yet.</p>}
        <p className="mt-2 text-xs text-slate-500">Only the account type and sign-in method are shown; no emails are stored with these events.</p>
      </section>

      {detail ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <ListCard title="Verdict mix" rows={detail.verdictMix.map((v) => [String(v.verdict), v.count])} empty="No scans yet." />
          <ListCard title="Affiliate clicks by link type" rows={detail.clicksByKind.map((c) => [String(c.kind), c.count])} empty="No affiliate clicks yet." />
          <ListCard title="Top scanned products" rows={detail.topProducts.map((p) => [String(p.title), p.scans])} empty="No scans yet." />
        </div>
      ) : null}
    </main>
  );
}
