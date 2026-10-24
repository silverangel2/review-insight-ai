import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getUiTextTranslation, normalizeLocale } from "@/lib/i18n";
import { footerLinkGroups, INDEPENDENCE_STATEMENT, AMAZON_ASSOCIATES_DISCLOSURE } from "@/lib/trustContent";

/**
 * Site footer (homepage overhaul, 2026-10-23): flat and short, on the
 * same 1,120px grid as the homepage — brand blurb (no "AI" tagline),
 * then the Product / Trust / Support columns from footerLinkGroups,
 * then the legal line. The old gradient brand card and the boxed link
 * cards are gone. NOTE: this component is shared by every page, so the
 * flat footer applies site-wide (flagged in the build report).
 */
export async function SiteFooter() {
  const locale = normalizeLocale(await getLocale());
  const tr = (text: string) => getUiTextTranslation(locale, text) || text;

  return (
    <footer className="border-t border-[#e2e8f0] bg-white px-4 pb-[34px] pt-16 text-ink dark:border-white/10 dark:bg-[#101018] dark:text-slate-200 sm:px-6">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-[10px] bg-[linear-gradient(92deg,#0a6cff,#5b3df0)] text-sm font-extrabold text-white">
                RI
              </span>
              <span className="text-[19px] font-extrabold text-ink dark:text-white">
                Review<span className="ri-gradient-text">Intel</span>
              </span>
            </div>
            <p className="mt-3 max-w-[34ch] text-[15px] leading-[1.6] text-slate-600 dark:text-slate-300">
              {tr("Review intelligence for shoppers — clear answers from real buyer reviews, with clear support, billing and privacy controls.")}
            </p>
          </div>

          {footerLinkGroups.map((group) => (
            <nav key={group.title} aria-label={tr(group.title)}>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink dark:text-white">
                {tr(group.title)}
              </h2>
              <ul className="mt-3.5">
                {group.links.map((link) => (
                  <li key={`${link.label}-${link.href}`} className="my-[9px]">
                    <Link
                      href={link.href}
                      className="text-[15px] text-slate-600 transition hover:text-[#0a6cff] dark:text-slate-300 dark:hover:text-indigo-300"
                    >
                      {tr(link.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-11 flex flex-wrap gap-x-[18px] gap-y-2 border-t border-[#e2e8f0] pt-5 text-[13.5px] text-slate-500 dark:border-white/10 dark:text-slate-400">
          <span className="font-semibold uppercase tracking-wide">ReviewIntel 2026</span>
          <span>
            {INDEPENDENCE_STATEMENT} {AMAZON_ASSOCIATES_DISCLOSURE}
          </span>
        </div>
      </div>
    </footer>
  );
}
