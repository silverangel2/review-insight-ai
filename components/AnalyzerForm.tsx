"use client";

import { readStoredLocale } from "@/lib/i18n";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isAccountProfileComplete, profileCompletionMissingFields } from "@/lib/account";
import type { AnalyzeResponse, QuotaInfo } from "@/lib/types";
import { accountHeaders, getClientAccount, saveQuota } from "@/lib/clientAccount";
import { saveLatestPreview, saveLatestResult, clearLatestResult, setActiveScanId, reviewIntelDevDiagnostic, readLatestResult } from "@/lib/resultStorage";
import { incrementStoredScanTally } from "@/lib/clientAccount";
import { ReviewIntelScanOverlay, type ScanStage } from "@/components/ReviewIntelScanOverlay";

// Anonymous-visitor free scans: 3 per day, per device. The localStorage
// counter is UX-only — the server enforces the real limit by IP hash
// with its own daily window (lib/anonymousScans.ts).
const ANON_SCAN_LIMIT_CLIENT = 3;
const ANON_SCAN_STORAGE_KEY = "ri_anon_scans";

function anonDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readAnonScanCount(): number {
  try {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(ANON_SCAN_STORAGE_KEY);
    if (!raw) return 0;
    // New format: {"d":"2026-10-03","n":2}. Old format was a bare number,
    // treated as today's count so nobody is stuck on the old behavior.
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed.d === anonDayKey() ? Number(parsed.n) || 0 : 0;
      }
    } catch {
      // Not JSON — fall through to the legacy bare-number format.
    }
    return Number(raw) || 0;
  } catch {
    return 0;
  }
}

function writeAnonScanCount(value: number) {
  try {
    window.localStorage.setItem(
      ANON_SCAN_STORAGE_KEY,
      JSON.stringify({ d: anonDayKey(), n: value })
    );
  } catch {
    // Storage unavailable — the server still enforces the limit.
  }
}

