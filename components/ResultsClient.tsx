"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { ResultsDashboard } from "@/components/ResultsDashboard";
import { reconcileAnalysisScores } from "@/lib/analysisScoring";
import { canAccessSellerAnalytics } from "@/lib/account";
import { getClientAccount, saveActiveMode } from "@/lib/clientAccount";
import { getUiTextTranslation, normalizeLocale, readStoredLocale, type ReviewIntelLocale } from "@/lib/i18n";
import { clearLatestResult, readLatestPreview, readLatestResult, saveLatestResult } from "@/lib/resultStorage";
import type { AnalyzeResponse, SubscriptionPlan } from "@/lib/types";
import { ShopperResultHistoryCorner } from "@/components/ShopperResultHistoryCorner";
import { displayCodeForResult } from "@/lib/productDisplay";
import { shortCompareTitle, shortProductName } from "@/lib/productName";

type ProductLike = {
  title?: string;
  name?: string;
  brand?: string;
  category?: string;
  store?: string;
  price?: string;
  rating?: string;
  reviewCount?: string;
};

type ShopperVerdict = "BUY" | "CONSIDER" | "AVOID";
type VerdictStyle = { tone: string; soft: string; ring: string };
type LocalizedVerdictCopy = { answer: string; title: string; message: string };

type ShopperProductResult = {
  product: ProductLike;
  verdict: ShopperVerdict;
  productScore: number;
  buyingConfidence: number;
  valueForMoney: string;
  fakeReviewRisk: string;
  fakeReviewPercent: number;
  strengths: string[];
  complaints: string[];
  bestFor: string[];
  notIdealFor: string[];
  bottomLine: string;
  sourcesUsed: string[];
};

const shopperVerdictStyle: Record<ShopperVerdict, VerdictStyle> = {
  BUY: {
    tone: "text-emerald-700",
    soft: "bg-emerald-50 border-emerald-200",
    ring: "border-emerald-500"
  },
  CONSIDER: {
    tone: "text-amber-700",
    soft: "bg-amber-50 border-amber-200",
    ring: "border-amber-500"
  },
  AVOID: {
    tone: "text-rose-700",
    soft: "bg-rose-50 border-rose-200",
    ring: "border-rose-500"
  }
};

const resultCopy: Record<
  ReviewIntelLocale,
  {
    verdicts: Record<ShopperVerdict, LocalizedVerdictCopy>;
    productIdentified: string;
    screenshotUnavailable: string;
    notShown: string;
    reviewCountNotShown: string;
    reviews: string;
    sourcesLimited: string;
    sourcesChecked: (count: number, names: string[], more: boolean) => string;
    buyerConfidence: string;
    buyScore: string;
    value: string;
    aiLikeReviews: string;
    signs: string;
    risk: string;
    rating: string;
    topStrengths: string;
    topComplaints: string;
    bottomLine: string;
    bestFor: string;
    notIdealFor: string;
    noStrengths: string;
    noComplaints: string;
    bestForEmpty: string;
    notIdealEmpty: string;
    priceNotShown: string;
    valueLabels: Record<string, string>;
    riskLabels: Record<string, string>;
  }
