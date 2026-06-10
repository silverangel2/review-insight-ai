import { AdSettingsPanel } from "@/components/advertising/AdSettingsPanel";
import { AdminAdvertisingManager } from "@/components/advertising/AdminAdvertisingManager";
import { defaultAdSettings, reviewIntelPlaceholderAds } from "@/lib/adConfig";

export default function AdminAdvertisingPage() {
  return (
    <main className="min-h-screen bg-sand px-6 py-10 text-ink dark:bg-slate-950 dark:text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ocean dark:text-cyan-200">
            Admin
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Advertising Control Center</h1>
          <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
            Review advertiser applications, approve sponsors, and pause or activate ads anytime.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-line dark:border-white/10 bg-white dark:bg-white/[0.04] p-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">Global ads</p>
            <p className="mt-2 text-2xl font-black">
              {defaultAdSettings.adsEnabled ? "Ready" : "Off"}
            </p>
          </div>

          <div className="rounded-3xl border border-line dark:border-white/10 bg-white dark:bg-white/[0.04] p-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">Direct sponsors</p>
            <p className="mt-2 text-2xl font-black">
              {defaultAdSettings.directSponsorAdsEnabled ? "Ready" : "Off"}
            </p>
          </div>

          <div className="rounded-3xl border border-line dark:border-white/10 bg-white dark:bg-white/[0.04] p-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">Google Ads</p>
            <p className="mt-2 text-2xl font-black">
              {defaultAdSettings.googleAdsEnabled ? "Ready" : "Off"}
            </p>
          </div>

          <div className="rounded-3xl border border-line dark:border-white/10 bg-white dark:bg-white/[0.04] p-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">Placeholder ads</p>
            <p className="mt-2 text-2xl font-black">{reviewIntelPlaceholderAds.length}</p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-cyan-200/15 bg-cyan-50 dark:bg-cyan-300/[0.06] p-6">
          <h2 className="text-2xl font-black">Automatic sponsor flow</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            {["Advertiser applies", "You approve", "Sponsor ad is created", "You pause/activate anytime"].map((item, index) => (
              <div key={item} className="rounded-2xl border border-line dark:border-white/10 bg-white dark:bg-slate-950/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-ocean dark:text-cyan-200">
                  Step {index + 1}
                </p>
                <p className="mt-2 font-semibold">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <AdSettingsPanel />

          <AdminAdvertisingManager />
        </div>
      </section>
    </main>
  );
}
