import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TikTok Approval Flow | ReviewIntel Admin",
  robots: {
    index: false,
    follow: false,
  },
};

const approvalSteps = [
  {
    label: "1",
    title: "Open ReviewIntel admin social automation",
    detail:
      "Show that only the ReviewIntel admin can access the social auto-post panel. This panel manages the daily organic content queue.",
  },
  {
    label: "2",
    title: "Connect TikTok",
    detail:
      "Click Connect TikTok. The app sends the admin to TikTok OAuth and requests user.info.basic plus video.upload for the approval-safe review flow.",
  },
  {
    label: "3",
    title: "Approve TikTok permission",
    detail:
      "Approve the TikTok authorization screen. ReviewIntel stores the connected TikTok account token securely server-side.",
  },
  {
    label: "4",
    title: "Return to ReviewIntel",
    detail:
      "The admin returns to /admin/social. Press Check TikTok to verify creator info, public media URL access, and direct-post scope.",
  },
  {
    label: "5",
    title: "Generate AI post",
    detail:
      "Press Post Now / Test. ReviewIntel selects one of the 100 built-in branded images, generates a new AI caption, hashtags, and alt text.",
  },
  {
    label: "6",
    title: "Publish and review the log",
    detail:
      "The post is sent to TikTok through the Content Posting API. The admin log shows posted, draft, or exact connector errors.",
  },
];

const reviewerNotes = [
  "ReviewIntel is a review-intelligence website for shoppers and ecommerce sellers.",
  "The TikTok feature posts ReviewIntel-owned educational marketing content, not user private data.",
  "Only the admin can connect or disconnect TikTok.",
  "Images are public ReviewIntel marketing assets hosted on getreviewintel.com.",
  "The app uses TikTok OAuth and stores tokens server-side; tokens are never exposed in the browser.",
  "Emergency pause stops all social auto-posting.",
];

export default function TikTokApprovalPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
          TikTok review video flow
        </p>
        <h1 className="mt-3 text-3xl font-black text-ink dark:text-white sm:text-5xl">
          Record this flow for TikTok approval.
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
          This page is the simple screen-recording script for TikTok app review. Show the reviewer how ReviewIntel connects TikTok, verifies direct posting, generates AI content, and posts only admin-owned ReviewIntel marketing content.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/admin/social"
            className="inline-flex items-center justify-center rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-soft transition hover:bg-ocean dark:bg-white dark:text-ink"
          >
            Open Social Auto-Post
          </Link>
          <a
            href="/social/house/reviewintel-house-001.png"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-5 py-3 text-sm font-black text-ink shadow-soft transition hover:border-ocean dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            Show Public Sample Image
          </a>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {approvalSteps.map((step) => (
          <article
            key={step.label}
            className="rounded-3xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-ocean text-sm font-black text-white">
              {step.label}
            </span>
            <h2 className="mt-4 text-xl font-black text-ink dark:text-white">
              {step.title}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
              {step.detail}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-cyan-200 bg-cyan-50/70 p-6 shadow-soft dark:border-cyan-300/20 dark:bg-cyan-300/10">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
          Narration script
        </p>
        <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">
          Short voiceover for the approval video
        </h2>
        <p className="mt-3 text-sm font-semibold leading-7 text-slate-700 dark:text-slate-200">
          ReviewIntel uses TikTok login only for the admin social posting workflow. The admin connects a TikTok account, approves the requested TikTok posting permission, and returns to ReviewIntel. The app then verifies creator information and public media access, generates a ReviewIntel marketing caption with AI, and prepares or posts ReviewIntel-owned content depending on the TikTok permissions currently approved for the app. No customer scan data, private account data, or third-party review content is posted to TikTok.
        </p>
      </section>

      <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
          Reviewer notes
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {reviewerNotes.map((note) => (
            <p
              key={note}
              className="rounded-2xl bg-mist p-4 text-sm font-bold leading-6 text-slate-700 dark:bg-white/[0.04] dark:text-slate-200"
            >
              {note}
            </p>
          ))}
        </div>
      </section>
    </main>
  );
}
