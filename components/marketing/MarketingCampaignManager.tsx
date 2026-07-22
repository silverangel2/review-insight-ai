"use client";

import { useState } from "react";

const premiumDraft = {
  subject: "ReviewIntel Premium is ready for smarter product decisions",
  message: `ReviewIntel helps shoppers and sellers understand products faster.

For shoppers, it gives fast buying confidence, AI-like review signs, complaints, value signals, and product comparison insights before they buy.

For sellers, it turns review comments into product intelligence, complaint patterns, customer pain points, and improvement ideas.

Try your next product scan and see what ReviewIntel finds before you decide.`
};

const advertiserDraft = {
  subject: "Advertise beside ReviewIntel AI product scans",
  message: `ReviewIntel now offers premium sponsor placements beside AI product scans.

Your brand can appear while shoppers are actively checking reviews, comparing products, and deciding what to buy.

Premium Analyze Spots are designed for brands, ecommerce tools, product services, and sellers who want attention at buyer decision time.`
};

const shopperDraft = {
  subject: "Before you buy, scan the reviews with ReviewIntel",
  message: `Product research can be messy, emotional, AI-generated, or hard to compare.

ReviewIntel helps turn those reviews into a clear buying answer:
worth buying, AI-like review signs, common complaints, value signals, and best-fit insights.

Use ReviewIntel before your next purchase and make the decision with more confidence.`
};

export function MarketingCampaignManager() {
  const [subject, setSubject] = useState(premiumDraft.subject);
  const [message, setMessage] = useState(premiumDraft.message);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function applyDraft(draft: typeof premiumDraft) {
    setSubject(draft.subject);
    setMessage(draft.message);
    setNotice("");
    setError("");
  }

  async function sendCampaign() {
    setSending(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/admin/marketing/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error ?? "Campaign failed.");
        return;
      }

      setNotice(`Campaign sent to ${data.sent ?? 0} of ${data.attempted ?? 0} consented subscribers.`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
          Auto email campaign
        </p>
        <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">
          Send to marketing-consent users
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          This sends only to profiles where marketing consent is Yes. Every email includes an unsubscribe link.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => applyDraft(premiumDraft)}
            className="rounded-2xl border border-line bg-mist px-4 py-3 text-left text-xs font-black uppercase text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          >
            Premium launch
          </button>
          <button
            type="button"
            onClick={() => applyDraft(shopperDraft)}
            className="rounded-2xl border border-line bg-mist px-4 py-3 text-left text-xs font-black uppercase text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          >
            Shopper promo
          </button>
          <button
            type="button"
            onClick={() => applyDraft(advertiserDraft)}
            className="rounded-2xl border border-line bg-mist px-4 py-3 text-left text-xs font-black uppercase text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          >
            Advertiser spot
          </button>
        </div>

        {notice ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase text-slate-500">Subject</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase text-slate-500">Campaign draft</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={10}
              className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold leading-6 text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
            />
          </label>

          <button
            type="button"
            onClick={() => void sendCampaign()}
            disabled={sending || subject.trim().length < 4 || message.trim().length < 10}
            className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-ink"
          >
            {sending ? "Sending campaign..." : "Send Campaign"}
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
        <div className="overflow-hidden rounded-[1.75rem] bg-[#07111f] shadow-[0_24px_70px_rgba(7,17,31,0.25)]">
          <div className="bg-gradient-to-br from-[#07111f] via-[#0f766e] to-[#22d3ee] p-7 text-white">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-3">
              <span className="size-5 rounded-md bg-gradient-to-br from-cyan-300 to-amber shadow-[0_0_24px_rgba(34,211,238,0.55)]" />
              <span className="text-sm font-black tracking-wide">ReviewIntel</span>
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-emerald-100">
              Email preview
            </p>
            <h3 className="mt-3 text-3xl font-black leading-tight">
              {subject || "ReviewIntel campaign subject"}
            </h3>
          </div>

          <div className="rounded-t-[1.75rem] bg-white p-6">
            <p className="text-base font-bold leading-7 text-ink">Hi there,</p>
            <div className="mt-4 grid gap-3">
              {message
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, index) => (
                  <p key={`${line}-${index}`} className="text-sm font-semibold leading-7 text-slate-700">
                    {line}
                  </p>
                ))}
            </div>

            <div className="mt-6 rounded-2xl border border-line bg-mist p-4">
              <p className="text-xs font-bold leading-6 text-slate-600">
                You are receiving this because you said yes to ReviewIntel marketing or product updates.
                You can unsubscribe anytime.
              </p>
            </div>

            <p className="mt-5 text-xs font-black text-ocean">
              Unsubscribe from ReviewIntel marketing emails
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-ocean dark:text-cyan-300">
            Safety rules
          </p>
          <div className="mt-3 grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <p>Only sends to users who said Yes to marketing consent.</p>
            <p>Skips missing or invalid emails.</p>
            <p>Uses support@getreviewintel.com as the verified sender.</p>
            <p>Includes unsubscribe link in every email.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
