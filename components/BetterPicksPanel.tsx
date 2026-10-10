"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trackTrafficEvent } from "@/lib/clientTraffic";
import type { AffiliatePartnerPlacement } from "@/lib/adConfig";
import { readStoredLocale } from "@/lib/i18n";

type ResultRecord = Record<string, unknown>;


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

function getVerdict(result: ResultRecord) {
  const verdict = (
    getString(result.stableVerdict) ||
    getString(result.finalVerdict) ||
    getString(result.verdict) ||
    getString(result.recommendation) ||
    "REVIEW FIRST"
  ).toUpperCase();

  if (verdict === "CONSIDER" || verdict === "MAYBE" || verdict === "REVIEW FIRST") return "DO NOT BUY YET";
  return verdict;
}

function getScanId(result: ResultRecord) {
  const meta = getRecord(result.meta);
  return getString(result.scanId) || getString(meta.scanId);
}


async function amazonAffiliateIsVisible(placement: AffiliatePartnerPlacement) {
  try {
    const response = await fetch("/api/advertising/settings", { cache: "no-store" });
    const data = await response.json();
    const settings = data.settings;
    const amazon = settings?.affiliatePartners?.amazon;

    return (
      settings?.adsEnabled !== false &&
      amazon?.enabled !== false &&
      amazon?.placements?.[placement] !== false
    );
  } catch {
    return false;
  }
}

export type BetterPickView = {
  kind?: "buy_scanned" | "reviewed" | "search";
  label?: string;
  title: string;
  store: string;
  url: string;
  affiliateUrl?: string;
  badge?: string;
  whyBetter?: string;
  evidence?: { verdict: string; acceptedReviews: number; score: number | null } | null;
};

/**
 * Shopper-first affiliate panel (no OpenAI). Order: the scanned product's own
 * "Check price on Amazon" CTA, then alternatives that our REAL-review data
 * rates higher, then plainly labeled Amazon search links. Never calls a
 * search link "better" or "reviewed".
 */
export function BetterPicksPanel({
  result,
  autoLoad = false,
  affiliatePlacement = "results",
  initialPicks,
  productName: productNameProp,
}: {
  result: ResultRecord;
  compact?: boolean;
  autoLoad?: boolean;
  affiliatePlacement?: AffiliatePartnerPlacement;
  /** Test/preview hook: render these picks instead of fetching. */
  initialPicks?: { recommendations: BetterPickView[]; disclosure: string } | null;
  /** The display title the results page already resolved (preferred over guessing from result). */
  productName?: string;
}) {
  const [picks, setPicks] = useState<BetterPickView[]>(initialPicks?.recommendations || []);
  const [disclosure, setDisclosure] = useState(initialPicks?.disclosure || "ReviewIntel may earn a commission from qualifying purchases through affiliate links. This does not affect our verdicts or review analysis.");
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(!initialPicks);
  const productName = useMemo(() => (productNameProp || "").trim() || getProductName(result || {}), [productNameProp, result]);
  const verdict = useMemo(() => getVerdict(result || {}), [result]);
  const scanId = useMemo(() => getScanId(result || {}), [result]);
  // The parent re-creates `result` on renders; key the fetch on identity, not object reference.
  const resultRef = useRef(result);
  resultRef.current = result;

  useEffect(() => {
    if (initialPicks) return;
    if (!productName) { setLoading(false); return; }
    let cancelled = false;
    // Deferred so it never competes with the initial scan-result load (free path: no OpenAI).
    const timer = window.setTimeout(async () => {
      try {
        if (!(await amazonAffiliateIsVisible(affiliatePlacement))) { if (!cancelled) setHidden(true); return; }
        const locale = readStoredLocale();
        const response = await fetch("/api/product-recommendations", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ productName, result: resultRef.current, scanId, locale, affiliatePlacement }),
        });
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok || !data?.ok || data.affiliateDisabled) { setHidden(true); return; }
        if (data.scanId && scanId && data.scanId !== scanId) return;
        setPicks(Array.isArray(data.recommendations) ? data.recommendations : []);
        if (typeof data.disclosure === "string") setDisclosure(data.disclosure);
      } catch { if (!cancelled) setHidden(true); } finally { if (!cancelled) setLoading(false); }
    }, autoLoad ? 0 : 1800);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [affiliatePlacement, autoLoad, initialPicks, productName, scanId]);

  if (hidden || (!loading && picks.length === 0)) return null;

  const primary = picks.find(pick => pick.kind === "buy_scanned");
  const reviewed = picks.filter(pick => pick.kind === "reviewed");
  const searches = picks.filter(pick => pick.kind === "search" || !pick.kind);
  const track = (pick: BetterPickView) => trackTrafficEvent({
    eventType: "affiliate_click",
    metadata: { source: "better_picks", kind: pick.kind || "legacy", provider: pick.store, productName, recommendedProduct: pick.title, verdict },
  });

  return (
    <section className="rounded-[2rem] bg-white p-6 ring-1 ring-slate-900/5 sm:p-8" data-testid="better-picks" aria-busy={loading}>
      <p className="text-sm text-slate-500">Where to buy</p>
      {primary ? (
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-900">{primary.title}</p>
            <p className="mt-1 text-sm text-slate-500">{primary.whyBetter}</p>
          </div>
          <a href={primary.affiliateUrl || primary.url} target="_blank" rel="sponsored noopener noreferrer" onClick={() => track(primary)}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-teal px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-teal/90">
            Check price on {primary.store}
          </a>
        </div>
      ) : loading ? <div className="mt-3 h-12 animate-pulse rounded-2xl bg-slate-100" /> : null}

      {reviewed.length ? (
        <div className="mt-8">
          <h3 className="text-base font-semibold text-slate-900">Rated higher in our real-review scans</h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {reviewed.map(pick => (
              <li key={pick.url} className="flex flex-col justify-between rounded-2xl bg-slate-50 p-4">
                <div>
                  <p className="font-semibold text-slate-900">{pick.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{pick.whyBetter}</p>
                </div>
                <a href={pick.affiliateUrl || pick.url} target="_blank" rel="sponsored noopener noreferrer" onClick={() => track(pick)}
                  className="mt-3 inline-flex w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-teal hover:text-teal">
                  Check price on {pick.store}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {searches.length ? (
        <div className="mt-8">
          <h3 className="text-base font-semibold text-slate-900">Keep browsing</h3>
          <p className="mt-1 text-xs text-slate-500">Amazon search links. These aren&apos;t reviewed picks; ReviewIntel hasn&apos;t checked these results.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {searches.map(pick => (
              <li key={pick.url}>
                <a href={pick.affiliateUrl || pick.url} target="_blank" rel="sponsored noopener noreferrer" onClick={() => track(pick)}
                  className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:border-teal hover:text-teal">
                  {pick.title} <span aria-hidden="true" className="ml-1">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">{disclosure}</p>
    </section>
  );
}
