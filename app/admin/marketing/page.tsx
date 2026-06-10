import { MarketingCampaignManager } from "@/components/marketing/MarketingCampaignManager";

export default function AdminMarketingPage() {
  return (
    <main className="min-h-screen bg-sand px-6 py-10 text-ink dark:bg-slate-950 dark:text-white">
      <section className="mx-auto max-w-6xl">
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
      </section>
    </main>
  );
}
