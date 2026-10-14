import Link from "next/link";

/** Gentle next step when a link-only scan could not read the written reviews. */
export function ExtensionPrompt() {
  return (
    <aside data-testid="extension-prompt" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-white/10 dark:bg-slate-900">
      <p className="font-black text-ink dark:text-white">Get real reviews read: add the free extension</p>
      <p className="mt-1 leading-6 text-slate-600 dark:text-slate-300">
        Open the product page yourself, then let ReviewIntel read the reviews already on your screen.
      </p>
      <Link href="/tools/analyze-page" className="mt-2 inline-flex font-black text-ocean underline">
        Add it free
      </Link>
    </aside>
  );
}
