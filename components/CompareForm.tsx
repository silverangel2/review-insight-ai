"use client";

import { saveLatestResult } from "@/lib/resultStorage";
import { getClientAccount, incrementStoredScanTally } from "@/lib/clientAccount";

import { useMemo, useState } from "react";
import Link from "next/link";
import { displayCodeForResult } from "@/lib/productDisplay";
import { readStoredLocale } from "@/lib/i18n";

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
    noConcern: "No major concern found from available signals."
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
        noConcern: "Aucune préoccupation majeure trouvée avec les signaux disponibles."
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
        noConcern: "No se encontró una preocupación importante con las señales disponibles."
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
        noConcern: "根据现有信号，未发现重大问题。"
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
        noConcern: "Keine größeren Bedenken aus den verfügbaren Signalen gefunden."
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
        noConcern: "Available signals से कोई major concern नहीं मिला।"
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

function productTitle(result: AnalyzeResult | null, fallback: string) {
  if (!result) return fallback;
  return result.product?.name || result.product?.brand || fallback;
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
    <div className="rounded-[1.75rem] border border-line bg-white p-4 shadow-soft sm:rounded-[2rem] sm:p-5 dark:border-white/10 dark:bg-slate-950">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-teal dark:text-cyan-200">{displayCodeForResult({ productName: `Product ${side.label}` }, `Product ${side.label}`)}</p>
          <h2 className="mt-1 text-xl font-black text-ink sm:text-2xl dark:text-ink">{compareCopy(readStoredLocale()).uploadOrPaste}</h2>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal text-base font-black text-white shadow-soft sm:text-lg">
          {side.label}
        </div>
      </div>

      <label className="group flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-teal/40 bg-white p-5 text-center transition hover:border-teal hover:bg-teal/5">
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
            Winner
          </span>
        )}
      </div>

      <div className={`mb-4 rounded-2xl border px-4 py-4 text-center ${verdictClass(result.verdict)}`}>
        <p className="text-xs font-black uppercase tracking-[0.24em] opacity-80">{compareCopy(readStoredLocale()).verdictLabel}</p>
        <p className="mt-1 text-3xl font-black">{result.verdict}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900">
          <p className="text-xs text-slate-700">Buy Score</p>
          <p className="mt-1 text-xl font-black text-ink sm:text-2xl dark:text-ink">{Math.round(result.productScore || 0)}/100</p>
        </div>
        <div className="rounded-2xl border border-line bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900">
          <p className="text-xs text-slate-700">AI-Generated Reviews</p>
          <p className="mt-1 text-xl font-black text-ink sm:text-2xl dark:text-ink">{Math.round(result.reviewAuthenticity?.score || 0)}% signs</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Main concerns</p>
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


function productComparisonCategory(result: AnalyzeResult) {
  const source = result as unknown as {
    analysis?: {
      summary?: string;
      mainConcerns?: string[];
    };
    summary?: string;
    mainConcerns?: string[];
  };

  const title = productTitle(result, "");
  const summary = source.analysis?.summary || source.summary || "";
  const concerns = source.analysis?.mainConcerns?.join(" ") || source.mainConcerns?.join(" ") || "";
  const allText = `${title} ${summary} ${concerns}`.toLowerCase();

  if (allText.includes("solar") || allText.includes("solar panel") || allText.includes("sunlight")) {
    return "solar_panel";
  }

  if (
    allText.includes("power bank") ||
    allText.includes("power station") ||
    allText.includes("battery") ||
    allText.includes("ac output")
  ) {
    return "battery_power";
  }

  if (allText.includes("phone case") || allText.includes("iphone") || allText.includes("android")) {
    return "phone_accessory";
  }

  if (allText.includes("serum") || allText.includes("skin") || allText.includes("hair") || allText.includes("makeup")) {
    return "beauty";
  }

  if (allText.includes("shirt") || allText.includes("dress") || allText.includes("shoes") || allText.includes("jacket")) {
    return "clothing";
  }

  return "unknown";
}

function areLikelyDirectSubstitutes(a: AnalyzeResult, b: AnalyzeResult) {
  const aCategory = productComparisonCategory(a);
  const bCategory = productComparisonCategory(b);

  if (aCategory !== "unknown" && bCategory !== "unknown") {
    return aCategory === bCategory;
  }

  return true;
}


