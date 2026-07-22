"use client";

import { useEffect, useMemo, useState } from "react";
import { trackTrafficEvent } from "@/lib/clientTraffic";
import type { AffiliatePartnerPlacement } from "@/lib/adConfig";
import { readStoredLocale, type ReviewIntelLocale } from "@/lib/i18n";

type AffiliateLink = {
  provider: "amazon";
  label: string;
  sourceUrl: string;
  affiliateUrl: string;
  host: string;
  qualifying: boolean;
};

type PanelCopy = {
  eyebrow: string;
  title: string;
  detail: string;
  open: string;
};

const copyByLocale: Record<ReviewIntelLocale, PanelCopy> = {
  en: {
    eyebrow: "Affiliate-ready evidence",
    title: "Shop checked Amazon sources",
    detail: "These Amazon links come from source URLs found during the scan. Affiliate links never change the verdict.",
    open: "Open qualifying link",
  },
  fr: {
    eyebrow: "Sources affiliées",
    title: "Voir les sources Amazon vérifiées",
    detail: "Ces liens Amazon viennent des sources trouvées pendant l’analyse. Les liens affiliés ne changent jamais le verdict.",
    open: "Ouvrir le lien",
  },
  es: {
    eyebrow: "Fuentes afiliadas",
    title: "Abrir fuentes Amazon revisadas",
    detail: "Estos enlaces de Amazon vienen de las fuentes encontradas durante el escaneo. Los enlaces afiliados nunca cambian el veredicto.",
    open: "Abrir enlace",
  },
  zh: {
    eyebrow: "联盟来源",
    title: "打开已检查的 Amazon 来源",
    detail: "这些 Amazon 链接来自扫描时找到的来源。联盟链接绝不会改变结论。",
    open: "打开链接",
  },
  de: {
    eyebrow: "Affiliate-Quellen",
    title: "Geprüfte Amazon-Quellen öffnen",
    detail: "Diese Amazon-Links stammen aus den beim Scan gefundenen Quellen. Affiliate-Links ändern niemals das Urteil.",
    open: "Link öffnen",
  },
  hi: {
    eyebrow: "Affiliate-ready sources",
    title: "Checked Amazon sources खोलें",
    detail: "ये Amazon links scan में मिले source URLs से आते हैं। Affiliate links verdict को कभी नहीं बदलते।",
    open: "Qualifying link खोलें",
  },
};

function stableCacheKey(result: unknown) {
  try {
    return JSON.stringify(result).slice(0, 8000);
  } catch {
    return String(Date.now());
  }
}

export function AffiliateSourcePanel({
  result,
  compact = false,
  title,
  autoLoad = true,
  affiliatePlacement = "results",
}: {
  result: unknown;
  compact?: boolean;
  title?: string;
  autoLoad?: boolean;
  affiliatePlacement?: AffiliatePartnerPlacement;
}) {
  const [locale, setLocale] = useState<ReviewIntelLocale>("en");
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [disclosure, setDisclosure] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestKey = useMemo(() => stableCacheKey(result), [result]);
  const copy = copyByLocale[locale] || copyByLocale.en;

  useEffect(() => {
    setLocale(readStoredLocale());
  }, []);

  useEffect(() => {
    if (!autoLoad || !result) return;

    let cancelled = false;

    async function loadLinks() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/affiliate-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            result,
            limit: compact ? 4 : 6,
            affiliatePlacement,
          }),
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Affiliate source links failed.");
        }

        if (cancelled) return;
        setLinks(Array.isArray(data.links) ? data.links : []);
        setDisclosure(typeof data.disclosure === "string" ? data.disclosure : "");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Affiliate source links failed.");
        setLinks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLinks();

    return () => {
      cancelled = true;
    };
  }, [affiliatePlacement, autoLoad, compact, requestKey, result]);

  if (!loading && !error && links.length === 0) return null;

  return (
    <section
      className={`${compact ? "mt-3 rounded-2xl p-3" : "mt-6 rounded-[2rem] p-5"} border border-sky-200 bg-sky-50/80 shadow-sm dark:border-sky-300/20 dark:bg-sky-300/10`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={`${compact ? "text-[10px]" : "text-xs"} font-black uppercase tracking-[0.22em] text-sky-700 dark:text-sky-200`}>
            {copy.eyebrow}
          </p>
          <h3 className={`${compact ? "mt-1 text-base" : "mt-1 text-xl"} font-black text-slate-950 dark:text-white`}>
            {title || copy.title}
          </h3>
          <p className={`${compact ? "mt-1 text-[11px] leading-4" : "mt-1 text-sm leading-6"} font-bold text-sky-900/70 dark:text-sky-100/80`}>
            {copy.detail}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 h-16 animate-pulse rounded-2xl bg-white/80 dark:bg-gradient-to-r from-sky-600 to-teal-500/50" />
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      {links.length ? (
        <div className={`${compact ? "mt-3 flex gap-2 overflow-x-auto pb-1" : "mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {links.map((link) => (
            <a
              key={link.sourceUrl}
              href={link.affiliateUrl || link.sourceUrl}
              target="_blank"
              rel="sponsored noopener noreferrer"
              onClick={() =>
                trackTrafficEvent({
                  eventType: "affiliate_click",
                  metadata: {
                    source: "scan_evidence_source",
                    provider: link.provider,
                    label: link.label,
                    host: link.host,
                    qualifying: link.qualifying,
                  },
                })
              }
              className={`${compact ? "min-w-[210px] p-3" : "p-4"} rounded-2xl border border-white/80 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500/80`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-600 dark:text-sky-200">
                Amazon source
              </p>
              <p className={`${compact ? "mt-1 text-sm" : "mt-2 text-base"} line-clamp-2 font-black text-slate-950 dark:text-white`}>
                {link.label}
              </p>
              <p className="mt-1 truncate text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {link.host}
              </p>
              <span className="mt-3 inline-flex rounded-full bg-gradient-to-r from-sky-600 to-teal-500 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white dark:bg-white dark:text-slate-950">
                {copy.open}
              </span>
            </a>
          ))}
        </div>
      ) : null}

      {disclosure ? (
        <p className={`${compact ? "mt-3 text-[10px] leading-4" : "mt-4 text-xs leading-relaxed"} font-bold text-sky-900/70 dark:text-sky-100/70`}>
          {disclosure}
        </p>
      ) : null}
    </section>
  );
}
