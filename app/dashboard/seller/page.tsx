import { DashboardMetric, DashboardShell, MiniBarChart } from "@/components/DashboardShell";
import { InsightList } from "@/components/InsightList";
import { ProOnlyGate } from "@/components/ProOnlyGate";
import { SellerProCommandPanel } from "@/components/SellerProCommandPanel";
import { SellerImprovementCalendar } from "@/components/SellerImprovementCalendar";
import { SellerProductHealthTracker } from "@/components/SellerProductHealthTracker";
import { SponsorAnalytics } from "@/components/SponsorAnalytics";
import { SponsoredResources } from "@/components/SponsoredResources";

export default function SellerDashboardPage() {
  return (
    <ProOnlyGate>
      <DashboardShell
        title="Seller dashboard"
        subtitle="For ecommerce operators tracking complaint clusters, customer pain points, feature requests, packaging issues, support issues, keyword frequency, exports, and AI recommendations."
        experience="seller"
      >
        <SponsorAnalytics placement="seller_dashboard" />
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <DashboardMetric label="Pain points" value="18" detail="Clustered review complaint themes." tone="bad" />
          <DashboardMetric label="Feature requests" value="9" detail="Customer-requested product improvements." tone="info" />
          <DashboardMetric label="Satisfaction" value="74%" detail="Shared scoring benchmark from seller scans." tone="good" />
          <DashboardMetric label="Exports" value="Ready" detail="CSV/PDF report paths are modeled." tone="warn" />
        </section>
        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <InsightList
            title="Seller recommendations"
            tone="info"
            items={[
              "Fix recurring packaging damage before increasing ad spend.",
              "Rewrite listing bullets around setup expectations and compatibility.",
              "Create support macros for replacement-part and warranty questions."
            ]}
          />
          <MiniBarChart
            items={[
              { label: "Product quality", value: 68, tone: "warn" },
              { label: "Shipping complaints", value: 41, tone: "bad" },
              { label: "Listing clarity", value: 57, tone: "info" },
              { label: "Support satisfaction", value: 76, tone: "good" }
            ]}
          />
        </section>
        <div className="mt-6">
          <SellerProductHealthTracker />
        </div>
        <div className="mt-6">
          <SellerProCommandPanel />
        </div>
        <div className="mt-6">
          <SellerImprovementCalendar />
        </div>
        <div className="mt-6">
          <SponsoredResources
            placement="seller_dashboard"
            compact
            eyebrow="Trusted ecommerce tools"
            title="Partner resources for sellers"
            description="Optional sponsored resources for seller operations, fulfillment, product research, and listing improvement."
          />
        </div>
      </DashboardShell>
    </ProOnlyGate>
  );
}
