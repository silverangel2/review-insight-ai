"use client";

import { useEffect, useMemo, useState } from "react";

type SourceLink = {
  label?: string;
  title?: string;
  url?: string;
  domain?: string;
};

type ResultRecord = Record<string, unknown>;

function asRecord(value: unknown): ResultRecord {
  return value && typeof value === "object" ? (value as ResultRecord) : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}


function cleanLabel(source: SourceLink) {
  return (
    source.label ||
    source.title ||
    source.domain ||
    source.url?.replace(/^https?:\/\//, "").slice(0, 80) ||
    "Open source"
  );
}

function collectSourceLinks(result: ResultRecord): SourceLink[] {
  const reviewEvidence = asRecord(result.reviewEvidence);
  const reviewEvidenceSnake = asRecord(result.review_evidence);
  const listingEvidence = asRecord(result.listingEvidence);
  const reviewListingEvidence = asRecord(reviewEvidence.listingEvidence);
  const reviewListingEvidenceSnake = asRecord(reviewEvidenceSnake.listingEvidence);
  const toolAudit = asRecord(result.toolAudit);

  const possible = [
    result.sourceLinks,
    reviewEvidence.sourceLinks,
    reviewEvidenceSnake.sourceLinks,
    listingEvidence.sourceLinks,
    reviewListingEvidence.sourceLinks,
    reviewListingEvidenceSnake.sourceLinks,
    toolAudit.sourceLinks,
  ];

  const links: SourceLink[] = [];

  for (const value of possible) {
    if (!Array.isArray(value)) continue;

    for (const item of value) {
      if (typeof item === "string" && item.startsWith("http")) {
        links.push({ url: item, label: item.replace(/^https?:\/\//, "").slice(0, 80) });
        continue;
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const url = getString(record.url);

        if (url.startsWith("http")) {
          links.push({
            url,
            label: getString(record.label) || getString(record.title) || url.replace(/^https?:\/\//, "").slice(0, 80),
            domain: getString(record.domain) || undefined,
          });
        }
      }
    }
  }

  const unique = new Map<string, SourceLink>();

  for (const link of links) {
    if (!link.url || !link.url.startsWith("http")) continue;
    unique.set(link.url, link);
  }

  return Array.from(unique.values()).slice(0, 8);
}

function getProductPayload(result: ResultRecord) {
  const productIdentity = asRecord(result.product_identity);
  const productIdentityCamel = asRecord(result.productIdentity);

  return {
    productName:
      getString(result.productName) ||
      getString(result.name) ||
      getString(result.title) ||
      getString(result.productTitle) ||
      getString(productIdentity.title) ||
      getString(productIdentityCamel.title),
    brand:
      getString(result.brand) ||
      getString(productIdentity.brand) ||
      getString(productIdentityCamel.brand),
    store:
      getString(result.store) ||
      getString(productIdentity.store) ||
      getString(productIdentityCamel.store),
    price:
      getNumber(result.price) ||
      getNumber(productIdentity.price) ||
      getNumber(productIdentityCamel.price),
    verdict:
      getString(result.stableVerdict) ||
      getString(result.finalVerdict) ||
      getString(result.verdict) ||
      getString(result.recommendation),
    rating:
      getNumber(result.rating) ||
      getNumber(productIdentity.rating) ||
      getNumber(productIdentityCamel.rating),
    reviewCount:
      getNumber(result.reviewCount) ||
      getNumber(result.review_count) ||
      getNumber(productIdentity.reviewCount) ||
      getNumber(productIdentityCamel.reviewCount),
    productKey:
      getString(result.productKey) ||
      getString(result.product_key),
    result,
  };
}

const followUps = [
  { action: "why_not_buy", label: "Why not Buy?" },
  { action: "show_complaints", label: "Show complaints" },
  { action: "is_good_for_travel", label: "Good for travel?" },
  { action: "find_better_option", label: "Find better option" },
  { action: "explain_verdict", label: "Explain verdict" },
];

export function ResultIntelligencePanel({ result, onResultUpdate }: { result: ResultRecord; onResultUpdate?: (result: ResultRecord) => void }) {
  const [answer, setAnswer] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");

  const sourceLinks = useMemo(() => collectSourceLinks(result || {}), [result]);
  const productPayload = useMemo(() => getProductPayload(result || {}), [result]);

  async function runFollowUp(action: string) {
    setLoadingAction(action);
    setAnswer("");

    try {
      const response = await fetch("/api/review-follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, product: productPayload }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Follow-up failed.");
      }

      setAnswer(data.answer || "No answer returned.");
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Follow-up failed.");
    } finally {
      setLoadingAction("");
    }
  }

  async function refreshEvidence() {
    const productName = productPayload.productName;

    if (!productName) {
      setRefreshMessage("Missing product name. Scan result does not have enough identity to refresh.");
      return;
    }

    setRefreshing(true);
    setRefreshMessage("");

    try {
      const response = await fetch("/api/review-evidence/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productName,
          brand: productPayload.brand,
          model: getString(asRecord(productPayload.result).model),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Refresh failed.");
      }

      const updatedResult = data.result || data.analysis || data.updatedResult;

      if (updatedResult && typeof updatedResult === "object") {
        onResultUpdate?.(updatedResult as ResultRecord);
        setRefreshMessage("Evidence refreshed. ReviewIntel updated this result with deeper review evidence.");
      } else {
        setRefreshMessage("Evidence refreshed. ReviewIntel will use the newest evidence on the next scan.");
      }
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : "Refresh evidence failed.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const reviewEvidence = asRecord(asRecord(result).reviewEvidence);
    const reviewCollector = asRecord(reviewEvidence.reviewCollector);
    const listingEvidence = asRecord(reviewEvidence.listingEvidence);

    const reviewsCollected =
      getNumber(asRecord(result).reviewsCollected) ??
      getNumber(reviewEvidence.reviewsCollected) ??
      getNumber(reviewCollector.reviewsCollected) ??
      0;
    const sourcesChecked = Array.isArray(reviewEvidence.sourcesChecked) ? reviewEvidence.sourcesChecked.length : 0;
    const evidenceStrength = getString(reviewEvidence.evidenceStrength).toLowerCase();
    const exactConfidence = getString(listingEvidence.confidence).toLowerCase();
    const shouldAutoRefresh =
      reviewsCollected === 0 &&
      sourcesChecked === 0 &&
      (evidenceStrength === "limited" || evidenceStrength === "not enough" || exactConfidence === "low" || !evidenceStrength);

    if (!shouldAutoRefresh || refreshing) return;

    const key = productPayload.productKey || productPayload.productName;
    if (!key) return;

    const storageKey = `reviewintel:auto-refresh:${key}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(storageKey)) return;
    if (typeof window !== "undefined") window.sessionStorage.setItem(storageKey, "1");

    refreshEvidence();
  }, [result, productPayload.productKey, productPayload.productName, refreshing]);

  return (
    <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500/80">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-600">
            ReviewIntel tools
          </p>
          <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
            Sources + smart follow-up
          </h3>
          <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">
            Ask quick shopping questions based on the scan evidence.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshEvidence}
          disabled={refreshing}
          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
        >
          {refreshing ? "Refreshing..." : "Refresh evidence"}
        </button>
      </div>

      {sourceLinks.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Source links checked
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sourceLinks.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-black text-sky-700 transition hover:bg-sky-100 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200"
              >
                {cleanLabel(source)}
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          Source links were not returned for this scan yet.
        </div>
      )}

      <div className="mt-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
          Ask ReviewIntel
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {followUps.map((item) => (
            <button
              key={item.action}
              type="button"
              onClick={() => runFollowUp(item.action)}
              disabled={Boolean(loadingAction)}
              className="rounded-full bg-gradient-to-r from-sky-600 to-teal-500 px-4 py-2 text-xs font-black text-white transition hover:scale-[1.02] disabled:opacity-50 dark:bg-white dark:text-slate-950"
            >
              {loadingAction === item.action ? "Thinking..." : item.label}
            </button>
          ))}
        </div>
      </div>

      {answer ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-relaxed text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          {answer}
        </div>
      ) : null}

      {refreshMessage ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {refreshMessage}
        </div>
      ) : null}
    </section>
  );
}
