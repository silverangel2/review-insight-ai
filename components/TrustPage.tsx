import Link from "next/link";
import { Badge } from "@/components/Badge";
import { ManageSubscriptionPanel } from "@/components/ManageSubscriptionPanel";
import { SupportContactForm } from "@/components/SupportContactForm";
import { SUPPORT_EMAIL, type TrustPageContent } from "@/lib/trustContent";

const toneClass = {
  trust: "from-teal/18 via-ocean/10 to-white dark:to-slate-950",
  support: "from-ocean/18 via-teal/10 to-white dark:to-slate-950",
  billing: "from-amber/20 via-ocean/10 to-white dark:to-slate-950",
  warning: "from-coral/16 via-amber/10 to-white dark:to-slate-950"
};

const toneBadge = {
  trust: "good",
  support: "info",
  billing: "warn",
  warning: "bad"
} as const;

export function TrustPage({ page }: { page: TrustPageContent }) {
  const showContactForm = page.slug === "contact" || page.slug === "billing-support" || page.slug === "account-support" || page.slug === "delete-account";
  const showSubscriptionPanel = page.slug === "manage-subscription";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className={`relative overflow-hidden rounded-[2.5rem] border border-line bg-gradient-to-br ${toneClass[page.tone]} p-6 shadow-soft dark:border-white/10 md:p-8`}>
        <div className="ri-scan-grid absolute inset-0 opacity-25" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Badge tone={toneBadge[page.tone]}>{page.eyebrow}</Badge>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-ink dark:text-white md:text-6xl">{page.title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-300">{page.summary}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white/80 p-4 text-sm font-bold text-slate-600 shadow-soft backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Last updated</p>
            <p className="mt-2 text-ink dark:text-white">{page.updated}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-5">
        {page.sections.map((section) => (
          <article key={section.title} className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
            <h2 className="text-2xl font-black text-ink dark:text-white">{section.title}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{section.body}</p>
            {section.items?.length ? (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {section.items.map((item) => (
                  <div key={item} className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
                    {item}
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </section>

      {showSubscriptionPanel ? <div className="mt-6"><ManageSubscriptionPanel /></div> : null}
      {showContactForm ? <div className="mt-6"><SupportContactForm defaultTopic={page.title} /></div> : null}

      <section className="mt-6 rounded-[2rem] border border-line bg-ink p-6 text-white shadow-glow dark:border-white/10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-teal">Customer service</p>
            <h2 className="mt-2 text-2xl font-black">Need help with this page?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Email {SUPPORT_EMAIL} or open the support form.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {page.cta ? (
              <Link href={page.cta.href} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-ink transition hover:bg-cyan-100">
                {page.cta.label}
              </Link>
            ) : null}
            <Link href="/faq" className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15">
              Open FAQ
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
