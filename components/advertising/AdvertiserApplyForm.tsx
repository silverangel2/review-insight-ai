"use client";

import { useState } from "react";

const placements = [
  { value: "homepage_mid", label: "Homepage" },
  { value: "analyze_below_card", label: "Analyze page" },
  { value: "results_below_verdict", label: "Results page" },
  { value: "buyer_dashboard", label: "Buyer dashboard" },
  { value: "seller_dashboard", label: "Seller dashboard" },
  { value: "footer", label: "Footer" },
];

export function AdvertiserApplyForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setStatus("sending");
    setMessage("");

    const payload = {
      brandName: String(formData.get("brandName") || ""),
      contactName: String(formData.get("contactName") || ""),
      contactEmail: String(formData.get("contactEmail") || ""),
      websiteUrl: String(formData.get("websiteUrl") || ""),
      destinationUrl: String(formData.get("destinationUrl") || ""),
      bannerUrl: String(formData.get("bannerUrl") || ""),
      preferredPlacement: String(formData.get("preferredPlacement") || "homepage_mid"),
      campaignGoal: String(formData.get("campaignGoal") || ""),
    };

    try {
      const response = await fetch("/api/advertising/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error || "Could not submit application.");
        return;
      }

      setStatus("success");
      setMessage("Application submitted. You will be reviewed before going live.");
    } catch {
      setStatus("error");
      setMessage("Could not submit application.");
    }
  }

  return (
    <form action={submit} className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-slate-900/80 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm">
          Brand name
          <input name="brandName" required className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="Your brand" />
        </label>

        <label className="grid gap-2 text-sm">
          Contact name
          <input name="contactName" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="John Smith" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm">
          Contact email
          <input name="contactEmail" required type="email" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="name@company.com" />
        </label>

        <label className="grid gap-2 text-sm">
          Website URL
          <input name="websiteUrl" required className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="https://yourbrand.com" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm">
          Destination URL
          <input name="destinationUrl" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="https://yourbrand.com/offer" />
        </label>

        <label className="grid gap-2 text-sm">
          Banner image URL
          <input name="bannerUrl" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="https://..." />
        </label>
      </div>

      <label className="grid gap-2 text-sm">
        Preferred placement
        <select name="preferredPlacement" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300">
          {placements.map((placement) => (
            <option key={placement.value} value={placement.value}>
              {placement.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm">
        What do you want to advertise?
        <textarea name="campaignGoal" required className="min-h-28 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="Tell us about your product, offer, or campaign." />
      </label>

      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-full bg-cyan-300 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
      >
        {status === "sending" ? "Submitting..." : "Submit application"}
      </button>

      {message && (
        <p className={status === "success" ? "text-sm text-emerald-200" : "text-sm text-red-200"}>
          {message}
        </p>
      )}
    </form>
  );
}
