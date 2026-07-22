"use client";

import { useState } from "react";
import { Badge } from "@/components/Badge";

export function PublicReviewForm() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Shopper");
  const [rating, setRating] = useState(90);
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/site-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, rating, email, comment })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Submission failed.");

      setStatus("Thank you. Your review was submitted for approval.");
      setName("");
      setEmail("");
      setComment("");
      setRating(90);
      setRole("Shopper");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void submitReview(event)} className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <Badge tone="info">Leave feedback</Badge>
      <h2 className="mt-4 text-2xl font-black text-ink dark:text-white">Tell us what ReviewIntel helped you decide.</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-black text-ink dark:text-white">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            placeholder="Your name"
          />
        </label>
        <label className="block">
          <span className="text-sm font-black text-ink dark:text-white">Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            <option>Shopper</option>
            <option>Seller</option>
            <option>Founder</option>
            <option>Product manager</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-black text-ink dark:text-white">Rating</span>
          <select
            value={rating}
            onChange={(event) => setRating(Number(event.target.value))}
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            {[100, 95, 90, 85, 80, 75, 70, 60].map((value) => (
              <option key={value} value={value}>
                {value}% rating
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-black text-ink dark:text-white">Email optional</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            placeholder="For follow-up only"
          />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-black text-ink dark:text-white">Short review</span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-line bg-white px-4 py-4 text-sm leading-6 text-ink outline-none transition focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
          placeholder="Example: ReviewIntel helped me compare two products quickly and avoid the one with repeated durability complaints."
        />
      </label>
      {error ? <p className="mt-4 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}
      {status ? <p className="mt-4 rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-teal">{status}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 rounded-2xl bg-ink px-6 py-4 text-sm font-black text-white transition hover:bg-ocean disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-ink"
      >
        {isSubmitting ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}
