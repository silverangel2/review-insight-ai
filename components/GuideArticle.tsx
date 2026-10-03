import Link from "next/link";
import { guides, type Guide } from "@/lib/guides";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function formatGuideDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTHS[(month || 1) - 1]} ${day}, ${year}`;
}

export function GuideArticle({ guide }: { guide: Guide }) {
  const others = guides.filter((item) => item.slug !== guide.slug).slice(0, 3);

  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Link href="/guides" className="transition hover:text-ocean dark:hover:text-cyan-300">
          Guides
        </Link>
        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">/</span>
        <span className="line-clamp-1 text-slate-700 dark:text-slate-200">{guide.title}</span>
      </nav>

      <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-line bg-[linear-gradient(135deg,#172033,#2356a3_52%,#08b7a8)] p-8 text-white shadow-glow sm:p-10">
        <div className="ri-scan-grid absolute inset-0 opacity-20" />
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber">
            ReviewIntel Guide
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
            {guide.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
            {guide.excerpt}
          </p>
          <p className="mt-6 text-sm font-bold text-slate-300">
            {formatGuideDate(guide.publishedAt)} · {guide.readingMinutes} min read
          </p>
        </div>
      </section>

      <article className="mt-10 rounded-[2rem] border border-line bg-white p-8 shadow-soft dark:border-white/10 dark:bg-gradient-to-r dark:from-sky-600 dark:to-teal-500 sm:p-10">
        {guide.sections.map((section) => (
          <section key={section.heading} className="mb-10 last:mb-0">
            <h2 className="text-2xl font-black text-ink dark:text-white">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph, index) => (
              <p
                key={`${section.heading}-${index}`}
                className="mt-4 text-base leading-8 text-slate-700 dark:text-slate-200"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <aside className="mt-12 rounded-3xl border border-amber/40 bg-amber/10 p-8 text-center dark:border-amber/30 dark:bg-amber/10">
          <h2 className="text-2xl font-black text-ink dark:text-white">
            Put this into practice on your next purchase
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            ReviewIntel reads review language, complaint patterns, and trust signals for you —
            and gives a clear BUY, REVIEW FIRST, or AVOID verdict. Your first 3 scans are free,
            no account needed.
          </p>
          <Link
            href="/analyze"
            className="mt-6 inline-flex rounded-2xl bg-ink px-6 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
          >
            Try a free scan
          </Link>
        </aside>
      </article>

      {others.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-black text-ink dark:text-white">More guides</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {others.map((other) => (
              <Link
                key={other.slug}
                href={`/guides/${other.slug}`}
                className="group rounded-3xl border border-line bg-white p-5 shadow-soft transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-300"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {formatGuideDate(other.publishedAt)} · {other.readingMinutes} min read
                </p>
                <p className="mt-2 text-base font-black leading-6 text-ink transition group-hover:text-ocean dark:text-white dark:group-hover:text-cyan-300">
                  {other.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
