import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VerdictSummaryCard } from "@/components/VerdictSummaryCard";
import { ShareVerdictButton } from "@/components/ShareVerdictButton";
import { verifySharedVerdict } from "@/lib/shareVerdict";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = verifySharedVerdict((await params).token);
  if (!data) return { title: "Shared verdict", robots: { index: false } };
  const score = data.score !== null ? ` · ${data.score.toFixed(1)}/10` : "";
  const title = `${data.label}: ${data.product}`;
  const description = `${data.label}${score}. ${data.why}${data.reviewCount > 0 ? ` Based on ${data.reviewCount} real buyer reviews.` : ""}`;
  return {
    title, description, robots: { index: false },
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedVerdictPage({ params }: Props) {
  const { token } = await params;
  const data = verifySharedVerdict(token);
  if (!data) notFound();
  const summary = {
    ...data,
    loves: data.love ? [data.love] : [],
    complaints: data.complaint ? [data.complaint] : [],
  };
  const scanned = new Date(data.createdAt);
  return (
    <main className="min-h-[80vh] bg-slate-50 px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <VerdictSummaryCard summary={summary} eyebrow="ReviewIntel verdict" headingLevel="h1" />
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Scanned {Number.isNaN(scanned.getTime()) ? "recently" : scanned.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}. Verdicts come only from real buyer reviews, never generated ones.
          </p>
          <ShareVerdictButton path={`/v/${token}`} title={`${data.label}: ${data.product}`} />
        </div>
        <section className="mt-10 rounded-[1.75rem] bg-white p-6 text-center ring-1 ring-slate-900/5 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Check a product before you buy</h2>
          <p className="mt-1 text-sm text-slate-600">Paste any Amazon link and get a plain answer from real buyer reviews.</p>
          <Link href="/analyze" className="mt-4 inline-flex rounded-full bg-teal px-6 py-3 text-sm font-semibold text-white hover:bg-teal/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">Scan a product</Link>
        </section>
      </div>
    </main>
  );
}
