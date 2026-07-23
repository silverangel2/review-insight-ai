"use client";

import { readStoredLocale } from "@/lib/i18n";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isAccountProfileComplete, profileCompletionMissingFields } from "@/lib/account";
import { accountHeaders, getClientAccount, saveQuota } from "@/lib/clientAccount";
import { saveLatestPreview, saveLatestResult, clearLatestResult, setActiveScanId } from "@/lib/resultStorage";
import { incrementStoredScanTally } from "@/lib/clientAccount";

const SCAN_PROGRESS_STEPS = [
  "Reading the screenshot",
  "Finding the exact product",
  "Checking Amazon and public review sources",
  "Collecting review evidence",
  "Comparing with fresh product memory",
  "Building the final verdict",
];

function createClientScanId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `scan_${crypto.randomUUID()}`;
  }

  return `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}


function analyzerFormCopy(locale: string) {
  switch (locale) {
    case "fr":
      return {
        analyzing: "Analyse en cours...",
        analyze: "⚡ Analyser le produit",
        clearUpload: "Effacer le téléversement",
        uploadTitle: "Téléverser une capture du produit",
        uploadHint: "Capturez la page produit, le prix, la note ou les avis.",
        linkPlaceholder: "Facultatif : collez le lien du produit",
        clearerScreenshot: "Nous avons besoin d’une capture plus claire ou d’un lien produit pour analyser correctement.",
        analyzeError: "Nous n’avons pas pu analyser cette capture.",
        intro: "Vous pensez acheter quelque chose ? Téléversez une capture et obtenez un verdict d’achat IA instantané.",
        previewAlt: "Aperçu de la capture du produit",
        scanLimitMessage: "Vous avez utilisé vos 3 analyses gratuites aujourd’hui. Vos analyses se réinitialisent demain."
      };
    case "es":
      return {
        analyzing: "Analizando...",
        analyze: "⚡ Analizar producto",
        clearUpload: "Quitar carga",
        uploadTitle: "Subir captura del producto",
        uploadHint: "Captura la página del producto, precio, calificación o reseñas.",
        linkPlaceholder: "Opcional: pega el enlace del producto",
        clearerScreenshot: "Necesitamos una captura más clara o un enlace del producto para analizarlo correctamente.",
        analyzeError: "No pudimos analizar esta captura.",
        intro: "¿Piensas comprar algo? Sube una captura y obtén un veredicto de compra instantáneo con IA.",
        previewAlt: "Vista previa de la captura del producto",
        scanLimitMessage: "Ya usaste tus 3 análisis gratis de hoy. Tus análisis se restablecen mañana."
      };
    case "zh":
      return {
        analyzing: "正在分析...",
        analyze: "⚡ 分析产品",
        clearUpload: "清除上传",
        uploadTitle: "上传产品截图",
        uploadHint: "截取产品页面、价格、评分或评论。",
        linkPlaceholder: "可选：粘贴产品链接",
        clearerScreenshot: "我们需要更清晰的截图或产品链接才能正确分析。",
        analyzeError: "我们无法分析这张截图。",
        intro: "想买东西？上传截图，即可获得即时 AI 购买判断。",
        previewAlt: "产品截图预览",
        scanLimitMessage: "你今天的 3 次免费扫描已经用完。扫描次数明天重置。"
      };
    case "de":
      return {
        analyzing: "Analyse läuft...",
        analyze: "⚡ Produkt analysieren",
        clearUpload: "Upload löschen",
        uploadTitle: "Produkt-Screenshot hochladen",
        uploadHint: "Screenshot der Produktseite, des Preises, der Bewertung oder der Rezensionen.",
        linkPlaceholder: "Optional: Produktlink einfügen",
        clearerScreenshot: "Wir brauchen einen klareren Screenshot oder Produktlink, um dies richtig zu analysieren.",
        analyzeError: "Wir konnten diesen Screenshot nicht analysieren.",
        intro: "Denkst du darüber nach, etwas zu kaufen? Lade einen Screenshot hoch und erhalte sofort ein KI-Kaufurteil.",
        previewAlt: "Vorschau des Produkt-Screenshots",
        scanLimitMessage: "Du hast heute alle 3 kostenlosen Scans verwendet. Deine Scans werden morgen zurückgesetzt."
      };
    case "hi":
      return {
        analyzing: "विश्लेषण हो रहा है...",
        analyze: "⚡ उत्पाद का विश्लेषण करें",
        clearUpload: "अपलोड हटाएं",
        uploadTitle: "उत्पाद स्क्रीनशॉट अपलोड करें",
        uploadHint: "उत्पाद पेज, कीमत, रेटिंग या reviews का स्क्रीनशॉट लें।",
        linkPlaceholder: "वैकल्पिक: उत्पाद लिंक पेस्ट करें",
        clearerScreenshot: "सही विश्लेषण के लिए हमें साफ़ स्क्रीनशॉट या उत्पाद लिंक चाहिए।",
        analyzeError: "हम इस स्क्रीनशॉट का विश्लेषण नहीं कर सके।",
        intro: "कुछ खरीदने की सोच रहे हैं? स्क्रीनशॉट अपलोड करें और तुरंत AI buying verdict पाएं।",
        previewAlt: "उत्पाद स्क्रीनशॉट preview",
        scanLimitMessage: "आपने आज के सभी 3 free scans इस्तेमाल कर लिए हैं। आपके scans कल reset होंगे."
      };
    default:
      return {
        analyzing: "Analyzing...",
        analyze: "⚡ Analyze Product",
        clearUpload: "Clear upload",
        uploadTitle: "Upload product screenshot",
        uploadHint: "Screenshot the product page, price, rating, or reviews.",
        linkPlaceholder: "Optional: paste product link",
        clearerScreenshot: "We need a clearer screenshot or product link to analyze this properly.",
        analyzeError: "We could not analyze this screenshot.",
        intro: "Thinking about buying something? Upload a screenshot and get an instant AI buying verdict.",
        previewAlt: "Product screenshot preview",
        scanLimitMessage: "You have used all 3 free scans for today. Your scans reset tomorrow."
      };
  }
}

export default function AnalyzerForm() {
  const router = useRouter();
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [previewDataUrl, setPreviewDataUrl] = useState("");
  const [productLink, setProductLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState("");

  const canAnalyze = Boolean(image) && !isLoading;
  const scanLimitMessage = analyzerFormCopy(readStoredLocale()).scanLimitMessage;
  const clientAccount = getClientAccount();
  const isBetaAccount = clientAccount?.plan === "buyer_beta" || clientAccount?.plan === "seller_beta";
  const isScanLimitError =
    !isBetaAccount &&
    (error.includes("3 free scans") ||
      error.toLowerCase().includes("upgrade to premium") ||
      error.includes("scans reset tomorrow"));

  const uploadLabel = useMemo(() => {
    if (!image) return analyzerFormCopy(readStoredLocale()).uploadTitle;
    return image.name.length > 30 ? `${image.name.slice(0, 30)}...` : image.name;
  }, [image]);

  const refreshServerQuota = useCallback(async () => {
    const account = getClientAccount();
    if (!account?.email || account.email === "guest") return null;

    const response = await fetch("/api/account", {
      headers: accountHeaders(),
      cache: "no-store"
    }).catch(() => null);

    if (!response?.ok) return null;

    const data = await response.json().catch(() => null);
    if (data?.quota) {
      saveQuota(data.quota);
      if (data.quota.remaining === null || Number(data.quota.remaining ?? 0) > 0) {
        setError((current) => (current === scanLimitMessage ? "" : current));
      }
      return data.quota;
    }

    return null;
  }, [scanLimitMessage]);

  useEffect(() => {
    void refreshServerQuota();

    const handleFocus = () => {
      void refreshServerQuota();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [refreshServerQuota]);

  useEffect(() => {
    if (!isLoading) {
      setScanProgress(0);
      return;
    }

    setScanProgress(8);
    const interval = window.setInterval(() => {
      setScanProgress((current) => {
        const lift = current < 42 ? 9 : current < 72 ? 6 : current < 90 ? 3 : 1;
        return Math.min(96, current + lift);
      });
    }, 850);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  function handleImage(file: File | null) {
    setError("");
    setImage(file);

    if (!file) {
      setPreview("");
      setPreviewDataUrl("");
      return;
    }

    setPreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setPreviewDataUrl(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setPreviewDataUrl("");
    reader.readAsDataURL(file);
  }

  async function analyzeProduct() {
    if (!image) return;

    const currentAccount = getClientAccount();
    if (currentAccount?.email && currentAccount.email !== "guest" && !isAccountProfileComplete(currentAccount)) {
      const missing = profileCompletionMissingFields(currentAccount);
      const next = encodeURIComponent("/analyze");
      setError(`Complete your profile before scanning: ${missing.join(", ")}.`);
      router.push(`/account?completeProfile=1&next=${next}`);
      return;
    }

    const scanId = createClientScanId();

    try {
      clearLatestResult();
      setActiveScanId(scanId);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("reviewintel_selected_history_id");
        window.localStorage.removeItem("reviewintel_selected_history_id");
      }
    } catch {
      // Ignore browser storage cleanup errors before a new scan.
    }

    setIsLoading(true);
    setError("");

    try {
      await refreshServerQuota();

      const formData = new FormData();
      formData.append("image", image);
      formData.append("productLink", productLink);
      formData.append("locale", readStoredLocale());
      formData.append("scanId", scanId);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: accountHeaders(),
        body: formData
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (data?.quota) saveQuota(data.quota);
        throw new Error(data?.error || analyzerFormCopy(readStoredLocale()).analyzeError);
      }
      if (data?.quota) saveQuota(data.quota);

      if (data?.scanId !== scanId) {
        throw new Error("This scan finished out of order. Please run the scan again.");
      }

      try {
        const account = getClientAccount();
        saveLatestResult({ ...data, resultSource: "analyze" }, account);
        incrementStoredScanTally();
        saveLatestPreview(previewDataUrl || preview);
        window.sessionStorage.removeItem("reviewintel_latest_result");
        window.localStorage.removeItem("reviewintel_latest_result_last");
        window.localStorage.removeItem("reviewintel_latest_result_fallback");
        window.sessionStorage.removeItem("reviewintel_selected_history_id");
        window.localStorage.removeItem("reviewintel_selected_history_id");
      } catch {
        // Keep scan flow alive even if browser storage is unavailable.
      }

      setScanProgress(100);
      router.push("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : analyzerFormCopy(readStoredLocale()).analyzeError);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="text-center">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-teal">Know the Truth Before You Buy</p>
        <h1 className="mt-4 text-5xl font-black tracking-tight text-ink dark:text-white sm:text-6xl">
          🛍️ Should You Buy It?
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg font-bold leading-8 text-slate-600 dark:text-slate-300">
          {analyzerFormCopy(readStoredLocale()).intro}
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        <label className="group flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-[2.5rem] border-4 border-dashed border-teal/40 bg-white p-8 text-center shadow-soft transition hover:-translate-y-1 hover:border-teal hover:shadow-glow dark:border-cyan-300/40 dark:bg-gradient-to-r from-sky-600 to-teal-500">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => handleImage(event.target.files?.[0] || null)}
          />

          {preview ? (
            <div className="relative h-48 w-full overflow-hidden rounded-3xl border border-line bg-slate-100 dark:border-white/10 dark:bg-white/5">
              <Image src={preview} alt={analyzerFormCopy(readStoredLocale()).previewAlt} fill className="object-contain" unoptimized />
            </div>
          ) : (
            <div className="grid size-24 place-items-center rounded-full bg-teal text-6xl font-black text-white shadow-glow">
              +
            </div>
          )}

          <p className="mt-6 text-3xl font-black text-ink dark:text-white">{uploadLabel}</p>
          <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
            {analyzerFormCopy(readStoredLocale()).uploadHint}
          </p>
        </label>

        <input
          value={productLink}
          onChange={(event) => setProductLink(event.target.value)}
          placeholder={analyzerFormCopy(readStoredLocale()).linkPlaceholder}
          className="mt-5 w-full rounded-2xl border border-line bg-white px-5 py-4 text-base font-bold text-ink outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/15 dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white"
        />

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-black text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
            <p>{error.includes("confidence") ? "I can see the product, but I need a closer screenshot or product link for a stronger verdict." : error}</p>

            {isScanLimitError ? (
              <a
                href="/pricing?plan=shopper_premium"
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-ocean px-5 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-ink sm:w-auto"
              >
                Try Premium
              </a>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canAnalyze}
          onClick={analyzeProduct}
          className="relative mt-6 min-h-16 w-full overflow-hidden rounded-3xl bg-ink px-8 py-5 text-xl font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-white dark:text-ink dark:disabled:bg-white/20 dark:disabled:text-white/40"
        >
          {isLoading ? (
            <span
              className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,rgba(8,183,168,0.45),rgba(35,86,163,0.55),rgba(255,178,56,0.45))] transition-all duration-700"
              style={{ width: `${scanProgress}%` }}
              aria-hidden="true"
            />
          ) : null}
          <span className="relative z-10">
            {isLoading ? `${analyzerFormCopy(readStoredLocale()).analyzing} ${scanProgress}%` : analyzerFormCopy(readStoredLocale()).analyze}
          </span>
        </button>

        {isLoading ? (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/90 p-4 shadow-soft dark:border-sky-300/20 dark:bg-sky-300/10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-700 dark:text-sky-100">
                ReviewIntel detective scan
              </p>
              <p className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-sky-700 shadow-sm dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-sky-100">
                {scanProgress}%
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white dark:bg-gradient-to-r from-sky-600 to-teal-500">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#08b7a8,#2356a3,#ffb238)] transition-all duration-700"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <p className="mt-3 text-xs font-bold leading-5 text-slate-600 dark:text-slate-200">
              {SCAN_PROGRESS_STEPS[Math.min(SCAN_PROGRESS_STEPS.length - 1, Math.floor((scanProgress / 100) * SCAN_PROGRESS_STEPS.length))]}
            </p>
          </div>
        ) : null}
      </div>


    </div>
  );
}
