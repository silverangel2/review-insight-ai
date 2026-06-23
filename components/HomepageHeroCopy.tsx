"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { normalizeLocale, readStoredLocale, type ReviewIntelLocale } from "@/lib/i18n";

const heroCopy: Record<
  ReviewIntelLocale,
  {
    badge: string;
    languageLabel: string;
    subtitle: string;
    slides: string[];
  }
> = {
  en: {
    badge: "AI shopping assistant",
    languageLabel: "Choose language",
    subtitle:
      "Upload a product screenshot or paste a product link. ReviewIntel checks public review signals, common complaints, ratings, value, and AI-like review patterns to give you a fast BUY, CONSIDER, or AVOID verdict.",
    slides: [
      "Find out if a product is worth buying.",
      "Know Before You Buy.",
      "Fake reviews are everywhere. One scan helps reveal what feels real."
    ]
  },
  fr: {
    badge: "Analyseur IA d’avis",
    languageLabel: "Choisir la langue",
    subtitle:
      "Collez les avis et obtenez un verdict clair, le risque de faux avis, les plaintes principales et la valeur du produit.",
    slides: [
      "Découvrez si un produit vaut vraiment l’achat.",
      "Fatigué de lire les avis? Collez-les dans ReviewIntel et obtenez une réponse rapide.",
      "Les faux avis sont partout. Un seul scan aide à repérer ce qui semble réel."
    ]
  },
  es: {
    badge: "Escáner de reseñas con IA",
    languageLabel: "Elegir idioma",
    subtitle:
      "Pega reseñas y recibe un veredicto claro, riesgo de reseñas falsas, quejas principales y puntuación de valor.",
    slides: [
      "Descubre si un producto vale la pena.",
      "¿Cansado de leer reseñas? Pégalas en ReviewIntel y obtén una respuesta rápida.",
      "Las reseñas falsas están en todas partes. Un escaneo ayuda a ver qué parece real."
    ]
  },
  zh: {
    badge: "AI 评论扫描器",
    languageLabel: "选择语言",
    subtitle:
      "粘贴评论，即可获得清晰结论、虚假评论风险、主要投诉和价值评分。",
    slides: [
      "快速判断产品是否值得购买。",
      "不想一条条看评论？粘贴到 ReviewIntel，快速得到答案。",
      "虚假评论无处不在。一次扫描帮助你看清哪些更可信。"
    ]
  },
  de: {
    badge: "KI-Bewertungsscanner",
    languageLabel: "Sprache wählen",
    subtitle:
      "Füge Rezensionen ein und erhalte ein klares Urteil, Risiko gefälschter Bewertungen, Hauptbeschwerden und eine Wertbewertung.",
    slides: [
      "Finde heraus, ob ein Produkt den Kauf wert ist.",
      "Keine Lust, Rezensionen zu lesen? In ReviewIntel einfügen und schnell Klarheit bekommen.",
      "Fake-Bewertungen sind überall. Ein Scan zeigt, was glaubwürdig wirkt."
    ]
  },
  hi: {
    badge: "AI समीक्षा स्कैनर",
    languageLabel: "भाषा चुनें",
    subtitle:
      "रिव्यू पेस्ट करें और साफ फैसला, फेक-रिव्यू जोखिम, मुख्य शिकायतें और वैल्यू स्कोर देखें।",
    slides: [
      "जानें कि यह प्रोडक्ट खरीदने लायक है या नहीं।",
      "रिव्यू पढ़कर थक गए? ReviewIntel में पेस्ट करें और तुरंत जवाब पाएं।",
      "फेक रिव्यू हर जगह हैं। एक स्कैन बताता है कि क्या भरोसेमंद लगता है।"
    ]
  }
};

function readLocale(): ReviewIntelLocale {
  if (typeof window === "undefined") return "en";
  return readStoredLocale();
}

type HomepageHeroCopyProps = {
  initialLocale?: ReviewIntelLocale | string;
};

export function HomepageHeroCopy({ initialLocale = "en" }: HomepageHeroCopyProps) {
  const [locale, setLocale] = useState<ReviewIntelLocale>(normalizeLocale(initialLocale));
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    setLocale(readLocale());
    const handleLocale = (event: Event) => {
      setLocale(normalizeLocale((event as CustomEvent).detail || readStoredLocale()));
      setSlideIndex(0);
    };

    window.addEventListener("reviewintel:locale", handleLocale);

    return () => window.removeEventListener("reviewintel:locale", handleLocale);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % heroCopy[locale].slides.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [locale]);

  const copy = heroCopy[locale];
  const activeSlide = useMemo(() => copy.slides[slideIndex % copy.slides.length], [copy.slides, slideIndex]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="good">{copy.badge}</Badge>
      </div>
      <div className="mt-6 flex min-h-[clamp(13rem,29vw,25rem)] items-center md:min-h-[clamp(16rem,27vw,25rem)]">
        <h1 key={activeSlide} className="ri-hero-copy-slide max-w-[min(100%,54rem)] text-[clamp(2.65rem,5.8vw,5.75rem)] font-black leading-[0.95] tracking-[-0.01em] text-[#06111f] [overflow-wrap:anywhere]">
          {activeSlide}
        </h1>
      </div>
      <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-700">
        {copy.subtitle}
      </p>
    </>
  );
}
