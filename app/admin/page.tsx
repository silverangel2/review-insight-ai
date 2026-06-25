import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminAITroubleshooter } from "@/components/AdminAITroubleshooter";
import { AdminSEOReadiness } from "@/components/AdminSEOReadiness";
import { DashboardShell } from "@/components/DashboardShell";
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

  const primaryTools = [
    {
      title: "Customers",
      detail: "Plans, quotas, scan resets, status, and signed accounts.",
      href: "/admin/customers",
      action: "Manage accounts"
    },
    {
      title: "Security",
      detail: "Threat events, rate limits, suspicious access, and IP blocking.",
      href: "/admin/security",
      action: "Open security"
    },
    {
      title: "Email",
      detail: "Customer support inbox, replies, complaints, and contact messages.",
      href: "/admin/email",
      action: "Open inbox"
    },
    {
      title: "Beta Panel",
      detail: "Active beta users, beta observations, replies, and expiry countdowns.",
      href: "/admin/beta",
      action: "Monitor beta"
    },
    {
      title: "Advertising",
      detail: "AdSense, direct sponsors, house ads, and sponsor applications.",
      href: "/admin/advertising",
      action: "Manage ads"
    },
    {
      title: "SEO",
      detail: "Readiness check, metadata drafts, sitemap, robots, and SEO pages.",
      href: "/admin/seo",
      action: "Open SEO"
    },
    {
      title: "System Checks",
      detail: "One-click diagnostics, OpenAI, Supabase, paths, build health, and speed.",
      href: "/admin/system",
      action: "Run checks"
    }
  ];

  const comfortChecks = [
    "Use AI Troubleshooter first when something feels off.",
    "Use System Checks before deploys or after changing env values.",
    "Use Security Center when traffic, login, upload, or abuse looks suspicious.",
    "Use SEO Readiness before publishing ads or sharing the public site."
  ];

  return (
    <DashboardShell
      title="Admin Control Center"
      subtitle="A calm owner dashboard for the things you actually need: customers, security, email, ads, SEO, diagnostics, and AI help."
      experience="admin"
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {primaryTools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="rounded-3xl border border-line bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-ocean dark:border-white/10 dark:bg-slate-950"
            >
              <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean dark:text-cyan-300">
                {tool.action}
              </p>
              <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">{tool.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                {tool.detail}
              </p>
            </Link>
          ))}
        </section>

        <AdminAITroubleshooter />
        <AdminSEOReadiness />

        <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
            Comfort checklist
          </p>
          <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">
            Where to go when something feels wrong
          </h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {comfortChecks.map((item) => (
              <p key={item} className="rounded-2xl bg-mist p-4 text-sm font-bold leading-6 text-slate-700 dark:bg-white/[0.04] dark:text-slate-200">
                {item}
              </p>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
