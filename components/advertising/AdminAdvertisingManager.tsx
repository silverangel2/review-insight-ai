"use client";

import { useEffect, useState } from "react";
import { adPackages, type AdPackageId, type AdPlacement } from "@/lib/adConfig";

type AdvertiserApplication = {
  id: string;
  brand_name: string;
  contact_name?: string | null;
  contact_email: string;
  website_url: string;
  headline?: string | null;
  campaign_goal: string;
  preferred_placement: string;
  banner_url?: string | null;
  creative_url?: string | null;
  media_type?: "image" | "video" | string | null;
  destination_url?: string | null;
  package_name?: string | null;
  package_price?: string | null;
  payment_reference?: string | null;
  payment_status?: "unpaid" | "pending_review" | "paid" | "refunded" | string | null;
  daily_impression_cap?: number | null;
  duration_days?: number | null;
  status: string;
  created_at?: string;
};

type SponsorAdRow = {
  id: string;
  sponsor_name: string;
  headline: string;
  description: string;
  image_url?: string | null;
  creative_url?: string | null;
  media_type?: "image" | "video" | string | null;
  destination_url: string;
  placement: string;
  package_name?: string | null;
  payment_status?: string | null;
  daily_impression_cap?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  active: boolean;
  status: string;
  impressions?: number;
  clicks?: number;
};

const placementOptions: Array<{ value: AdPlacement; label: string }> = [
  { value: "homepage_hero", label: "Homepage hero" },
  { value: "homepage_mid", label: "Homepage middle" },
  { value: "analyze_below_card", label: "Analyze page" },
  { value: "analyze_premium_top", label: "Premium analyze top" },
  { value: "analyze_premium_bottom", label: "Premium analyze bottom" },
  { value: "results_below_verdict", label: "Results page" },
  { value: "buyer_dashboard", label: "Buyer dashboard" },
  { value: "seller_dashboard", label: "Seller dashboard" },
  { value: "footer", label: "Footer" },
];

const packageOptions = Object.values(adPackages);

function paymentLabel(status?: string | null) {
  if (status === "paid") return "Payment verified";
  if (status === "pending_review") return "Payment needs review";
  if (status === "refunded") return "Refunded";
  return "Unpaid";
}

function statusTone(status?: string | null) {
  if (status === "paid" || status === "approved") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  if (status === "pending_review" || status === "paused") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  if (status === "rejected" || status === "unpaid") return "border-red-300/30 bg-red-300/10 text-red-100";
  return "border-white/10 bg-white/10 text-slate-200";
}

function CreativePreview({ url, type }: { url?: string | null; type?: string | null }) {
  if (!url) {
    return (
      <div className="grid h-24 w-full place-items-center rounded-2xl border border-white/10 bg-slate-900 text-xs font-bold text-slate-500 sm:w-40">
        No creative
      </div>
    );
  }

  if (type === "video") {
    return (
      <video
        src={url}
        muted
        loop
        playsInline
        controls
        className="h-24 w-full rounded-2xl border border-white/10 object-cover sm:w-40"
      />
    );
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className="h-24 w-full rounded-2xl border border-white/10 object-cover sm:w-40"
    />
  );
}

