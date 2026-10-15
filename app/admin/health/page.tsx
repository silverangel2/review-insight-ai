import { DashboardShell } from "@/components/DashboardShell";
import {
  readHealthSnapshots,
  windowOf,
  formatDelta,
  formatRevenue,
  type WindowCounts,
} from "@/lib/adminHealth";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4 shadow-soft">
      <h2 className="text-sm font-black uppercase tracking-wide text-ink/70">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FunnelRow({
  label,
  today,
  yesterday,
  last7d,
}: {
  label: string;
  today: number;
  yesterday: number;
  last7d: number;
}) {
  return (
    <tr className="border-t border-line/60">
      <td className="py-2 pr-4 text-sm font-semibold text-ink">{label}</td>
      <td className="py-2 pr-4 text-right text-sm font-black text-ink">{today}</td>
      <td className="py-2 pr-4 text-right text-sm text-ink/70">
        {yesterday}{" "}
        <span className="text-xs">({formatDelta(today, yesterday)})</span>
      </td>
      <td className="py-2 text-right text-sm text-ink/70">{last7d}</td>
    </tr>
  );
}

export default async function AdminHealthPage() {
  const snapshots = await readHealthSnapshots(8);
  const latest = snapshots[0];

  if (!latest) {
    return (
      <DashboardShell
        title="App Health"
        subtitle="One glance at ReviewIntel: funnel, scans, money, reliability, and data-integrity alerts."
        experience="admin"
      >
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <p className="text-sm font-bold text-ink">
            No health snapshots yet.
          </p>
          <p className="mt-2 text-sm text-ink/70">
            Apply{" "}
            <code className="rounded bg-mist px-1">supabase/migrations/20261015_admin_health_snapshots.sql</code>{" "}
            in Supabase, then let the daily cron{" "}
            <code className="rounded bg-mist px-1">/api/cron/health-snapshot</code>{" "}
            (scheduled 11:30 UTC) write the first row. This page renders the
            latest snapshot with today-vs-yesterday and 7-day comparisons.
          </p>
        </section>
      </DashboardShell>
    );
  }

  const t: WindowCounts = windowOf(latest, "today");
  const y: WindowCounts = windowOf(latest, "yesterday");
  const d7: WindowCounts = windowOf(latest, "last7d");
  const m = latest.metrics;
  const alerts = latest.alerts ?? [];
  const warns = alerts.filter((a) => a.severity === "warn");
  const infos = alerts.filter((a) => a.severity !== "warn");

  const funnel: Array<[string, number, number, number]> = [
    ["Page views", t.pageViews, y.pageViews, d7.pageViews],
    ["Unique visitors", t.uniqueVisitors, y.uniqueVisitors, d7.uniqueVisitors],
    ["Sign-ins", t.signIns, y.signIns, d7.signIns],
    ["Signups", t.signUps, y.signUps, d7.signUps],
    ["Scans completed", t.scans, y.scans, d7.scans],
    ["— buyer scans", t.scansBuyer, y.scansBuyer, d7.scansBuyer],
    ["— seller scans", t.scansSeller, y.scansSeller, d7.scansSeller],
    ["— link scans", t.linkScans, y.linkScans, d7.linkScans],
    ["— screenshot scans", t.screenshotScans, y.screenshotScans, d7.screenshotScans],
    ["Store rating present", t.aggregatePresent, y.aggregatePresent, d7.aggregatePresent],
    ["Store rating missing", t.aggregateMissing, y.aggregateMissing, d7.aggregateMissing],
    ["Checkouts started", t.checkoutsStarted, y.checkoutsStarted, d7.checkoutsStarted],
    ["Affiliate clicks", t.affiliateClicks, y.affiliateClicks, d7.affiliateClicks],
    ["Affiliate impressions", t.affiliateImpressions, y.affiliateImpressions, d7.affiliateImpressions],
    ["Emails sent", t.emailsSent, y.emailsSent, d7.emailsSent],
    ["Emails failed", t.emailsFailed, y.emailsFailed, d7.emailsFailed],
  ];

  return (
    <DashboardShell
      title="App Health"
      subtitle={`Snapshot ${latest.snapshot_date}${m.generatedAt ? ` · written ${m.generatedAt}` : ""}`}
      experience="admin"
    >
      <div className="space-y-6">
        {warns.length > 0 && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <h2 className="text-sm font-black uppercase tracking-wide text-red-700">
              Needs attention ({warns.length})
            </h2>
            <ul className="mt-2 space-y-2">
              {warns.map((a) => (
                <li key={a.code} className="text-sm text-red-800">
                  <span className="font-bold">{a.message}</span>
                  {a.detail ? <span className="text-red-600"> — {a.detail}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        <Card title="Funnel — today / yesterday / last 7 days">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="pr-4 text-xs font-bold uppercase text-ink/50">Metric</th>
                <th className="pr-4 text-right text-xs font-bold uppercase text-ink/50">Today</th>
                <th className="pr-4 text-right text-xs font-bold uppercase text-ink/50">Yesterday</th>
                <th className="text-right text-xs font-bold uppercase text-ink/50">7 days</th>
              </tr>
            </thead>
            <tbody>
              {funnel.map(([label, a, b, c]) => (
                <FunnelRow key={label} label={label} today={a} yesterday={b} last7d={c} />
              ))}
            </tbody>
          </table>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Verdict mix (7 days)">
            {m.verdictMix && m.verdictMix.length ? (
              <ul className="space-y-1">
                {m.verdictMix.map((v) => (
                  <li key={v.verdict} className="flex justify-between text-sm">
                    <span className="font-semibold text-ink">{v.verdict}</span>
                    <span className="font-black text-ink">{v.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/60">No verdict data.</p>
            )}
          </Card>

          <Card title="Top pages (7 days)">
            {m.topPages && m.topPages.length ? (
              <ul className="space-y-1">
                {m.topPages.map((p) => (
                  <li key={p.label} className="flex justify-between text-sm">
                    <span className="truncate font-semibold text-ink">{p.label}</span>
                    <span className="ml-4 font-black text-ink">{p.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/60">No page data.</p>
            )}
          </Card>

          <Card title="Review library">
            {m.library ? (
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="font-semibold text-ink">Products</dt>
                  <dd className="font-black text-ink">{m.library.products}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-semibold text-ink">Stored reviews</dt>
                  <dd className="font-black text-ink">{m.library.storedReviews}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-semibold text-ink">Scans consolidated</dt>
                  <dd className="font-black text-ink">{m.library.consolidatedScans}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-ink/60">
                Library table not present yet — apply the product-library migration.
              </p>
            )}
          </Card>

          <Card title="Money (7 days)">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="font-semibold text-ink">Paid events</dt>
                <dd className="font-black text-ink">{m.money?.paidCount7d ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-ink">Revenue</dt>
                <dd className="font-black text-ink">
                  {formatRevenue(m.money?.revenueByCurrency7d)}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-ink/50">
              Raw amounts from the payments table; affiliate commissions are not
              tracked by any network API.
            </p>
          </Card>

          <Card title="Reliability">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="font-semibold text-ink">Security events (7d)</dt>
                <dd className="font-black text-ink">
                  {Object.entries(m.security?.severityTally ?? {})
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ") || "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-ink">Unresolved support messages</dt>
                <dd className="font-black text-ink">
                  {m.support?.unresolvedMessages ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-ink">Newest email error</dt>
                <dd className="max-w-[60%] text-right font-semibold text-ink">
                  {m.emails?.newestError ?? "none"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card title="Services">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="font-semibold text-ink">Supabase</dt>
                <dd className="font-black text-ink">
                  {m.services?.supabaseConfigured ? "configured" : "missing"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-ink">Stripe</dt>
                <dd className="font-black text-ink">
                  {m.services?.stripeConfigured ? "configured" : "missing"}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-ink/50">
              Environment presence only. Full diagnostics live on{" "}
              <a className="underline" href="/admin/system">System Checks</a>.
            </p>
          </Card>
        </div>

        {infos.length > 0 && (
          <Card title={`Notes (${infos.length})`}>
            <ul className="space-y-1">
              {infos.map((a) => (
                <li key={a.code} className="text-sm text-ink/80">
                  <span className="font-bold">{a.message}</span>
                  {a.detail ? <span className="text-ink/60"> — {a.detail}</span> : null}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {snapshots.length > 1 && (
          <Card title="Snapshot history">
            <ul className="space-y-1">
              {snapshots.map((s) => (
                <li key={s.snapshot_date} className="flex justify-between text-sm">
                  <span className="font-semibold text-ink">{s.snapshot_date}</span>
                  <span className="text-ink/60">
                    {(s.alerts ?? []).filter((a) => a.severity === "warn").length} warning(s)
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