function createClientScanId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `scan_${crypto.randomUUID()}`;
  }

  return `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * POST the scan without introducing a separate progress overlay.
 */
type ScanApiPayload = {
  quota?: QuotaInfo;
  error?: string;
  code?: string;
  scanId?: string;
};

function postScanRequest(
  formData: FormData,
  headers: Record<string, string>,
  onUploadProgress?: (percent: number) => void,
  onUploaded?: () => void
): Promise<{ status: number; data: ScanApiPayload | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/analyze");
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onUploadProgress?.((event.loaded / event.total) * 100); };
    xhr.upload.onload = () => onUploaded?.();

    for (const [key, value] of Object.entries(headers)) {
      try {
        xhr.setRequestHeader(key, value);
      } catch {
        // Skip headers the browser won't allow.
      }
    }

    xhr.onload = () => {
      let data: ScanApiPayload | null = null;
      try {
        data = xhr.responseText ? (JSON.parse(xhr.responseText) as ScanApiPayload) : null;
      } catch {
        data = null;
      }
      resolve({ status: xhr.status, data });
    };

    xhr.onerror = () => reject(new Error("Network error while uploading your scan. Please try again."));
    xhr.ontimeout = () => reject(new Error("The scan timed out. Please try again."));

    xhr.send(formData);
  });
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
  const [scanStage, setScanStage] = useState<ScanStage | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [liveScanId, setLiveScanId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [anonScansUsed, setAnonScansUsed] = useState(0);

  const canAnalyze = Boolean(image) && !isLoading;
  const scanLimitMessage = analyzerFormCopy(readStoredLocale()).scanLimitMessage;
  const clientAccount = getClientAccount();
  const isAnonymousVisitor = !clientAccount?.email || clientAccount.email === "guest";
  const anonLimitReached = isAnonymousVisitor && anonScansUsed >= ANON_SCAN_LIMIT_CLIENT;
  const anonScansLeft = Math.max(0, ANON_SCAN_LIMIT_CLIENT - anonScansUsed);
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
    setAnonScansUsed(readAnonScanCount());
  }, []);

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
    setLiveScanId(scanId);
    setUploadPercent(0);
    setScanStage("uploading");

    try {
      await refreshServerQuota();

      const formData = new FormData();
      formData.append("image", image);
      formData.append("productLink", productLink);
      formData.append("locale", readStoredLocale());
      formData.append("scanId", scanId);

      const { status, data } = await postScanRequest(
        formData,
        accountHeaders(),
        (percent) => setUploadPercent(percent),
        () => setScanStage("analyzing")
      );

      reviewIntelDevDiagnostic("ANALYZE_RESPONSE_SCAN_ID", {
        requestedScanId: scanId,
        returnedScanId: data?.scanId || null,
        ok: status === 200,
      });

      if (!data || status !== 200) {
        if (data?.quota) saveQuota(data.quota);
        if (status === 403 && data?.code === "ANON_SCAN_LIMIT_REACHED") {
          // Server says the anonymous allowance is spent — sync the local
          // counter so the sign-in wall shows immediately.
          writeAnonScanCount(ANON_SCAN_LIMIT_CLIENT);
          setAnonScansUsed(ANON_SCAN_LIMIT_CLIENT);
        }
        throw new Error(data?.error || analyzerFormCopy(readStoredLocale()).analyzeError);
      }
      if (data?.quota) saveQuota(data.quota);

      if (data?.scanId !== scanId) {
        throw new Error("This scan finished out of order. Please run the scan again.");
      }

      try {
        const account = getClientAccount();
        const storedResult: AnalyzeResponse = {
          ...(data as unknown as AnalyzeResponse),
          resultSource: "analyze",
        };
        const storageSuccess = saveLatestResult(storedResult, account);
        const storedScan = readLatestResult(account, { scanId });

        reviewIntelDevDiagnostic("RESULT_STORAGE_SUCCESS", {
          scanId,
          storageSuccess,
          readBackSuccess: Boolean(storedScan),
        });

        if (!storageSuccess || !storedScan) {
          throw new Error(
            "The scan completed, but its result could not be saved locally. Please retry without private browsing or storage blocking."
          );
        }
        incrementStoredScanTally();
        if (isAnonymousVisitor) {
          const next = readAnonScanCount() + 1;
          writeAnonScanCount(next);
          setAnonScansUsed(next);
        }
        saveLatestPreview(previewDataUrl || preview);
        window.sessionStorage.removeItem("reviewintel_latest_result");
        window.localStorage.removeItem("reviewintel_latest_result_last");
        window.localStorage.removeItem("reviewintel_latest_result_fallback");
        window.sessionStorage.removeItem("reviewintel_selected_history_id");
        window.localStorage.removeItem("reviewintel_selected_history_id");
      } catch (storageError) {
        throw storageError;
      }

      const resultUrl = `/results?scanId=${encodeURIComponent(data.scanId)}`;
      reviewIntelDevDiagnostic("NAVIGATION_TARGET", {
        target: resultUrl,
        scanId,
      });
      setScanStage("done");
      router.push(resultUrl);
    } catch (err) {
      setScanStage(null);
      setError(err instanceof Error ? err.message : analyzerFormCopy(readStoredLocale()).analyzeError);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      {scanStage ? <ReviewIntelScanOverlay stage={scanStage} uploadProgress={uploadPercent} scanId={liveScanId} /> : null}
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
        {anonLimitReached ? (
          <div className="relative overflow-hidden rounded-[2rem] border border-[#ffbd58]/35 bg-[linear-gradient(135deg,#101a30_0%,#16244a_55%,#1e2f5e_100%)] p-8 text-center text-white shadow-[0_24px_70px_rgba(10,18,38,0.35)] sm:p-10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#ffbd58]/80 to-transparent"
            />
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#ffbd58]">
              Free scans used
            </p>
            <h2 className="mt-3 text-3xl font-black">You&apos;ve used today&apos;s 3 free scans</h2>
            <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-slate-300">
              Come back tomorrow for 3 more — or sign in now to keep scanning. It&apos;s free, and your scan history and premium verdicts are waiting.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/login?next=/analyze"
                className="inline-flex items-center justify-center rounded-2xl bg-[#ffbd58] px-7 py-3.5 text-sm font-black text-[#172033] shadow-[0_10px_30px_rgba(255,189,88,0.35)] transition hover:-translate-y-0.5 hover:bg-[#ffd07a]"
              >
                Sign in to continue
              </a>
              <a
                href="/signup?next=/analyze"
                className="inline-flex items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-7 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/20"
              >
                Create free account
              </a>
            </div>
          </div>
        ) : (
        <>
        {isAnonymousVisitor ? (
          <p className="mb-4 flex justify-center px-4">
            <span className="inline-block max-w-full rounded-full border border-[#ffbd58]/50 bg-[#ffbd58]/10 px-4 py-2 text-center text-[11px] font-black uppercase leading-relaxed tracking-[0.14em] text-[#b98a2f] sm:text-xs sm:tracking-[0.18em]">
              {anonScansLeft} of {ANON_SCAN_LIMIT_CLIENT} free scans left — no sign-in needed
            </span>
          </p>
        ) : null}
        <label className="group flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-teal/40 bg-white p-8 text-center shadow-soft transition hover:-translate-y-1 hover:border-teal hover:shadow-glow dark:border-cyan-300/40 dark:bg-gradient-to-r from-sky-600 to-teal-500">
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
          aria-label={analyzerFormCopy(readStoredLocale()).linkPlaceholder}
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
          <span className="relative z-10">
            {isLoading ? analyzerFormCopy(readStoredLocale()).analyzing : analyzerFormCopy(readStoredLocale()).analyze}
          </span>
        </button>

        </>
        )}
      </div>


    </div>
  );
}
