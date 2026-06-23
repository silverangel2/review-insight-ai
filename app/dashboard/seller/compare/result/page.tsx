"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  deleteSellerCompareHistoryItem,
  readActiveSellerCompare,
  readSellerCompareHistory,
  setActiveSellerCompare,
  type SellerCompareHistoryItem,
} from "@/lib/sellerCompareHistory";

function list(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|•|- /)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function text(value: unknown, fallback = "Not enough evidence yet.") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function score(value: unknown) {
  return typeof value === "number" ? `${Math.round(value)}% confidence` : "AI confidence";
}

export default function SellerCompareResultPage() {
  const [active, setActive] = useState<SellerCompareHistoryItem | null>(null);
  const [history, setHistory] = useState<SellerCompareHistoryItem[]>([]);

  function refresh() {
    const savedHistory = readSellerCompareHistory();
    const savedActive = readActiveSellerCompare();

    setHistory(savedHistory);
    setActive(savedActive || savedHistory[0] || null);

    if (!savedActive && savedHistory[0]) {
      setActiveSellerCompare(savedHistory[0].id);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const visibleActive = active || history[0] || null;

  if (!visibleActive) {
    return (
      <main className="min-h-screen bg-[#f7f3ea] px-4 py-10 text-[#172033]">
        <section className="mx-auto max-w-4xl rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-teal-600">
            Seller Compare
          </p>
          <h1 className="mt-3 text-4xl font-black">No compare result yet.</h1>
          <p className="mt-4 text-base font-semibold text-slate-600">
            Run a Seller Pro comparison first to create a dedicated competitor strategy result.
          </p>
          <Link
            href="/dashboard/seller/compare"
            className="mt-6 inline-flex rounded-2xl bg-teal-600 px-6 py-3 text-sm font-black text-white"
          >
            Run seller compare
          </Link>
        </section>
      </main>
    );
  }

  const comparison = visibleActive.comparison ?? {};
  const heroSummary = text(comparison.executiveSummary, "ReviewIntel created your competitor strategy.");
  const position = text(comparison.competitivePosition, "Competitive position needs more review evidence.");
  const warning = text(comparison.comparabilityWarning, "");

  const fixFirst = list(comparison.fixFirst);
  const marketMove = text(comparison.marketMove, "No clear market move was detected.");
  const outgrowStrategy = list(comparison.outgrowStrategy);
  const competitorAdvantages = list(comparison.competitorAdvantages);
  const yourAdvantages = list(comparison.yourAdvantages);
  const conversionGaps = list(comparison.conversionGaps);
  const productMoves = list(comparison.productMoves);
  const listingMoves = list(comparison.listingMoves);
  const adAngles = list(comparison.adAngles);
  const riskWarnings = list(comparison.riskWarnings);
  const thirtyDayPlan = list(comparison.thirtyDayPlan);
  const ninetyDayPlan = list(comparison.ninetyDayPlan);

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 text-[#172033]">
      <section className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="bg-slate-950 px-6 py-7 text-white md:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-teal-300">
                  Seller Pro AI Compare
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
                  Competitor Outgrowth Plan
                </h1>
                <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-300">
                  {visibleActive.yourLabel} <span className="text-teal-300">vs</span> {visibleActive.competitorLabel}
                </p>
              </div>

              <div className="rounded-3xl border border-teal-400/30 bg-teal-400/10 px-5 py-4">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-200">
                  AI Confidence
                </p>
                <p className="mt-2 text-3xl font-black text-white">{score(comparison.confidence)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="border-b border-slate-200 p-6 md:p-8 lg:border-b-0 lg:border-r">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
                Competitive position
              </p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950">{position}</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-slate-700">{heroSummary}</p>

              <div className="mt-6 rounded-3xl border border-teal-200 bg-teal-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-700">
                  Best market move
                </p>
                <p className="mt-3 text-xl font-black leading-8 text-teal-950">{marketMove}</p>
              </div>

              {warning ? (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
                  {warning}
                </p>
              ) : null}
            </section>

            <section className="p-6 md:p-8">
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-rose-700">
                  Fix first
                </p>
                <h3 className="mt-3 text-2xl font-black text-rose-950">
                  Highest-impact correction
                </h3>
                <ActionList items={fixFirst} empty="No urgent fix was detected." tone="rose" limit={4} />
              </div>
            </section>
          </div>

          <div className="grid gap-5 border-t border-slate-200 bg-slate-50 p-6 md:grid-cols-3 md:p-8">
            <StrategyCard title="Competitor wins because" items={competitorAdvantages} tone="amber" />
            <StrategyCard title="You already win on" items={yourAdvantages} tone="teal" />
            <StrategyCard title="Conversion leaks" items={conversionGaps} tone="rose" />
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2 md:p-8">
            <StrategyCard title="Product moves" items={productMoves} tone="slate" />
            <StrategyCard title="Listing moves" items={listingMoves} tone="slate" />
            <StrategyCard title="Ad angles to test" items={adAngles} tone="teal" />
            <StrategyCard title="Risk warnings" items={riskWarnings} tone="rose" />
          </div>

          <div className="border-t border-slate-200 bg-slate-950 p-6 text-white md:p-8">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-300">
                  Outgrow strategy
                </p>
                <ActionList items={outgrowStrategy} empty="No outgrowth strategy was generated." tone="dark" limit={6} />
              </section>

              <div className="grid gap-5 md:grid-cols-2">
                <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-300">
                    30-day attack plan
                  </p>
                  <ActionList items={thirtyDayPlan} empty="No 30-day plan was generated." tone="dark" limit={6} />
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-300">
                    90-day roadmap
                  </p>
                  <ActionList items={ninetyDayPlan} empty="No 90-day roadmap was generated." tone="dark" limit={6} />
                </section>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-slate-200 bg-white p-6 md:p-8">
            <Link
              href="/dashboard/seller/compare"
              className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-black text-white hover:bg-slate-800"
            >
              Run another compare
            </Link>
            <Link
              href="/seller/analyze"
              className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-800 hover:bg-slate-50"
            >
              Back to seller analyze
            </Link>
          </div>
        </div>

        {history.length > 0 ? (
          <section className="mt-6 rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Compare history</h2>
            <div className="mt-4 grid gap-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSellerCompare(item.id);
                      refresh();
                    }}
                    className="text-left"
                  >
                    <p className="text-sm font-black text-slate-950">
                      {item.yourLabel} vs {item.competitorLabel}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      deleteSellerCompareHistoryItem(item.id);
                      refresh();
                    }}
                    className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-black text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}


function StrategyCard({
  title,
  items,
  empty = "No clear pattern detected.",
  tone = "slate",
}: {
  title: string;
  items: string[];
  empty?: string;
  tone?: "slate" | "teal" | "rose" | "amber";
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal-200 bg-teal-50 text-teal-950"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-950"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-slate-200 bg-white text-slate-950";

  return (
    <section className={`rounded-3xl border p-6 ${toneClass}`}>
      <h3 className="text-xl font-black">{title}</h3>
      <ActionList items={items} empty={empty} tone={tone} limit={6} />
    </section>
  );
}

function ActionList({
  items,
  empty,
  tone,
  limit = 6,
}: {
  items: string[];
  empty: string;
  tone: "slate" | "teal" | "rose" | "amber" | "dark";
  limit?: number;
}) {
  const dotClass =
    tone === "dark"
      ? "bg-teal-300"
      : tone === "rose"
        ? "bg-rose-500"
        : tone === "amber"
          ? "bg-amber-500"
          : tone === "teal"
            ? "bg-teal-500"
            : "bg-slate-500";

  const textClass = tone === "dark" ? "text-slate-200" : "text-slate-700";
  const emptyClass = tone === "dark" ? "text-slate-400" : "text-slate-500";

  if (!items.length) {
    return <p className={`mt-4 text-sm font-semibold ${emptyClass}`}>{empty}</p>;
  }

  return (
    <ul className="mt-4 space-y-3">
      {items.slice(0, limit).map((item, index) => (
        <li key={`${item}-${index}`} className={`flex gap-3 text-sm font-semibold leading-6 ${textClass}`}>
          <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
