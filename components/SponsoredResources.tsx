import { Badge } from "@/components/Badge";
import { sponsorCategoryLabels, sponsorHref, sponsorsForPlacement, type SponsorPlacement } from "@/lib/sponsors";

type SponsoredResourcesProps = {
  placement: SponsorPlacement;
  title?: string;
  eyebrow?: string;
  description?: string;
  compact?: boolean;
};

export function SponsoredResources({
  placement,
  title = "Trusted ecommerce tools",
  eyebrow = "Partner resources",
  description = "A quiet directory for useful seller tools, ecommerce services, and AI workflows. Placements are curated to stay relevant to review intelligence.",
  compact = false
}: SponsoredResourcesProps) {
  const sponsors = sponsorsForPlacement(placement, compact ? 2 : 3);

  if (!sponsors.length) return null;

  return (
    <section
      aria-labelledby={`sponsored-${placement}`}
      className={compact ? "rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950" : "border-b border-line bg-white dark:border-white/10 dark:bg-slate-950"}
    >
      <div className={compact ? "" : "mx-auto max-w-7xl px-6 py-14"}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge tone="neutral">{eyebrow}</Badge>
            <h2 id={`sponsored-${placement}`} className={`${compact ? "text-xl" : "text-3xl"} mt-4 font-black tracking-tight text-ink dark:text-white`}>
              {title}
            </h2>
          </div>
          <p className={`${compact ? "max-w-xl" : "max-w-2xl"} text-sm leading-6 text-slate-600 dark:text-slate-300`}>
            {description}
          </p>
        </div>

        <div className={`${compact ? "mt-5 grid gap-3" : "mt-8 grid gap-5 md:grid-cols-3"}`}>
          {sponsors.map((sponsor) => (
            <article
              key={sponsor.id}
              data-sponsor-id={sponsor.id}
              data-sponsored={sponsor.sponsored ? "true" : "false"}
              className="rounded-2xl border border-line bg-mist p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-ocean/40 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-white text-sm font-black text-ink dark:border-white/10 dark:bg-slate-950 dark:text-white">
                    {sponsor.logoText}
                  </div>
                  <div>
                    <h3 className="font-black text-ink dark:text-white">{sponsor.title}</h3>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      {sponsorCategoryLabels[sponsor.category]}
                    </p>
                  </div>
                </div>
                {sponsor.sponsored ? <Badge tone="info">Sponsored</Badge> : null}
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{sponsor.description}</p>
              <a
                href={sponsorHref(sponsor)}
                target="_blank"
                rel="noopener noreferrer sponsored"
                data-sponsor-click={sponsor.id}
                className="mt-5 inline-flex rounded-xl border border-line bg-white px-4 py-2 text-sm font-black text-ink transition hover:border-ocean hover:text-ocean dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:text-cyan-300"
              >
                {sponsor.cta}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
