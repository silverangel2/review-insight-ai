"use client";

import { saveLatestResult } from "@/lib/resultStorage";
import { getClientAccount, incrementStoredScanTally } from "@/lib/clientAccount";
import { AffiliateSourcePanel } from "@/components/AffiliateSourcePanel";

import { useMemo, useState } from "react";
import Link from "next/link";
import { displayCodeForResult } from "@/lib/productDisplay";
import { readStoredLocale } from "@/lib/i18n";
import { shortProductName, shortCompareTitle } from "@/lib/productName";

type Verdict = "BUY" | "CONSIDER" | "AVOID";

type AnalyzeResult = {
  verdict: Verdict;
  productScore: number;
  valueForMoney: string;
  bottomLine: string;
  product: {
    name: string;
    brand: string;
    category: string;
    store: string;
    price: string;
    rating: string;
    reviewCount: string;
  };
  reviewAuthenticity: {
    label: string;
    score: number;
    reasons: string[];
  };
  topStrengths: string[];
  topComplaints: string[];
  bestFor: string[];
  notIdealFor: string[];
  sourcesUsed: string[];
};

type CompareSide = {
  label: "A" | "B";
  file: File | null;
  preview: string;
  link: string;
  result: AnalyzeResult | null;
};

type ShopperComparison = {
  winner: "A" | "B" | "TIE" | "INCOMPARABLE";
  directSubstitutes: boolean;
  confidence: number;
  verdictHeadline: string;
  summary: string;
  reasons: string[];
  nextSteps: string[];
};

function emptySide(label: "A" | "B"): CompareSide {
  return {
    label,
    file: null,
    preview: "",
    link: "",
    result: null
  };
}



async function saveShopperCompareToServerHistory(result: Record<string, unknown>, account: unknown) {
  const accountRecord = (account || {}) as Record<string, unknown>;
  const email = String(accountRecord.email || "").toLowerCase().trim();

  if (!email) return;

  await fetch("/api/account/analyses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      plan: accountRecord.plan || "buyer_pro",
      role: accountRecord.role || "buyer",
      mode: "buyer_compare",
      audience: "buyer",
      productName:
        result.title ||
        result.fileName ||
        compareDisplayTitle(result.productA, result.productB),
      platform: "compare",
      productScore: result.score ?? null,
      recommendation: result.verdict ?? null,
      summary: result.summary ?? null,
      analysis: result,
      account: accountRecord
    })
  }).catch(() => null);
}


