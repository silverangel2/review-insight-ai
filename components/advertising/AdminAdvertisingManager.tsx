"use client";

import { useEffect, useState } from "react";

type AdvertiserApplication = {
  id: string;
  brand_name: string;
  contact_name?: string | null;
  contact_email: string;
  website_url: string;
  campaign_goal: string;
  preferred_placement: string;
  banner_url?: string | null;
  destination_url?: string | null;
  status: string;
  created_at?: string;
};

type SponsorAdRow = {
  id: string;
  sponsor_name: string;
  headline: string;
  description: string;
  destination_url: string;
  placement: string;
  active: boolean;
  status: string;
};

export function AdminAdvertisingManager() {
  const [applications, setApplications] = useState<AdvertiserApplication[]>([]);
  const [ads, setAds] = useState<SponsorAdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

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

    try {
      await fetch("/api/admin/advertising", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "application"
            ? { action, applicationId: id }
            : { action, adId: id },
        ),
      });

      await loadData();
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="grid gap-8">
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black">Advertiser Applications</h2>
            <p className="mt-2 text-sm text-slate-400">
              Brands apply here. You approve or reject before anything goes live.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="rounded-full border border-cyan-300/30 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-300/10"
          >
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          {loading ? (
            <p className="text-slate-400">Loading advertising data...</p>
          ) : applications.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-slate-400">
              No advertiser applications yet.
            </p>
          ) : (
            applications.map((application) => (
              <div
                key={application.id}
                className="rounded-2xl border border-white/10 bg-slate-950/70 p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
                      {application.status}
                    </p>
                    <h3 className="mt-1 text-xl font-black">{application.brand_name}</h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {application.contact_name || "No contact name"} · {application.contact_email}
                    </p>
                    <p className="mt-1 text-sm text-cyan-100">{application.website_url}</p>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                      {application.campaign_goal}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      Placement: {application.preferred_placement}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busyId === application.id || application.status === "approved"}
                      onClick={() => runAction("approve", application.id, "application")}
                      className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === application.id || application.status === "rejected"}
                      onClick={() => runAction("reject", application.id, "application")}
                      className="rounded-full border border-red-300/30 px-4 py-2 text-sm font-bold text-red-100 disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-2xl font-black">Active Sponsor Ads</h2>
        <p className="mt-2 text-sm text-slate-400">
          Approved ads can be paused or activated anytime.
        </p>

        <div className="mt-5 grid gap-4">
          {ads.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-slate-400">
              No live sponsor ads yet. ReviewIntel placeholder ads are still shown until real ads are approved.
            </p>
          ) : (
            ads.map((ad) => (
              <div key={ad.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-cyan-100">{ad.sponsor_name}</p>
                    <h3 className="mt-1 text-xl font-black">{ad.headline}</h3>
                    <p className="mt-2 text-sm text-slate-300">{ad.description}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {ad.placement} · {ad.active ? "active" : "paused"}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={busyId === ad.id}
                    onClick={() => runAction(ad.active ? "pause" : "activate", ad.id, "ad")}
                    className="rounded-full border border-cyan-300/30 px-4 py-2 text-sm font-bold text-cyan-100 disabled:opacity-40"
                  >
                    {ad.active ? "Pause" : "Activate"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
