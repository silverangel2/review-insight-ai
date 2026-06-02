import Link from "next/link";
import { Badge } from "@/components/Badge";

type DashboardExperience = "buyer" | "seller" | "admin";

const navItems: Record<DashboardExperience, Array<[string, string]>> = {
  buyer: [
    ["/dashboard/customer", "Shopper Home"],
    ["/analyze", "Paste Reviews"],
    ["/compare", "Compare Products"],
    ["/account", "Account"]
  ],
  seller: [
    ["/dashboard/seller", "Seller Home"],
    ["/analyze", "Deep Analysis"],
    ["/compare", "Competitor Compare"],
    ["/account", "Billing"]
  ],
  admin: [
    ["/admin", "Control Center"],
    ["/admin/seo", "SEO Manager"],
    ["/dashboard/customer", "Test Shopper"],
    ["/dashboard/seller", "Test Seller"],
    ["/analyze", "Test Analyzer"],
    ["/compare", "Test Compare"],
    ["/contact", "Support"]
  ]
};

export function DashboardShell({
  title,
  subtitle,
  children,
  experience = "buyer"
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  experience?: DashboardExperience;
}) {
  const workspaceLabel = experience === "admin" ? "Control Center" : experience === "seller" ? "Seller Workspace" : "Shopper Workspace";
  const badge = experience === "admin" ? "Admin" : experience === "seller" ? "Seller" : "Shopper";
  const badgeTone = experience === "admin" ? "good" : experience === "seller" ? "info" : "warn";

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="rounded-2xl bg-ink p-4 text-white dark:bg-white dark:text-ink">
          <p className="text-xs font-bold uppercase opacity-70">Workspace</p>
          <p className="mt-2 text-lg font-black">{workspaceLabel}</p>
          <p className="mt-1 text-xs opacity-70">ReviewIntel</p>
        </div>
        <nav className="mt-4 grid gap-2">
          {navItems[experience].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-mist hover:text-ink dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white">
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
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Support</p>
          <Link href="/manage-subscription" className="text-sm font-bold text-ocean transition hover:text-teal dark:text-cyan-300">
            Manage subscription
          </Link>
          <Link href="/billing-support" className="text-sm font-bold text-ocean transition hover:text-teal dark:text-cyan-300">
            Billing support
          </Link>
          <Link href="/faq" className="text-sm font-bold text-ocean transition hover:text-teal dark:text-cyan-300">
            FAQ
          </Link>
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
