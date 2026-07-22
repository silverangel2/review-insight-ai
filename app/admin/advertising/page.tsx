import { DashboardShell } from "@/components/DashboardShell";
import { AdSettingsPanel } from "@/components/advertising/AdSettingsPanel";
import { AdminAdvertisingManager } from "@/components/advertising/AdminAdvertisingManager";
import { reviewIntelPlaceholderAds } from "@/lib/adConfig";
import { readAdSettings } from "@/lib/adSettingsStore";

function StatusCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-line bg-white p-5 dark:border-white/10 dark:bg-white/[0.04]">
      <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

export default async function AdminAdvertisingPage() {
  const settings = await readAdSettings();
  const googleAdSenseConfigured = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT &&
      process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT,
  );

  return (
    <DashboardShell
      title="Advertising Control"
      subtitle="Control Google AdSense, approved sponsor ads, and ReviewIntel house ad placements."
      experience="admin"
      fullWidth
    >
      <div className="space-y-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ocean dark:text-cyan-200">
            Admin
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Advertising Control Center</h1>
          <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
            Verify payment, approve creative, rotate sponsor campaigns, and track impressions or clicks.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatusCard
            label="Public ad slots"
            value={settings.adsEnabled ? "On" : "Off"}
            detail="Master switch for every ad location on the public website."
          />

          <StatusCard
            label="Paid sponsor ads"
            value={settings.directSponsorAdsEnabled ? "On" : "Off"}
            detail="Real advertisers you approve from applications. These show first."
          />

          <StatusCard
            label="Google AdSense"
            value={
              !settings.googleAdsEnabled
                ? "Off"
                : googleAdSenseConfigured
                  ? "Connected"
                  : "Needs setup"
            }
            detail={
              googleAdSenseConfigured
                ? "Google fills empty slots after paid sponsors when visitors accept optional ad cookies."
                : "Add AdSense client and slot env values before Google ads can show."
            }
          />

          <StatusCard
            label="ReviewIntel house ads"
            value={
              settings.placeholderAdsEnabled
                ? `${reviewIntelPlaceholderAds.length} fallback ads`
                : "Off"
            }
            detail="Your own ReviewIntel promo ads. These fill empty slots when paid ads or AdSense are unavailable."
          />
        </div>

        <div className="mt-8 rounded-3xl border border-cyan-200/15 bg-cyan-50 dark:bg-cyan-300/[0.06] p-6">
          <h2 className="text-2xl font-black">How paid sponsor ads go live</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            {["Advertiser pays and uploads", "You verify payment", "You approve creative", "System rotates the campaign"].map((item, index) => (
              <div key={item} className="rounded-2xl border border-line dark:border-white/10 bg-white dark:bg-gradient-to-r from-sky-600 to-teal-500/70 p-4">
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
      </div>
    </DashboardShell>
  );
}
