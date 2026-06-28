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
    body: "Login, security, language, and account mode need essential cookies or browser storage. Optional Google ad cookies load only if you accept.",
    accept: "Accept optional cookies",
    essential: "Essential only",
    policy: "Cookie Policy"
  },
  fr: {
    eyebrow: "Choix des cookies",
    title: "ReviewIntel utilise des cookies essentiels.",
    body: "La connexion, la sécurité, la langue et le mode de compte utilisent des cookies ou le stockage essentiel. Les cookies publicitaires Google ne se chargent que si vous acceptez.",
    accept: "Accepter les cookies optionnels",
    essential: "Essentiels seulement",
    policy: "Politique cookies"
  },
  es: {
    eyebrow: "Preferencia de cookies",
    title: "ReviewIntel usa cookies esenciales.",
    body: "El inicio de sesión, la seguridad, el idioma y el modo de cuenta necesitan cookies o almacenamiento esencial. Las cookies opcionales de anuncios de Google solo cargan si aceptas.",
    accept: "Aceptar cookies opcionales",
    essential: "Solo esenciales",
    policy: "Política de cookies"
  },
  zh: {
    eyebrow: "Cookie 选择",
    title: "ReviewIntel 使用必要 Cookie。",
    body: "登录、安全、语言和账户模式需要必要 Cookie 或浏览器存储。只有在你接受后，Google 广告 Cookie 才会加载。",
    accept: "接受可选 Cookie",
    essential: "仅必要",
    policy: "Cookie 政策"
  },
  de: {
    eyebrow: "Cookie-Auswahl",
    title: "ReviewIntel nutzt notwendige Cookies.",
    body: "Login, Sicherheit, Sprache und Kontomodus benötigen notwendige Cookies oder Browserspeicher. Optionale Google-Werbe-Cookies laden nur nach Zustimmung.",
    accept: "Optionale Cookies akzeptieren",
    essential: "Nur notwendige",
    policy: "Cookie-Richtlinie"
  },
  hi: {
    eyebrow: "Cookie choice",
    title: "ReviewIntel essential cookies use करता है.",
    body: "Login, security, language और account mode के लिए essential cookies या browser storage चाहिए. Optional Google ad cookies सिर्फ accept करने पर load होंगे.",
    accept: "Optional cookies accept करें",
    essential: "Essential only",
    policy: "Cookie Policy"
  }
};

function languageFromLocale(): ConsentLanguage {
  const locale = readStoredLocale().toLowerCase();
  if (locale.startsWith("fr")) return "fr";
  if (locale.startsWith("es")) return "es";
  if (locale.startsWith("zh")) return "zh";
  if (locale.startsWith("de")) return "de";
  if (locale.startsWith("hi")) return "hi";
  return "en";
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState<CookieConsentChoice | null>(null);
  const language = useMemo(languageFromLocale, []);
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
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[9997] mx-auto max-w-3xl overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/85 p-4 text-ink shadow-[0_24px_90px_rgba(15,23,42,0.20)] backdrop-blur-2xl"
      aria-label="Cookie consent"
    >
      <div className="pointer-events-none absolute -left-10 -top-12 h-28 w-28 rounded-full bg-cyan-300/35 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-14 right-6 h-32 w-32 rounded-full bg-amber-300/35 blur-2xl" />
      <div className="relative grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-ocean">{text.eyebrow}</p>
          <h2 className="mt-1 text-base font-black text-ink md:text-lg">{text.title}</h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">{text.body}</p>
          <Link href="/cookies" className="mt-2 inline-flex text-xs font-black text-ocean underline underline-offset-4">
            {text.policy}
          </Link>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
          <button
            type="button"
            onClick={() => choose("accepted")}
            disabled={Boolean(saving)}
            className="rounded-2xl bg-[linear-gradient(135deg,#08b7a8,#2356a3)] px-4 py-3 text-sm font-black text-white shadow-[0_14px_35px_rgba(35,86,163,0.20)] disabled:opacity-60"
          >
            {saving === "accepted" ? "Saving..." : text.accept}
          </button>
          <button
            type="button"
            onClick={() => choose("essential")}
            disabled={Boolean(saving)}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-black text-ink shadow-sm disabled:opacity-60"
          >
            {saving === "essential" ? "Saving..." : text.essential}
          </button>
        </div>
      </div>
    </section>
  );
}
