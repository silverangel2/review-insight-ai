"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import type { SiteReview } from "@/lib/siteReviews";

export function FeaturedReviews() {
  const [reviews, setReviews] = useState<SiteReview[]>([]);

  useEffect(() => {
    fetch("/api/site-reviews")
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) setReviews(data.reviews ?? []);
      })
      .catch(() => setReviews([]));
  }, []);

  if (!reviews.length) return null;

  return (
    <section className="bg-white px-6 py-12 text-ink dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white">
      <div className="mx-auto max-w-7xl">
        <Badge tone="good">Featured Reviews</Badge>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-4xl font-black">What users say after testing ReviewIntel.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Approved customer feedback only. New submissions are reviewed before they appear publicly.
            </p>
          </div>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {reviews.slice(0, 3).map((review) => (
            <article key={review.id} className="rounded-3xl border border-line bg-mist p-6 shadow-soft dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-4xl font-black text-ocean dark:text-cyan-300">{review.rating}%</p>
              <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-200">&ldquo;{review.comment}&rdquo;</p>
              <div className="mt-5 border-t border-line pt-4 dark:border-white/10">
                <p className="font-black text-ink dark:text-white">{review.name}</p>
                <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{review.role}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