> = {
  en: {
    verdicts: {
      BUY: { answer: "BUY", title: "This looks worth buying.", message: "The available buying signals are strong enough for a positive decision." },
      CONSIDER: { answer: "CONSIDER", title: "Compare first before buying.", message: "There are mixed signals. Check alternatives, reviews, and return terms first." },
      AVOID: { answer: "AVOID", title: "Better to skip this one.", message: "The risk or complaint signals are too weak for a confident buy." }
    },
    productIdentified: "Product identified",
    screenshotUnavailable: "Screenshot preview is not available for this saved scan.",
    notShown: "Not shown",
    reviewCountNotShown: "Review count not shown",
    reviews: "reviews",
    sourcesLimited: "Public evidence was limited at analysis time.",
    sourcesChecked: (count, names, more) => `We checked ${count} source${count === 1 ? "" : "s"} including ${names.join(", ")}${more ? " and more" : ""}.`,
    buyerConfidence: "Buyer confidence",
    buyScore: "Buy score",
    value: "Value",
    aiLikeReviews: "AI-like reviews",
    signs: "signs",
    risk: "risk",
    rating: "Rating",
    topStrengths: "Top Strengths",
    topComplaints: "Top Complaints",
    bottomLine: "Bottom Line",
    bestFor: "Best For",
    notIdealFor: "Not Ideal For",
    noStrengths: "No clear strengths found.",
    noComplaints: "No repeated complaints found.",
    bestForEmpty: "Good for shoppers who match the product strengths.",
    notIdealEmpty: "Not enough evidence to say.",
    priceNotShown: "Price not shown",
    valueLabels: { Excellent: "Excellent", Good: "Good", Fair: "Fair", Poor: "Poor" },
    riskLabels: { Low: "Low", Medium: "Medium", High: "High" }
  },
  fr: {
    verdicts: {
      BUY: { answer: "ACHETER", title: "Ce produit semble valoir l’achat.", message: "Les signaux d’achat disponibles sont assez solides pour une décision positive." },
      CONSIDER: { answer: "CONSIDÉRER", title: "Comparez avant d’acheter.", message: "Les signaux sont mixtes. Vérifiez les alternatives, les avis et les conditions de retour." },
      AVOID: { answer: "ÉVITER", title: "Mieux vaut passer votre tour.", message: "Les signaux de risque ou de plainte sont trop faibles pour recommander un achat confiant." }
    },
    productIdentified: "Produit identifié",
    screenshotUnavailable: "L’aperçu de la capture n’est pas disponible pour cette analyse enregistrée.",
    notShown: "Non affiché",
    reviewCountNotShown: "Nombre d’avis non affiché",
    reviews: "avis",
    sourcesLimited: "Les preuves publiques étaient limitées au moment de l’analyse.",
    sourcesChecked: (count, names, more) => `Nous avons vérifié ${count} source${count === 1 ? "" : "s"}, dont ${names.join(", ")}${more ? " et d’autres" : ""}.`,
    buyerConfidence: "Confiance acheteur",
    buyScore: "Score d’achat",
    value: "Valeur",
    aiLikeReviews: "Avis de type IA",
    signs: "signes",
    risk: "risque",
    rating: "Note",
    topStrengths: "Principaux points forts",
    topComplaints: "Principales plaintes",
    bottomLine: "Conclusion",
    bestFor: "Idéal pour",
    notIdealFor: "Pas idéal pour",
    noStrengths: "Aucun point fort clair trouvé.",
    noComplaints: "Aucune plainte répétée trouvée.",
    bestForEmpty: "Adapté aux acheteurs qui correspondent aux points forts du produit.",
    notIdealEmpty: "Pas assez de preuves pour le dire.",
    priceNotShown: "Prix non affiché",
    valueLabels: { Excellent: "Excellent", Good: "Bon", Fair: "Correct", Poor: "Faible" },
    riskLabels: { Low: "Faible", Medium: "Moyen", High: "Élevé" }
  },
  es: {
    verdicts: {
      BUY: { answer: "COMPRAR", title: "Parece que vale la pena comprarlo.", message: "Las señales de compra disponibles son suficientemente fuertes para una decisión positiva." },
      CONSIDER: { answer: "CONSIDERAR", title: "Compara antes de comprar.", message: "Las señales son mixtas. Revisa alternativas, reseñas y condiciones de devolución." },
      AVOID: { answer: "EVITAR", title: "Mejor omitir este producto.", message: "Las señales de riesgo o quejas son demasiado débiles para una compra confiada." }
    },
    productIdentified: "Producto identificado",
    screenshotUnavailable: "La vista previa de la captura no está disponible para este análisis guardado.",
    notShown: "No mostrado",
    reviewCountNotShown: "Número de reseñas no mostrado",
    reviews: "reseñas",
    sourcesLimited: "La evidencia pública era limitada al momento del análisis.",
    sourcesChecked: (count, names, more) => `Revisamos ${count} fuente${count === 1 ? "" : "s"}, incluidas ${names.join(", ")}${more ? " y más" : ""}.`,
    buyerConfidence: "Confianza del comprador",
    buyScore: "Puntuación de compra",
    value: "Valor",
    aiLikeReviews: "Reseñas tipo IA",
    signs: "señales",
    risk: "riesgo",
    rating: "Calificación",
    topStrengths: "Principales fortalezas",
    topComplaints: "Principales quejas",
    bottomLine: "Conclusión",
    bestFor: "Ideal para",
    notIdealFor: "No ideal para",
    noStrengths: "No se encontraron fortalezas claras.",
    noComplaints: "No se encontraron quejas repetidas.",
    bestForEmpty: "Bueno para compradores que coinciden con las fortalezas del producto.",
    notIdealEmpty: "No hay suficiente evidencia para decirlo.",
    priceNotShown: "Precio no mostrado",
    valueLabels: { Excellent: "Excelente", Good: "Bueno", Fair: "Aceptable", Poor: "Bajo" },
    riskLabels: { Low: "Bajo", Medium: "Medio", High: "Alto" }
  },
  zh: {
    verdicts: {
      BUY: { answer: "购买", title: "这个产品看起来值得买。", message: "现有购买信号足够强，可以给出正向购买判断。" },
      CONSIDER: { answer: "考虑", title: "购买前先比较。", message: "信号有好有坏。请先查看替代品、评论和退货条款。" },
      AVOID: { answer: "避免", title: "最好先跳过这个产品。", message: "风险或投诉信号太弱，不足以支持放心购买。" }
    },
    productIdentified: "已识别产品",
    screenshotUnavailable: "此已保存分析没有可用的截图预览。",
    notShown: "未显示",
    reviewCountNotShown: "未显示评论数量",
    reviews: "条评论",
    sourcesLimited: "分析时可用的公开证据有限。",
    sourcesChecked: (count, names, more) => `我们检查了 ${count} 个来源，包括 ${names.join("、")}${more ? " 等" : ""}。`,
    buyerConfidence: "购买信心",
    buyScore: "购买评分",
    value: "价值",
    aiLikeReviews: "类似 AI 的评论",
    signs: "迹象",
    risk: "风险",
    rating: "评分",
    topStrengths: "主要优点",
    topComplaints: "主要投诉",
    bottomLine: "结论",
    bestFor: "适合人群",
    notIdealFor: "不适合人群",
    noStrengths: "未发现明确优点。",
    noComplaints: "未发现重复投诉。",
    bestForEmpty: "适合与产品优势匹配的购物者。",
    notIdealEmpty: "证据不足，无法判断。",
    priceNotShown: "未显示价格",
    valueLabels: { Excellent: "优秀", Good: "良好", Fair: "一般", Poor: "较差" },
    riskLabels: { Low: "低", Medium: "中", High: "高" }
  },
  de: {
    verdicts: {
      BUY: { answer: "KAUFEN", title: "Dieses Produkt wirkt kaufenswert.", message: "Die verfügbaren Kaufsignale sind stark genug für eine positive Entscheidung." },
      CONSIDER: { answer: "PRÜFEN", title: "Vor dem Kauf vergleichen.", message: "Die Signale sind gemischt. Prüfe Alternativen, Bewertungen und Rückgabebedingungen zuerst." },
      AVOID: { answer: "VERMEIDEN", title: "Dieses Produkt besser überspringen.", message: "Die Risiko- oder Beschwerdesignale sind zu schwach für einen sicheren Kauf." }
    },
    productIdentified: "Produkt erkannt",
    screenshotUnavailable: "Für diesen gespeicherten Scan ist keine Screenshot-Vorschau verfügbar.",
    notShown: "Nicht angezeigt",
    reviewCountNotShown: "Bewertungsanzahl nicht angezeigt",
    reviews: "Bewertungen",
    sourcesLimited: "Zum Analysezeitpunkt waren öffentliche Belege begrenzt.",
    sourcesChecked: (count, names, more) => `Wir haben ${count} Quelle${count === 1 ? "" : "n"} geprüft, darunter ${names.join(", ")}${more ? " und weitere" : ""}.`,
    buyerConfidence: "Käufervertrauen",
    buyScore: "Kaufwertung",
    value: "Wert",
    aiLikeReviews: "KI-ähnliche Bewertungen",
    signs: "Anzeichen",
    risk: "Risiko",
    rating: "Bewertung",
    topStrengths: "Top-Stärken",
    topComplaints: "Hauptbeschwerden",
    bottomLine: "Fazit",
    bestFor: "Ideal für",
    notIdealFor: "Nicht ideal für",
    noStrengths: "Keine klaren Stärken gefunden.",
    noComplaints: "Keine wiederholten Beschwerden gefunden.",
    bestForEmpty: "Gut für Käufer, die zu den Produktstärken passen.",
    notIdealEmpty: "Nicht genug Belege für eine Aussage.",
    priceNotShown: "Preis nicht angezeigt",
    valueLabels: { Excellent: "Ausgezeichnet", Good: "Gut", Fair: "Ordentlich", Poor: "Schwach" },
    riskLabels: { Low: "Niedrig", Medium: "Mittel", High: "Hoch" }
  },
  hi: {
    verdicts: {
      BUY: { answer: "खरीदें", title: "यह खरीदने लायक लगता है।", message: "उपलब्ध खरीद संकेत सकारात्मक निर्णय के लिए पर्याप्त मजबूत हैं।" },
      CONSIDER: { answer: "विचार करें", title: "खरीदने से पहले तुलना करें।", message: "संकेत मिले-जुले हैं। पहले विकल्प, समीक्षाएँ और रिटर्न शर्तें जाँचें।" },
      AVOID: { answer: "बचें", title: "इसे छोड़ना बेहतर है।", message: "जोखिम या शिकायत संकेत भरोसेमंद खरीद के लिए बहुत कमजोर हैं।" }
    },
    productIdentified: "उत्पाद पहचाना गया",
    screenshotUnavailable: "इस सहेजे गए स्कैन के लिए स्क्रीनशॉट पूर्वावलोकन उपलब्ध नहीं है।",
    notShown: "नहीं दिखाया गया",
    reviewCountNotShown: "समीक्षा संख्या नहीं दिखाई गई",
    reviews: "समीक्षाएँ",
    sourcesLimited: "विश्लेषण के समय सार्वजनिक प्रमाण सीमित थे।",
    sourcesChecked: (count, names, more) => `हमने ${count} स्रोत जाँचे, जिनमें ${names.join(", ")}${more ? " और अन्य" : ""} शामिल हैं।`,
    buyerConfidence: "खरीदार भरोसा",
    buyScore: "खरीद स्कोर",
    value: "मूल्य",
    aiLikeReviews: "AI जैसी समीक्षाएँ",
    signs: "संकेत",
    risk: "जोखिम",
    rating: "रेटिंग",
    topStrengths: "मुख्य खूबियाँ",
    topComplaints: "मुख्य शिकायतें",
    bottomLine: "निष्कर्ष",
    bestFor: "सबसे उपयुक्त",
    notIdealFor: "इनके लिए उपयुक्त नहीं",
    noStrengths: "कोई स्पष्ट खूबी नहीं मिली।",
    noComplaints: "कोई दोहराई गई शिकायत नहीं मिली।",
    bestForEmpty: "उन खरीदारों के लिए अच्छा जो उत्पाद की खूबियों से मेल खाते हैं।",
    notIdealEmpty: "कहने के लिए पर्याप्त प्रमाण नहीं।",
    priceNotShown: "कीमत नहीं दिखाई गई",
    valueLabels: { Excellent: "उत्कृष्ट", Good: "अच्छा", Fair: "ठीक", Poor: "कमज़ोर" },
    riskLabels: { Low: "कम", Medium: "मध्यम", High: "उच्च" }
  }
};

