import Link from "next/link";
import { Badge } from "@/components/Badge";

type DashboardExperience = "buyer" | "seller" | "admin";

const navItems: Record<DashboardExperience, Array<[string, string]>> = {
  buyer: [
    ["/dashboard/customer", "Shopper Home"],
    ["/analyze", "Analyze Product"],
    ["/compare", "Compare Products"],
    ["/account", "Account"]
  ],
  seller: [
    ["/seller/analyze", "Deep Analysis"],
    ["/seller/result", "Results"],
    ["/manage-subscription", "Billing"],
  ],
  admin: [
    ["/admin", "Control Center"],
    ["/admin/customers", "Customers"],
    ["/admin/email", "Email"],
    ["/admin/security", "Security"],
    ["/admin/seo", "SEO Manager"],
    ["/admin/advertising", "Advertising"],
    ["/admin/finance", "Finance"],
    ["/admin/system", "System Checks"],
  ]
};

export function DashboardShell({
  title,
  subtitle,
  children,
  experience = "buyer",
  fullWidth = false
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  experience?: DashboardExperience;
  fullWidth?: boolean;
}) {
  const analyzeHref = experience === "seller" ? "/seller/analyze" : "/analyze";
  const workspaceLabel = experience === "admin" ? "Control Center" : experience === "seller" ? "Seller Workspace" : "Shopper Workspace";
  const badge = experience === "admin" ? "Admin" : experience === "seller" ? "Seller" : "Shopper";
  const badgeTone = experience === "admin" ? "good" : experience === "seller" ? "info" : "warn";

  return (
    <main
      className={
        fullWidth
          ? "mx-auto grid w-full max-w-none gap-6 px-4 py-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:px-6"
          : "mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[260px_minmax(0,1fr)]"
      }
    >
      <aside className="rounded-2xl border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="rounded-2xl bg-ink p-4 text-white dark:bg-white dark:text-ink">
          <p className="text-xs font-bold uppercase opacity-70">Workspace</p>
          <p className="mt-2 text-lg font-black">{workspaceLabel}</p>
          <p className="mt-1 text-xs opacity-70">ReviewIntel</p>
        </div>
        <nav className="mt-4 grid gap-2">
          {navItems[experience].map(([href, label]) => (
            <Link key={`${label}-${href}`} href={href} className="rounded-2xl border border-line bg-slate-50 px-5 py-4 text-base font-black text-slate-700 shadow-sm transition hover:border-ocean hover:bg-white hover:text-ink dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 rounded-2xl border border-line p-4 dark:border-white/10">
          <Badge tone={badgeTone}>{badge}</Badge>
          <p className="mt-3 text-sm font-bold text-ink dark:text-white">
            {experience === "admin" ? "All limits bypassed" : experience === "seller" ? "Business intelligence" : "Shopping assistant"}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {experience === "admin"
              ? "Private controls for testing, settings, quotas, and platform operations."
              : experience === "seller"
                ? "Seller tools stay separate from shopper purchase decisions."
                : "Shopper tools stay simple and recommendation-focused."}
          </p>
        </div>
        <div className="mt-4 grid gap-2 rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">
            {experience === "admin" ? "Quick access" : "Support"}
          </p>
          {experience === "admin" ? (
            <>
              <Link href={analyzeHref} className="text-sm font-bold text-ocean transition hover:text-teal dark:text-cyan-300">
                Test shopper scan
              </Link>
              <Link href="/dashboard/seller" className="text-sm font-bold text-ocean transition hover:text-teal dark:text-cyan-300">
                Test seller dashboard
              </Link>
              <Link href="/seller/analyze" className="text-sm font-bold text-ocean transition hover:text-teal dark:text-cyan-300">
                Test seller analysis
              </Link>
              <Link href="/admin/marketing" className="text-sm font-bold text-ocean transition hover:text-teal dark:text-cyan-300">
                Marketing
              </Link>
              <Link href="/admin/calendar" className="text-sm font-bold text-ocean transition hover:text-teal dark:text-cyan-300">
                Calendar
              </Link>
            </>
          ) : (
            <>
              <Link href="/account" className="block rounded-xl px-4 py-2 font-black text-ocean hover:bg-white">
                Profile
              </Link>
              <Link href="/manage-subscription" className="text-sm font-bold text-ocean transition hover:text-teal dark:text-cyan-300">
                Manage subscription
              </Link>
              <Link href="/billing-support" className="text-sm font-bold text-ocean transition hover:text-teal dark:text-cyan-300">
                Billing support
              </Link>
              <Link href="/faq" className="text-sm font-bold text-ocean transition hover:text-teal dark:text-cyan-300">
                FAQ
              </Link>
            </>
          )}
        </div>
      </aside>

      <section className="min-w-0">
        <div className="mb-6 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <Badge tone="info">Dashboard</Badge>
          <h1 className="mt-4 text-3xl font-black text-ink dark:text-white">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p>
        </div>
        {children}
      </section>
    </main>
  );
}

export function DashboardMetric({ label, value, detail, tone = "info" }: { label: string; value: string; detail: string; tone?: "info" | "good" | "warn" | "bad" }) {
  const color = {
    info: "text-ocean dark:text-cyan-300",
    good: "text-teal",
    warn: "text-amber",
    bad: "text-coral"
  }[tone];

  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-4 text-3xl font-black ${color}`}>{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{detail}</p>
    </article>
  );
}

export function MiniBarChart({ items }: { items: Array<{ label: string; value: number; tone?: "good" | "warn" | "bad" | "info" }> }) {
  const color = {
    info: "bg-ocean",
    good: "bg-teal",
    warn: "bg-amber",
    bad: "bg-coral"
  };

  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Trend snapshot</p>
      <div className="mt-5 grid gap-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>{item.label}</span>
              <span>{item.value}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div className={`h-full rounded-full ${color[item.tone ?? "info"]}`} style={{ width: `${Math.min(100, Math.max(4, item.value))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
