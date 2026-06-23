"use client";

import { useState } from "react";
import { adPackages, type AdPackageId } from "@/lib/adConfig";

const placements = [
  { value: "homepage_mid", label: "Homepage middle" },
  { value: "analyze_below_card", label: "Analyze page" },
  { value: "results_below_verdict", label: "Results page" },
  { value: "footer", label: "Footer" },
];

const packageOptions = Object.values(adPackages);

export function AdvertiserApplyForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<AdPackageId>("sponsored_monthly");
  const adPackage = adPackages[selectedPackage];

  async function submit(formData: FormData) {
    setStatus("sending");
    setMessage("");
    formData.set("packageId", selectedPackage);

    try {
      const response = await fetch("/api/advertising/apply", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error || "Could not submit application.");
        return;
      }

      setStatus("success");
      setMessage(data.message || "Application submitted. ReviewIntel will verify payment and review your creative before it goes live.");
    } catch {
      setStatus("error");
      setMessage("Could not submit application.");
    }
  }

  return (
    <form action={submit} className="mt-8 grid gap-5 rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-white">
      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100">How ReviewIntel ads go live</p>
        <p className="mt-2 text-sm leading-6 text-cyan-50/90">
          Pay for a package, upload your banner or short video, submit your campaign, then ReviewIntel verifies payment and approves the creative before the ad rotates on the selected placement.
        </p>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">Choose package</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {packageOptions.map((item) => (
            <label
              key={item.id}
              className={`rounded-2xl border p-4 transition ${
                selectedPackage === item.id
                  ? "border-cyan-300 bg-cyan-300/10"
                  : "border-white/10 bg-slate-950"
              }`}
            >
              <input
                type="radio"
                name="packageChoice"
                checked={selectedPackage === item.id}
                onChange={() => setSelectedPackage(item.id)}
                className="sr-only"
              />
              <span className="block text-lg font-black">{item.name}</span>
              <span className="mt-1 block text-2xl font-black text-cyan-200">{item.price}</span>
              <span className="mt-2 block text-sm leading-6 text-slate-300">{item.description}</span>
              <span className="mt-3 block text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                {item.dailyImpressionCap.toLocaleString()} daily impressions · {item.durationDays} days
              </span>
            </label>
          ))}
        </div>
        <a
          href={adPackage.stripeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit rounded-full bg-cyan-300 px-5 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
        >
          Pay for {adPackage.name}
        </a>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">
          Brand name
          <input name="brandName" required className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="Your brand" />
        </label>

        <label className="grid gap-2 text-sm font-bold">
          Contact name
          <input name="contactName" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="John Smith" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">
          Contact email
          <input name="contactEmail" required type="email" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="name@company.com" />
        </label>

        <label className="grid gap-2 text-sm font-bold">
          Website URL
          <input name="websiteUrl" required className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="https://yourbrand.com" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">
          Campaign headline
          <input name="headline" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="Your offer in one short line" />
        </label>

        <label className="grid gap-2 text-sm font-bold">
          Destination URL
          <input name="destinationUrl" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="https://yourbrand.com/offer" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">
          Upload banner or short video
          <input
            name="creativeFile"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-300 outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-300 file:px-4 file:py-2 file:text-sm file:font-black file:text-slate-950 focus:border-cyan-300"
          />
          <span className="text-xs font-semibold text-slate-400">Images up to 4 MB. MP4/WEBM video up to 20 MB, muted autoplay.</span>
        </label>

        <label className="grid gap-2 text-sm font-bold">
          Payment reference or Stripe email
          <input name="paymentReference" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="Stripe receipt email, transaction ID, or note" />
          <span className="text-xs font-semibold text-slate-400">Leave blank if you want ReviewIntel to contact you before payment.</span>
        </label>
      </div>

      <label className="grid gap-2 text-sm font-bold">
        Preferred placement
        <select name="preferredPlacement" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300">
          {placements.map((placement) => (
            <option key={placement.value} value={placement.value}>
              {placement.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-bold">
        What do you want to advertise?
        <textarea name="campaignGoal" required className="min-h-28 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300" placeholder="Tell us about your product, offer, or campaign." />
      </label>

      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-full bg-cyan-300 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
      >
        {status === "sending" ? "Submitting..." : "Submit campaign for review"}
      </button>

      {message && (
        <p className={status === "success" ? "text-sm font-bold text-emerald-200" : "text-sm font-bold text-red-200"}>
          {message}
        </p>
      )}
    </form>
  );
}
