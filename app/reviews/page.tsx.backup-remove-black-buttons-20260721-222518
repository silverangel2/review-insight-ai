import type { Metadata } from "next";
import { Badge } from "@/components/Badge";
import { PublicReviewForm } from "@/components/PublicReviewForm";
import { listSiteReviews } from "@/lib/siteReviews";

export const metadata: Metadata = {
  title: "User Reviews",
  description: "Read approved ReviewIntel user feedback and submit your own ReviewIntel review."
};

export const dynamic = "force-dynamic";

export default function ReviewsPage() {
  const reviews = listSiteReviews({ publicOnly: true });

  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <section className="relative overflow-hidden rounded-[2rem] border border-line bg-[linear-gradient(135deg,#172033,#2356a3_52%,#08b7a8)] p-8 text-white shadow-glow">
        <div className="ri-scan-grid absolute inset-0 opacity-20" />
        <div className="relative">
          <Badge tone="good">ReviewIntel Reviews</Badge>
          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-tight">Real customer feedback, approved before publishing.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
            Users can submit feedback here. Reviews do not appear publicly until they are approved from the Admin dashboard.
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-4">
          {reviews.length ? reviews.map((review) => (
            <article key={review.id} className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-4xl font-black text-ocean dark:text-cyan-300">{review.rating}%</p>
                  <p className="mt-4 text-base leading-7 text-slate-700 dark:text-slate-200">&ldquo;{review.comment}&rdquo;</p>
                </div>
                {review.featured ? <Badge tone="good">Featured</Badge> : null}
              </div>
              <div className="mt-5 border-t border-line pt-4 dark:border-white/10">
                <p className="font-black text-ink dark:text-white">{review.name}</p>
                <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{review.role}</p>
              </div>
            </article>
          )) : (
            <article className="rounded-3xl border border-line bg-white p-8 text-center shadow-soft dark:border-white/10 dark:bg-slate-950">
              <Badge tone="warn">No public reviews yet</Badge>
              <h2 className="mt-4 text-3xl font-black text-ink dark:text-white">Be the first to leave ReviewIntel feedback.</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                We do not publish fake testimonials. Approved user reviews will appear here after moderation.
              </p>
            </article>
          )}
        </div>
        <PublicReviewForm />
      </section>
    </main>
  );
}