function compareCopy(locale: string) {
  const en = {
    verdictLabel: "Verdict",
    comparisonVerdict: "Comparison Verdict",
    tooClose: "Too Close To Call",
    winner: (winner: "A" | "B") => `Winner: Product ${winner}`,
    productLabel: (label: "A" | "B") => `Product ${label}`,
    productPreview: (label: "A" | "B") => `Product ${label} preview`,
    ratingLabel: "rating",
    tieSummary: "Both products look close based on the available buying signals.",
    directWinner: (winner: "A" | "B") =>
      `Product ${winner} looks like the safer choice based on verdict, complaints, score, value, and AI-generated review signs.`,
    confidenceWinner: (winner: "A" | "B") =>
      `Product ${winner} has stronger buying confidence, but these products are different product types. ReviewIntel is comparing buying confidence only — not saying they are direct substitutes or do the same job.`,
    differentTypes: "Different product types detected. ReviewIntel is comparing buying confidence only — not saying these products are direct substitutes or do the same job.",
    analyzeOne: "← Analyze One Product",
    premiumBadge: "Shopper Premium",
    reviewIntelCompare: "ReviewIntel Compare",
    compareProductsTitle: "Compare Products.",
    compareIntro: "Upload two product screenshots or paste two product links. ReviewIntel checks both and tells you which one looks safer to buy.",
    uploadOrPaste: "Upload or paste link",
    uploadScreenshot: "Upload product screenshot",
    uploadHint: "Use a product listing screenshot with price, rating, or product details.",
    productLinkOptional: "Product link optional",
    readyToCompare: "Ready to compare.",
    addScreenshotOrLink: "Add screenshot or link to continue.",
    comparing: "Comparing both products...",
    compareButton: "⚡ Compare Products",
    compareAnother: "Compare another pair",
    missingInputs: "Add a screenshot or link for both products.",
    comparisonFailed: "Comparison failed.",
    productDetailsChecked: "Product details checked",
    noConcern: "No major concern found from available signals.",
    notDirectlyComparable: "Not Directly Comparable",
    whyThisResult: "Why this result",
    nextSteps: "Next steps",
    decisionSnapshot: "Decision snapshot",
    confidenceLabel: "Confidence",
    compareType: "Compare type",
    directCompare: "Direct substitute",
    buyingConfidenceOnly: "Buying confidence only",
    sideBySide: "Side-by-side analysis",
    productA: "Product A",
    productB: "Product B",
    edge: "Edge",
    buyScore: "Buy score",
    reviewTrust: "Review trust",
    valueLabel: "Value",
    topConcern: "Top concern",
    bestUse: "Best use",
    scoreGap: "Score gap",
    similar: "Similar",
    stronger: (label: "A" | "B") => `Product ${label} stronger`,
    checkBoth: "Check both"
  };

  switch (locale) {
    case "fr":
      return {
        ...en,
        verdictLabel: "Verdict",
        comparisonVerdict: "Verdict de comparaison",
        tooClose: "Trop serré pour trancher",
        winner: (winner: "A" | "B") => `Gagnant : Produit ${winner}`,
        productLabel: (label: "A" | "B") => `Produit ${label}`,
        productPreview: (label: "A" | "B") => `Aperçu du produit ${label}`,
        ratingLabel: "note",
        tieSummary: "Les deux produits sont très proches selon les signaux d’achat disponibles.",
        directWinner: (winner: "A" | "B") => `Le produit ${winner} semble être le choix le plus sûr selon le verdict, les plaintes, le score, la valeur et les signaux d’avis générés par IA.`,
        confidenceWinner: (winner: "A" | "B") => `Le produit ${winner} présente une meilleure confiance d’achat, mais ces produits sont différents. ReviewIntel compare uniquement la confiance d’achat.`,
        differentTypes: "Types de produits différents détectés. ReviewIntel compare uniquement la confiance d’achat.",
        analyzeOne: "← Analyser un produit",
        premiumBadge: "Shopper Premium",
        reviewIntelCompare: "Comparaison ReviewIntel",
        compareProductsTitle: "Comparer les produits.",
        compareIntro: "Téléversez deux captures de produits ou collez deux liens. ReviewIntel analyse les deux et indique lequel semble le plus sûr à acheter.",
        uploadOrPaste: "Téléverser ou coller un lien",
        uploadScreenshot: "Téléverser une capture du produit",
        uploadHint: "Utilisez une capture avec le prix, la note ou les détails du produit.",
        productLinkOptional: "Lien du produit facultatif",
        readyToCompare: "Prêt à comparer.",
        addScreenshotOrLink: "Ajoutez une capture ou un lien pour continuer.",
        comparing: "Comparaison des deux produits...",
        compareButton: "⚡ Comparer les produits",
        compareAnother: "Comparer une autre paire",
        missingInputs: "Ajoutez une capture ou un lien pour les deux produits.",
        comparisonFailed: "La comparaison a échoué.",
        productDetailsChecked: "Détails du produit vérifiés",
        noConcern: "Aucune préoccupation majeure trouvée avec les signaux disponibles.",
        notDirectlyComparable: "Pas directement comparables",
        whyThisResult: "Pourquoi ce résultat",
        nextSteps: "Prochaines étapes",
        decisionSnapshot: "Résumé de décision",
        confidenceLabel: "Confiance",
        compareType: "Type de comparaison",
        directCompare: "Substitut direct",
        buyingConfidenceOnly: "Confiance d’achat seulement",
        sideBySide: "Analyse côte à côte",
        productA: "Produit A",
        productB: "Produit B",
        edge: "Avantage",
        buyScore: "Score d’achat",
        reviewTrust: "Fiabilité des avis",
        valueLabel: "Valeur",
        topConcern: "Préoccupation principale",
        bestUse: "Meilleur usage",
        scoreGap: "Écart de score",
        similar: "Similaire",
        stronger: (label: "A" | "B") => `Produit ${label} plus fort`,
        checkBoth: "Vérifier les deux"
      };
    case "es":
      return {
        ...en,
        verdictLabel: "Veredicto",
        comparisonVerdict: "Veredicto de comparación",
        tooClose: "Demasiado parejo para decidir",
        winner: (winner: "A" | "B") => `Ganador: Producto ${winner}`,
        productLabel: (label: "A" | "B") => `Producto ${label}`,
        productPreview: (label: "A" | "B") => `Vista previa del producto ${label}`,
        ratingLabel: "calificación",
        tieSummary: "Ambos productos están muy parejos según las señales de compra disponibles.",
        directWinner: (winner: "A" | "B") => `El producto ${winner} parece la opción más segura según el veredicto, las quejas, la puntuación, el valor y las señales de reseñas generadas por IA.`,
        confidenceWinner: (winner: "A" | "B") => `El producto ${winner} tiene mayor confianza de compra, pero estos productos son diferentes. ReviewIntel compara solo la confianza de compra.`,
        differentTypes: "Se detectaron productos de tipo diferente. ReviewIntel compara solo la confianza de compra.",
        analyzeOne: "← Analizar un producto",
        premiumBadge: "Shopper Premium",
        reviewIntelCompare: "Comparación ReviewIntel",
        compareProductsTitle: "Comparar productos.",
        compareIntro: "Sube dos capturas de productos o pega dos enlaces. ReviewIntel revisa ambos y te dice cuál parece más seguro para comprar.",
        uploadOrPaste: "Subir o pegar enlace",
        uploadScreenshot: "Subir captura del producto",
        uploadHint: "Usa una captura con precio, calificación o detalles del producto.",
        productLinkOptional: "Enlace del producto opcional",
        readyToCompare: "Listo para comparar.",
        addScreenshotOrLink: "Agrega una captura o enlace para continuar.",
        comparing: "Comparando ambos productos...",
        compareButton: "⚡ Comparar productos",
        compareAnother: "Comparar otro par",
        missingInputs: "Agrega una captura o enlace para ambos productos.",
        comparisonFailed: "La comparación falló.",
        productDetailsChecked: "Detalles del producto revisados",
        noConcern: "No se encontró una preocupación importante con las señales disponibles.",
        notDirectlyComparable: "No son directamente comparables",
        whyThisResult: "Por qué este resultado",
        nextSteps: "Próximos pasos",
        decisionSnapshot: "Resumen de decisión",
        confidenceLabel: "Confianza",
        compareType: "Tipo de comparación",
        directCompare: "Sustituto directo",
        buyingConfidenceOnly: "Solo confianza de compra",
        sideBySide: "Análisis lado a lado",
        productA: "Producto A",
        productB: "Producto B",
        edge: "Ventaja",
        buyScore: "Puntuación de compra",
        reviewTrust: "Confianza en reseñas",
        valueLabel: "Valor",
        topConcern: "Principal preocupación",
        bestUse: "Mejor uso",
        scoreGap: "Diferencia de puntuación",
        similar: "Similar",
        stronger: (label: "A" | "B") => `Producto ${label} más fuerte`,
        checkBoth: "Revisar ambos"
      };
    case "zh":
      return {
        ...en,
        verdictLabel: "结论",
        comparisonVerdict: "对比结论",
        tooClose: "差距太小，无法明确判断",
        winner: (winner: "A" | "B") => `胜出：产品 ${winner}`,
        productLabel: (label: "A" | "B") => `产品 ${label}`,
        productPreview: (label: "A" | "B") => `产品 ${label} 预览`,
        ratingLabel: "评分",
        tieSummary: "根据现有购买信号，两个产品非常接近。",
        directWinner: (winner: "A" | "B") => `根据结论、投诉、评分、价值和 AI 生成评论迹象，产品 ${winner} 看起来是更安全的选择。`,
        confidenceWinner: (winner: "A" | "B") => `产品 ${winner} 的购买信心更强，但这些产品类型不同。ReviewIntel 这里只比较购买信心。`,
        differentTypes: "检测到不同产品类型。ReviewIntel 这里只比较购买信心。",
        analyzeOne: "← 分析单个产品",
        premiumBadge: "购物者高级版",
        reviewIntelCompare: "ReviewIntel 对比",
        compareProductsTitle: "对比产品。",
        compareIntro: "上传两个产品截图或粘贴两个产品链接。ReviewIntel 会检查两者，并告诉你哪个看起来更值得购买。",
        uploadOrPaste: "上传或粘贴链接",
        uploadScreenshot: "上传产品截图",
        uploadHint: "请使用包含价格、评分或产品详情的截图。",
        productLinkOptional: "产品链接（可选）",
        readyToCompare: "可以开始对比。",
        addScreenshotOrLink: "添加截图或链接以继续。",
        comparing: "正在对比两个产品...",
        compareButton: "⚡ 对比产品",
        compareAnother: "对比另一组",
        missingInputs: "请为两个产品都添加截图或链接。",
        comparisonFailed: "对比失败。",
        productDetailsChecked: "产品详情已检查",
        noConcern: "根据现有信号，未发现重大问题。",
        notDirectlyComparable: "不能直接比较",
        whyThisResult: "为什么是这个结果",
        nextSteps: "下一步",
        decisionSnapshot: "决策摘要",
        confidenceLabel: "信心",
        compareType: "对比类型",
        directCompare: "直接替代品",
        buyingConfidenceOnly: "仅比较购买信心",
        sideBySide: "并排分析",
        productA: "产品 A",
        productB: "产品 B",
        edge: "优势",
        buyScore: "购买分数",
        reviewTrust: "评论可信度",
        valueLabel: "价值",
        topConcern: "主要担忧",
        bestUse: "最适合",
        scoreGap: "分数差距",
        similar: "相近",
        stronger: (label: "A" | "B") => `产品 ${label} 更强`,
        checkBoth: "两者都检查"
      };
    case "de":
      return {
        ...en,
        verdictLabel: "Urteil",
        comparisonVerdict: "Vergleichsurteil",
        tooClose: "Zu knapp für eine klare Entscheidung",
        winner: (winner: "A" | "B") => `Gewinner: Produkt ${winner}`,
        productLabel: (label: "A" | "B") => `Produkt ${label}`,
        productPreview: (label: "A" | "B") => `Vorschau von Produkt ${label}`,
        ratingLabel: "Bewertung",
        tieSummary: "Beide Produkte liegen anhand der verfügbaren Kaufsignale sehr nah beieinander.",
        directWinner: (winner: "A" | "B") => `Produkt ${winner} wirkt nach Urteil, Beschwerden, Bewertung, Wert und Hinweisen auf KI-generierte Bewertungen wie die sicherere Wahl.`,
        confidenceWinner: (winner: "A" | "B") => `Produkt ${winner} hat eine stärkere Kaufzuversicht, aber die Produkte sind unterschiedlich. ReviewIntel vergleicht hier nur die Kaufzuversicht.`,
        differentTypes: "Unterschiedliche Produkttypen erkannt. ReviewIntel vergleicht hier nur die Kaufzuversicht.",
        analyzeOne: "← Ein Produkt analysieren",
        premiumBadge: "Shopper Premium",
        reviewIntelCompare: "ReviewIntel Vergleich",
        compareProductsTitle: "Produkte vergleichen.",
        compareIntro: "Lade zwei Produkt-Screenshots hoch oder füge zwei Links ein. ReviewIntel prüft beide und zeigt, welches sicherer zu kaufen wirkt.",
        uploadOrPaste: "Hochladen oder Link einfügen",
        uploadScreenshot: "Produkt-Screenshot hochladen",
        uploadHint: "Nutze einen Screenshot mit Preis, Bewertung oder Produktdetails.",
        productLinkOptional: "Produktlink optional",
        readyToCompare: "Bereit zum Vergleichen.",
        addScreenshotOrLink: "Füge einen Screenshot oder Link hinzu, um fortzufahren.",
        comparing: "Beide Produkte werden verglichen...",
        compareButton: "⚡ Produkte vergleichen",
        compareAnother: "Ein weiteres Paar vergleichen",
        missingInputs: "Füge für beide Produkte einen Screenshot oder Link hinzu.",
        comparisonFailed: "Vergleich fehlgeschlagen.",
        productDetailsChecked: "Produktdetails geprüft",
        noConcern: "Keine größeren Bedenken aus den verfügbaren Signalen gefunden.",
        notDirectlyComparable: "Nicht direkt vergleichbar",
        whyThisResult: "Warum dieses Ergebnis",
        nextSteps: "Nächste Schritte",
        decisionSnapshot: "Entscheidungsübersicht",
        confidenceLabel: "Sicherheit",
        compareType: "Vergleichstyp",
        directCompare: "Direkter Ersatz",
        buyingConfidenceOnly: "Nur Kaufzuversicht",
        sideBySide: "Direkter Vergleich",
        productA: "Produkt A",
        productB: "Produkt B",
        edge: "Vorteil",
        buyScore: "Kaufscore",
        reviewTrust: "Bewertungsvertrauen",
        valueLabel: "Wert",
        topConcern: "Hauptbedenken",
        bestUse: "Bester Einsatz",
        scoreGap: "Score-Abstand",
        similar: "Ähnlich",
        stronger: (label: "A" | "B") => `Produkt ${label} stärker`,
        checkBoth: "Beide prüfen"
      };
    case "hi":
      return {
        ...en,
        verdictLabel: "निर्णय",
        comparisonVerdict: "तुलना निर्णय",
        tooClose: "निर्णय के लिए बहुत करीब",
        winner: (winner: "A" | "B") => `विजेता: उत्पाद ${winner}`,
        productLabel: (label: "A" | "B") => `उत्पाद ${label}`,
        productPreview: (label: "A" | "B") => `उत्पाद ${label} preview`,
        ratingLabel: "रेटिंग",
        tieSummary: "उपलब्ध खरीद संकेतों के आधार पर दोनों उत्पाद बहुत करीब हैं।",
        directWinner: (winner: "A" | "B") => `निर्णय, शिकायतों, स्कोर, मूल्य और AI-generated review संकेतों के आधार पर उत्पाद ${winner} अधिक सुरक्षित विकल्प लगता है।`,
        confidenceWinner: (winner: "A" | "B") => `उत्पाद ${winner} में खरीद भरोसा अधिक है, लेकिन ये अलग प्रकार के उत्पाद हैं। ReviewIntel केवल खरीद भरोसे की तुलना कर रहा है।`,
        differentTypes: "अलग product types मिले हैं। ReviewIntel केवल buying confidence की तुलना कर रहा है।",
        analyzeOne: "← एक उत्पाद analyze करें",
        premiumBadge: "Shopper Premium",
        reviewIntelCompare: "ReviewIntel तुलना",
        compareProductsTitle: "उत्पादों की तुलना करें।",
        compareIntro: "दो product screenshots upload करें या दो links paste करें। ReviewIntel दोनों को check करके बताता है कौन सा खरीदने के लिए safer लगता है।",
        uploadOrPaste: "Upload करें या link paste करें",
        uploadScreenshot: "उत्पाद screenshot upload करें",
        uploadHint: "Price, rating या product details वाला screenshot इस्तेमाल करें।",
        productLinkOptional: "Product link optional",
        readyToCompare: "Compare करने के लिए ready.",
        addScreenshotOrLink: "जारी रखने के लिए screenshot या link जोड़ें।",
        comparing: "दोनों products compare हो रहे हैं...",
        compareButton: "⚡ Products compare करें",
        compareAnother: "एक और pair compare करें",
        missingInputs: "दोनों products के लिए screenshot या link जोड़ें।",
        comparisonFailed: "Comparison failed.",
        productDetailsChecked: "Product details checked",
        noConcern: "Available signals से कोई major concern नहीं मिला।",
        notDirectlyComparable: "सीधे तुलना योग्य नहीं",
        whyThisResult: "यह result क्यों",
        nextSteps: "Next steps",
        decisionSnapshot: "Decision snapshot",
        confidenceLabel: "Confidence",
        compareType: "Compare type",
        directCompare: "Direct substitute",
        buyingConfidenceOnly: "Buying confidence only",
        sideBySide: "Side-by-side analysis",
        productA: "Product A",
        productB: "Product B",
        edge: "Edge",
        buyScore: "Buy score",
        reviewTrust: "Review trust",
        valueLabel: "Value",
        topConcern: "Top concern",
        bestUse: "Best use",
        scoreGap: "Score gap",
        similar: "Similar",
        stronger: (label: "A" | "B") => `Product ${label} stronger`,
        checkBoth: "Check both"
      };
    default:
      return en;
  }
}


