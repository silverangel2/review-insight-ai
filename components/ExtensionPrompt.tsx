import Link from "next/link";
import { shopperSafeText } from "@/lib/shopperAnswer";

/** Gentle next step when a link-only scan could not read the written reviews. */
export function ExtensionPrompt() {
  const title = shopperSafeText("Get real reviews read: add the free extension");
  const detail = shopperSafeText("Open the product page yourself, then let ReviewIntel read the reviews already on your screen.");
  return (
    <aside data-testid="extension-prompt" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-white/10 dark:bg-slate-900">
      <p className="font-black text-ink dark:text-white">{title}</p>
      <p className="mt-1 leading-6 text-slate-600 dark:text-slate-300">{detail}</p>
      <Link href="/tools/analyze-page" className="mt-2 inline-flex font-black text-ocean underline">
        {shopperSafeText("Add it free")}
      </Link>
    </aside>
  );
}
