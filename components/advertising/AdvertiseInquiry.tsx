"use client";
// Short inquiry form (saved + emailed to the Owner) with creative guidance and a LIVE local preview.
// The preview file never leaves the browser here; creatives are uploaded later via /advertise/apply.
import { useEffect, useState } from "react";
import { FeaturedDeals } from "@/components/advertising/FeaturedDeals";

const BUDGETS = ["Under $100", "$100–$500", "$500–$2,000", "$2,000+", "Not sure yet"];
const PLACEMENTS = [["results_below_verdict", "Results page"], ["analyze_below_card", "Scan page"], ["homepage_mid", "Homepage"], ["footer", "Site-wide footer"], ["not_sure", "Not sure yet"]];
const field = "mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal";

export function AdvertiseInquiry() {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [headline, setHeadline] = useState("Your headline here");
  const [description, setDescription] = useState("One short line about your offer.");
  const [media, setMedia] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [mediaNote, setMediaNote] = useState("");
  useEffect(() => () => { if (media) URL.revokeObjectURL(media.url); }, [media]);

  async function submit(form: HTMLFormElement) {
    setStatus("sending"); setMessage("");
    const data = Object.fromEntries(new FormData(form).entries());
    const res = await fetch("/api/advertising/inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) { setStatus("done"); setMessage(json.message || "Thanks! We'll reply within 2 business days."); form.reset(); }
    else { setStatus("error"); setMessage(json.error || "Couldn't send. Please try again or email us."); }
  }

  function pick(file: File | undefined) {
    if (!file) return;
    const type = file.type.startsWith("video/") ? "video" : "image";
    const max = type === "video" ? 60 : 8;
    setMediaNote(file.size > max * 1024 * 1024 ? `Too large: ${type}s must be under ${max} MB.` : "");
    setMedia({ url: URL.createObjectURL(file), type });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <form onSubmit={e => { e.preventDefault(); void submit(e.currentTarget); }} className="rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-900/5 sm:p-6" aria-describedby="inquiry-status">
        <h2 className="text-xl font-semibold text-slate-900">Tell us about your campaign</h2>
        <p className="mt-1 text-sm text-slate-600">Two minutes. We reply within 2 business days.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Your name<input name="name" required autoComplete="name" className={field} /></label>
          <label className="text-sm font-medium text-slate-700">Work email<input name="email" type="email" required autoComplete="email" className={field} /></label>
          <label className="text-sm font-medium text-slate-700">Company<input name="company" required autoComplete="organization" className={field} /></label>
          <label className="text-sm font-medium text-slate-700">Website<input name="website" type="url" placeholder="https://" className={field} /></label>
          <label className="text-sm font-medium text-slate-700">Monthly budget<select name="budget" className={field} defaultValue="Not sure yet">{BUDGETS.map(b => <option key={b}>{b}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Preferred placement<select name="placement" className={field} defaultValue="not_sure">{PLACEMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        </div>
        <label className="mt-3 block text-sm font-medium text-slate-700">Message<textarea name="message" rows={3} maxLength={2000} className={field} placeholder="What are you promoting, and who is it for?" /></label>
        {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Leave empty<input name="company_website_confirm" tabIndex={-1} autoComplete="off" /></label></div>
        <button type="submit" disabled={status === "sending"} className="ri-lift mt-4 w-full rounded-full bg-teal px-6 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto">{status === "sending" ? "Sending…" : "Send inquiry"}</button>
        <p id="inquiry-status" role="status" className={`mt-3 text-sm ${status === "error" ? "text-coralink" : "text-teal"}`}>{message}</p>
        <p className="mt-2 text-xs text-slate-500">By sending, you agree to our <a className="underline" href="/advertiser-terms">advertiser terms</a> and <a className="underline" href="/ad-policy">ad content policy</a>.</p>
      </form>

      <section className="rounded-[1.75rem] bg-[linear-gradient(135deg,#f1edff_0%,#ffffff_60%,#e6f7f1_100%)] p-5 ring-1 ring-slate-900/5 sm:p-6" aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="text-xl font-semibold text-slate-900">Preview your ad</h2>
        <p className="mt-1 text-sm text-slate-600">Image: JPG/PNG/WebP, up to 8 MB, ideally 1200×628. Video: MP4/WebM, muted, up to 60 MB, 15 s. Headline up to 60 characters, description up to 140.</p>
        <div className="mt-3 grid gap-2">
          <label className="text-sm font-medium text-slate-700">Headline<input value={headline} maxLength={60} onChange={e => setHeadline(e.target.value)} className={field} /></label>
          <label className="text-sm font-medium text-slate-700">Description<input value={description} maxLength={140} onChange={e => setDescription(e.target.value)} className={field} /></label>
          <label className="text-sm font-medium text-slate-700">Image or video (stays on your device)<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={e => pick(e.target.files?.[0])} className="mt-1 block w-full text-sm" /></label>
          {mediaNote ? <p className="text-sm text-coralink">{mediaNote}</p> : null}
        </div>
        <div className="mt-4" data-testid="ad-live-preview">
          <FeaturedDeals slides={[{ ad: { id: "preview", sponsorName: "Your brand", headline, description, destinationUrl: "#", placement: "results_below_verdict", active: true, status: "approved", mediaUrl: media?.url, mediaType: media?.type }, kind: "direct", partner: "Your brand", headline, description, cta: "Learn more" }]} />
        </div>
      </section>
    </div>
  );
}