function verdictRank(verdict: Verdict) {
  if (verdict === "BUY") return 3;
  if (verdict === "CONSIDER") return 2;
  return 1;
}



function compareProductName(result: unknown, fallback: string) {
  const record = (result || {}) as Record<string, unknown>;
  const product = (record.product || {}) as Record<string, unknown>;

  const name =
    product.title ||
    product.name ||
    record.productName ||
    record.title ||
    record.name ||
    record.fileName ||
    fallback;

  return String(name);
}

function compareDisplayTitle(productA: unknown, productB: unknown) {
  return `Compare: ${compareProductName(productA, "Product A")} vs ${compareProductName(productB, "Product B")}`;
}


function winnerLetter(value: "A" | "B" | "TIE" | null): "A" | "B" | null {
  return value === "A" || value === "B" ? value : null;
}

function pickWinner(a: AnalyzeResult | null, b: AnalyzeResult | null) {
  if (!a || !b) return null;

  const aRank = verdictRank(a.verdict);
  const bRank = verdictRank(b.verdict);

  if (aRank > bRank) return "A";
  if (bRank > aRank) return "B";

  const aRisk = a.reviewAuthenticity?.score ?? 0;
  const bRisk = b.reviewAuthenticity?.score ?? 0;

  const aScore = (a.productScore || 0) - aRisk * 0.35 - (a.topComplaints?.length || 0) * 2;
  const bScore = (b.productScore || 0) - bRisk * 0.35 - (b.topComplaints?.length || 0) * 2;

  if (Math.abs(aScore - bScore) < 3) return "TIE";
  return aScore > bScore ? "A" : "B";
}

function verdictClass(verdict: Verdict) {
  if (verdict === "BUY") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  if (verdict === "CONSIDER") return "border-amber-300 bg-amber-50 text-amber-950";
  return "border-rose-300 bg-rose-50 text-rose-950";
}

function rawProductTitle(result: AnalyzeResult | null, fallback: string) {
  if (!result) return fallback;
  return result.product?.name || result.product?.brand || fallback;
}

function productTitle(result: AnalyzeResult | null, fallback: string) {
  return shortProductName(rawProductTitle(result, fallback), fallback);
}

