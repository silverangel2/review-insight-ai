"use client";

import { useEffect, useMemo, useState } from "react";
import { trackTrafficEvent } from "@/lib/clientTraffic";
import { readStoredLocale, type ReviewIntelLocale } from "@/lib/i18n";

type ResultRecord = Record<string, unknown>;

type BetterPick = {
  title: string;
  store: string;
  url: string;
  affiliateUrl: string;
  imageUrl?: string | null;
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

function getVerdict(result: ResultRecord) {
  return (
    getString(result.stableVerdict) ||
    getString(result.finalVerdict) ||
    getString(result.verdict) ||
    getString(result.recommendation) ||
    "CONSIDER"
  ).toUpperCase();
}

function cacheKeyFor(productName: string, verdict: string, locale: string) {
  return `reviewintel_better_picks:${locale}:${productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 90)}:${verdict}`;
}

function copyForVerdict(verdict: string, locale: ReviewIntelLocale) {
  const copy = {
    en: {
      searching: "Searching Amazon...",
      view: "See Amazon deal",
      imageFallback: "Amazon image loading",
      price: "Price",
      rating: "Rating",
      reviews: "Reviews",
      aiLikeRisk: "AI-like risk",
      buy: {
        eyebrow: "Amazon value check",
        title: "Better Amazon picks",
        detail: "Even on a BUY, ReviewIntel looks for cheaper or stronger-quality Amazon options before checkout.",
        button: "Refresh picks",
      },
      avoid: {
        eyebrow: "Amazon replacement",
        title: "Safer Amazon alternatives",
        detail: "The scanned item looks risky, so these are better replacement options from Amazon.",
        button: "Refresh alternatives",
      },
      consider: {
        eyebrow: "Amazon upgrade check",
        title: "Cleaner Amazon options",
        detail: "For a CONSIDER result, ReviewIntel looks for nicer, more proven Amazon alternatives.",
        button: "Refresh picks",
      },
    },
    fr: {
      searching: "Recherche sur Amazon...",
      view: "Voir l'offre Amazon",
      imageFallback: "Image Amazon en chargement",
      price: "Prix",
      rating: "Note",
      reviews: "Avis",
      aiLikeRisk: "Risque IA",
      buy: {
        eyebrow: "Vérification Amazon",
        title: "Meilleurs choix Amazon",
        detail: "Même avec un verdict BUY, ReviewIntel cherche des options Amazon moins chères ou de meilleure qualité avant l'achat.",
        button: "Actualiser",
      },
      avoid: {
        eyebrow: "Remplacement Amazon",
        title: "Alternatives Amazon plus sûres",
        detail: "L'article scanné semble risqué, alors voici de meilleures options de remplacement sur Amazon.",
        button: "Actualiser",
      },
      consider: {
        eyebrow: "Option Amazon supérieure",
        title: "Options Amazon plus propres",
        detail: "Pour un résultat CONSIDER, ReviewIntel cherche des alternatives plus fiables et mieux prouvées.",
        button: "Actualiser",
      },
    },
    es: {
      searching: "Buscando en Amazon...",
      view: "Ver oferta en Amazon",
      imageFallback: "Imagen de Amazon cargando",
      price: "Precio",
      rating: "Calificación",
      reviews: "Reseñas",
      aiLikeRisk: "Riesgo tipo IA",
      buy: {
        eyebrow: "Chequeo de valor Amazon",
        title: "Mejores opciones de Amazon",
        detail: "Incluso con BUY, ReviewIntel busca opciones de Amazon más baratas o de mejor calidad antes de comprar.",
        button: "Actualizar",
      },
      avoid: {
        eyebrow: "Reemplazo en Amazon",
        title: "Alternativas Amazon más seguras",
        detail: "El producto escaneado parece riesgoso, así que estas son mejores opciones de reemplazo en Amazon.",
        button: "Actualizar",
      },
      consider: {
        eyebrow: "Mejora en Amazon",
        title: "Opciones Amazon más claras",
        detail: "Para un resultado CONSIDER, ReviewIntel busca alternativas más probadas y confiables.",
        button: "Actualizar",
      },
    },
    zh: {
      searching: "正在搜索 Amazon...",
      view: "查看 Amazon 优惠",
      imageFallback: "Amazon 图片加载中",
      price: "价格",
      rating: "评分",
      reviews: "评论",
      aiLikeRisk: "AI 风险",
      buy: {
        eyebrow: "Amazon 价值检查",
        title: "更好的 Amazon 选择",
        detail: "即使结果是 BUY，ReviewIntel 也会先寻找更便宜或质量更强的 Amazon 选择。",
        button: "刷新选择",
      },
      avoid: {
        eyebrow: "Amazon 替代品",
        title: "更安全的 Amazon 替代选择",
        detail: "扫描商品看起来有风险，所以这里提供更好的 Amazon 替代品。",
        button: "刷新替代品",
      },
      consider: {
        eyebrow: "Amazon 升级检查",
        title: "更可靠的 Amazon 选择",
        detail: "对于 CONSIDER 结果，ReviewIntel 会寻找更好、更有证据支持的替代品。",
        button: "刷新选择",
      },
    },
    de: {
      searching: "Amazon wird durchsucht...",
      view: "Amazon-Angebot ansehen",
      imageFallback: "Amazon-Bild wird geladen",
      price: "Preis",
      rating: "Bewertung",
      reviews: "Bewertungen",
      aiLikeRisk: "KI-ähnliches Risiko",
      buy: {
        eyebrow: "Amazon-Wertprüfung",
        title: "Bessere Amazon-Auswahl",
        detail: "Auch bei BUY sucht ReviewIntel vor dem Kauf nach günstigeren oder hochwertigeren Amazon-Optionen.",
        button: "Auswahl aktualisieren",
      },
      avoid: {
        eyebrow: "Amazon-Ersatz",
        title: "Sicherere Amazon-Alternativen",
        detail: "Der gescannte Artikel wirkt riskant, daher sind dies bessere Ersatzoptionen von Amazon.",
        button: "Alternativen aktualisieren",
      },
      consider: {
        eyebrow: "Amazon-Upgrade-Check",
        title: "Klarere Amazon-Optionen",
        detail: "Bei CONSIDER sucht ReviewIntel nach besser belegten und zuverlässigeren Alternativen.",
        button: "Auswahl aktualisieren",
      },
    },
    hi: {
      searching: "Amazon खोज रहा है...",
      view: "Amazon डील देखें",
      imageFallback: "Amazon इमेज लोड हो रही है",
      price: "कीमत",
      rating: "रेटिंग",
      reviews: "रिव्यू",
      aiLikeRisk: "AI जैसा जोखिम",
      buy: {
        eyebrow: "Amazon वैल्यू चेक",
        title: "बेहतर Amazon विकल्प",
        detail: "BUY होने पर भी ReviewIntel खरीदने से पहले सस्ते या बेहतर गुणवत्ता वाले Amazon विकल्प खोजता है.",
        button: "विकल्प रीफ्रेश करें",
      },
      avoid: {
        eyebrow: "Amazon रिप्लेसमेंट",
        title: "सुरक्षित Amazon विकल्प",
        detail: "स्कैन किया गया आइटम जोखिम भरा लगता है, इसलिए ये बेहतर Amazon विकल्प हैं.",
        button: "विकल्प रीफ्रेश करें",
      },
      consider: {
        eyebrow: "Amazon अपग्रेड चेक",
        title: "बेहतर Amazon विकल्प",
        detail: "CONSIDER परिणाम के लिए ReviewIntel ज्यादा भरोसेमंद और बेहतर विकल्प खोजता है.",
        button: "विकल्प रीफ्रेश करें",
      },
    },
  }[locale];

  const variant = verdict === "BUY" ? copy.buy : verdict === "AVOID" ? copy.avoid : copy.consider;

  return {
    ...copy,
    ...variant,
  };
}

export function BetterPicksPanel({
  result,
  compact = false,
  autoLoad = true,
}: {
  result: ResultRecord;
  compact?: boolean;
  autoLoad?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<BetterPick[]>([]);
  const [error, setError] = useState("");
  const [locale, setLocale] = useState<ReviewIntelLocale>("en");
  const [disclosure, setDisclosure] = useState(
    "ReviewIntel may earn a commission from qualifying purchases through affiliate links. This does not affect our verdicts or review analysis."
  );

  const productName = useMemo(() => getProductName(result || {}), [result]);
  const verdict = useMemo(() => getVerdict(result || {}), [result]);
  const panelCopy = copyForVerdict(verdict, locale);
  const requestKey = useMemo(() => cacheKeyFor(productName, verdict, locale), [productName, verdict, locale]);

  useEffect(() => {
    setLocale(readStoredLocale());
  }, []);

  async function findBetterPicks(options?: { useCache?: boolean }) {
    if (!productName) return;

    const cached = window.sessionStorage.getItem(requestKey);
    if (cached && options?.useCache) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.recommendations)) setPicks(parsed.recommendations);
        if (typeof parsed?.disclosure === "string") setDisclosure(parsed.disclosure);
        return;
      } catch {
        window.sessionStorage.removeItem(requestKey);
      }
    }

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
          locale,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not find better picks.");
      }

      const nextPicks = Array.isArray(data.recommendations) ? data.recommendations : [];
      setPicks(nextPicks);
      setDisclosure(data.disclosure || disclosure);

      window.sessionStorage.setItem(
        requestKey,
        JSON.stringify({
          recommendations: nextPicks,
          disclosure: data.disclosure || disclosure,
          savedAt: new Date().toISOString(),
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find better picks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoLoad || !productName) return;

    try {
      const cached = window.sessionStorage.getItem(requestKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.recommendations)) {
          setPicks(parsed.recommendations);
          if (typeof parsed?.disclosure === "string") setDisclosure(parsed.disclosure);
          return;
        }
      }
    } catch {
      // Ignore broken browser cache and refetch below.
    }

    void findBetterPicks({ useCache: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, productName, requestKey]);

  return (
    <section className={`${compact ? "mt-3 rounded-2xl p-3" : "mt-6 rounded-[2rem] p-5"} border border-emerald-200 bg-emerald-50 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-400/10`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={`${compact ? "text-[10px]" : "text-xs"} font-black uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-200`}>
            {panelCopy.eyebrow}
          </p>
          <h3 className={`${compact ? "mt-1 text-base" : "mt-1 text-xl"} font-black text-slate-950 dark:text-white`}>
            {panelCopy.title}
          </h3>
          <p className={`${compact ? "mt-1 text-[11px] leading-4" : "mt-1 text-sm"} font-bold text-emerald-900/70 dark:text-emerald-100/80`}>
            {panelCopy.detail}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void findBetterPicks()}
          disabled={loading || !productName}
          className={`${compact ? "px-4 py-2 text-[10px]" : "px-5 py-3 text-xs"} rounded-full bg-emerald-600 font-black uppercase tracking-[0.16em] text-white shadow-sm transition hover:scale-[1.02] disabled:opacity-50`}
        >
          {loading ? panelCopy.searching : panelCopy.button}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading && picks.length === 0 ? (
        <div className={`${compact ? "mt-3" : "mt-5"} grid gap-3 ${compact ? "grid-cols-1" : "md:grid-cols-3"}`}>
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-36 animate-pulse rounded-[1.5rem] border border-white/70 bg-white/70 dark:border-white/10 dark:bg-slate-950/60" />
          ))}
        </div>
      ) : null}

      {picks.length > 0 ? (
        <div className={`${compact ? "mt-3 flex snap-x gap-3 overflow-x-auto pb-1" : "mt-5 grid gap-4 md:grid-cols-3"}`}>
          {picks.map((pick) => (
            <article
              key={`${pick.badge}-${pick.title}`}
              className={`${compact ? "min-w-[230px] snap-start p-3" : "p-4"} rounded-[1.5rem] border border-white/70 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950/80`}
            >
              {pick.imageUrl ? (
                <div className={`${compact ? "h-24" : "h-36"} relative mb-3 overflow-hidden rounded-2xl bg-slate-50 dark:bg-white/5`}>
                  <img
                    src={pick.imageUrl}
                    alt={pick.title}
                    loading="lazy"
                    className="h-full w-full object-contain p-2"
                  />
                </div>
              ) : (
                <div className={`${compact ? "h-20" : "h-28"} mb-3 grid place-items-center rounded-2xl bg-[radial-gradient(circle_at_top_left,#d1fae5,#eff6ff_55%,#fff7ed)] px-3 text-center text-[10px] font-black uppercase tracking-[0.18em] text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-100`}>
                  {panelCopy.imageFallback}
                </div>
              )}

              <p className={`${compact ? "text-[10px]" : "text-xs"} font-black uppercase tracking-[0.18em] text-emerald-600`}>
                {pick.badge}
              </p>
              <h4 className={`${compact ? "line-clamp-2 text-sm leading-4" : "text-base"} mt-2 font-black text-slate-950 dark:text-white`}>
                {pick.title}
              </h4>

              <div className={`${compact ? "mt-2 text-[11px]" : "mt-3 text-xs"} space-y-1 font-bold text-slate-600 dark:text-slate-300`}>
                <p>{pick.store}</p>
                {pick.price ? <p>{panelCopy.price}: {pick.price}</p> : null}
                {pick.rating ? <p>{panelCopy.rating}: {pick.rating}/5</p> : null}
                {pick.reviewCount ? <p>{panelCopy.reviews}: {pick.reviewCount.toLocaleString()}</p> : null}
                {pick.aiLikeRisk ? <p>{panelCopy.aiLikeRisk}: {pick.aiLikeRisk}</p> : null}
              </div>

              <p className={`${compact ? "line-clamp-3 text-[11px] leading-4" : "text-sm leading-relaxed"} mt-3 font-bold text-slate-700 dark:text-slate-200`}>
                {pick.whyBetter}
              </p>

              <a
                href={pick.affiliateUrl || pick.url}
                target="_blank"
                rel="sponsored noopener noreferrer"
                onClick={() =>
                  trackTrafficEvent({
                    eventType: "affiliate_click",
                    metadata: {
                      source: "better_picks",
                      provider: pick.store,
                      productName,
                      recommendedProduct: pick.title,
                      verdict,
                    },
                  })
                }
                className={`${compact ? "px-3 py-2 text-[10px]" : "px-4 py-2 text-xs"} mt-4 inline-flex rounded-full bg-slate-950 font-black uppercase tracking-[0.14em] text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700 dark:bg-white dark:text-slate-950`}
              >
                {panelCopy.view}
              </a>
            </article>
          ))}
        </div>
      ) : null}

      <p className={`${compact ? "mt-3 text-[10px] leading-4" : "mt-4 text-xs leading-relaxed"} font-bold text-emerald-900/70 dark:text-emerald-100/70`}>
        {disclosure}
      </p>
    </section>
  );
}
