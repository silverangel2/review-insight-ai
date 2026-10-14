import type { Metadata } from "next";
import { headers } from "next/headers";
import { withSeo } from "@/lib/pageSeo";
import { buildPageCaptureBookmarklet } from "@/lib/pageCaptureBookmarklet";
import { BookmarkletLink } from "./BookmarkletLink";

export const metadata: Metadata = withSeo("/tools/analyze-page", {
  title: "Analyze this page",
  description: "Read the reviews already on your screen with a free browser extension or a bookmark.",
}, { noindex: true });

export const dynamic = "force-dynamic";

function pageOrigin(headerList: Headers) {
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "getreviewintel.com";
  const proto = headerList.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function AnalyzePageTool() {
  const origin = pageOrigin(await headers());
  const bookmarklet = buildPageCaptureBookmarklet(origin);
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-4xl font-black tracking-tight text-ink dark:text-white">Analyze this page</h1>
      <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
        Some product pages will not answer ReviewIntel&apos;s own servers. Your browser already has the page open, so it can read the reviews you see and send those words in for a Buying Score. Nothing runs until you click.
      </p>

      <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900">
        <h2 className="text-xl font-black text-ink dark:text-white">Free browser extension</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
          For Chrome and Edge on a computer. After it is installed, open a product page and click <strong>Analyze with ReviewIntel</strong>. ReviewIntel reads the title, the star rating, the number of ratings, and the review cards already on the screen, then opens your result. It does not turn pages or keep reading after you leave.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-200">
          <li>Sign in to ReviewIntel in the same browser.</li>
          <li>Add the extension from the Chrome Web Store or Edge Add-ons once it is listed. Until then, a computer you control can load the unpacked folder named extension.</li>
          <li>Reload the product page, then click Analyze with ReviewIntel.</li>
        </ol>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900">
        <h2 className="text-xl font-black text-ink dark:text-white">Bookmark for a phone or a computer</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
          Drag this bookmark to your bookmarks bar. On a phone, add it as a bookmark, then edit the address and replace it with the bookmark address from this page. Open a product page, tap the bookmark, and sign in if ReviewIntel asks.
        </p>
        <p className="mt-4">
          <BookmarkletLink code={bookmarklet} />
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          The bookmark only reads the page you tapped it on. It does not ask the store for more pages.
        </p>
      </section>
    </main>
  );
}