function asTextArray(value: unknown, limit = 8) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, limit) : [];
}

function clampScore(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function verdictFromBuyer(value: unknown): ShopperVerdict {
  const verdict = String(value || "").toUpperCase();
  if (verdict === "BUY") return "BUY";
  if (verdict === "AVOID") return "AVOID";
  return "CONSIDER";
}

function optionalVerdictFromBuyer(value: unknown): ShopperVerdict | null {
  const verdict = String(value || "").toUpperCase();
  if (verdict === "BUY" || verdict === "CONSIDER" || verdict === "MAYBE") return verdict === "BUY" ? "BUY" : "CONSIDER";
  if (verdict === "AVOID") return "AVOID";
  return null;
}

function decisionPercent(result: ShopperProductResult) {
  return clampScore(result.buyingConfidence || result.productScore, result.productScore);
}

function localeFromResult(result: AnalyzeResponse): ReviewIntelLocale {
  const source = result as AnalyzeResponse & { meta?: { locale?: unknown } };
  return normalizeLocale(readStoredLocale() || source.meta?.locale);
}

function localizedValueLabel(locale: ReviewIntelLocale, value: string) {
  return resultCopy[locale].valueLabels[value] || value;
}

function localizedRiskLabel(locale: ReviewIntelLocale, value: string) {
  return resultCopy[locale].riskLabels[value] || value;
}

function translateResultText(locale: ReviewIntelLocale, value: string) {
  return getUiTextTranslation(locale, value) || value;
}

function translateResultArray(locale: ReviewIntelLocale, values: string[]) {
  return values.map((value) => translateResultText(locale, value));
}

function hasContradictoryNegativeLanguage(text: string) {
  return /\b(hard to recommend|not recommended|not a clean buy|compare alternatives|weak satisfaction|heavy complaint|complaint pressure|risk signals|poor value|avoid|skip|unreliable|not enough strong buying evidence)\b/i.test(text);
}

function isImpossibleCachedShopperResult(value: unknown) {
  const source = value as {
    verdict?: string;
    productScore?: number;
    buyingConfidence?: number;
    valueForMoney?: string;
    bottomLine?: string;
    topComplaints?: string[];
    notIdealFor?: string[];
  } | null;

  if (!source || typeof source !== "object") return false;

  const verdict = String(source.verdict || "").toUpperCase();
  if (verdict !== "BUY") return false;

  const productScore = clampScore(source.productScore, 0);
  const buyingConfidence = clampScore(source.buyingConfidence, productScore);
  const evidenceText = [
    source.bottomLine,
    ...(Array.isArray(source.topComplaints) ? source.topComplaints : []),
    ...(Array.isArray(source.notIdealFor) ? source.notIdealFor : [])
  ].join(" ");

  return (
    productScore < 75 ||
    buyingConfidence < 60 ||
    String(source.valueForMoney || "").toLowerCase() === "poor" ||
    hasContradictoryNegativeLanguage(evidenceText)
  );
}

function shopperProductFromResult(result: AnalyzeResponse, locale: ReviewIntelLocale): ShopperProductResult {
  const source = result as AnalyzeResponse & {
    product?: ProductLike;
    verdict?: ShopperVerdict;
    productScore?: number;
    buyingConfidence?: number;
    valueForMoney?: string;
    reviewAuthenticity?: {
      score?: number;
      suspiciousReviewRisk?: string;
      reasons?: string[];
    };
    topStrengths?: string[];
    topComplaints?: string[];
    bestFor?: string[];
    notIdealFor?: string[];
    bottomLine?: string;
    sourcesUsed?: string[];
  };

  const analysis = source.analysis;
  const product = source.product || {};
  const authenticity = source.reviewAuthenticity;
  const rawVerdict =
    source.verdict ||
    optionalVerdictFromBuyer((analysis as Record<string, unknown> | undefined)?.verdict) ||
    verdictFromBuyer(analysis?.buyer_recommendation?.verdict || analysis?.customer_recommendation?.verdict);
  const productScore = clampScore(source.productScore ?? analysis?.product_score ?? (analysis as Record<string, unknown> | undefined)?.score, 0);
  const buyingConfidence = clampScore(source.buyingConfidence ?? analysis?.confidence_score ?? analysis?.product_score ?? (analysis as Record<string, unknown> | undefined)?.score, productScore);
  const valueForMoney = String(source.valueForMoney || analysis?.value_for_money_opinion || "Fair");
  const strengths = asTextArray(source.topStrengths?.length ? source.topStrengths : analysis?.positive_points?.length ? analysis.positive_points : analysis?.praised_features, 5);
  const complaints = asTextArray(source.topComplaints?.length ? source.topComplaints : analysis?.common_complaints?.length ? analysis.common_complaints : analysis?.negative_points, 6);
  const bestFor = asTextArray(source.bestFor, 4);
  const notIdealFor = asTextArray(source.notIdealFor?.length ? source.notIdealFor : analysis?.quality_concerns, 4);
  const bottomLine = String(source.bottomLine || analysis?.buyer_recommendation?.rationale || analysis?.overall_summary || "Latest scan loaded.");
  const fakeReviewPercent = clampScore(authenticity?.score ?? analysis?.fake_review_risk_score, 0);
  const fakeReviewRisk =
    authenticity?.suspiciousReviewRisk ||
    (fakeReviewPercent >= 70 ? "High" : fakeReviewPercent >= 40 ? "Medium" : "Low");

  return {
    product,
    verdict: rawVerdict,
    productScore,
    buyingConfidence,
    valueForMoney: translateResultText(locale, valueForMoney),
    fakeReviewRisk: translateResultText(locale, fakeReviewRisk),
    fakeReviewPercent,
    strengths: translateResultArray(locale, strengths),
    complaints: translateResultArray(locale, complaints),
    bestFor: translateResultArray(locale, bestFor),
    notIdealFor: translateResultArray(locale, notIdealFor),
    bottomLine: translateResultText(locale, bottomLine),
    sourcesUsed: asTextArray(source.sourcesUsed, 10)
  };
}

function MiniMetric({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-3 shadow-sm dark:border-white/10 dark:bg-slate-950 sm:rounded-2xl sm:px-4 sm:py-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-[11px]">{label}</p>
      <p className="mt-2 break-words text-lg font-black text-ink dark:text-white sm:text-xl">{value}</p>
      {helper ? <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{helper}</p> : null}
    </div>
  );
}

function SignalList({ title, tone, items, empty }: { title: string; tone: "good" | "bad"; items: string[]; empty: string }) {
  const color = tone === "good" ? "text-emerald-700 bg-emerald-100" : "text-rose-700 bg-rose-100";

  return (
    <section className="rounded-2xl border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-950 sm:rounded-[1.5rem] sm:p-6">
      <h2 className="text-lg font-black text-ink dark:text-white sm:text-xl">{title}</h2>
      <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4">
        {(items.length ? items : [empty]).map((item, index) => (
          <div key={`${title}-${index}`} className="flex gap-3">
            <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-black ${color}`}>
              {tone === "good" ? "✓" : "!"}
            </span>
            <p className="text-sm font-bold leading-6 text-slate-700 dark:text-slate-300">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}


function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function isShopperCompareResult(value: unknown) {
  const record = recordOf(value);
  const mode = String(record.mode || "");
  const type = String(record.type || "");
  return type === "compare" || mode.includes("compare") || Boolean(record.compareId);
}

function compareSideName(value: unknown, fallback: string) {
  const record = recordOf(value);
  const product = recordOf(record.product);
  return shortProductName(
    product.title ||
      product.name ||
      record.productName ||
      record.title ||
      record.name ||
      record.fileName,
    fallback
  );
}

function compareResultTitle(value: unknown) {
  const record = recordOf(value);
  const productA = record.productA || record.resultA || record.a;
  const productB = record.productB || record.resultB || record.b;

  return shortCompareTitle(
    record.title ||
      record.fileName ||
      record.productName ||
      `Compare: ${compareSideName(productA, "Product A")} vs ${compareSideName(productB, "Product B")}`,
    "Product comparison"
  );
}

function ShopperCompareDetail({ result }: { result: AnalyzeResponse }) {
  const record = recordOf(result);
  const productA = record.productA || record.resultA || record.a;
  const productB = record.productB || record.resultB || record.b;
  const nameA = compareSideName(productA, "Product A");
  const nameB = compareSideName(productB, "Product B");

  const winner = String(record.winner || record.recommendedProduct || record.bestChoice || "").trim();
  const verdict = String(
    record.verdict ||
      record.finalVerdict ||
      (winner && winner !== "TIE" ? `I would choose Product ${winner}.` : "Both products are close, but one may still fit you better.")
  );

  const summary = String(
    record.summary ||
      record.bottomLine ||
      record.reason ||
      record.why ||
      "ReviewIntel compared both products using review quality, buyer confidence, value, risk signals, and common complaint patterns."
  );

  const whyWinner = String(
    record.whyWinner ||
      record.winnerReason ||
      record.reasonWhy ||
      record.explanation ||
      record.recommendationReason ||
      summary
  );

  const productAReason = String(
    record.productAReason ||
      record.reasonA ||
      record.productAStrength ||
      record.aReason ||
      "Product A may still be worth considering if its features, price, or brand fit your needs better."
  );

  const productBReason = String(
    record.productBReason ||
      record.reasonB ||
      record.productBStrength ||
      record.bReason ||
      "Product B may be stronger if it has better buyer confidence, cleaner review patterns, or better value."
  );

  const riskReason = String(
    record.riskReason ||
      record.biggestRisk ||
      record.warning ||
      record.redFlag ||
      "Before buying, check repeated complaints, durability issues, return policy, and review authenticity signals."
  );

  const code = displayCodeForResult({ ...record, type: "compare" }, compareResultTitle(record));

  return (
    <section className="shopper-compare-ai-result ri-reveal-pop rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950 sm:p-7">
      <div className="space-y-2">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-ocean dark:text-cyan-300">AI compare result</p>
        <h2 className="text-2xl font-semibold leading-tight text-ink dark:text-white">{compareResultTitle(record)}</h2>
        <p className="text-sm font-normal leading-6 text-slate-500 dark:text-slate-400">{code}</p>
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-ocean/15 bg-gradient-to-br from-ocean/8 via-white to-cyan-50 p-5 dark:border-cyan-300/20 dark:from-cyan-300/10 dark:via-slate-950 dark:to-slate-900">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ocean dark:text-cyan-300">Recommendation</p>
        <h3 className="mt-2 text-xl font-semibold leading-snug text-ink dark:text-white">{verdict}</h3>
        <p className="mt-3 text-sm font-normal leading-6 text-slate-700 dark:text-slate-200">{whyWinner}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-500">Product A</p>
          <h3 className="mt-2 text-base font-semibold leading-snug text-ink dark:text-white">{nameA}</h3>
          <p className="mt-2 text-sm font-normal leading-6 text-slate-600 dark:text-slate-300">{productAReason}</p>
        </div>

        <div className="rounded-2xl border border-line bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-500">Product B</p>
          <h3 className="mt-2 text-base font-semibold leading-snug text-ink dark:text-white">{nameB}</h3>
          <p className="mt-2 text-sm font-normal leading-6 text-slate-600 dark:text-slate-300">{productBReason}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-300/20 dark:bg-amber-300/10">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">Check before buying</p>
        <p className="mt-2 text-sm font-normal leading-6 text-amber-950 dark:text-amber-100">{riskReason}</p>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-slate-500">AI explanation</p>
        <p className="mt-2 text-sm font-normal leading-6 text-slate-700 dark:text-slate-200">{summary}</p>
      </div>
    </section>
  );
}


function ShopperProductDetail({ result, preview }: { result: AnalyzeResponse; preview: string }) {
  const locale = localeFromResult(result);
  const copy = resultCopy[locale];
  const shopper = shopperProductFromResult(result, locale);
  const verdict = {
    ...shopperVerdictStyle[shopper.verdict],
    ...copy.verdicts[shopper.verdict]
  };
  const productName = shortProductName(shopper.product.title || shopper.product.name || displayCodeForResult(result, "Analyzed product"), "Analyzed product");
  const percent = decisionPercent(shopper);
  const visibleRating = shopper.product.rating || copy.notShown;
  const visibleReviews = shopper.product.reviewCount ? `${shopper.product.reviewCount} ${copy.reviews}` : copy.reviewCountNotShown;
  const sourcesLine = shopper.sourcesUsed.length
    ? copy.sourcesChecked(Math.min(shopper.sourcesUsed.length, 8), shopper.sourcesUsed.slice(0, 4), shopper.sourcesUsed.length > 4)
    : copy.sourcesLimited;

  return (
    <>
      {/* Mobile-only compact shopper result */}
      <div className="ri-results-mobile space-y-3">
        <section className={`rounded-[1.4rem] border p-4 text-center shadow-soft ${verdict.soft}`}>
          <div className="mx-auto grid size-16 place-items-center rounded-full border-[4px] border-emerald-400 bg-white text-3xl font-black text-emerald-700 shadow-sm">
            {shopper.verdict === "BUY" ? "✓" : shopper.verdict === "AVOID" ? "!" : "?"}
          </div>

          <p className={`mt-2 text-[34px] font-black leading-none tracking-[-0.08em] ${verdict.tone}`}>
            {verdict.answer}
          </p>

          <div className="mx-auto mt-2 inline-flex items-center rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-700 shadow-sm">
            {percent}% {copy.buyerConfidence}
          </div>

          <h1 className="mx-auto mt-3 line-clamp-2 max-w-[310px] text-[17px] font-black leading-[1.08] tracking-tight text-ink dark:text-white">
            {productName}
          </h1>

          <p className="mx-auto mt-2 line-clamp-2 max-w-[300px] text-[12px] font-bold leading-4 text-slate-600 dark:text-slate-300">
            {verdict.message}
          </p>

          <div className="ri-mobile-metric-grid mt-4 grid grid-cols-2 gap-2 border-t border-black/10 pt-3 text-left">
            <MiniMetric label={copy.buyScore} value={`${Math.round(shopper.productScore / 10)}/10`} />
            <MiniMetric label={copy.value} value={localizedValueLabel(locale, shopper.valueForMoney)} helper={shopper.product.price || copy.priceNotShown} />
            <MiniMetric label={copy.aiLikeReviews} value={`${shopper.fakeReviewPercent}% ${copy.signs}`} helper={`${localizedRiskLabel(locale, shopper.fakeReviewRisk)} ${copy.risk}`} />
            <MiniMetric label={copy.rating} value={visibleRating} helper={visibleReviews} />
          </div>
        </section>

        <section className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 rounded-2xl border border-line bg-white p-3 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <div className="relative h-[104px] overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-white/5 dark:to-white/[0.02]">
            {preview ? (
              <Image src={preview} alt="Analyzed product screenshot" fill className="object-contain p-1.5" unoptimized priority />
            ) : (
              <div className="grid h-full place-items-center px-2 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {copy.screenshotUnavailable}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <Badge tone="good">{copy.productIdentified}</Badge>
            <p className="mt-2 line-clamp-2 text-[12px] font-black leading-[1.12] text-ink dark:text-white">
              {productName}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-bold leading-4 text-slate-600 dark:text-slate-300">
              {shopper.product.brand ? <span>{shopper.product.brand}</span> : null}
              <span>{visibleReviews}</span>
              {shopper.product.store ? <span>{shopper.product.store}</span> : null}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-300/20 dark:bg-emerald-300/10">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-100">
              {copy.topStrengths}
            </p>
            <ul className="mt-2 space-y-1.5">
              {(shopper.strengths.slice(0, 3).length ? shopper.strengths.slice(0, 3) : [copy.noStrengths]).map((item, index) => (
                <li key={`mobile-strength-${index}`} className="text-[10px] font-bold leading-4 text-slate-700 dark:text-slate-200">
                  • {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 dark:border-rose-300/20 dark:bg-rose-300/10">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-800 dark:text-rose-100">
              {copy.topComplaints}
            </p>
            <ul className="mt-2 space-y-1.5">
              {(shopper.complaints.slice(0, 3).length ? shopper.complaints.slice(0, 3) : [copy.noComplaints]).map((item, index) => (
                <li key={`mobile-complaint-${index}`} className="text-[10px] font-bold leading-4 text-slate-700 dark:text-slate-200">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-soft dark:border-amber-300/20 dark:bg-amber-300/10">
          <h2 className="text-[13px] font-black text-ink dark:text-white">{copy.bottomLine}</h2>
          <p className="mt-2 text-[11px] font-bold leading-4 text-slate-700 dark:text-slate-200">
            {shopper.bottomLine}
          </p>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <SignalList title={copy.bestFor} tone="good" items={shopper.bestFor.slice(0, 2)} empty={copy.bestForEmpty} />
          <SignalList title={copy.notIdealFor} tone="bad" items={shopper.notIdealFor.slice(0, 2)} empty={copy.notIdealEmpty} />
        </section>

        <div className="rounded-2xl border border-ocean/20 bg-ocean/5 p-3 text-[10px] font-bold leading-4 text-slate-600 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-slate-200">
          {sourcesLine}
        </div>
      </div>

      {/* Desktop report layout unchanged */}
      <div className="ri-results-desktop space-y-4 sm:space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(320px,440px)_minmax(0,1fr)] lg:gap-6">
        <div className="rounded-2xl border border-line bg-white p-3 shadow-soft dark:border-white/10 dark:bg-slate-950 sm:rounded-[1.75rem] sm:p-4">
          <div className="relative grid h-[260px] place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-white/5 dark:to-white/[0.02] sm:h-[360px] sm:rounded-2xl lg:h-[520px]">
            {preview ? (
              <Image src={preview} alt="Analyzed product screenshot" fill className="object-contain p-2" unoptimized priority />
            ) : (
              <p className="px-6 text-center text-sm font-bold text-slate-500 dark:text-slate-400">{copy.screenshotUnavailable}</p>
            )}
          </div>
        </div>

        <div className="grid min-w-0 gap-4 sm:gap-5">
          <div className="min-w-0">
            <Badge tone="good">{copy.productIdentified}</Badge>
            <h1 className="mt-4 break-words text-2xl font-black leading-tight text-ink dark:text-white sm:text-3xl lg:mt-5 lg:text-5xl">
              {productName}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300 sm:mt-5 sm:gap-5 sm:text-base">
              {shopper.product.brand ? <span>{shopper.product.brand}</span> : null}
              {visibleRating !== copy.notShown ? <span>{visibleRating}</span> : null}
              <span>{visibleReviews}</span>
              {shopper.product.store ? <span>{shopper.product.store}</span> : null}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold leading-5 text-emerald-900 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100 sm:rounded-2xl sm:px-5 sm:py-4 sm:text-sm sm:leading-6">
            {sourcesLine}
          </div>

          <section className={`rounded-2xl border p-4 sm:rounded-[1.5rem] sm:p-6 ${verdict.soft}`}>
            <div className="grid gap-4 sm:gap-6 md:grid-cols-[1fr_150px] md:items-center">
              <div className="flex items-start gap-4 sm:items-center sm:gap-6">
                <span className={`grid size-14 shrink-0 place-items-center rounded-full border-[3px] bg-white text-2xl font-black sm:size-20 sm:border-4 sm:text-4xl ${verdict.ring} ${verdict.tone}`}>
                  {shopper.verdict === "BUY" ? "✓" : shopper.verdict === "AVOID" ? "!" : "?"}
                </span>
                <div className="min-w-0">
                  <p className={`break-words text-3xl font-black tracking-tight sm:text-5xl ${verdict.tone}`}>{verdict.answer}</p>
                  <p className="mt-2 text-base font-black text-ink sm:mt-3 sm:text-lg">{verdict.title}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-slate-600 sm:text-sm sm:leading-6">{verdict.message}</p>
                </div>
              </div>
              <div className="mx-auto grid size-24 place-items-center rounded-full border-[8px] border-slate-200 bg-white sm:size-32 sm:border-[10px]">
                <div className="text-center">
                  <p className={`text-2xl font-black sm:text-3xl ${verdict.tone}`}>{percent}%</p>
                  <p className="text-[10px] font-black uppercase text-slate-500 sm:text-xs">{copy.buyerConfidence}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-black/10 pt-4 md:grid-cols-4 sm:mt-6 sm:pt-5">
              <MiniMetric label={copy.buyScore} value={`${Math.round(shopper.productScore / 10)}/10`} />
              <MiniMetric label={copy.value} value={localizedValueLabel(locale, shopper.valueForMoney)} helper={shopper.product.price || copy.priceNotShown} />
              <MiniMetric label={copy.aiLikeReviews} value={`${shopper.fakeReviewPercent}% ${copy.signs}`} helper={`${localizedRiskLabel(locale, shopper.fakeReviewRisk)} ${copy.risk}`} />
              <MiniMetric label={copy.rating} value={visibleRating} helper={visibleReviews} />
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <SignalList title={copy.topStrengths} tone="good" items={shopper.strengths} empty={copy.noStrengths} />
        <SignalList title={copy.topComplaints} tone="bad" items={shopper.complaints} empty={copy.noComplaints} />
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-soft dark:border-amber-300/20 dark:bg-amber-300/10 sm:rounded-[1.5rem] sm:p-6">
        <h2 className="text-lg font-black text-ink dark:text-white sm:text-xl">{copy.bottomLine}</h2>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-700 dark:text-slate-200 sm:text-base sm:leading-7">{shopper.bottomLine}</p>
      </section>

      <section className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <SignalList title={copy.bestFor} tone="good" items={shopper.bestFor} empty={copy.bestForEmpty} />
        <SignalList title={copy.notIdealFor} tone="bad" items={shopper.notIdealFor} empty={copy.notIdealEmpty} />
      </section>
      </div>
    </>
  );
}

function reconcileResponse(result: AnalyzeResponse): AnalyzeResponse {
  const source = result as AnalyzeResponse & {
    analysis?: Record<string, unknown>;
    topStrengths?: string[];
    topComplaints?: string[];
    bestFor?: string[];
    notIdealFor?: string[];
  };

  const existing = source.analysis || {};
  const strengths =
    (existing.strengths as string[] | undefined) ||
    (existing.praised_features as string[] | undefined) ||
    (existing.praisedFeatures as string[] | undefined) ||
    (existing.positive_points as string[] | undefined) ||
    (existing.positivePoints as string[] | undefined) ||
    source.topStrengths ||
    [];

  const complaints =
    (existing.complaints as string[] | undefined) ||
    (existing.mainConcerns as string[] | undefined) ||
    (existing.negative_points as string[] | undefined) ||
    (existing.negativePoints as string[] | undefined) ||
    (existing.pain_points as string[] | undefined) ||
    (existing.painPoints as string[] | undefined) ||
    source.topComplaints ||
    [];

  const bestFor =
    (existing.bestFor as string[] | undefined) ||
    (existing.best_for as string[] | undefined) ||
    source.bestFor ||
    [];

  const notIdealFor =
    (existing.notIdealFor as string[] | undefined) ||
    (existing.not_ideal_for as string[] | undefined) ||
    source.notIdealFor ||
    [];

  const analysis = {
    ...existing,
    strengths,
    praised_features: strengths,
    praisedFeatures: strengths,
    positive_points: strengths,
    positivePoints: strengths,
    complaints,
    mainConcerns: complaints,
    topComplaints: complaints,
    negative_points: complaints,
    negativePoints: complaints,
    pain_points: complaints,
    painPoints: complaints,
    bestFor,
    best_for: bestFor,
    notIdealFor,
    not_ideal_for: notIdealFor
  };

  return {
    ...result,
    analysis: reconcileAnalysisScores(
      analysis as AnalyzeResponse["analysis"],
      result.meta.review_count_estimate
    )
  };
}


export function ResultsClient() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [preview, setPreview] = useState("");
  const [accountPlan, setAccountPlan] = useState<SubscriptionPlan | null>(null);

  const dashboardHref =
    result?.meta.audience === "seller" ||
    result?.meta.audience === "both" ||
    accountPlan === "seller_premium" ||
    accountPlan === "seller_pro"
      ? "/dashboard/seller"
      : "/dashboard/customer";

  const customerNav = (
    <div className="reviewintel-results-secondary-nav mb-5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="rounded-full border border-line bg-white px-4 py-2 text-xs font-black text-ink shadow-soft transition hover:-translate-y-0.5 hover:border-ocean hover:text-ocean dark:border-white/10 dark:bg-slate-950 dark:text-white"
      >
        ← Back
      </button>
      <Link
        href={dashboardHref}
        className="rounded-full border border-line bg-white px-4 py-2 text-xs font-black text-ink shadow-soft transition hover:-translate-y-0.5 hover:border-ocean hover:text-ocean dark:border-white/10 dark:bg-slate-950 dark:text-white"
      >
        Dashboard
      </Link>
      <Link
        href="/analyze"
        className="rounded-full bg-ink px-4 py-2 text-xs font-black text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-ocean dark:bg-white dark:text-ink"
      >
        Scan
      </Link>
      <Link
        href="/account"
        className="rounded-full border border-line bg-white px-4 py-2 text-xs font-black text-ink shadow-soft transition hover:-translate-y-0.5 hover:border-ocean hover:text-ocean dark:border-white/10 dark:bg-slate-950 dark:text-white"
      >
        Account
      </Link>
    </div>
  );

  useEffect(() => {
    let cancelled = false;

    async function loadResult() {
      try {
      const account = getClientAccount();
      setAccountPlan(account?.plan ?? null);
      setPreview(readLatestPreview());
      let parsed: AnalyzeResponse | null = readLatestResult(account);

      if (account?.email && account.plan !== "free_buyer") {
        const params = new URLSearchParams({
          email: account.email,
          plan: account.plan,
          role: account.role
        });

        const response = await fetch(`/api/account/analyses?${params.toString()}`, { cache: "no-store" }).catch(() => null);
        const data = response?.ok ? await response.json().catch(() => null) : null;
        const analyses = Array.isArray(data?.analyses) ? data.analyses : [];
        const selectedHistoryId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("history") ||
              window.localStorage.getItem("reviewintel_selected_history_id")
            : null;

        const latest = selectedHistoryId
          ? analyses.find((item: Record<string, unknown>) => {
              const analysisJson =
                item.analysis_json && typeof item.analysis_json === "object"
                  ? (item.analysis_json as Record<string, unknown>)
                  : {};

              return (
                String(item.id ?? "") === selectedHistoryId ||
                String(analysisJson.analysisId ?? "") === selectedHistoryId ||
                String(analysisJson.serverId ?? "") === selectedHistoryId ||
                String(analysisJson.compareId ?? "") === selectedHistoryId
              );
            }) ?? analyses[0] ?? null
          : analyses[0] ?? null;

        const stored = latest?.analysis_json && typeof latest.analysis_json === "object"
          ? (latest.analysis_json as Record<string, unknown>)
          : null;
        const restored = stored?.result || stored;

        if (restored && typeof restored === "object") {
          const serverParsed = {
            ...(restored as AnalyzeResponse),
            analysisId: latest?.id,
            createdAt: latest?.created_at
          } as AnalyzeResponse;

          const localTime = new Date(String((parsed as Record<string, unknown> | null)?.createdAt || (parsed as Record<string, unknown> | null)?.savedAt || 0)).getTime();
          const serverTime = new Date(String(latest?.created_at || (serverParsed as Record<string, unknown>).createdAt || (serverParsed as Record<string, unknown>).savedAt || 0)).getTime();
          const serverIsCompare =
            String((serverParsed as Record<string, unknown>).type || "").toLowerCase() === "compare" ||
            String((serverParsed as Record<string, unknown>).mode || "").toLowerCase().includes("compare") ||
            Boolean((serverParsed as Record<string, unknown>).compareId);

          if (!parsed || serverIsCompare || serverTime >= localTime) {
            parsed = serverParsed;
            saveLatestResult(serverParsed, account);
          }
        }
      }

      if (!parsed) {
        parsed = readLatestResult(account);
      }

      if (!parsed) return;

      if (isImpossibleCachedShopperResult(parsed)) {
        clearLatestResult();
        if (!cancelled) setResult(null);
        return;
      }

      if (isShopperCompareResult(parsed)) {
        const compareParsed = {
          ...(parsed as AnalyzeResponse),
          type: "compare",
          meta: {
            ...((parsed as AnalyzeResponse).meta || {}),
            audience: "buyer"
          }
        } as AnalyzeResponse;

        saveLatestResult(compareParsed, account);
        if (!cancelled) setResult(compareParsed);
        return;
      }

      const source = parsed as AnalyzeResponse & {
        product?: {
          name?: string;
          brand?: string;
          category?: string;
          store?: string;
          price?: string;
          rating?: string;
          reviewCount?: string;
        };
        verdict?: "BUY" | "CONSIDER" | "AVOID";
        productScore?: number;
        buyingConfidence?: number;
        valueForMoney?: string;
        reviewAuthenticity?: {
          label?: string;
          score?: number;
          suspiciousReviewRisk?: string;
          reasons?: string[];
        };
        topStrengths?: string[];
        topComplaints?: string[];
        bestFor?: string[];
        notIdealFor?: string[];
        bottomLine?: string;
      };

      const sourceRecord = source && typeof source === "object" ? (source as Record<string, unknown>) : {};
      const sourceTypeText = String(sourceRecord.type ?? "").toLowerCase();
      const sourceModeText = String(sourceRecord.mode ?? "").toLowerCase();
      const sourceCompareIdText = String(sourceRecord.compareId ?? "");
      const isServerCompareSource =
        Boolean(sourceRecord.productA && sourceRecord.productB) &&
        (
          sourceTypeText === "compare" ||
          sourceModeText === "buyer_compare" ||
          sourceCompareIdText.startsWith("CMR-")
        );

      if (isServerCompareSource) {
        const compareResult = source as AnalyzeResponse;
        saveLatestResult(compareResult, account);
        if (!cancelled) setResult(compareResult);
        saveActiveMode("buyer");
        return;
      }

      const normalized =
        source.meta && source.analysis
          ? source
          : ({
              meta: {
                audience: "buyer",
                locale: readStoredLocale(),
                generatedAt: new Date().toISOString()
              },
              product: {
                title: source.product?.name || "Analyzed product",
                name: source.product?.name || "Analyzed product",
                brand: source.product?.brand || "",
                category: source.product?.category || "",
                store: source.product?.store || "",
                price: source.product?.price || "",
                rating: source.product?.rating || "",
                reviewCount: source.product?.reviewCount || ""
              },
              verdict: source.verdict || "CONSIDER",
              productScore: source.productScore || source.buyingConfidence || 0,
              buyingConfidence: source.buyingConfidence || source.productScore || 0,
              valueForMoney: source.valueForMoney || "Fair",
              reviewAuthenticity: source.reviewAuthenticity,
              topStrengths: source.topStrengths || [],
              topComplaints: source.topComplaints || [],
              bestFor: source.bestFor || [],
              notIdealFor: source.notIdealFor || [],
              bottomLine: source.bottomLine || "Latest scan loaded.",
              analysis: {
                verdict: source.verdict || "CONSIDER",
                score: source.productScore || source.buyingConfidence || 0,
                buyingConfidence: source.buyingConfidence || source.productScore || 0,
                valueForMoney: source.valueForMoney || "Fair",
                summary: source.bottomLine || "Latest scan loaded.",
                mainConcerns: source.topComplaints || [],
                strengths: source.topStrengths || [],
                praised_features: source.topStrengths || [],
                praisedFeatures: source.topStrengths || [],
                positive_points: source.topStrengths || [],
                positivePoints: source.topStrengths || [],
                complaints: source.topComplaints || [],
                topComplaints: source.topComplaints || [],
                negative_points: source.topComplaints || [],
                negativePoints: source.topComplaints || [],
                pain_points: source.topComplaints || [],
                painPoints: source.topComplaints || [],
                bestFor: source.bestFor || [],
                best_for: source.bestFor || [],
                notIdealFor: source.notIdealFor || [],
                not_ideal_for: source.notIdealFor || [],
                authenticity: {
                  label: source.reviewAuthenticity?.label || "Medium Trust",
                  score: source.reviewAuthenticity?.score || 50,
                  suspiciousReviewRisk: source.reviewAuthenticity?.suspiciousReviewRisk || "Medium",
                  reasons: source.reviewAuthenticity?.reasons || []
                }
              }
            } as unknown as AnalyzeResponse);

      const reconciled = reconcileResponse(normalized);
      saveLatestResult(reconciled, account);
      if (!cancelled) setResult(reconciled);

      const audience = reconciled.meta?.audience || "buyer";
      const sellerAccount = account ? canAccessSellerAnalytics(account.role, account.plan) : false;
      saveActiveMode(sellerAccount && (audience === "both" || audience === "seller") ? "seller" : audience);
      } catch (error) {
        console.error("Results page failed to load latest scan", error);
        if (!cancelled) setResult(null);
      }
    }

    void loadResult();

    return () => {
      cancelled = true;
    }
  }, []);

  if (!result) {
    return (
      <>
        {accountPlan !== "free_buyer" ? customerNav : null}
        <section className="ri-reveal-pop relative overflow-hidden rounded-2xl border border-line bg-white p-5 text-center shadow-soft dark:border-white/10 dark:bg-slate-950 sm:rounded-[2rem] sm:p-8">
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-teal via-ocean to-amber" />
        <Badge tone="warn">No scan loaded</Badge>
        <h1 className="mx-auto mt-4 max-w-2xl text-2xl font-black text-ink dark:text-white sm:text-4xl">Run a real analysis to see ReviewIntel results.</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Public sample results have been removed from the customer experience. Upload a product screenshot or paste a product link to generate a fresh buying verdict.
        </p>
        <Link href="/analyze" className="mt-6 inline-flex rounded-2xl bg-ink px-6 py-4 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
          Run AI Analysis
        </Link>
      </section>
      </>
    );
  }

  const isSellerAudience = result.meta.audience === "seller" || result.meta.audience === "both";
  const sellerPlanLabel =
    accountPlan === "seller_pro"
      ? "Seller Pro"
      : accountPlan === "seller_premium"
        ? "Seller Premium"
        : "Seller Premium";
  const isCompareResult = !isSellerAudience && isShopperCompareResult(result);
  const productTitle =
    (result as AnalyzeResponse & { product?: ProductLike }).product?.title ||
    (result as AnalyzeResponse & { product?: ProductLike }).product?.name ||
    displayCodeForResult(result, "Product detail verdict");
  const resultHeading = isSellerAudience
    ? `${sellerPlanLabel} intelligence`
    : isCompareResult
      ? compareResultTitle(result)
      : shortProductName(productTitle, "Analyzed product");

  return (
    <div className="space-y-5">
      {accountPlan !== "free_buyer" ? customerNav : null}
      {!isSellerAudience && ["buyer_pro", "buyer_beta", "shopper_beta"].includes(String(accountPlan)) ? <ShopperResultHistoryCorner /> : null}
      <section className="ri-reveal-pop relative overflow-hidden rounded-2xl border border-line bg-white p-3 shadow-soft dark:border-white/10 dark:bg-slate-950 sm:rounded-[1.6rem] sm:p-4">
        <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-b from-teal via-ocean to-amber" />
        <div className="flex flex-col gap-4 pl-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-ocean dark:text-cyan-300">
              Your latest scan
            </p>
            <h1 className="mt-2 break-words text-xl font-black text-ink dark:text-white sm:text-2xl">
              {resultHeading}
            </h1>
          </div>
          <div className="grid gap-2 sm:grid-cols-1 lg:min-w-48">
            <Link href="/analyze" className="rounded-2xl bg-ink px-4 py-3 text-center text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ocean dark:bg-white dark:text-ink">
              Run another scan
            </Link>
          </div>
        </div>
      </section>

      {isSellerAudience ? (
        <ResultsDashboard result={result} accountPlan={accountPlan} />
      ) : isCompareResult ? (
        <ShopperCompareDetail result={result} />
      ) : (
        <ShopperProductDetail result={result} preview={preview} />
      )}
      <style jsx global>{`
        @media (max-width: 640px) {
          html[data-layout-mode="mobile"] .reviewintel-route-results main {
            width: 100% !important;
            max-width: 430px !important;
            padding: 0.75rem !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }

          html[data-layout-mode="mobile"] main:has(.ri-results-mobile),
          html[data-layout-mode="mobile"] main:has(.shopper-compare-ai-result) {
            width: 100% !important;
            max-width: 430px !important;
            padding: 0.75rem !important;
            margin-left: auto !important;
            margin-right: auto !important;
            overflow-x: hidden !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-route-results .reviewintel-results-secondary-nav {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 0.45rem !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-results-secondary-nav {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 0.45rem !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-route-results .reviewintel-results-secondary-nav :is(a, button) {
            min-height: 2.25rem !important;
            padding: 0.45rem 0.35rem !important;
            font-size: 0.68rem !important;
            line-height: 1.05 !important;
            border-radius: 0.8rem !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-results-secondary-nav :is(a, button) {
            min-height: 2.25rem !important;
            padding: 0.45rem 0.35rem !important;
            font-size: 0.68rem !important;
            line-height: 1.05 !important;
            border-radius: 0.8rem !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-mobile {
            display: block !important;
          }

          html[data-layout-mode="mobile"] .ri-results-mobile {
            display: block !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-desktop {
            display: none !important;
          }

          html[data-layout-mode="mobile"] .ri-results-desktop {
            display: none !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-mobile {
            max-width: 100% !important;
          }

          html[data-layout-mode="mobile"] .ri-results-mobile {
            max-width: 100% !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-mobile section {
            padding: 0.85rem !important;
            border-radius: 1rem !important;
          }

          html[data-layout-mode="mobile"] .ri-results-mobile section {
            padding: 0.85rem !important;
            border-radius: 1rem !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-mobile h1 {
            font-size: 1rem !important;
            line-height: 1.12 !important;
            letter-spacing: -0.02em !important;
          }

          html[data-layout-mode="mobile"] .ri-results-mobile h1 {
            font-size: 1rem !important;
            line-height: 1.12 !important;
            letter-spacing: -0.02em !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-mobile h2 {
            font-size: 0.9rem !important;
            line-height: 1.18 !important;
          }

          html[data-layout-mode="mobile"] .ri-results-mobile h2 {
            font-size: 0.9rem !important;
            line-height: 1.18 !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-mobile p,
          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-mobile li {
            font-size: 0.76rem !important;
            line-height: 1.38 !important;
          }

          html[data-layout-mode="mobile"] .ri-results-mobile p,
          html[data-layout-mode="mobile"] .ri-results-mobile li {
            font-size: 0.76rem !important;
            line-height: 1.38 !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-mobile .ri-mobile-metric-grid,
          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-mobile .grid-cols-2 {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.5rem !important;
          }

          html[data-layout-mode="mobile"] .ri-results-mobile .ri-mobile-metric-grid,
          html[data-layout-mode="mobile"] .ri-results-mobile .grid-cols-2 {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.5rem !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-mobile .grid-cols-\\[104px_minmax\\(0\\,1fr\\)\\] {
            display: grid !important;
            grid-template-columns: 96px minmax(0, 1fr) !important;
            gap: 0.65rem !important;
          }

          html[data-layout-mode="mobile"] .ri-results-mobile .grid-cols-\\[104px_minmax\\(0\\,1fr\\)\\] {
            display: grid !important;
            grid-template-columns: 96px minmax(0, 1fr) !important;
            gap: 0.65rem !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-mobile img {
            max-height: 96px !important;
            object-fit: contain !important;
          }

          html[data-layout-mode="mobile"] .ri-results-mobile img {
            max-height: 96px !important;
            object-fit: contain !important;
          }

          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-mobile .rounded-xl,
          html[data-layout-mode="mobile"] .reviewintel-route-results .ri-results-mobile .rounded-2xl {
            border-radius: 0.9rem !important;
          }

          html[data-layout-mode="mobile"] .ri-results-mobile .rounded-xl,
          html[data-layout-mode="mobile"] .ri-results-mobile .rounded-2xl {
            border-radius: 0.9rem !important;
          }
        }

        html[data-layout-mode="desktop"] .reviewintel-route-results .ri-results-mobile,
        html[data-layout-mode="desktop-mini"] .reviewintel-route-results .ri-results-mobile,
        html[data-layout-mode="desktop"] .ri-results-mobile,
        html[data-layout-mode="desktop-mini"] .ri-results-mobile {
          display: none !important;
        }

        html[data-layout-mode="desktop"] .reviewintel-route-results .ri-results-desktop,
        html[data-layout-mode="desktop-mini"] .reviewintel-route-results .ri-results-desktop,
        html[data-layout-mode="desktop"] .ri-results-desktop,
        html[data-layout-mode="desktop-mini"] .ri-results-desktop {
          display: block !important;
        }
      `}</style>
    </div>
  );
}
