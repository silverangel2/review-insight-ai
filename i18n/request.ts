import {cookies} from "next/headers";
import {getRequestConfig} from "next-intl/server";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  normalizeLocale
} from "@/lib/i18n";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();

  const savedLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = normalizeLocale(savedLocale || DEFAULT_LOCALE);

  const messages = (
    await import(`../messages/${locale}.json`)
  ).default;

  return {
    locale,
    messages
  };
});
