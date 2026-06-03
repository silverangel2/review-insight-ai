import Link from "next/link";
import { DashboardMetric, DashboardShell, MiniBarChart } from "@/components/DashboardShell";
import { InsightList } from "@/components/InsightList";
import { ProOnlyGate } from "@/components/ProOnlyGate";
import { SellerImprovementCalendar } from "@/components/SellerImprovementCalendar";
import { SponsorAnalytics } from "@/components/SponsorAnalytics";
import { SponsoredResources } from "@/components/SponsoredResources";

export default function SellerDashboardPage() {
  return (
    <ProOnlyGate>
      <DashboardShell
        title="Seller dashboard"
        subtitle="Your seller workspace starts empty. Complaint clusters, feature requests, satisfaction, exports, and calendar records appear only after real seller scans."
        experience="seller"
      >
        <SponsorAnalytics placement="seller_dashboard" />

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <DashboardMetric label="Pain points" value="0" detail="Real complaint clusters will appear here." tone="good" />
          <DashboardMetric label="Feature requests" value="0" detail="Customer-requested improvements appear after scans." tone="info" />
          <DashboardMetric label="Satisfaction" value="—" detail="Calculated after real seller scans." tone="warn" />
          <DashboardMetric label="Exports" value="0" detail="CSV/PDF exports created from real reports." tone="info" />
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <InsightList
            title="Seller recommendations"
            tone="info"
            items={[
              "No seller scan data yet.",
              "Run a seller analysis to generate complaint clusters, feature requests, keyword intelligence, and improvement priorities.",
              "Seller Pro calendar entries should come from saved real scan summaries."
            ]}
          />
          <MiniBarChart
            items={[
              { label: "Complaints", value: 0, tone: "bad" },
              { label: "Feature requests", value: 0, tone: "info" },
              { label: "Positive signals", value: 0, tone: "good" },
              { label: "Exported reports", value: 0, tone: "warn" }
            ]}
          />
        </section>

        <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <h2 className="text-2xl font-black text-ink dark:text-white">Start your seller data</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            This seller dashboard is now zeroed. It will no longer show fake pain points, fake feature requests, fake satisfaction, or fake export readiness.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/analyze" className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
              Run Seller Analysis
            </Link>
            <Link href="/compare" className="rounded-xl border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-ocean hover:text-ocean dark:border-white/10 dark:text-white">
              Competitor Compare
            </Link>
          </div>
        </section>

        <SellerImprovementCalendar />
        <SponsoredResources placement="seller_dashboard" />
      </DashboardShell>
    </ProOnlyGate>
  );
}