function SideInput({
  side,
  disabled,
  onChangeFile,
  onChangeLink
}: {
  side: CompareSide;
  disabled: boolean;
  onChangeFile: (file: File | null) => void;
  onChangeLink: (value: string) => void;
}) {
  const hasInput = Boolean(side.file || side.link.trim());

  return (
    <div className="w-full rounded-[1.75rem] border border-line bg-white p-4 shadow-soft sm:rounded-[2rem] sm:p-5 dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-teal dark:text-cyan-200">{displayCodeForResult({ productName: `Product ${side.label}` }, `Product ${side.label}`)}</p>
          <h2 className="mt-1 text-xl font-black text-ink sm:text-2xl dark:text-ink">{compareCopy(readStoredLocale()).uploadOrPaste}</h2>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal text-base font-black text-white shadow-soft sm:text-lg">
          {side.label}
        </div>
      </div>

      <label className="group flex min-h-[220px] w-full cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-teal/40 bg-white p-5 text-center transition hover:border-teal hover:bg-teal/5">
        {side.preview ? (
          <img src={side.preview} alt={compareCopy(readStoredLocale()).productPreview(side.label)} className="max-h-[190px] rounded-2xl object-contain" />
        ) : (
          <>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-teal text-2xl text-white shadow-soft sm:text-3xl">📸</div>
            <p className="text-base font-black text-ink sm:text-lg dark:text-ink">{compareCopy(readStoredLocale()).uploadScreenshot}</p>
            <p className="mt-2 max-w-xs text-xs font-semibold text-slate-700 sm:text-sm dark:text-slate-700">{compareCopy(readStoredLocale()).uploadHint}</p>
          </>
        )}

        <input
          className="hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled}
          onChange={(event) => onChangeFile(event.target.files?.[0] || null)}
        />
      </label>

      <div className="mt-4">
        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 sm:text-xs sm:tracking-[0.2em]">{compareCopy(readStoredLocale()).productLinkOptional}</label>
        <input
          value={side.link}
          disabled={disabled}
          onChange={(event) => onChangeLink(event.target.value)}
          placeholder="https://..."
          className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink shadow-soft dark:border-white/10 dark:bg-slate-900 dark:text-ink outline-none transition placeholder:text-slate-700 focus:border-teal"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-700 dark:text-slate-100">
        {hasInput ? compareCopy(readStoredLocale()).readyToCompare : compareCopy(readStoredLocale()).addScreenshotOrLink}
      </div>
    </div>
  );
}


type CompareToolProofRecord = Record<string, unknown>;

function isCompareToolProofRecord(value: unknown): value is CompareToolProofRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function proofRecord(source: CompareToolProofRecord | null, key: string): CompareToolProofRecord | null {
  if (!source) return null;
  const value = source[key];
  return isCompareToolProofRecord(value) ? value : null;
}

