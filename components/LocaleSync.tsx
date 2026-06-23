"use client";

import { useEffect } from "react";
import { normalizeLocale, persistLocale, type ReviewIntelLocale } from "@/lib/i18n";

type LocaleSyncProps = {
  initialLocale?: ReviewIntelLocale | string;
};

export function LocaleSync({ initialLocale = "en" }: LocaleSyncProps) {
  useEffect(() => {
    const locale = normalizeLocale(initialLocale);
    persistLocale(locale);
    window.dispatchEvent(new CustomEvent("reviewintel:locale", { detail: locale }));
  }, [initialLocale]);

  return null;
}
