"use client";

import { useEffect, useState } from "react";
import { CommunityReviewForm } from "@/components/CommunityReviewForm";

type CommunityReviewView = {
  id: string;
  stars: number;
  body: string;
  store: string | null;
  bought_it: boolean;
  verified_purchase: boolean;
  created_at: string | null;
};

type CommunityReviewsSectionProps = {
  productKey: string;
};

function starsFor(value: number) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

export function CommunityReviewsSection({ productKey }: CommunityReviewsSectionProps) {
  const [reviews, setReviews] = useState<CommunityReviewView[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/community-reviews?product_key=${encodeURIComponent(productKey)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [productKey]);

  return (
    <section id="community-reviews" aria-label="Community experiences" className="mt-10">
      <h2 className="text-2xl font-black text-ink dark:text-white">Community experiences</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Written by ReviewIntel shoppers about this exact product — separate from store reviews above.
      </p>
      {loaded && reviews.length > 0 ? (
        <ul className="mt-5 grid gap-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-2xl border border-line bg-white p-5 dark:border-white/10 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-amber-500" aria-label={`${review.stars} out of 5 stars`}>
                  {starsFor(review.stars)}
                </span>
                {review.verified_purchase ? (
                  <span className="rounded-full bg-teal/15 px-3 py-1 text-xs font-black text-teal">
                    Verified purchase
                  </span>
                ) : null}
                {review.store ? (
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    bought at {review.store}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{review.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-6">
        <CommunityReviewForm productKey={productKey} />
      </div>
    </section>
  );
}
