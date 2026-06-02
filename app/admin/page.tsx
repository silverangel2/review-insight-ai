import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardMetric, DashboardShell, MiniBarChart } from "@/components/DashboardShell";
import { AdminUserSystem } from "@/components/AdminUserSystem";
import { AdminReviewModeration } from "@/components/AdminReviewModeration";
import { AdminUsageCostMonitor } from "@/components/AdminUsageCostMonitor";
import { DeveloperControlCenter } from "@/components/DeveloperControlCenter";
import { DeveloperQACenter } from "@/components/DeveloperQACenter";
import { InsightList } from "@/components/InsightList";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionCookie } from "@/lib/adminAccess";

export const metadata: Metadata = {
  title: "Admin Control Center",
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const adminSession = verifyAdminSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (!adminSession) {
    redirect("/admin-access");
  }

  return (
    <DashboardShell
      title="Admin panel"
      subtitle="Operational metrics for users, subscriptions, analysis usage, token usage, flagged uploads, and revenue placeholders."
      experience="admin"
    >
      <DeveloperControlCenter serverDeveloperMode />
      <DeveloperQACenter />
      <AdminUsageCostMonitor />
      <AdminUserSystem />
      <AdminReviewModeration />
      <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-ocean dark:text-cyan-300">Launch SEO</p>
            <h2 className="mt-3 text-xl font-black tracking-tight text-ink dark:text-white">SEO Manager</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Edit page titles, meta descriptions, social cards, canonical URLs, robots settings, sitemap status, and SEO landing-page drafts.
            </p>
          </div>
          <Link href="/admin/seo" className="inline-flex justify-center rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
            Open SEO Manager
          </Link>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric label="Developer Mode" value="Active" detail="Admin bypasses quotas, uploads, comparisons, AI limits, and feature gates." tone="good" />
        <DashboardMetric label="Users" value="1,248" detail="User count placeholder." tone="info" />
        <DashboardMetric label="Subscriptions" value="186" detail="Active paid subscription placeholder." tone="good" />
        <DashboardMetric label="AI tokens" value="4.2M" detail="Monthly token usage placeholder." tone="warn" />
      </section>
      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <MiniBarChart
          items={[
            { label: "Free usage", value: 82, tone: "warn" },
            { label: "Pro conversion", value: 18, tone: "good" },
            { label: "Flagged uploads", value: 6, tone: "bad" },
            { label: "Webhook health", value: 96, tone: "info" }
          ]}
        />
        <InsightList
          title="Admin queue"
          tone="warn"
          items={[
            "Review flagged uploads for unsupported file types or abuse patterns.",
            "Monitor quota errors to tune upgrade prompts.",
            "Track OpenAI request failures separately from local fallback analysis."
          ]}
        />
      </section>
      <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Monetization controls</p>
            <h2 className="mt-3 text-xl font-black tracking-tight text-ink dark:text-white">Sponsored resources</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Future admin CRUD connects to the sponsors table for adding, pausing, editing, and measuring partner placements.
            </p>
          </div>
          <div className="rounded-xl border border-line px-4 py-3 text-sm font-black text-ink dark:border-white/10 dark:text-white">
            Toggle via NEXT_PUBLIC_SPONSORS_ENABLED
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
