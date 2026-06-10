"use client";

import { useMemo, useState } from "react";
import { buildCampaignUrl, reviewIntelCampaigns } from "@/lib/marketingCampaigns";

export function MarketingCampaignManager() {
  const [origin, setOrigin] = useState("https://getreviewintel.com");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const campaignLinks = useMemo(
    () =>
      reviewIntelCampaigns.map((campaign) => ({
        ...campaign,
        url: buildCampaignUrl(origin, campaign),
      })),
    [origin],
  );

  async function copyLink(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <div className="grid gap-8">
      <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-cyan-200/15 dark:bg-cyan-300/[0.06]">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-ocean dark:text-cyan-200">
          External Advertising
        </p>
        <h2 className="mt-2 text-2xl font-black">ReviewIntel campaign link generator</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
          Use these links when you advertise ReviewIntel on Google, TikTok, Facebook,
          Reddit, YouTube, newsletters, or affiliate pages. Each link includes UTM tracking
          so you can identify where traffic came from.
        </p>

        <label className="mt-5 grid gap-2 text-sm">
          Live website domain
          <input
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            className="rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-cyan-300"
            placeholder="https://getreviewintel.com"
          />
        </label>
      </section>

      <section className="grid gap-4">
        {campaignLinks.map((campaign) => (
          <article
            key={campaign.id}
            className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-white/[0.04]"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100">
                  {campaign.channel}
                </div>

                <h3 className="text-xl font-black">{campaign.name}</h3>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{campaign.description}</p>

                <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-400 md:grid-cols-2">
                  <p>
                    <span className="font-semibold text-ink dark:text-slate-200">Audience:</span>{" "}
                    {campaign.audience}
                  </p>
                  <p>
                    <span className="font-semibold text-ink dark:text-slate-200">Landing page:</span>{" "}
                    {campaign.landingPath}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-line bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/70">
                  <p className="break-all text-xs font-semibold leading-6 text-ocean dark:text-cyan-100">{campaign.url}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => copyLink(campaign.id, campaign.url)}
                className="rounded-full bg-cyan-300 px-5 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
              >
                {copiedId === campaign.id ? "Copied" : "Copy link"}
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/80">
        <h2 className="text-2xl font-black">How to use these links</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-line bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950/70">
            <p className="text-sm font-bold text-cyan-100">1. Pick a campaign</p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Choose Google, TikTok, Reddit, YouTube, or another platform.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950/70">
            <p className="text-sm font-bold text-cyan-100">2. Copy the link</p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Paste it as the destination URL inside the ad platform.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950/70">
            <p className="text-sm font-bold text-cyan-100">3. Track results</p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Later we can add analytics to show visits, signups, and conversions by campaign.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
