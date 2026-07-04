import type { Metadata } from "next";
import { DashboardMetric, DashboardShell } from "@/components/DashboardShell";
import { conversionRate, readTrafficSummary } from "@/lib/trafficAnalytics";

export const metadata: Metadata = {
  title: "Traffic Tracker",
  robots: {
    index: false,
    follow: false,
  },
};

function ListCard({
  title,
  items,
  empty = "No traffic yet.",
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
  empty?: string;
}) {
  return (
    <article className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <h2 className="text-lg font-black text-ink dark:text-white">{title}</h2>
      <div className="mt-4 grid gap-2">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-2xl bg-mist px-4 py-3 text-sm font-bold dark:bg-white/[0.04]"
            >
              <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">{item.label}</span>
              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-ink shadow-sm dark:bg-white/10 dark:text-white">
                {item.count}
              </span>
            </div>
          ))
        ) : (
          <p className="rounded-2xl bg-mist p-4 text-sm font-bold text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
            {empty}
          </p>
        )}
      </div>
    </article>
  );
}

export default async function AdminTrafficPage() {
  const summary = await readTrafficSummary(30);

  return (
    <DashboardShell
      title="Traffic Tracker"
      subtitle="Track promotion results by page views, visitors, source, location, device, campaign tags, pricing intent, and affiliate clicks."
      experience="admin"
    >
      <div className="grid gap-6">
        {!summary.configured ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-soft dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
            <p className="text-xs font-black uppercase tracking-[0.2em]">Setup needed</p>
            <h2 className="mt-2 text-2xl font-black">Supabase traffic storage is not configured.</h2>
            <p className="mt-2 text-sm font-bold leading-6">
              Add the Supabase env values and run the traffic migration. Public pages will continue working while tracking waits for the database.
            </p>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <DashboardMetric
            label="30-day page views"
            value={String(summary.pageViews)}
            detail="Total public page views tracked after cookie choice."
            tone="info"
          />
          <DashboardMetric
            label="Estimated visitors"
            value={String(summary.visitors)}
            detail="Privacy-safe unique visitor estimate. No raw IP stored."
            tone="good"
          />
          <DashboardMetric
            label="Today"
            value={String(summary.todayViews)}
            detail="Public page views since midnight UTC."
            tone="warn"
          />
          <DashboardMetric
            label="Affiliate clicks"
            value={String(summary.affiliateClicks)}
            detail={`Click rate: ${conversionRate(summary.affiliateClicks, summary.pageViews)}`}
            tone="good"
          />
          <DashboardMetric
            label="Pricing clicks"
            value={String(summary.pricingClicks)}
            detail="People who pressed a pricing/checkout plan button."
            tone="info"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ListCard title="Top pages" items={summary.topPaths} />
          <ListCard title="Locations" items={summary.topCountries} />
          <ListCard title="Platforms" items={summary.topDevices} />
          <ListCard title="Traffic sources" items={summary.topReferrers} />
          <ListCard title="UTM campaigns" items={summary.topCampaigns} empty="No tagged campaigns yet. Use links like /?utm_source=facebook&utm_campaign=launch." />
        </section>

        <section className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
            Recent activity
          </p>
          <div className="mt-4 grid gap-3">
            {summary.recentEvents.length ? (
              summary.recentEvents.map((event, index) => (
                <div
                  key={`${event.createdAt}-${index}`}
                  className="grid gap-2 rounded-2xl border border-line bg-mist p-4 text-sm dark:border-white/10 dark:bg-white/[0.04] md:grid-cols-[120px_minmax(0,1fr)_180px]"
                >
                  <p className="font-black uppercase tracking-[0.14em] text-ocean dark:text-cyan-300">
                    {event.type}
                  </p>
                  <div className="min-w-0">
                    <p className="truncate font-black text-ink dark:text-white">{event.path}</p>
                    <p className="mt-1 truncate font-semibold text-slate-500 dark:text-slate-400">
                      {event.location} · {event.platform}
                    </p>
                  </div>
                  <p className="font-bold text-slate-500 dark:text-slate-400">
                    {event.createdAt ? new Date(event.createdAt).toLocaleString() : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-mist p-4 text-sm font-bold text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                No traffic has been recorded yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
