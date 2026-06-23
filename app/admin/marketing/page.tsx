import { DashboardShell } from "@/components/DashboardShell";
import { MarketingCampaignManager } from "@/components/marketing/MarketingCampaignManager";

export default function AdminMarketingPage() {
  return (
    <DashboardShell
      title="Marketing Campaigns"
      subtitle="Prepare and send ReviewIntel email campaigns to users with marketing consent."
      experience="admin"
    >
      <div className="space-y-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ocean dark:text-cyan-200">
            Admin
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">
            ReviewIntel Marketing Campaigns
          </h1>
          <p className="mt-3 max-w-3xl text-slate-700 dark:text-slate-300">
            Prepare ReviewIntel advertising links for Google Ads, TikTok, Facebook,
            Reddit, YouTube, newsletters, and affiliate placements.
          </p>
        </div>

        <MarketingCampaignManager />
      </div>
    </DashboardShell>
  );
}