export function AdminAdvertisingManager() {
  const [applications, setApplications] = useState<AdvertiserApplication[]>([]);
  const [ads, setAds] = useState<SponsorAdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [manualPackage, setManualPackage] = useState<AdPackageId>("sponsored_monthly");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualMessage, setManualMessage] = useState("");

  async function loadData() {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/advertising", { cache: "no-store" });
      const data = await response.json();

      setApplications(Array.isArray(data.applications) ? data.applications : []);
      setAds(Array.isArray(data.ads) ? data.ads : []);
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action: string, id: string, type: "application" | "ad") {
    setBusyId(id);
    setNotice("");

    try {
      const response = await fetch("/api/admin/advertising", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "application"
            ? { action, applicationId: id }
            : { action, adId: id },
        ),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setNotice(data.error || "Advertising action failed.");
        return;
      }

      setNotice(data.message || "Advertising action saved.");
      await loadData();
    } finally {
      setBusyId(null);
    }
  }

  async function createOwnerAd(formData: FormData) {
    setManualBusy(true);
    setManualMessage("");
    formData.set("action", "create_manual");
    formData.set("packageId", manualPackage);

    if (!formData.get("active")) {
      formData.set("active", "false");
    }

    try {
      const response = await fetch("/api/admin/advertising", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setManualMessage(data.error || "Owner ad could not be created.");
        return;
      }

      setManualMessage(data.message || "Owner ad campaign created.");
      await loadData();
    } finally {
      setManualBusy(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="mt-8 grid gap-8">
      {notice ? (
        <p className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100">
          {notice}
        </p>
      ) : null}

      <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-ocean dark:text-cyan-200">
              Owner Ad Queue
            </p>
            <h2 className="mt-2 text-2xl font-black">Add your own banner or video</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Use this for ReviewIntel promos or your own approved creative. Choose the exact placement, add the creative, and it enters that placement&apos;s rotation queue.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-line bg-mist p-4 text-sm dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500/50">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean dark:text-cyan-200">
              Best banner size
            </p>
            <p className="mt-2 font-bold text-ink dark:text-white">1600 x 500 PNG/JPG/WebP</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
              Keep text inside the center area so mobile crops still look clean.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-mist p-4 text-sm dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500/50">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean dark:text-cyan-200">
              Queue rule
            </p>
            <p className="mt-2 font-bold text-ink dark:text-white">Each spot rotates separately</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
              Multiple active ads in the same placement rotate automatically by time and daily cap.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-mist p-4 text-sm dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500/50">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean dark:text-cyan-200">
              Display priority
            </p>
            <p className="mt-2 font-bold text-ink dark:text-white">Sponsor/owner first</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
              Paid owner or sponsor ads show before AdSense. Affiliate recommendation cards are separate and do not override this queue.
            </p>
          </div>
        </div>

        <form action={createOwnerAd} className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Sponsor / campaign name
              <input
                name="sponsorName"
                defaultValue="ReviewIntel"
                className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white"
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Placement
              <select
                name="placement"
                defaultValue="homepage_mid"
                className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white"
              >
                {placementOptions.map((placement) => (
                  <option key={placement.value} value={placement.value}>
                    {placement.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Headline
              <input
                name="headline"
                required
                placeholder="Try ReviewIntel before you buy"
                className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white"
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Destination URL
              <input
                name="destinationUrl"
                defaultValue="/analyze"
                className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white"
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            Description
            <textarea
              name="description"
              rows={3}
              placeholder="Short, simple message for this ad placement."
              className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Upload photo or video
              <input
                name="creativeFile"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-slate-600 outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-ocean file:px-4 file:py-2 file:text-sm file:font-black file:text-white focus:border-ocean dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-slate-300"
              />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Optional. Images up to 8 MB; video up to 60 MB. Starter banner URL: /uploads/ads/reviewintel-ad-banner-1600x500.png
              </span>
            </label>

            <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Or paste creative URL
              <input
                name="creativeUrl"
                placeholder="https://..."
                className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white"
              />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Use this if the banner/video already lives in Supabase or another CDN.
              </span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Package priority
              <select
                value={manualPackage}
                onChange={(event) => setManualPackage(event.target.value as AdPackageId)}
                className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white"
              >
                {packageOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Daily cap
              <input
                name="dailyImpressionCap"
                type="number"
                min="1"
                defaultValue={adPackages[manualPackage].dailyImpressionCap}
                className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white"
              />
            </label>

            <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Days live
              <input
                name="durationDays"
                type="number"
                min="1"
                defaultValue={adPackages[manualPackage].durationDays}
                className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-line bg-mist px-4 py-3 text-sm font-black text-ink dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
              <input name="active" type="checkbox" value="true" defaultChecked className="h-4 w-4" />
              Go live now
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={manualBusy}
              className="rounded-full bg-ink px-6 py-3 text-sm font-black text-white transition hover:bg-ocean disabled:opacity-50 dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200"
            >
              {manualBusy ? "Adding owner ad..." : "Add to ad rotation"}
            </button>

            {manualMessage ? (
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{manualMessage}</p>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black">Advertiser applications</h2>
            <p className="mt-2 text-sm text-slate-400">
              Proper flow: payment verified + creative approved = campaign can go live.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-full border border-cyan-300/30 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-300/10"
          >
            Refresh applications and stats
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          {loading ? (
            <p className="text-slate-400">Loading advertising data...</p>
          ) : applications.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-gradient-to-r from-sky-600 to-teal-500/60 p-4 text-slate-400">
              No advertiser applications yet.
            </p>
          ) : (
            applications.map((application) => {
              const creativeUrl = application.creative_url || application.banner_url;
              const paid = application.payment_status === "paid";
              const approved = application.status === "approved";

              return (
                <div
                  key={application.id}
                  className="rounded-2xl border border-white/10 bg-gradient-to-r from-sky-600 to-teal-500/70 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
                      <CreativePreview url={creativeUrl} type={application.media_type} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${statusTone(application.status)}`}>
                            {application.status}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${statusTone(application.payment_status)}`}>
                            {paymentLabel(application.payment_status)}
                          </span>
                        </div>
                        <h3 className="mt-3 text-xl font-black">{application.brand_name}</h3>
                        <p className="mt-1 text-sm text-slate-300">
                          {application.contact_name || "No contact name"} · {application.contact_email}
                        </p>
                        <p className="mt-1 text-sm text-cyan-100">{application.website_url}</p>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                          {application.campaign_goal}
                        </p>
                        <div className="mt-3 grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 sm:grid-cols-2">
                          <span>Placement: {application.preferred_placement}</span>
                          <span>Package: {application.package_name || "Sponsored placement"}</span>
                          <span>Daily cap: {application.daily_impression_cap || "Default"}</span>
                          <span>Payment ref: {application.payment_reference || "None yet"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:min-w-44">
                      <button
                        type="button"
                        disabled={busyId === application.id || paid}
                        onClick={() => void runAction("mark_paid", application.id, "application")}
                        className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-40"
                      >
                        Mark payment verified
                      </button>
                      <button
                        type="button"
                        disabled={busyId === application.id || approved}
                        onClick={() => void runAction("approve", application.id, "application")}
                        className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-40"
                      >
                        Approve creative
                      </button>
                      <button
                        type="button"
                        disabled={busyId === application.id || application.status === "rejected"}
                        onClick={() => void runAction("reject", application.id, "application")}
                        className="rounded-full border border-red-300/30 px-4 py-2 text-sm font-bold text-red-100 disabled:opacity-40"
                      >
                        Reject application
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-2xl font-black">Live and scheduled sponsor campaigns</h2>
        <p className="mt-2 text-sm text-slate-400">
          Paid + approved campaigns rotate automatically in their placement. Paused campaigns are never shown.
        </p>

        <div className="mt-5 grid gap-4">
          {ads.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-gradient-to-r from-sky-600 to-teal-500/60 p-4 text-slate-400">
              No sponsor campaigns yet. ReviewIntel house ads or Google AdSense can fill slots depending on your switches above.
            </p>
          ) : (
            ads.map((ad) => {
              const creativeUrl = ad.creative_url || ad.image_url;

              return (
                <div key={ad.id} className="rounded-2xl border border-white/10 bg-gradient-to-r from-sky-600 to-teal-500/70 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
                      <CreativePreview url={creativeUrl} type={ad.media_type} />

                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${statusTone(ad.status)}`}>
                            {ad.active ? "Live now" : "Paused"}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${statusTone(ad.payment_status)}`}>
                            {paymentLabel(ad.payment_status)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-cyan-100">{ad.sponsor_name}</p>
                        <h3 className="mt-1 text-xl font-black">{ad.headline}</h3>
                        <p className="mt-2 text-sm text-slate-300">{ad.description}</p>
                        <div className="mt-3 grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 sm:grid-cols-2">
                          <span>Placement: {ad.placement}</span>
                          <span>Package: {ad.package_name || "Sponsor campaign"}</span>
                          <span>Impressions: {ad.impressions ?? 0}</span>
                          <span>Clicks: {ad.clicks ?? 0}</span>
                          <span>Daily cap: {ad.daily_impression_cap || "None"}</span>
                          <span>Ends: {ad.ends_at ? new Date(ad.ends_at).toLocaleDateString() : "No end date"}</span>
                        </div>

                        <a
                          href={ad.destination_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex text-sm font-bold text-cyan-100 underline decoration-cyan-300/40 underline-offset-4"
                        >
                          Open sponsor destination
                        </a>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:min-w-44">
                      <button
                        type="button"
                        disabled={busyId === ad.id}
                        onClick={() => void runAction(ad.active ? "pause" : "activate", ad.id, "ad")}
                        className="rounded-full border border-cyan-300/30 px-4 py-2 text-sm font-bold text-cyan-100 disabled:opacity-40"
                      >
                        {ad.active ? "Pause campaign" : "Activate campaign"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === ad.id || ad.payment_status === "paid"}
                        onClick={() => void runAction("mark_paid", ad.id, "ad")}
                        className="rounded-full border border-emerald-300/30 px-4 py-2 text-sm font-bold text-emerald-100 disabled:opacity-40"
                      >
                        Mark paid
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
