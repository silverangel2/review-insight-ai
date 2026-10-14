import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import Link from "next/link";
import { listServerScans, loadServerResult } from "@/lib/serverResult";
import { formatShopperConfidence } from "@/lib/shopperAnswer";
import { compareSummary, sideColumn, type SideColumn } from "@/lib/sideBySide";
import { TrackedBuyLink } from "@/components/TrackedBuyLink";
import { AMAZON_ASSOCIATES_DISCLOSURE, INDEPENDENCE_STATEMENT } from "@/lib/trustContent";

export const dynamic = "force-dynamic";
export const metadata: Metadata = withSeo("/compare/side-by-side", { title: "Compare two products side by side", robots: { index: false } }, { noindex: true });

const CHIP: Record<string, string> = {
  buy: "bg-emerald-700 text-white", wait: "bg-[#fdf0d5] text-[#7a4a06]", skip: "bg-rose-700 text-white", not_enough: "bg-slate-100 text-slate-700",
};

function Column({ c }: { c: SideColumn }) {
  const a = c.answer;
  return (
    <article className="flex min-w-0 flex-col rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-900/5 sm:p-6">
      <h2 className="text-lg font-semibold leading-snug text-slate-900">{c.title}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-4 py-1.5 text-base font-semibold ${CHIP[a.kind]}`}>{a.label}</span>
        {a.score !== null ? <span className="text-sm text-slate-600">Score {Math.round(a.score)} / 100</span> : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{a.why}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-slate-500">How sure we are</dt><dd className="font-semibold text-slate-900">{formatShopperConfidence(a)}</dd></div>
      </dl>
      {[["What buyers love", a.loves, "bg-mint"], ["What buyers complain about", a.complaints, "bg-peach"]].map(([title, points, tint]) => (
        <section key={title as string} className={`mt-4 rounded-2xl ${tint} p-4`}>
          <h3 className="text-sm font-semibold text-slate-700">{title as string}</h3>
          {(points as typeof a.loves).length ? (
            <ul className="mt-2 space-y-3">
              {(points as typeof a.loves).slice(0, 3).map(p => (
                <li key={p.claim} className="text-sm">
                  <p className="font-semibold text-slate-900">{p.claim}</p>
                  {p.quote ? <blockquote className="mt-1 border-l-2 border-teal pl-3 text-slate-600">&ldquo;{p.quote}&rdquo;{p.sourceHost ? <span className="block text-xs text-slate-500">{p.sourceHost}</span> : null}</blockquote> : null}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-slate-600">Nothing repeated in the real reviews.</p>}
        </section>
      ))}
      <div className="mt-auto pt-5">
        {c.buyUrl ? (
          <>
            <TrackedBuyLink href={c.buyUrl} label={c.buyLabel!} productName={c.title} source="side_by_side" />
            <p className="mt-2 text-center text-xs text-slate-500">{c.isAffiliate ? "Affiliate link" : "Store link"}</p>
          </>
        ) : null}
        <Link href={`/results?scanId=${encodeURIComponent(c.scanId)}`} className="mt-3 block text-center text-sm font-medium text-teal underline-offset-2 hover:underline">See full result</Link>
      </div>
    </article>
  );
}

export default async function SideBySidePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams;
  const [ra, rb, scans] = await Promise.all([loadServerResult(a), loadServerResult(b), listServerScans()]);
  const ready = ra && rb && a !== b;
  const ca = ready ? sideColumn(ra!, a!) : null;
  const cb = ready ? sideColumn(rb!, b!) : null;
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
      <p className="inline-flex rounded-full bg-lavender px-3 py-1 text-sm font-semibold text-slate-700">Side by side</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Compare two products you scanned</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">Built only from your real scans: what buyers actually wrote about each exact product.</p>

      <form method="get" className="mt-6 grid gap-3 rounded-[1.5rem] bg-white p-4 ring-1 ring-slate-900/5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        {(["a", "b"] as const).map((k, n) => (
          <label key={k} className="text-sm font-medium text-slate-700">Product {n + 1}
            <select name={k} defaultValue={(k === "a" ? a : b) || ""} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <option value="">Choose a saved scan</option>
              {scans.map(s => <option key={s.scanId} value={s.scanId}>{s.title}</option>)}
            </select>
          </label>
        ))}
        <button type="submit" className="ri-lift rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white">Compare</button>
      </form>
      {!scans.length ? <p className="mt-3 text-sm text-slate-600"><Link href="/login" className="text-teal underline">Sign in</Link> and scan two products to compare them here, or <Link href="/analyze" className="text-teal underline">scan a product</Link>.</p> : null}

      {ca && cb ? (
        <>
          <p className="mt-8 rounded-2xl bg-butter px-5 py-3 text-sm font-medium text-slate-800" data-testid="compare-summary">{compareSummary(ca, cb)}</p>
          <div className="mt-4 grid gap-5 md:grid-cols-2"><Column c={ca} /><Column c={cb} /></div>
          <p className="mt-6 text-xs leading-5 text-slate-500">{AMAZON_ASSOCIATES_DISCLOSURE} {INDEPENDENCE_STATEMENT}</p>
        </>
      ) : a || b ? <p className="mt-6 text-sm text-slate-600">Pick two different saved scans to compare.</p> : null}
    </main>
  );
}
