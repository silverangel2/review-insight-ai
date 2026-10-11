import type { Metadata } from "next";
import { CATEGORY_LABELS, OPTIONAL_CATEGORIES, verifyEmailToken } from "@/lib/emailPreferences";
import { getPreferences } from "@/lib/emailPreferencesStore";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Email preferences", robots: { index: false, follow: false } };

export default async function EmailPreferencesPage({ searchParams }: { searchParams: Promise<{ t?: string; saved?: string; done?: string }> }) {
  const { t = "", saved, done } = await searchParams;
  const email = verifyEmailToken(t);
  const prefs = email ? await getPreferences(email) : null;
  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <p className="inline-flex rounded-full bg-mint px-3 py-1 text-sm font-semibold text-teal">Email preferences</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Choose what we send you</h1>
      {!email || !prefs ? (
        <p className="mt-4 rounded-2xl bg-butter p-5 text-sm text-slate-700">This link is invalid or has expired. Use the link at the bottom of any ReviewIntel email, or reply to it and we&apos;ll update your preferences.</p>
      ) : (
        <form method="post" action="/api/email/preferences" className="mt-6 rounded-[1.5rem] bg-white p-6 ring-1 ring-slate-900/5" data-testid="email-preferences">
          <input type="hidden" name="t" value={t} />
          <p className="text-sm text-slate-600">For <strong className="text-slate-900">{email}</strong></p>
          {saved === "1" || done === "1" ? <p role="status" className="mt-3 rounded-xl bg-mint px-3 py-2 text-sm text-teal">Saved.</p> : saved === "0" || done === "0" ? <p role="status" className="mt-3 rounded-xl bg-peach px-3 py-2 text-sm text-coralink">We couldn&apos;t save that right now. Reply to any email and we&apos;ll do it for you.</p> : null}
          <fieldset className="mt-4 space-y-3">
            <legend className="sr-only">Optional emails</legend>
            {OPTIONAL_CATEGORIES.map(c => (
              <label key={c} className="flex items-start gap-3 text-sm text-slate-800">
                <input type="checkbox" name={c} defaultChecked={prefs[c]} className="mt-0.5 h-4 w-4 accent-teal" />
                {CATEGORY_LABELS[c]}
              </label>
            ))}
          </fieldset>
          <p className="mt-4 text-xs text-slate-500">Account, security, payment and receipt emails are always sent.</p>
          <button type="submit" className="ri-lift mt-5 rounded-full bg-teal px-6 py-2.5 text-sm font-semibold text-white">Save preferences</button>
        </form>
      )}
    </main>
  );
}
