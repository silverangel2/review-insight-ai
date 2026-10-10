"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readStoredLocale } from "@/lib/i18n";
import { readCookieConsentChoice, saveCookieConsentChoice, type CookieConsentChoice } from "@/lib/cookieConsent";

type ConsentLanguage = "en" | "fr" | "es" | "zh" | "de" | "hi";

const copy: Record<ConsentLanguage, {
  eyebrow: string;
  title: string;
  body: string;
  accept: string;
  essential: string;
  policy: string;
}> = {
  en: {
    eyebrow: "Cookie choice",
    title: "ReviewIntel uses essential cookies.",
    body: "Login, security, language, account mode, and privacy-friendly traffic counts use essential storage. Optional Google ad cookies load only if you accept.",
    accept: "Accept optional cookies",
    essential: "Essential only",
    policy: "Cookie Policy"
  },
  fr: {
    eyebrow: "Choix des cookies",
    title: "ReviewIntel utilise des cookies essentiels.",
    body: "Connexion, sécurité, langue, mode de compte et comptage de trafic respectueux de la vie privée utilisent le stockage essentiel. Les cookies publicitaires Google ne se chargent que si vous acceptez.",
    accept: "Accepter les cookies optionnels",
    essential: "Essentiels seulement",
    policy: "Politique cookies"
  },
  es: {
    eyebrow: "Preferencia de cookies",
    title: "ReviewIntel usa cookies esenciales.",
    body: "Inicio de sesión, seguridad, idioma, modo de cuenta y conteos de tráfico respetuosos con la privacidad usan almacenamiento esencial. Las cookies opcionales de Google solo cargan si aceptas.",
    accept: "Aceptar cookies opcionales",
    essential: "Solo esenciales",
    policy: "Política de cookies"
  },
  zh: {
    eyebrow: "Cookie 选择",
    title: "ReviewIntel 使用必要 Cookie。",
    body: "登录、安全、语言、账户模式和隐私友好的流量统计使用必要存储。只有接受后，Google 广告 Cookie 才会加载。",
    accept: "接受可选 Cookie",
    essential: "仅必要",
    policy: "Cookie 政策"
  },
  de: {
    eyebrow: "Cookie-Auswahl",
    title: "ReviewIntel nutzt notwendige Cookies.",
    body: "Login, Sicherheit, Sprache, Kontomodus und datenschutzfreundliche Traffic-Zählung nutzen notwendigen Speicher. Optionale Google-Werbe-Cookies laden nur nach Zustimmung.",
    accept: "Optionale Cookies akzeptieren",
    essential: "Nur notwendige",
    policy: "Cookie-Richtlinie"
  },
  hi: {
    eyebrow: "Cookie choice",
    title: "ReviewIntel essential cookies use करता है.",
    body: "Login, security, language, account mode और privacy-friendly traffic counts essential storage use करते हैं. Optional Google ad cookies सिर्फ accept करने पर load होंगे.",
    accept: "Optional cookies accept करें",
    essential: "Essential only",
    policy: "Cookie Policy"
  }
};

function languageFromLocale(serverLocale?: string): ConsentLanguage {
  const locale = (serverLocale || readStoredLocale()).toLowerCase();
  if (locale.startsWith("fr")) return "fr";
  if (locale.startsWith("es")) return "es";
  if (locale.startsWith("zh")) return "zh";
  if (locale.startsWith("de")) return "de";
  if (locale.startsWith("hi")) return "hi";
  return "en";
}

export function CookieConsentBanner({ initialVisible = false, serverLocale }: { initialVisible?: boolean; serverLocale?: string } = {}) {
  // Server tells us whether a consent cookie exists, so the banner is in the first HTML
  // (no late paint that becomes the page's Largest Contentful Paint).
  const [visible, setVisible] = useState(initialVisible);
  const [saving, setSaving] = useState<CookieConsentChoice | null>(null);
  const language = useMemo(() => languageFromLocale(serverLocale), [serverLocale]);
  const text = copy[language];

  useEffect(() => {
    setVisible(!readCookieConsentChoice());
  }, []);

  function choose(choice: CookieConsentChoice) {
    setSaving(choice);
    saveCookieConsentChoice(choice);
    window.setTimeout(() => setVisible(false), 120);
  }

  if (!visible) return null;

  return (
    <section
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[9997] mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-[0_12px_40px_rgba(15,23,42,0.14)]"
      aria-label="Cookie consent"
    >
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          
          <h2 className="sr-only">{text.title}</h2>
          <p className="text-sm leading-5 text-slate-600">{text.body}</p>
          <Link href="/cookies" className="mt-1 inline-flex text-xs font-medium text-teal underline underline-offset-4">
            {text.policy}
          </Link>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("accepted")}
            disabled={Boolean(saving)}
            className="rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300"
          >
            {saving === "accepted" ? "Saving..." : text.accept}
          </button>
          <button
            type="button"
            onClick={() => choose("essential")}
            disabled={Boolean(saving)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300"
          >
            {saving === "essential" ? "Saving..." : text.essential}
          </button>
        </div>
      </div>
    </section>
  );
}
