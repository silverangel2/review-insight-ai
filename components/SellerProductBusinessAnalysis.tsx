"use client";

import Link from "next/link";
import { useMemo } from "react";
import { consolidateSellerProductScans } from "@/lib/sellerProductConsolidation";
import type { SellerProduct } from "@/lib/sellerProducts";

type Props = {
  products: SellerProduct[];
  isPro: boolean;
};

const TREND_STYLES: Record<string, string> = {
  improving: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  declining: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  stable: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200",
  needs_data: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
};

const TREND_LABELS: Record<string, string> = {
  improving: "Improving",
  declining: "Declining",
  stable: "Stable",
  needs_data: "Needs data",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-white/5">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-ink dark:text-white">{value}</p>
    </div>
  );
}

export function SellerProductBusinessAnalysis({ products, isPro }: Props) {
  const ordered = useMemo(
    () => [...products].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [products]
  );
  if (!ordered.length) return null;

  return (
    <section className="seller-product-business-analysis mb-6 rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r dark:from-sky-600 dark:to-teal-500">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-ocean">Product business analysis</p>
      <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">Every scan, consolidated per product</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
        Each new seller analysis merges into its product&apos;s record automatically — the numbers below roll up every
        analysis ever saved for that product.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {ordered.map((product) => {
          const consolidated = consolidateSellerProductScans(product.scans ?? []);
          const hasScans = consolidated.analysisCount > 0;

          return (
            <article
              key={product.id}
              className="min-w-0 overflow-hidden rounded-[1.5rem] border border-line bg-slate-50/60 p-5 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="max-w-full break-words text-lg font-black leading-tight text-ink [overflow-wrap:anywhere] dark:text-white">
                  {product.name}
                </h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${TREND_STYLES[consolidated.trend] ?? TREND_STYLES.stable}`}
                >
                  {TREND_LABELS[consolidated.trend] ?? "Stable"}
                </span>
              </div>

              {!hasScans ? (
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  No seller analyses attached yet. Run a seller analysis and it will merge into this product&apos;s
                  record automatically.
                </p>
              ) : !isPro ? (
                <div className="mt-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Metric label="Analyses" value={String(consolidated.analysisCount)} />
                    <Metric label="Reviews analyzed" value={String(consolidated.totalReviews)} />
                    <Metric label="Avg health" value={consolidated.avgHealth === null ? "—" : `${consolidated.avgHealth}%`} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    The full consolidated business analysis — trend, recurring complaints, strengths, and merged action
                    themes — is part of{" "}
                    <Link href="/pricing" className="font-bold text-teal underline-offset-2 hover:underline">
                      Seller Pro
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className="mt-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metric label="Analyses" value={String(consolidated.analysisCount)} />
                    <Metric label="Reviews" value={String(consolidated.totalReviews)} />
                    <Metric label="Avg health" value={consolidated.avgHealth === null ? "—" : `${consolidated.avgHealth}%`} />
                    <Metric
                      label="Satisfaction"
                      value={consolidated.avgSatisfaction === null ? "—" : `${consolidated.avgSatisfaction}%`}
                    />
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{consolidated.trendNote}</p>

                  {consolidated.topComplaints.length ? (
                    <div className="mt-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Recurring complaints
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {consolidated.topComplaints.slice(0, 5).map((theme) => (
                          <li key={theme.label} className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate text-ink dark:text-white">{theme.label}</span>
                            <span className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">
                              {theme.analyses} {theme.analyses === 1 ? "analysis" : "analyses"} · {theme.reviews} reviews
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {consolidated.topStrengths.length ? (
                    <div className="mt-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Proven strengths
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {consolidated.topStrengths.slice(0, 5).map((theme) => (
                          <li key={theme.label} className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate text-ink dark:text-white">{theme.label}</span>
                            <span className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">
                              {theme.analyses} {theme.analyses === 1 ? "analysis" : "analyses"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {consolidated.priorityActions.length ? (
                    <div className="mt-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Consolidated action themes
                      </p>
                      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink dark:text-white">
                        {consolidated.priorityActions.slice(0, 6).map((theme) => (
                          <li key={theme.label}>{theme.label}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <details className="mt-4 rounded-2xl bg-slate-100/70 px-4 py-3 dark:bg-white/5">
                    <summary className="cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-200">
                      Analysis history ({consolidated.analysisCount})
                    </summary>
                    <ul className="mt-3 space-y-2">
                      {(product.scans ?? []).map((scan) => (
                        <li key={scan.id} className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-slate-600 dark:text-slate-300">{scan.date || "—"}</span>
                          <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{scan.topComplaint}</span>
                          <span className="shrink-0 font-black text-ink dark:text-white">
                            {scan.productHealthScore}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
