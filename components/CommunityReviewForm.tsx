"use client";

import { useState } from "react";

type CommunityReviewFormProps = {
  productKey: string;
};

const inputClass =
  "mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white";

export function CommunityReviewForm({ productKey }: CommunityReviewFormProps) {
  const [stars, setStars] = useState(5);
  const [body, setBody] = useState("");
  const [store, setStore] = useState("");
  const [boughtIt, setBoughtIt] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setIsSubmitting(true);

    try {
      const form = new FormData(event.currentTarget);
      form.set("product_key", productKey);
      form.set("stars", String(stars));
      form.set("body", body);
      form.set("store", store);
      if (boughtIt) form.set("bought_it", "true");
      const response = await fetch("/api/community-reviews", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Submission failed.");

      setStatus(
        "Thank you — your review is in the moderation queue and will appear here once it's approved." +
          (data.verified_purchase ? " Your purchase was verified." : "")
      );
      setBody("");
      setStore("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submitReview(event)}
      className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900"
    >
      <h3 className="text-xl font-black text-ink dark:text-white">Own this product? Share your experience.</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Your words help the next shopper decide. Reviews are moderated before they appear, and verified ones
        can strengthen this product&apos;s future verdicts.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-black text-ink dark:text-white">Your rating</span>
          <select
            value={stars}
            onChange={(event) => setStars(Number(event.target.value))}
            className={inputClass}
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} star{value === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-black text-ink dark:text-white">Where did you buy it? (optional)</span>
          <input
            name="store"
            value={store}
            onChange={(event) => setStore(event.target.value)}
            className={inputClass}
            placeholder="e.g. Amazon.ca, Walmart, Best Buy"
            maxLength={120}
          />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-black text-ink dark:text-white">Your review</span>
        <textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-line bg-white px-4 py-4 text-sm leading-6 text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
          placeholder="What did you buy it for, how has it held up, and would you buy it again?"
          maxLength={4000}
        />
      </label>
      <label className="mt-4 flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          name="bought_it"
          checked={boughtIt}
          onChange={(event) => setBoughtIt(event.target.checked)}
          className="mt-1 h-4 w-4 accent-teal-600"
        />
        <span>I bought this product myself. Please only share honest experiences with products you&apos;ve actually used.</span>
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-black text-ink dark:text-white">Order or receipt photo (optional)</span>
        <input
          type="file"
          name="proof"
          accept="image/png,image/jpeg"
          className="mt-2 block w-full text-sm text-slate-600 dark:text-slate-300"
        />
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
          A photo of your order helps us verify your review — verified reviews carry more weight.
        </span>
      </label>
      {error ? (
        <p className="mt-4 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coralink">{error}</p>
      ) : null}
      {status ? (
        <p className="mt-4 rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-teal">{status}</p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 rounded-2xl bg-ink px-6 py-4 text-sm font-black text-white transition hover:bg-ocean disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-ink"
      >
        {isSubmitting ? "Submitting..." : "Share my review"}
      </button>
    </form>
  );
}
