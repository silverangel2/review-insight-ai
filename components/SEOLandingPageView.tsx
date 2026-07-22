import Link from "next/link";
import { Badge } from "@/components/Badge";
import type { SEOLandingPage } from "@/lib/seoLandingPages";

export function SEOLandingPageView({ page }: { page: SEOLandingPage }) {
  const primaryHref = page.audience === "Seller" ? "/dashboard/seller" : "/analyze";
  const secondaryHref =
    page.slug === "fake-review-detector"
      ? "/disclaimer"
      : page.audience === "Seller"
        ? "/pricing"
        : "/results";

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <section className="relative overflow-hidden rounded-[2.6rem] border border-white/20 bg-[linear-gradient(135deg,#050816,#2356a3_44%,#08b7a8_78%,#ffb238)] p-7 text-white shadow-[0_35px_130px_rgba(35,86,163,0.34)] md:p-10">
        <div className="ri-scan-grid absolute inset-0 opacity-25" />
        <div className="ri-scan-beam absolute inset-x-0 top-0 h-28 opacity-70" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_0.82fr] lg:items-center">
          <div>
            <Badge tone={page.audience === "Seller" ? "warn" : "good"}>{page.audience} SEO landing page</Badge>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight md:text-7xl">{page.title}</h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-100">{page.description}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href={primaryHref} className="rounded-2xl bg-white px-6 py-4 text-center text-sm font-black text-ink shadow-glow transition hover:-translate-y-0.5 hover:bg-cyan-100">
                {page.primaryCta}
              </Link>
              <Link href={secondaryHref} className="rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-center text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15">
                {page.secondaryCta}
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/15 bg-gradient-to-r from-sky-600 to-teal-500/52 p-5 shadow-[0_25px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-wide text-cyan-100">Launch-ready search focus</p>
            <div className="mt-4 grid gap-3">
              {page.highlights.map((highlight, index) => (
                <div key={highlight} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <span className="grid size-9 place-items-center rounded-full bg-white text-sm font-black text-ink">{index + 1}</span>
                  <span className="text-sm font-black">{highlight}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-5 md:grid-cols-3">
        {(page.sections ?? []).map((section) => (
          <article key={section.title} className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
            <h2 className="text-2xl font-black text-ink dark:text-white">{section.title}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{section.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
        <p className="text-xs font-black uppercase text-ocean dark:text-cyan-300">Keywords and search topics</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {page.keywords.map((keyword) => (
            <span key={keyword} className="rounded-full border border-teal/20 bg-teal/10 px-3 py-2 text-xs font-black uppercase text-teal">
              {keyword}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
