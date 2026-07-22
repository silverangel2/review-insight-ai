"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import type { SiteReview, SiteReviewStatus } from "@/lib/siteReviews";

const statuses: SiteReviewStatus[] = ["pending", "approved", "hidden"];

export function AdminReviewModeration() {
  const [reviews, setReviews] = useState<SiteReview[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadReviews() {
    setError("");
    try {
      const response = await fetch("/api/admin/site-reviews");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load reviews.");
      setReviews(data.reviews ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load reviews.");
    }
  }

  useEffect(() => {
    void loadReviews();
  }, []);

  async function patchReview(id: string, patch: Partial<SiteReview>) {
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/site-reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, patch })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update review.");
      setReviews((current) => current.map((review) => (review.id === id ? data.review : review)));
      setMessage("Review updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update review.");
    }
  }

  async function removeReview(id: string) {
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/site-reviews?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete review.");
      setReviews((current) => current.filter((review) => review.id !== id));
      setMessage("Review deleted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete review.");
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge tone="info">Review moderation</Badge>
          <h2 className="mt-4 text-2xl font-black text-ink dark:text-white">Public ReviewIntel reviews</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Submitted testimonials stay pending until approved. Feature only real approved customer feedback on the homepage.
          </p>
        </div>
        <button type="button" onClick={() => void loadReviews()} className="rounded-xl border border-line px-4 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white">
          Refresh
        </button>
      </div>
      {message ? <p className="mt-4 rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-teal">{message}</p> : null}
      {error ? <p className="mt-4 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p> : null}
      <div className="mt-5 grid gap-4">
        {reviews.length ? reviews.map((review) => (
          <article key={review.id} className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={review.name}
                  onChange={(event) => setReviews((current) => current.map((item) => (item.id === review.id ? { ...item, name: event.target.value } : item)))}
                  className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
                <input
                  value={review.role}
                  onChange={(event) => setReviews((current) => current.map((item) => (item.id === review.id ? { ...item, role: event.target.value } : item)))}
                  className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={review.rating}
                  onChange={(event) => setReviews((current) => current.map((item) => (item.id === review.id ? { ...item, rating: Number(event.target.value) } : item)))}
                  className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
                <select
                  value={review.status}
                  onChange={(event) => void patchReview(review.id, { status: event.target.value as SiteReviewStatus })}
                  className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button type="button" onClick={() => void patchReview(review.id, { name: review.name, role: review.role, rating: review.rating, comment: review.comment })} className="rounded-xl bg-ink px-4 py-2 text-xs font-black text-white dark:bg-white dark:text-ink">
                  Save
                </button>
                <button type="button" onClick={() => void patchReview(review.id, { status: "approved" })} className="rounded-xl border border-teal/30 bg-teal/10 px-4 py-2 text-xs font-black text-teal">
                  Approve
                </button>
                <button type="button" onClick={() => void patchReview(review.id, { featured: !review.featured })} className="rounded-xl border border-ocean/30 bg-ocean/10 px-4 py-2 text-xs font-black text-ocean dark:text-cyan-300">
                  {review.featured ? "Unfeature" : "Feature"}
                </button>
                <button type="button" onClick={() => void removeReview(review.id)} className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-2 text-xs font-black text-coral">
                  Delete
                </button>
              </div>
            </div>
            <textarea
              value={review.comment}
              onChange={(event) => setReviews((current) => current.map((item) => (item.id === review.id ? { ...item, comment: event.target.value } : item)))}
              className="mt-3 min-h-24 w-full resize-y rounded-xl border border-line bg-white px-3 py-3 text-sm leading-6 text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase text-slate-500 dark:text-slate-400">
              <span>{review.status}</span>
              <span>{review.featured ? "Featured" : "Not featured"}</span>
              <span>{review.email || "No email"}</span>
              <span>{new Date(review.createdAt).toLocaleDateString()}</span>
            </div>
          </article>
        )) : (
          <p className="rounded-2xl border border-line bg-mist p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
            No user reviews submitted yet.
          </p>
        )}
      </div>
    </section>
  );
}