function proofString(source: CompareToolProofRecord | null, key: string): string {
  if (!source) return "";
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function proofNumber(source: CompareToolProofRecord | null, key: string): number | null {
  if (!source) return null;
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function proofArray(source: CompareToolProofRecord | null, key: string): unknown[] {
  if (!source) return [];
  const value = source[key];
  return Array.isArray(value) ? value : [];
}

function proofProductName(result: AnalyzeResult, fallback: string) {
  const product = isCompareToolProofRecord(result.product) ? result.product : null;
  return (
    proofString(product, "title") ||
    proofString(product, "name") ||
    proofString(product, "productName") ||
    fallback
  );
}

function getCompareProof(result: AnalyzeResult) {
  const raw = result as unknown as CompareToolProofRecord;
  const analysis = proofRecord(raw, "analysis");

  const productIdentity =
    proofRecord(raw, "productIdentity") ||
    proofRecord(analysis, "productIdentity");

  const reviewEvidence =
    proofRecord(raw, "reviewEvidence") ||
    proofRecord(analysis, "reviewEvidence");

  const listingEvidence = proofRecord(reviewEvidence, "listingEvidence");

  const reviewAuthenticity =
    proofRecord(raw, "reviewAuthenticity") ||
    proofRecord(reviewEvidence, "reviewAuthenticity") ||
    proofRecord(analysis, "reviewAuthenticity");

  const stableKey =
    proofString(raw, "stableProductKey") ||
    proofString(raw, "productKey") ||
    proofString(analysis, "stableProductKey") ||
    proofString(analysis, "productKey");

  return {
    stableKey,
    store: proofString(productIdentity, "store") || proofString(listingEvidence, "store"),
    brand: proofString(productIdentity, "brand"),
    price: proofNumber(productIdentity, "price") ?? proofNumber(listingEvidence, "price"),
    rating: proofNumber(productIdentity, "rating") ?? proofNumber(listingEvidence, "rating"),
    reviewCount: proofNumber(productIdentity, "reviewCount") ?? proofNumber(listingEvidence, "reviewCount"),
    sourcesChecked: proofArray(reviewEvidence, "sourcesChecked"),
    commentsAnalyzed: proofNumber(reviewEvidence, "commentsAnalyzed") ?? proofNumber(reviewEvidence, "reviewsFound"),
    evidenceStrength: proofString(reviewEvidence, "evidenceStrength"),
    exactListingConfidence: proofString(listingEvidence, "confidence"),
    aiLikeRisk: proofNumber(reviewAuthenticity, "score"),
  };
}

function CompareProofPill({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "Not found" : String(value);

  return (
    <div className="rounded-2xl border border-line bg-white/80 p-3 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500/70">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-ink dark:text-white">{display}</p>
    </div>
  );
}

function ProductCompareToolProof({ label, result }: { label: string; result: AnalyzeResult }) {
  const proof = getCompareProof(result);

  return (
    <div className="rounded-3xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-300/20 dark:bg-sky-300/10">
      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600 dark:text-sky-200">
        {label} tool proof
      </p>
      <h3 className="mt-1 text-lg font-black text-ink dark:text-white">
        {proofProductName(result, label)}
      </h3>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <CompareProofPill label="Store" value={proof.store || "Not confirmed"} />
        <CompareProofPill label="Brand" value={proof.brand || "Not confirmed"} />
        <CompareProofPill label="Price" value={proof.price !== null ? `$${proof.price}` : null} />
        <CompareProofPill label="Rating" value={proof.rating !== null ? `${proof.rating}/5` : null} />
        <CompareProofPill label="Review count" value={proof.reviewCount} />
        <CompareProofPill label="Sources checked" value={proof.sourcesChecked.length} />
        <CompareProofPill label="Comments analyzed" value={proof.commentsAnalyzed} />
        <CompareProofPill label="Evidence strength" value={proof.evidenceStrength || "Not enough"} />
        <CompareProofPill label="Exact listing" value={proof.exactListingConfidence || "Not confirmed"} />
        <CompareProofPill label="AI-like risk" value={proof.aiLikeRisk !== null ? `${proof.aiLikeRisk}%` : "Not scored"} />
        <CompareProofPill label="Memory" value={proof.stableKey ? "Saved/merged" : "New/unknown"} />
        <CompareProofPill label="Stable key" value={proof.stableKey ? "Matched" : "Not matched"} />
      </div>

      {proof.sourcesChecked.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Sources checked</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {proof.sourcesChecked.slice(0, 6).map((source, index) => (
              <span
                key={`${String(source)}-${index}`}
                className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-black text-sky-700 dark:border-sky-300/20 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-sky-200"
              >
                {String(source).slice(0, 40)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ShopperCompareToolProof({ productA, productB }: { productA: AnalyzeResult; productB: AnalyzeResult }) {
  const a = getCompareProof(productA);
  const b = getCompareProof(productB);

  const aEvidenceScore = a.sourcesChecked.length * 3 + (a.commentsAnalyzed || 0) + (a.reviewCount || 0) / 100;
  const bEvidenceScore = b.sourcesChecked.length * 3 + (b.commentsAnalyzed || 0) + (b.reviewCount || 0) / 100;

  const evidenceAdvantage =
    Math.abs(aEvidenceScore - bEvidenceScore) < 2
      ? "Both products have similar review evidence."
      : aEvidenceScore > bEvidenceScore
        ? "Product A has stronger review evidence."
        : "Product B has stronger review evidence.";

  return (
    <section className="rounded-[2rem] border border-sky-200 bg-white p-4 shadow-soft dark:border-sky-300/20 dark:bg-gradient-to-r from-sky-600 to-teal-500 sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-600 dark:text-sky-200">
          AI tool proof
        </p>
        <h2 className="mt-1 text-xl font-black text-ink dark:text-white">
          What ReviewIntel checked for this comparison
        </h2>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-600 dark:text-slate-300">
          Compare uses product memory, exact listing search, and review evidence for both products before deciding.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProductCompareToolProof label="Product A" result={productA} />
        <ProductCompareToolProof label="Product B" result={productB} />
      </div>

      <p className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-black text-sky-800 dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100">
        {evidenceAdvantage}
      </p>
    </section>
  );
}


function ResultCard({ label, result, winner }: { label: "A" | "B"; result: AnalyzeResult; winner: boolean }) {
  return (
    <div
      className={`compare-readable-card rounded-[2rem] border p-5 shadow-soft ${
        winner
          ? "border-teal bg-teal-50 ring-2 ring-teal/20"
          : "border-line bg-white"
      } dark:border-white/10 dark:bg-slate-900`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-700">{compareCopy(readStoredLocale()).productLabel(label)}</p>
          <h3 className="mt-1 text-xl font-black text-ink dark:text-ink">{productTitle(result, compareCopy(readStoredLocale()).productLabel(label))}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-700 sm:text-sm dark:text-slate-700">
            {[result.product?.store, result.product?.price, result.product?.rating ? `${result.product.rating} ${compareCopy(readStoredLocale()).ratingLabel}` : ""]
              .filter(Boolean)
              .join(" • ") || compareCopy(readStoredLocale()).productDetailsChecked}
          </p>
        </div>

        {winner && (
          <span className="rounded-full bg-cyan-300 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-950">
            {compareCopy(readStoredLocale()).stronger(label)}
          </span>
        )}
      </div>

      <div className={`mb-4 rounded-2xl border px-4 py-4 text-center ${verdictClass(result.verdict)}`}>
        <p className="text-xs font-black uppercase tracking-[0.24em] opacity-80">{compareCopy(readStoredLocale()).verdictLabel}</p>
        <p className="mt-1 text-3xl font-black">{result.verdict}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900">
          <p className="text-xs text-slate-700">{compareCopy(readStoredLocale()).buyScore}</p>
          <p className="mt-1 text-xl font-black text-ink sm:text-2xl dark:text-ink">{Math.round(result.productScore || 0)}/100</p>
        </div>
        <div className="rounded-2xl border border-line bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900">
          <p className="text-xs text-slate-700">{compareCopy(readStoredLocale()).reviewTrust}</p>
          <p className="mt-1 text-xl font-black text-ink sm:text-2xl dark:text-ink">{Math.round(result.reviewAuthenticity?.score || 0)}% signs</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">{compareCopy(readStoredLocale()).topConcern}</p>
        <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-100">
          {(result.topComplaints || []).slice(0, 3).map((item, index) => (
            <li key={index} className="rounded-xl bg-slate-50 px-3 py-2 text-slate-700 dark:bg-white dark:text-slate-100">• {item}</li>
          ))}
          {!result.topComplaints?.length && <li className="rounded-xl bg-slate-50 px-3 py-2 text-slate-700 dark:bg-white dark:text-slate-100">{compareCopy(readStoredLocale()).noConcern}</li>}
        </ul>
      </div>

      <p className="mt-4 rounded-2xl border border-line bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-100">{result.bottomLine}</p>
    </div>
  );
}


function comparisonSearchText(result: AnalyzeResult) {
  const product = result.product || {};
  return [
    product.name,
    product.brand,
    product.category,
    product.store,
    product.price,
    product.rating,
    product.reviewCount,
    result.valueForMoney,
    result.bottomLine,
    ...(result.topStrengths || []),
    ...(result.topComplaints || []),
    ...(result.bestFor || []),
    ...(result.notIdealFor || []),
    ...(result.sourcesUsed || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const productCategoryRules = [
  { id: "battery_power", keywords: ["power bank", "power station", "portable power", "solar generator", "lifepo4", "battery pack", "mah", "wh", "ac output", "inverter"] },
  { id: "solar_panel", keywords: ["solar panel", "photovoltaic", "solar charger", "watt panel", "sunlight"] },
  { id: "audio", keywords: ["headphone", "headphones", "earbud", "earbuds", "speaker", "soundbar", "microphone", "noise cancelling"] },
  { id: "phone", keywords: ["smartphone", "mobile phone", "iphone", "android phone", "galaxy phone", "pixel phone"] },
  { id: "phone_accessory", keywords: ["phone case", "screen protector", "magsafe case", "wallet case", "camera lens protector"] },
  { id: "charger", keywords: ["wall charger", "usb-c charger", "charging cable", "wireless charger", "charging pad", "power adapter"] },
  { id: "computer", keywords: ["laptop", "notebook computer", "chromebook", "macbook", "desktop pc", "mini pc"] },
  { id: "tablet", keywords: ["tablet", "ipad", "galaxy tab", "kindle"] },
  { id: "display", keywords: ["monitor", "television", "tv", "projector", "display"] },
  { id: "camera", keywords: ["camera", "webcam", "dash cam", "security camera", "lens"] },
  { id: "kitchen", keywords: ["air fryer", "blender", "coffee maker", "espresso", "toaster", "rice cooker", "kettle", "mixer"] },
  { id: "home_appliance", keywords: ["vacuum", "fan", "heater", "humidifier", "air purifier", "dehumidifier", "mop"] },
  { id: "beauty", keywords: ["serum", "skin", "skincare", "hair", "makeup", "cream", "shampoo", "conditioner"] },
  { id: "clothing", keywords: ["shirt", "dress", "jacket", "pants", "jeans", "hoodie", "sweater", "coat"] },
  { id: "footwear", keywords: ["shoes", "sneaker", "boots", "sandals", "slippers"] },
  { id: "toy", keywords: ["toy", "lego", "puzzle", "doll", "remote control car"] },
  { id: "pet", keywords: ["dog", "cat", "pet", "litter", "leash", "aquarium"] },
  { id: "fitness", keywords: ["treadmill", "dumbbell", "exercise", "fitness", "yoga", "bike trainer"] },
  { id: "automotive", keywords: ["car", "truck", "automotive", "tire", "jump starter", "dashcam"] },
  { id: "furniture", keywords: ["chair", "desk", "sofa", "mattress", "bed frame", "table"] },
  { id: "tool", keywords: ["drill", "saw", "tool", "wrench", "screwdriver", "work light"] },
  { id: "baby", keywords: ["baby", "stroller", "crib", "diaper", "car seat"] }
] as const;

function productComparisonCategory(result: AnalyzeResult) {
  const allText = comparisonSearchText(result);
  return productCategoryRules.find((rule) => rule.keywords.some((keyword) => allText.includes(keyword)))?.id || "unknown";
}

const compareStopWords = new Set([
  "with",
  "from",
  "that",
  "this",
  "your",
  "product",
  "portable",
  "include",
  "included",
  "without",
  "review",
  "reviews",
  "amazon",
  "walmart",
  "best",
  "good",
  "high",
  "seller",
  "shopper",
  "pack",
  "black",
  "white"
]);

function importantTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !compareStopWords.has(token) && !/^\d+$/.test(token));
}

function tokenOverlapCount(a: string[], b: string[]) {
  const bSet = new Set(b);
  return new Set(a.filter((token) => bSet.has(token))).size;
}

function areLikelyDirectSubstitutes(a: AnalyzeResult, b: AnalyzeResult) {
  const aCategory = productComparisonCategory(a);
  const bCategory = productComparisonCategory(b);

  if (aCategory !== "unknown" && bCategory !== "unknown") {
    return aCategory === bCategory;
  }

  const aProductCategory = String(a.product?.category || "").trim().toLowerCase();
  const bProductCategory = String(b.product?.category || "").trim().toLowerCase();
  if (aProductCategory && bProductCategory && aProductCategory === bProductCategory) return true;

  const titleOverlap = tokenOverlapCount(
    importantTokens(rawProductTitle(a, "")),
    importantTokens(rawProductTitle(b, ""))
  );
  const evidenceOverlap = tokenOverlapCount(
    importantTokens(comparisonSearchText(a)),
    importantTokens(comparisonSearchText(b))
  );

  return titleOverlap >= 2 || evidenceOverlap >= 4;
}

function firstSignal(items: string[] | undefined, fallback: string) {
  return (items || []).map((item) => String(item || "").trim()).find(Boolean) || fallback;
}

function weightedBuyingScore(result: AnalyzeResult) {
  const score = Number(result.productScore || 0);
  const risk = Number(result.reviewAuthenticity?.score || 0);
  const complaintPenalty = Math.min(15, (result.topComplaints?.length || 0) * 2.5);
  const strengthLift = Math.min(8, (result.topStrengths?.length || 0) * 1.5);
  const verdictLift = verdictRank(result.verdict) * 4;

  return score - risk * 0.22 - complaintPenalty + strengthLift + verdictLift;
}

function pickFallbackWinner(productA: AnalyzeResult, productB: AnalyzeResult): "A" | "B" | "TIE" {
  const aScore = weightedBuyingScore(productA);
  const bScore = weightedBuyingScore(productB);
  if (Math.abs(aScore - bScore) < 4) return "TIE";
  return aScore > bScore ? "A" : "B";
}

type CompareEdge = "A" | "B" | "TIE";

function metricEdge(aValue: number, bValue: number, higherIsBetter = true, threshold = 3): CompareEdge {
  const gap = higherIsBetter ? aValue - bValue : bValue - aValue;
  if (Math.abs(gap) < threshold) return "TIE";
  return gap > 0 ? "A" : "B";
}

function edgeText(edge: CompareEdge, copy: ReturnType<typeof compareCopy>) {
  if (edge === "A" || edge === "B") return copy.stronger(edge);
  return copy.similar;
}

function localComparison(productA: AnalyzeResult, productB: AnalyzeResult, copy: ReturnType<typeof compareCopy>): ShopperComparison {
  const directSubstitutes = areLikelyDirectSubstitutes(productA, productB);
  const picked = directSubstitutes ? pickFallbackWinner(productA, productB) : "INCOMPARABLE";
  const winner: ShopperComparison["winner"] = picked || "TIE";
  const aRisk = Math.round(productA.reviewAuthenticity?.score || 0);
  const bRisk = Math.round(productB.reviewAuthenticity?.score || 0);
  const aName = productTitle(productA, copy.productA);
  const bName = productTitle(productB, copy.productB);
  const scoreGap = Math.abs(weightedBuyingScore(productA) - weightedBuyingScore(productB));
  const confidence = directSubstitutes
    ? Math.max(58, Math.min(94, Math.round(60 + scoreGap * 1.4 + Math.abs(aRisk - bRisk) * 0.18)))
    : 88;

  return {
    winner,
    directSubstitutes,
    confidence,
    verdictHeadline:
      winner === "INCOMPARABLE"
        ? copy.notDirectlyComparable
        : winner === "A" || winner === "B"
          ? copy.winner(winner)
          : copy.tooClose,
    summary:
      winner === "INCOMPARABLE"
        ? copy.differentTypes
        : winner === "A" || winner === "B"
          ? `${winner === "A" ? aName : bName} has the stronger combined buying signal after score, verdict, complaints, value, and review-trust checks.`
          : copy.tieSummary,
    reasons: directSubstitutes
      ? [
          `${aName} scores ${Math.round(productA.productScore || 0)}/100 with verdict ${productA.verdict}; ${bName} scores ${Math.round(productB.productScore || 0)}/100 with verdict ${productB.verdict}.`,
          `Review trust check: ${aName} shows ${aRisk}% AI-like review signs while ${bName} shows ${bRisk}%.`,
          `Concern contrast: ${aName} has ${firstSignal(productA.topComplaints, "no major repeated concern")}; ${bName} has ${firstSignal(productB.topComplaints, "no major repeated concern")}.`,
          `Use-case fit: ${aName} is best for ${firstSignal(productA.bestFor, "general shoppers")}; ${bName} is best for ${firstSignal(productB.bestFor, "general shoppers")}.`
        ]
      : [
          `${aName} and ${bName} appear to solve different shopping jobs, so a forced winner would be misleading.`,
          `Compare ${aName} against another ${productComparisonCategory(productA).replace(/_/g, " ")} option and ${bName} against another ${productComparisonCategory(productB).replace(/_/g, " ")} option.`,
          `You can still use the individual scores to judge risk, but not as a direct substitute decision.`
        ],
    nextSteps: directSubstitutes
      ? [
          "Check the latest reviews, return policy, warranty, and exact model before checkout.",
          "Choose the product that fits your real use case, not only the higher headline score.",
          "If the score gap is small, compare recent one-star reviews before buying."
        ]
      : [
          "Decide the job you need the product to do before choosing.",
          "Run a second comparison using two products in the same category.",
          "Use each individual scan to understand risk, value, and review trust separately."
        ],
  };
}

function ComparisonScorecard({
  productA,
  productB,
  comparison,
  copy
}: {
  productA: AnalyzeResult;
  productB: AnalyzeResult;
  comparison: ShopperComparison | null;
  copy: ReturnType<typeof compareCopy>;
}) {
  const aRisk = Math.round(productA.reviewAuthenticity?.score || 0);
  const bRisk = Math.round(productB.reviewAuthenticity?.score || 0);
  const aScore = Math.round(productA.productScore || 0);
  const bScore = Math.round(productB.productScore || 0);
  const winner = comparison?.winner || pickFallbackWinner(productA, productB);
  const directSubstitutes = comparison?.directSubstitutes ?? areLikelyDirectSubstitutes(productA, productB);
  const winnerEdge: CompareEdge = winner === "A" || winner === "B" ? winner : "TIE";

  const rows: Array<{ label: string; a: string; b: string; edge: CompareEdge }> = [
    {
      label: copy.buyScore,
      a: `${aScore}/100`,
      b: `${bScore}/100`,
      edge: metricEdge(aScore, bScore, true, 4)
    },
    {
      label: copy.verdictLabel,
      a: productA.verdict,
      b: productB.verdict,
      edge: metricEdge(verdictRank(productA.verdict), verdictRank(productB.verdict), true, 1)
    },
    {
      label: copy.reviewTrust,
      a: `${Math.max(0, 100 - aRisk)}%`,
      b: `${Math.max(0, 100 - bRisk)}%`,
      edge: metricEdge(aRisk, bRisk, false, 5)
    },
    {
      label: copy.valueLabel,
      a: productA.valueForMoney || copy.checkBoth,
      b: productB.valueForMoney || copy.checkBoth,
      edge: directSubstitutes ? winnerEdge : "TIE"
    },
    {
      label: copy.topConcern,
      a: shortProductName(firstSignal(productA.topComplaints, copy.noConcern), copy.noConcern),
      b: shortProductName(firstSignal(productB.topComplaints, copy.noConcern), copy.noConcern),
      edge: directSubstitutes ? winnerEdge : "TIE"
    },
    {
      label: copy.bestUse,
      a: shortProductName(firstSignal(productA.bestFor, copy.checkBoth), copy.checkBoth),
      b: shortProductName(firstSignal(productB.bestFor, copy.checkBoth), copy.checkBoth),
      edge: "TIE" as const
    }
  ];

  return (
    <div className="shopper-compare-scorecard mt-5 rounded-[1.6rem] border border-line bg-white p-4 text-left shadow-soft dark:border-white/10 dark:bg-white/5 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal">{copy.sideBySide}</p>
          <h3 className="mt-1 text-xl font-black text-ink dark:text-white">{shortCompareTitle(compareDisplayTitle(productA, productB))}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 dark:bg-white/10 dark:text-slate-100">
          {directSubstitutes ? copy.directCompare : copy.buyingConfidenceOnly}
        </span>
      </div>

      <div className="shopper-compare-matrix overflow-hidden rounded-2xl border border-line dark:border-white/10">
        <div className="shopper-compare-row shopper-compare-head grid grid-cols-[0.82fr_1fr_1fr_0.82fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:bg-white/5 dark:text-slate-300">
          <span>{copy.sideBySide}</span>
          <span>{copy.productA}</span>
          <span>{copy.productB}</span>
          <span>{copy.edge}</span>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="shopper-compare-row grid grid-cols-[0.82fr_1fr_1fr_0.82fr] gap-3 border-t border-line px-4 py-3 text-sm dark:border-white/10">
            <p className="font-black text-slate-500 dark:text-slate-300">{row.label}</p>
            <p className="font-black text-ink dark:text-white">{row.a}</p>
            <p className="font-black text-ink dark:text-white">{row.b}</p>
            <p className={row.edge === "TIE" ? "font-black text-slate-500 dark:text-slate-300" : "font-black text-teal"}>
              {edgeText(row.edge, copy)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

async function compareProductsWithAi(productA: AnalyzeResult, productB: AnalyzeResult, locale: string) {
  const response = await fetch("/api/shopper-compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productA, productB, locale }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "AI comparison failed.");
  }

  return data as ShopperComparison;
}


export 
const COMPARE_PROGRESS_STEPS = [
  "Identifying both products",
  "Creating stable product keys",
  "Finding exact listings",
  "Reading review evidence for Product A",
  "Reading review evidence for Product B",
  "Checking AI-like review patterns",
  "Comparing buyer confidence",
];

function CompareProgressSteps() {
  return (
    <div className="rounded-[2rem] border border-sky-200 bg-sky-50/80 p-4 shadow-soft dark:border-sky-300/20 dark:bg-sky-300/10 sm:p-5">
      <div className="mb-4">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600 dark:text-sky-200">
          Compare tools working
        </p>
        <h3 className="mt-1 text-lg font-black text-ink dark:text-white">
          ReviewIntel is checking both products before comparing
        </h3>

        <CompareProgressSteps />
      </div>

      <div className="space-y-3">
        {COMPARE_PROGRESS_STEPS.map((step, index) => (
          <div key={step} className="flex items-center gap-3 rounded-2xl bg-white/80 p-3 dark:bg-gradient-to-r from-sky-600 to-teal-500/60">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-black text-white dark:bg-sky-300 dark:text-slate-950">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-ink dark:text-white">{step}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100 dark:bg-slate-800">
                <div
                  className="h-full animate-pulse rounded-full bg-sky-500 dark:bg-sky-300"
                  style={{ width: `${Math.min(100, 20 + index * 12)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">
        Compare should use product memory, exact listing search, and review evidence for both products.
      </p>
    </div>
  );
}


export function CompareForm() {
  const locale = readStoredLocale();
  const copy = compareCopy(locale);
  const [productA, setProductA] = useState<CompareSide>(emptySide("A"));
  const [productB, setProductB] = useState<CompareSide>(emptySide("B"));
  const [comparison, setComparison] = useState<ShopperComparison | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const winner = useMemo(() => {
    if (comparison?.winner === "INCOMPARABLE") return "TIE";
    if (comparison?.winner) return comparison.winner;
    return pickWinner(productA.result, productB.result);
  }, [comparison, productA.result, productB.result]);

  const directSubstitutes = useMemo(() => {
    if (comparison) return comparison.directSubstitutes;
    if (!productA.result || !productB.result) return true;
    return areLikelyDirectSubstitutes(productA.result, productB.result);
  }, [comparison, productA.result, productB.result]);

  const canCompare = Boolean((productA.file || productA.link.trim()) && (productB.file || productB.link.trim()));

  function setFile(label: "A" | "B", file: File | null) {
    const preview = file ? URL.createObjectURL(file) : "";
    setComparison(null);
    if (label === "A") setProductA((current) => ({ ...current, file, preview, result: null }));
    if (label === "B") setProductB((current) => ({ ...current, file, preview, result: null }));
  }

  function setLink(label: "A" | "B", link: string) {
    setComparison(null);
    if (label === "A") setProductA((current) => ({ ...current, link, result: null }));
    if (label === "B") setProductB((current) => ({ ...current, link, result: null }));
  }

  async function analyzeSide(side: CompareSide) {
    const formData = new FormData();

    if (side.file) formData.append("image", side.file);
    if (side.link.trim()) formData.append("productLink", side.link.trim());
    formData.append("locale", readStoredLocale());

    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `${displayCodeForResult({ productName: `Product ${side.label}` }, `Product ${side.label}`)} failed to analyze.`);
    }

    return data as AnalyzeResult;
  }

  async function compareProducts() {
    if (!canCompare) {
      setError(copy.missingInputs);
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const [resultA, resultB] = await Promise.all([analyzeSide(productA), analyzeSide(productB)]);
      const createdAt = new Date().toISOString();
      let comparisonNow: ShopperComparison;

      try {
        comparisonNow = await compareProductsWithAi(resultA, resultB, locale);
      } catch (comparisonError) {
        console.warn("AI shopper comparison failed; using scan-grounded fallback", comparisonError);
        comparisonNow = localComparison(resultA, resultB, copy);
      }

      const directSubstitutesNow = comparisonNow.directSubstitutes;
      const account = getClientAccount();

      const resultARecord = resultA as unknown as Record<string, unknown>;
      const resultBRecord = resultB as unknown as Record<string, unknown>;
      const scoreA = Number(
        resultARecord.score ||
          resultARecord.productScore ||
          resultARecord.confidenceScore ||
          resultARecord.rating ||
          0
      );
      const scoreB = Number(
        resultBRecord.score ||
          resultBRecord.productScore ||
          resultBRecord.confidenceScore ||
          resultBRecord.rating ||
          0
      );

      const compareTitle = shortCompareTitle(compareDisplayTitle(resultA, resultB));

      const compareHistoryResult = {
        type: "compare",
        mode: "shopper-premium-compare",
        title: compareTitle,
        fileName: compareTitle,
        productName: compareTitle,
        compareId: displayCodeForResult({ type: "compare", productA: resultA, productB: resultB, createdAt }, compareTitle),
        savedAt: createdAt,
        createdAt,
        locale,
        winner: comparisonNow.winner,
        directSubstitutes: directSubstitutesNow,
        comparison: comparisonNow,
        productA: resultA,
        productB: resultB,
        score: Math.max(scoreA, scoreB),
        verdict: comparisonNow.verdictHeadline,
        summary: comparisonNow.summary,
      };

      const compareHistoryPayload = compareHistoryResult as unknown as Parameters<typeof saveLatestResult>[0];

      saveLatestResult(compareHistoryPayload, account);
      await saveShopperCompareToServerHistory(compareHistoryResult as unknown as Record<string, unknown>, account);
      incrementStoredScanTally();

      setComparison(comparisonNow);
      setProductA((current) => ({ ...current, result: resultA }));
      setProductB((current) => ({ ...current, result: resultB }));
    } catch (error) {
      setError(error instanceof Error ? error.message : copy.comparisonFailed);
    } finally {
      setIsLoading(false);
    }
  }

  const showResults = productA.result && productB.result;
  const scoreGap = showResults
    ? Math.abs(Math.round(productA.result!.productScore || 0) - Math.round(productB.result!.productScore || 0))
    : 0;
  const confidenceValue = comparison?.confidence ?? (directSubstitutes ? Math.min(92, 62 + scoreGap) : 88);

  return (
    <main className="min-h-screen bg-paper px-3 py-4 text-ink sm:px-6 sm:py-8 lg:px-8 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/analyze" className="rounded-full border border-line bg-white px-3 py-2 text-xs font-bold text-ink shadow-soft transition hover:border-teal dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-ink sm:px-4 sm:text-sm">
            ← Analyze One Product
          </Link>
          <span className="rounded-full border border-line bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-teal shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-cyan-200 sm:px-4 sm:text-xs sm:tracking-[0.2em]">
            Shopper Premium
          </span>
        </div>

        {!showResults && (
        <section className="rounded-[1.75rem] border border-line bg-white p-4 shadow-soft sm:rounded-[2.5rem] sm:p-10 dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-teal sm:text-sm sm:tracking-[0.3em] dark:text-cyan-200">{copy.reviewIntelCompare}</p>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-6xl dark:text-ink">
            {copy.compareProductsTitle}
          </h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-slate-700 sm:text-lg dark:text-slate-700">
            {copy.compareIntro}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-5">
            <SideInput
              side={productA}
              disabled={isLoading}
              onChangeFile={(file) => setFile("A", file)}
              onChangeLink={(value) => setLink("A", value)}
            />
            <SideInput
              side={productB}
              disabled={isLoading}
              onChangeFile={(file) => setFile("B", file)}
              onChangeLink={(value) => setLink("B", value)}
            />
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={!canCompare || isLoading}
            onClick={compareProducts}
            className="mt-6 min-h-14 w-full rounded-2xl bg-ink px-5 py-4 text-base font-black text-white shadow-glow transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700 sm:min-h-16 sm:rounded-3xl sm:px-8 sm:py-5 sm:text-xl dark:bg-white dark:text-ink dark:disabled:bg-white/20 dark:disabled:text-ink/40"
          >
            {isLoading ? copy.comparing : copy.compareButton}
          </button>
        </section>
        )}

        {showResults && (
          <section className="shopper-compare-result-shell rounded-[2.5rem] border border-line bg-white p-4 shadow-soft sm:p-8 dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
            <div className="mb-6 rounded-[2rem] border border-line bg-teal-50 p-5 text-center shadow-soft sm:p-6 dark:border-white/10">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-teal dark:text-cyan-200">{compareCopy(readStoredLocale()).comparisonVerdict}</p>
              <h2 className="mt-2 text-3xl font-black text-ink sm:text-4xl dark:text-ink">
                {comparison?.verdictHeadline ||
                  (winnerLetter(winner)
                    ? compareCopy(readStoredLocale()).winner(winnerLetter(winner)!)
                    : compareCopy(readStoredLocale()).tooClose)}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-700 dark:text-slate-100">
                {comparison?.summary ||
                (winner === "TIE"
                  ? compareCopy(readStoredLocale()).tieSummary
                  : directSubstitutes
                    ? winnerLetter(winner)
                      ? compareCopy(readStoredLocale()).directWinner(winnerLetter(winner)!)
                      : compareCopy(readStoredLocale()).tieSummary
                    : winnerLetter(winner)
                      ? compareCopy(readStoredLocale()).confidenceWinner(winnerLetter(winner)!)
                      : compareCopy(readStoredLocale()).tieSummary)}
              </p>
              {!directSubstitutes ? (
                <div className="mx-auto mt-4 max-w-2xl rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-black leading-6 text-amber-950 shadow-sm">
                  {copy.differentTypes}
                </div>
              ) : null}

              <div className="shopper-compare-decision-grid mx-auto mt-5 grid max-w-4xl gap-3 text-left sm:grid-cols-4">
                <article className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{copy.decisionSnapshot}</p>
                  <p className="mt-2 text-xl font-black text-ink dark:text-white">
                    {comparison?.winner === "INCOMPARABLE" ? copy.notDirectlyComparable : winnerLetter(winner) ? copy.winner(winnerLetter(winner)!) : copy.tooClose}
                  </p>
                </article>
                <article className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{copy.confidenceLabel}</p>
                  <p className="mt-2 text-xl font-black text-ink dark:text-white">{confidenceValue}%</p>
                </article>
                <article className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{copy.compareType}</p>
                  <p className="mt-2 text-xl font-black text-ink dark:text-white">
                    {directSubstitutes ? copy.directCompare : copy.buyingConfidenceOnly}
                  </p>
                </article>
                <article className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{copy.scoreGap}</p>
                  <p className="mt-2 text-xl font-black text-ink dark:text-white">{scoreGap} pts</p>
                </article>
              </div>

              <ComparisonScorecard
                productA={productA.result!}
                productB={productB.result!}
                comparison={comparison}
                copy={copy}
              />

              <AffiliateSourcePanel
                result={{ productA: productA.result, productB: productB.result, comparison }}
                compact
                title="Shop checked comparison sources"
              />

              {comparison ? (
                <div className="mx-auto mt-4 grid max-w-4xl gap-3 text-left sm:grid-cols-2">
                  <div className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-teal">{copy.whyThisResult}</p>
                    <ul className="mt-2 space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                      {comparison.reasons.slice(0, 3).map((reason, index) => (
                        <li key={`${reason}-${index}`}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-teal">{copy.nextSteps}</p>
                    <ul className="mt-2 space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                      {comparison.nextSteps.slice(0, 3).map((step, index) => (
                        <li key={`${step}-${index}`}>• {step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setProductA(emptySide("A"));
                  setProductB(emptySide("B"));
                  setComparison(null);
                  setError("");
                }}
                className="mt-5 rounded-2xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-teal dark:border-white/10 dark:bg-white/5 dark:text-ink"
              >
                {copy.compareAnother}
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">

      <style jsx global>{`
        .shopper-compare-result-shell,
        .compare-readable-card,
        .compare-readable-card * {
          color: #172033;
        }

        .shopper-compare-result-shell * {
          overflow-wrap: anywhere;
        }

        .compare-readable-card .verdict,
        .compare-readable-card [class*="verdict"] {
          color: #172033;
        }

        .compare-readable-card h3,
        .compare-readable-card p,
        .compare-readable-card span,
        .compare-readable-card div {
          color: #172033;
        }

        .dark .compare-readable-card,
        .dark .compare-readable-card * {
          color: #f8fafc;
        }

        @media (max-width: 640px) {
          .shopper-compare-result-shell {
            border-radius: 1.35rem !important;
            padding: .85rem !important;
          }

          .shopper-compare-result-shell > div:first-child {
            border-radius: 1.1rem !important;
            padding: 1rem !important;
          }

          .shopper-compare-result-shell h2 {
            font-size: 1.55rem !important;
            line-height: 1.12 !important;
          }

          .shopper-compare-decision-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: .55rem !important;
          }

          .shopper-compare-decision-grid article,
          .shopper-compare-scorecard {
            border-radius: .95rem !important;
            padding: .8rem !important;
          }

          .shopper-compare-decision-grid p:last-child {
            font-size: .98rem !important;
            line-height: 1.2 !important;
          }

          .shopper-compare-head {
            display: none !important;
          }

          .shopper-compare-row {
            grid-template-columns: 1fr !important;
            gap: .35rem !important;
            padding: .75rem !important;
          }

          .shopper-compare-row p:first-child {
            color: #64748b !important;
            font-size: .68rem !important;
            text-transform: uppercase !important;
            letter-spacing: .1em !important;
          }
        }
      `}</style>
              <ResultCard label="A" result={productA.result!} winner={winner === "A"} />
              <ResultCard label="B" result={productB.result!} winner={winner === "B"} />

              <ShopperCompareToolProof productA={productA.result!} productB={productB.result!} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
