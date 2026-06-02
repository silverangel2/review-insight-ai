import { DashboardMetric, DashboardShell, MiniBarChart } from "@/components/DashboardShell";
import { InsightList } from "@/components/InsightList";

export default function BuyerDashboardPage() {
  return (
    <DashboardShell
      title="Shopper dashboard"
      subtitle="For shoppers who want buying recommendations, product pros and cons, fake-review warning indicators, saved products, favorites, and comparison history."
      experience="buyer"
    >
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric label="Saved products" value="12" detail="Favorites and bookmarked product analyses." tone="good" />
        <DashboardMetric label="Compare queue" value="4" detail="Products ready for side-by-side comparison." tone="info" />
        <DashboardMetric label="Avoid flags" value="3" detail="Products with strong risk signals." tone="bad" />
        <DashboardMetric label="Confidence avg." value="78%" detail="Average evidence confidence." tone="warn" />
      </section>
      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <InsightList
          title="Shopper signals"
          tone="good"
          items={[
            "Product score and recommendation are saved with each analysis.",
            "Fake-review warning indicators are shown separately from product complaints.",
            "Favorites are modeled in the database for cross-device sync."
          ]}
        />
        <MiniBarChart
          items={[
            { label: "Buy", value: 58, tone: "good" },
            { label: "Maybe", value: 31, tone: "warn" },
            { label: "Avoid", value: 11, tone: "bad" }
          ]}
        />
      </section>
    </DashboardShell>
  );
}
