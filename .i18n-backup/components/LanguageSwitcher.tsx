"use client";

import { useEffect, useState } from "react";
import { LOCALE_STORAGE_KEY, SUPPORTED_LOCALES, getDictionary, normalizeLocale, persistLocale, readStoredLocale, type ReviewIntelLocale } from "@/lib/i18n";

type LanguageSwitcherProps = {
  compact?: boolean;
};

function readPreferredLocale() {
  if (typeof window === "undefined") return "en";
  return readStoredLocale();
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const [locale, setLocale] = useState<ReviewIntelLocale>("en");
  const dictionary = getDictionary(locale);

  useEffect(() => {
    const preferred = readPreferredLocale();
    setLocale(preferred);
    persistLocale(preferred);

    const refresh = (event?: Event) => {
      const detail = event && "detail" in event ? (event as CustomEvent).detail : undefined;
      const nextLocale = normalizeLocale(detail || window.localStorage.getItem(LOCALE_STORAGE_KEY) || window.navigator.language);
      setLocale(nextLocale);
      persistLocale(nextLocale);
    };

    window.addEventListener("reviewintel:locale", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("reviewintel:locale", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function updateLocale(value: ReviewIntelLocale) {
    setLocale(value);
    persistLocale(value);
    window.dispatchEvent(new CustomEvent("reviewintel:locale", { detail: value }));
  }

  return (
    <label
      className={[
        "inline-flex shrink-0 items-center gap-2 rounded-2xl border border-line bg-white/80 font-black text-slate-700 shadow-sm backdrop-blur transition focus-within:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-slate-200",
        compact ? "px-2.5 py-2 text-[11px]" : "px-3 py-2.5 text-xs",
      ].join(" ")}
    >
      <span className={compact ? "hidden lg:inline" : ""}>{dictionary.language}</span>
      <select
        value={locale}
        onChange={(event) => updateLocale(event.target.value as ReviewIntelLocale)}
        className="max-w-[7rem] bg-transparent text-xs font-black text-ink outline-none dark:text-white"
        aria-label={dictionary.chooseLanguage}
      >
        {SUPPORTED_LOCALES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
