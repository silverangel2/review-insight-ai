import Link from "next/link";
import { AdminSEOManager } from "@/components/AdminSEOManager";
import { AdminSEOReadiness } from "@/components/AdminSEOReadiness";
import { DashboardShell } from "@/components/DashboardShell";
import { seoLandingPages } from "@/lib/seoLandingPages";

const seoPages = Object.values(seoLandingPages);

export default function AdminSeoPage() {
  return (
    <DashboardShell
      title="SEO Manager"
      subtitle="One clean place to check SEO readiness, edit metadata, upload the share image, and open public SEO pages."
      experience="admin"
      fullWidth
    >
      <div className="space-y-6">
        <AdminSEOReadiness />
        <AdminSEOManager />

        <section className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-ocean dark:text-cyan-300">Public SEO pages</p>
              <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">Open and review each page</h2>
            </div>
            <Link href="/sitemap.xml" className="rounded-xl border border-line px-4 py-2 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white">
              View sitemap
            </Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {seoPages.map((page) => (
              <Link
                key={page.slug}
                href={`/${page.slug}`}
                className="rounded-2xl border border-line bg-mist/60 p-4 transition hover:-translate-y-0.5 hover:border-ocean hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
              >
                <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{page.audience}</p>
                <h3 className="mt-2 text-lg font-black text-ink dark:text-white">{page.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{page.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
