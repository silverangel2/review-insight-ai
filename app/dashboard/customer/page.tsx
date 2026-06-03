import Link from "next/link";
import { DashboardMetric, DashboardShell, MiniBarChart } from "@/components/DashboardShell";
import { InsightList } from "@/components/InsightList";

export default function BuyerDashboardPage() {
  return (
    <DashboardShell
      title="Shopper dashboard"
      subtitle="Your shopper workspace starts empty. Saved products, comparisons, avoid flags, and confidence scores appear only after real scans."
      experience="buyer"
    >
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric label="Saved products" value="0" detail="Real saved product analyses will appear here." tone="info" />
        <DashboardMetric label="Compare queue" value="0" detail="Products added for comparison will appear here." tone="info" />
        <DashboardMetric label="Avoid flags" value="0" detail="Risk flags appear after real product scans." tone="good" />
        <DashboardMetric label="Confidence avg." value="—" detail="Confidence is calculated after real scans." tone="warn" />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <InsightList
          title="Shopper signals"
          tone="good"
          items={[
            "No shopper scan data yet.",
            "Run an analysis to save product score, recommendation, fake-review risk, and complaints.",
            "Use Compare to build real side-by-side product history."
          ]}
        />
        <MiniBarChart
          items={[
            { label: "Buy", value: 0, tone: "good" },
            { label: "Maybe", value: 0, tone: "warn" },
            { label: "Avoid", value: 0, tone: "bad" }
          ]}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <h2 className="text-2xl font-black text-ink dark:text-white">Start your real dashboard</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          This dashboard is now zeroed. It will no longer show fake saved products, fake confidence, or fake avoid flags.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/analyze" className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
            Run Analyze
          </Link>
          <Link href="/compare" className="rounded-xl border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-ocean hover:text-ocean dark:border-white/10 dark:text-white">
            Compare Products
          </Link>
        </div>
      </section>
    </DashboardShell>
  );
}
