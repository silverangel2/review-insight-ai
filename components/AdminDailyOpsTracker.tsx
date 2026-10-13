"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";

type DailyOps = {
  date: string;
  signups: number;
  analyzeScans: number;
  compareScans: number;
  sales: number;
  revenue: number;
  aiCost: number;
};

const OPS_KEY = "reviewintel:admin-daily-ops";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function blankDay(date: string): DailyOps {
  return { date, signups: 0, analyzeScans: 0, compareScans: 0, sales: 0, revenue: 0, aiCost: 0 };
}

function readOps(): DailyOps[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOps(items: DailyOps[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OPS_KEY, JSON.stringify(items));
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export function AdminDailyOpsTracker() {
  const [items, setItems] = useState<DailyOps[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayKey());

  useEffect(() => {
    setItems(readOps());
  }, []);

  const selected = items.find((item) => item.date === selectedDate) ?? blankDay(selectedDate);

  const totals = useMemo(() => {
    return items.reduce(
      (sum, item) => ({
        signups: sum.signups + item.signups,
        analyzeScans: sum.analyzeScans + item.analyzeScans,
        compareScans: sum.compareScans + item.compareScans,
        sales: sum.sales + item.sales,
        revenue: sum.revenue + item.revenue,
        aiCost: sum.aiCost + item.aiCost
      }),
      { signups: 0, analyzeScans: 0, compareScans: 0, sales: 0, revenue: 0, aiCost: 0 }
    );
  }, [items]);

  function savePatch(patch: Partial<DailyOps>) {
    const nextDay = { ...selected, ...patch };
    const next = [nextDay, ...items.filter((item) => item.date !== selectedDate)].sort((a, b) => b.date.localeCompare(a.date));
    setItems(next);
    writeOps(next);
  }

  function zeroAll() {
    setItems([]);
    writeOps([]);
  }

  const totalScans = totals.analyzeScans + totals.compareScans;

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge tone="good">Daily operations tracker</Badge>
          <h2 className="mt-4 text-2xl font-black text-ink dark:text-white">Signups, scans, sales, and AI cost per day</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Starts at zero. Use this as your launch control sheet until the production database and Stripe analytics are fully connected.
          </p>
        </div>
        <button
          type="button"
          onClick={zeroAll}
          className="rounded-2xl border border-coral/30 px-5 py-3 text-sm font-black text-coral transition hover:bg-coral/10"
        >
          Zero local tracker
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-6">
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Signups</p>
          <p className="mt-2 text-3xl font-black text-ink dark:text-white">{totals.signups}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Total scans</p>
          <p className="mt-2 text-3xl font-black text-ocean">{totalScans}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Analyze / Compare</p>
          <p className="mt-2 text-2xl font-black text-teal">{totals.analyzeScans} / {totals.compareScans}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Sales</p>
          <p className="mt-2 text-3xl font-black text-amber">{totals.sales}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Revenue</p>
          <p className="mt-2 text-3xl font-black text-teal">{money(totals.revenue)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">AI cost</p>
          <p className="mt-2 text-3xl font-black text-coral">{money(totals.aiCost)}</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
        <label className="block max-w-xs">
          <span className="text-sm font-black text-ink dark:text-white">Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
        </label>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            ["signups", "Signups"],
            ["analyzeScans", "Analyze scans"],
            ["compareScans", "Compare scans"],
            ["sales", "Sales"],
            ["revenue", "Revenue $"],
            ["aiCost", "AI cost $"]
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-sm font-black text-ink dark:text-white">{label}</span>
              <input
                type="number"
                min="0"
                step={key === "revenue" || key === "aiCost" ? "0.01" : "1"}
                value={selected[key as keyof DailyOps] as number}
                onChange={(event) => savePatch({ [key]: Number(event.target.value || 0) } as Partial<DailyOps>)}
                className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-line dark:border-white/10">
        {items.length ? (
          <table className="min-w-full divide-y divide-line text-sm dark:divide-white/10">
            <thead className="bg-mist text-xs font-black uppercase text-slate-500 dark:bg-white/[0.04]">
              <tr>
                {["Date", "Signups", "Analyze", "Compare", "Sales", "Revenue", "AI cost"].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-white/10">
              {items.map((item) => (
                <tr key={item.date}>
                  <td className="px-4 py-3 font-black">{item.date}</td>
                  <td className="px-4 py-3">{item.signups}</td>
                  <td className="px-4 py-3">{item.analyzeScans}</td>
                  <td className="px-4 py-3">{item.compareScans}</td>
                  <td className="px-4 py-3">{item.sales}</td>
                  <td className="px-4 py-3">{money(item.revenue)}</td>
                  <td className="px-4 py-3">{money(item.aiCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-8 text-sm font-bold text-slate-500 dark:text-slate-400">
            No daily activity recorded yet.
          </div>
        )}
      </div>
    </section>
  );
}