export function CompareForm() {
  const locale = readStoredLocale();
  const copy = compareCopy(locale);
  const [productA, setProductA] = useState<CompareSide>(emptySide("A"));
  const [productB, setProductB] = useState<CompareSide>(emptySide("B"));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const winner = useMemo(() => pickWinner(productA.result, productB.result), [productA.result, productB.result]);

  const directSubstitutes = useMemo(() => {
    if (!productA.result || !productB.result) return true;
    return areLikelyDirectSubstitutes(productA.result, productB.result);
  }, [productA.result, productB.result]);

  const canCompare = Boolean((productA.file || productA.link.trim()) && (productB.file || productB.link.trim()));

  function setFile(label: "A" | "B", file: File | null) {
    const preview = file ? URL.createObjectURL(file) : "";
    if (label === "A") setProductA((current) => ({ ...current, file, preview, result: null }));
    if (label === "B") setProductB((current) => ({ ...current, file, preview, result: null }));
  }

  function setLink(label: "A" | "B", link: string) {
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
      const winnerNow = pickWinner(resultA, resultB);
      const winnerLetterNow = winnerLetter(winnerNow);
      const directSubstitutesNow = areLikelyDirectSubstitutes(resultA, resultB);
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

      const compareTitle = compareDisplayTitle(resultA, resultB);

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
        winner: winnerNow,
        directSubstitutes: directSubstitutesNow,
        productA: resultA,
        productB: resultB,
        score: Math.max(scoreA, scoreB),
        verdict:
          winnerLetterNow
            ? copy.winner(winnerLetterNow)
            : copy.tooClose,
        summary:
          winnerLetterNow
            ? directSubstitutesNow
              ? copy.directWinner(winnerLetterNow)
              : copy.confidenceWinner(winnerLetterNow)
            : copy.tieSummary
      };

      const compareHistoryPayload = compareHistoryResult as unknown as Parameters<typeof saveLatestResult>[0];

      saveLatestResult(compareHistoryPayload, account);
      await saveShopperCompareToServerHistory(compareHistoryResult as unknown as Record<string, unknown>, account);
      incrementStoredScanTally();

      setProductA((current) => ({ ...current, result: resultA }));
      setProductB((current) => ({ ...current, result: resultB }));
    } catch (error) {
      setError(error instanceof Error ? error.message : copy.comparisonFailed);
    } finally {
      setIsLoading(false);
    }
  }

  const showResults = productA.result && productB.result;

  return (
    <main className="min-h-screen bg-paper px-3 py-4 text-ink sm:px-6 sm:py-8 lg:px-8 dark:bg-slate-950 dark:text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/analyze" className="rounded-full border border-line bg-white px-3 py-2 text-xs font-bold text-ink shadow-soft transition hover:border-teal dark:border-white/10 dark:bg-slate-950 dark:text-ink sm:px-4 sm:text-sm">
            ← Analyze One Product
          </Link>
          <span className="rounded-full border border-line bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-teal shadow-soft dark:border-white/10 dark:bg-slate-950 dark:text-cyan-200 sm:px-4 sm:text-xs sm:tracking-[0.2em]">
            Shopper Premium
          </span>
        </div>

        {!showResults && (
        <section className="rounded-[1.75rem] border border-line bg-white p-4 shadow-soft sm:rounded-[2.5rem] sm:p-10 dark:border-white/10 dark:bg-slate-950">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-teal sm:text-sm sm:tracking-[0.3em] dark:text-cyan-200">{copy.reviewIntelCompare}</p>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-6xl dark:text-ink">
            {copy.compareProductsTitle}
          </h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-slate-700 sm:text-lg dark:text-slate-700">
            {copy.compareIntro}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-8 sm:gap-5 lg:grid-cols-2">
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
          <section className="rounded-[2.5rem] border border-line bg-white p-4 shadow-soft sm:p-8 dark:border-white/10 dark:bg-slate-950">
            <div className="mb-6 rounded-[2rem] border border-line bg-teal-50 p-5 text-center shadow-soft sm:p-6 dark:border-white/10">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-teal dark:text-cyan-200">{compareCopy(readStoredLocale()).comparisonVerdict}</p>
              <h2 className="mt-2 text-3xl font-black text-ink sm:text-4xl dark:text-ink">
                {winnerLetter(winner) ? compareCopy(readStoredLocale()).winner(winnerLetter(winner)!) : compareCopy(readStoredLocale()).tooClose}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-700 dark:text-slate-100">
                {winner === "TIE"
                  ? compareCopy(readStoredLocale()).tieSummary
                  : directSubstitutes
                    ? winnerLetter(winner)
                      ? compareCopy(readStoredLocale()).directWinner(winnerLetter(winner)!)
                      : compareCopy(readStoredLocale()).tieSummary
                    : winnerLetter(winner)
                      ? compareCopy(readStoredLocale()).confidenceWinner(winnerLetter(winner)!)
                      : compareCopy(readStoredLocale()).tieSummary}
              </p>
              {!directSubstitutes ? (
                <div className="mx-auto mt-4 max-w-2xl rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-black leading-6 text-amber-950 shadow-sm">
                  Different product types detected. ReviewIntel is comparing buying confidence only — not saying these products are direct substitutes or do the same job.
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setProductA(emptySide("A"));
                  setProductB(emptySide("B"));
                  setError("");
                }}
                className="mt-5 rounded-2xl border border-line bg-white px-5 py-3 text-sm font-black text-ink transition hover:border-teal dark:border-white/10 dark:bg-white/5 dark:text-ink"
              >
                {copy.compareAnother}
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">

      <style jsx global>{`
        .compare-readable-card,
        .compare-readable-card * {
          color: #172033;
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
      `}</style>
              <ResultCard label="A" result={productA.result!} winner={winner === "A"} />
              <ResultCard label="B" result={productB.result!} winner={winner === "B"} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
