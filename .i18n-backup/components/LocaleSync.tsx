"use client";

import { useEffect } from "react";
import { persistLocale, readStoredLocale } from "@/lib/i18n";

export function LocaleSync() {
  useEffect(() => {
    const locale = readStoredLocale();
    persistLocale(locale);
    window.dispatchEvent(new CustomEvent("reviewintel:locale", { detail: locale }));
  }, []);

  return null;
}
