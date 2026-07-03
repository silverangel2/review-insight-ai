import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getUiTextTranslation, normalizeLocale } from "@/lib/i18n";
import { BILLING_EMAIL, footerLinkGroups, SUPPORT_EMAIL } from "@/lib/trustContent";

export async function SiteFooter() {
  const locale = normalizeLocale(await getLocale());
  const tr = (text: string) => getUiTextTranslation(locale, text) || text;

  return (
    <footer className="border-t border-cyan-100/70 bg-white/85 px-4 py-10 text-ink shadow-[0_-20px_70px_rgba(8,183,168,0.06)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90 dark:text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl min-w-0 gap-8 lg:grid-cols-[1.05fr_1.6fr]">
        <section className="relative min-w-0 overflow-hidden rounded-[2rem] border border-line bg-[linear-gradient(135deg,#172033,#2356a3_52%,#08b7a8)] p-5 text-white shadow-glow dark:border-white/10 sm:p-6">
          <div className="ri-scan-grid absolute inset-0 opacity-20" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-white text-sm font-black text-ink">RI</span>
              <div>
                <p className="text-lg font-black">ReviewIntel</p>
                <p className="text-xs font-bold uppercase text-cyan-100">{tr("AI review intelligence")}</p>
              </div>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-100">
              {tr("AI shopping intelligence for shoppers and ecommerce sellers, with clear support, billing, privacy, and subscription controls.")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/contact" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-ink transition hover:bg-cyan-100">
                {tr("Customer Service")}
              </Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15">
                {tr("Email Us")}
              </a>
            </div>
            <div className="mt-5 grid gap-2 text-sm text-cyan-50">
              <p>
                {tr("Support:")} <a className="font-black underline-offset-4 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </p>
              <p>
                {tr("Billing:")} <a className="font-black underline-offset-4 hover:underline" href={`mailto:${BILLING_EMAIL}`}>{BILLING_EMAIL}</a>
              </p>
            </div>
          </div>
        </section>

        <nav className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Footer links">
          {footerLinkGroups.map((group) => (
            <section key={group.title} className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-white/[0.04]">
              <h2 className="text-sm font-black uppercase text-slate-500 dark:text-slate-400">{tr(group.title)}</h2>
              <div className="mt-4 grid gap-3">
                {group.links.map((link) => (
                  <Link key={`${link.label}-${link.href}`} href={link.href} className="min-w-0 break-words text-sm font-bold text-slate-600 transition hover:text-ocean dark:text-slate-300 dark:hover:text-cyan-200">
                    {tr(link.label)}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </div>
      <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-2 border-t border-line pt-5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span>ReviewIntel 2026</span>
        <span>{tr("AI guidance for review decisions. Always verify critical product claims.")}</span>
      </div>
    </footer>
  );
}
