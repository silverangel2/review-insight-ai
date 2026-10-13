import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuideArticle } from "@/components/GuideArticle";
import { getGuide, guides } from "@/lib/guides";
import { loadCategoryGuides } from "@/lib/guideData";
import { GUIDE_MIN_PRODUCTS, GUIDE_MIN_REVIEWS, PRODUCT_TYPES } from "@/lib/categoryGuides";
import { INDEPENDENCE_STATEMENT } from "@/lib/trustContent";
import { withSeo } from "@/lib/pageSeo";
import { JsonLd } from "@/components/JsonLd";
import { seoBaseUrl } from "@/lib/seoAutomation";

async function categoryGuideFor(slug: string) {
  return (await loadCategoryGuides()).find(g => g.slug === slug) || null;
}

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const editorial = getGuide(slug);
  if (editorial) {
    return withSeo(`/guides/${slug}`, { title: { absolute: `${editorial.title} | ReviewIntel` }, description: editorial.excerpt }, { type: "article" });
  }
  const g = await categoryGuideFor(slug);
  const name = g?.name || PRODUCT_TYPES.find(t => t.slug === slug)?.name || "Guide";
  const description = g && !g.thin
    ? `What real buyers reported about ${name.toLowerCase()}: repeated praise and complaints from ${g.totalReviews} written reviews across ${g.products.length} scanned products.`
    : `A ReviewIntel guide to ${name.toLowerCase()}, built only from real written buyer reviews.`;
  return withSeo(`/guides/${slug}`, { title: `${name}: what real buyers reported`, description }, { type: "article", noindex: !g || g.thin });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const editorial = getGuide(slug);
  if (editorial) return <GuideArticle guide={editorial} />;

  if (!PRODUCT_TYPES.some(t => t.slug === slug)) notFound();
  const g = await categoryGuideFor(slug);
  const name = g?.name || PRODUCT_TYPES.find(t => t.slug === slug)!.name;
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
      {g && !g.thin ? <JsonLd data={[
        {
          "@context": "https://schema.org", "@type": "Article",
          headline: `${name}: what real buyers reported`,
          description: `Repeated praise and complaints from ${g.totalReviews} real written buyer reviews across ${g.products.length} scanned products.`,
          url: `${seoBaseUrl()}/guides/${slug}`, mainEntityOfPage: `${seoBaseUrl()}/guides/${slug}`,
          author: { "@type": "Organization", name: "ReviewIntel", url: seoBaseUrl() },
          publisher: { "@type": "Organization", name: "ReviewIntel", url: seoBaseUrl() },
        },
        ...(g.loves.length || g.complaints.length ? [{
          "@context": "https://schema.org", "@type": "FAQPage",
          mainEntity: [
            ...(g.loves.length ? [{ "@type": "Question", name: `What do buyers like about ${name.toLowerCase()}?`, acceptedAnswer: { "@type": "Answer", text: `Buyers most often reported: ${g.loves.slice(0, 4).map(t => t.claim).join("; ")}.` } }] : []),
            ...(g.complaints.length ? [{ "@type": "Question", name: `What do buyers complain about with ${name.toLowerCase()}?`, acceptedAnswer: { "@type": "Answer", text: `The most repeated problems were: ${g.complaints.slice(0, 4).map(t => t.claim).join("; ")}.` } }] : []),
          ],
        }] : []),
      ]} /> : null}
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500"><Link href="/" className="text-teal underline-offset-2 hover:underline">Home</Link> / <Link href="/guides" className="text-teal underline-offset-2 hover:underline">All guides</Link></nav>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{name}: what real buyers reported</h1>
      {!g || g.thin ? (
        <p className="mt-4 rounded-2xl bg-butter p-5 text-sm text-slate-700" data-testid="guide-thin">
          Not enough data yet. A guide needs at least {GUIDE_MIN_PRODUCTS} scanned products and {GUIDE_MIN_REVIEWS} real reviews{g ? ` (so far: ${g.products.length} products, ${g.totalReviews} reviews)` : ""}. <Link href="/analyze" className="font-semibold text-teal underline">Scan a product</Link> to help.
        </p>
      ) : null}
      {g ? (
        <>
          <p className="mt-4 text-base text-slate-600">Based on {g.products.length} scanned products and {g.totalReviews} real written buyer reviews.</p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {([["Buyers reported liking", g.loves, "bg-mint"], ["Buyers reported problems with", g.complaints, "bg-peach"]] as const).map(([title, themes, tint]) => (
              <section key={title} className={`rounded-[1.5rem] ${tint} p-5`}>
                <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                {themes.length ? (
                  <ul className="mt-3 space-y-3">
                    {themes.map(t => (
                      <li key={t.claim} className="text-sm">
                        <p className="font-semibold text-slate-900">{t.claim} <span className="font-normal text-slate-600">· reported for {t.products} product{t.products === 1 ? "" : "s"}</span></p>
                        {t.quote ? <blockquote className="mt-1 border-l-2 border-teal pl-3 text-slate-700">&ldquo;{t.quote}&rdquo;{t.sourceHost ? <span className="block text-xs text-slate-500">A buyer on {t.sourceHost}</span> : null}</blockquote> : null}
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-sm text-slate-600">Nothing repeated yet.</p>}
              </section>
            ))}
          </div>
          <h2 className="mt-8 text-xl font-semibold text-slate-900">Products we scanned</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-[1.5rem] bg-white ring-1 ring-slate-900/5">
            {g.products.map(p => (
              <li key={p.title} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="min-w-0 font-medium text-slate-900">{p.title}</span>
                <span className="text-slate-600">{p.label}{p.score !== null ? ` · ${Math.round(p.score)} / 100` : ""} · {p.reviewCount} reviews</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <section className="mt-8 rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-900/5">
        <h2 className="text-base font-semibold text-slate-900">Check a specific product</h2>
        <p className="mt-1 text-sm text-slate-600">Paste any Amazon link and get a Buy, Wait or Skip answer from its own real reviews. <Link href="/analyze" className="font-semibold text-teal underline">Scan a product</Link> · <Link href="/guides/spot-fake-amazon-reviews" className="font-semibold text-teal underline">How to spot fake reviews</Link></p>
      </section>
      <p className="mt-8 text-xs leading-5 text-slate-500">These are summaries of what buyers wrote, not our own claims about any brand. {INDEPENDENCE_STATEMENT}</p>
    </main>
  );
}
