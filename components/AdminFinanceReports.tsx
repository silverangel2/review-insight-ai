"use client";

import { useMemo, useState } from "react";

export default function AdminFinanceReports() {
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const links = useMemo(() => {
    const encodedYear = encodeURIComponent(year);

    return {
      taxCsv: `/api/admin/finance/report?type=tax&format=csv&year=${encodedYear}`,
      taxHtml: `/api/admin/finance/report?type=tax&format=html&year=${encodedYear}`,
      personalCsv: `/api/admin/finance/report?type=personal&format=csv&year=${encodedYear}`,
      personalHtml: `/api/admin/finance/report?type=personal&format=html&year=${encodedYear}`,
    };
  }, [year]);

  return (
    <section className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
            Finance reports
          </p>
          <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">
            Canada tax and personal reports
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Generate tax-preparation and personal finance reports from real Supabase finance entries. Use CSV for your accountant/spreadsheet and printable report for review.
          </p>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-mist px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Year</span>
          <input
            value={year}
            onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            className="w-20 bg-transparent text-lg font-black text-ink outline-none dark:text-white"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-lg font-black text-ink dark:text-white">Tax Report</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Canada-style report with suggested CRA/T2125 expense grouping, monthly totals, category totals, receipt links, and tax notes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={links.taxCsv}
              className="rounded-2xl bg-ink px-4 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
            >
              Download Tax CSV
            </a>
            <a
              href={links.taxHtml}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-black text-ink transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              Open Tax Report
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-lg font-black text-ink dark:text-white">Personal Report</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Personal cash-flow summary, spending pattern, category totals, and recent finance entries.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={links.personalCsv}
              className="rounded-2xl bg-ocean px-4 py-3 text-sm font-black text-white transition hover:bg-ink"
            >
              Download Personal CSV
            </a>
            <a
              href={links.personalHtml}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-black text-ink transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              Open Personal Report
            </a>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs font-bold leading-5 text-slate-500">
        Reports are for Canadian business organization and review. Suggested T2125 groupings are not tax advice. Confirm treatment with a qualified tax professional before filing.
      </p>
    </section>
  );
}
