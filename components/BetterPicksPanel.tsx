"use client";

import { useMemo, useState } from "react";

type ResultRecord = Record<string, unknown>;

type BetterPick = {
  title: string;
  store: string;
  url: string;
  affiliateUrl: string;
  rating?: number | null;
  reviewCount?: number | null;
  price?: string | null;
  badge: string;
  whyBetter: string;
  aiLikeRisk?: string | null;
};

function getRecord(value: unknown): ResultRecord {
  return value && typeof value === "object" ? (value as ResultRecord) : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getProductName(result: ResultRecord) {
  const identity = getRecord(result.productIdentity);
  const identitySnake = getRecord(result.product_identity);

  return (
    getString(result.productName) ||
    getString(result.name) ||
    getString(result.title) ||
    getString(result.productTitle) ||
    getString(identity.title) ||
    getString(identitySnake.title)
  );
}

export function BetterPicksPanel({ result }: { result: ResultRecord }) {
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<BetterPick[]>([]);
  const [error, setError] = useState("");
  const [disclosure, setDisclosure] = useState(
    "ReviewIntel may earn a commission from qualifying purchases through affiliate links. This does not affect our verdicts or review analysis."
  );

  const productName = useMemo(() => getProductName(result || {}), [result]);

  async function findBetterPicks() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/product-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productName,
          result,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not find better picks.");
      }

      setPicks(Array.isArray(data.recommendations) ? data.recommendations : []);
      setDisclosure(data.disclosure || disclosure);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find better picks.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-400/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-200">
            Affiliate-ready
          </p>
          <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
            Better Picks
          </h3>
          <p className="mt-1 text-sm font-bold text-emerald-900/70 dark:text-emerald-100/80">
            Find stronger alternatives from Amazon when the scanned item is not the best choice.
          </p>
        </div>

        <button
          type="button"
          onClick={findBetterPicks}
          disabled={loading || !productName}
          className="rounded-full bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm transition hover:scale-[1.02] disabled:opacity-50"
        >
          {loading ? "Searching..." : "Find better picks"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {picks.length > 0 ? (
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {picks.map((pick) => (
            <article
              key={`${pick.badge}-${pick.title}`}
              className="rounded-[1.5rem] border border-white/70 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/80"
            >
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
                {pick.badge}
              </p>
              <h4 className="mt-2 text-base font-black text-slate-950 dark:text-white">
                {pick.title}
              </h4>

              <div className="mt-3 space-y-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                <p>{pick.store}</p>
                {pick.price ? <p>Price: {pick.price}</p> : null}
                {pick.rating ? <p>Rating: {pick.rating}/5</p> : null}
                {pick.reviewCount ? <p>Reviews: {pick.reviewCount.toLocaleString()}</p> : null}
                {pick.aiLikeRisk ? <p>AI-like risk: {pick.aiLikeRisk}</p> : null}
              </div>

              <p className="mt-3 text-sm font-bold leading-relaxed text-slate-700 dark:text-slate-200">
                {pick.whyBetter}
              </p>

              <a
                href={pick.affiliateUrl || pick.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white dark:bg-white dark:text-slate-950"
              >
                View pick
              </a>
            </article>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-xs font-bold leading-relaxed text-emerald-900/70 dark:text-emerald-100/70">
        {disclosure}
      </p>
    </section>
  );
}
