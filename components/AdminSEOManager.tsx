"use client";

import { useMemo, useState } from "react";
import { seoLandingPages } from "@/lib/seoLandingPages";

type RobotsMode = "index,follow" | "noindex,nofollow";

const pageOptions = [
  { label: "Home", path: "/", title: "ReviewIntel | AI Review Intelligence Platform" },
  { label: "Analyzer", path: "/analyze", title: "AI Review Analyzer" },
  { label: "Pricing", path: "/pricing", title: "ReviewIntel Pricing" },
  ...Object.values(seoLandingPages).map((page) => ({ label: page.title, path: `/${page.slug}`, title: page.metaTitle }))
];

export function AdminSEOManager() {
  const [selectedPath, setSelectedPath] = useState("/analyze");
  const selectedLanding = Object.values(seoLandingPages).find((page) => `/${page.slug}` === selectedPath);
  const selectedOption = pageOptions.find((page) => page.path === selectedPath) ?? pageOptions[0];
  const [title, setTitle] = useState(selectedLanding?.metaTitle ?? selectedOption.title);
  const [description, setDescription] = useState(selectedLanding?.description ?? "Analyze product reviews with AI and get trusted shopper or seller intelligence.");
  const [ogTitle, setOgTitle] = useState(selectedLanding?.title ?? selectedOption.title);
  const [ogDescription, setOgDescription] = useState(selectedLanding?.description ?? "Fast AI review analysis for shoppers and sellers.");
  const [ogImage, setOgImage] = useState("/og-reviewintel.png");
  const [twitterTitle, setTwitterTitle] = useState(selectedLanding?.title ?? selectedOption.title);
  const [twitterDescription, setTwitterDescription] = useState(selectedLanding?.description ?? "ReviewIntel turns reviews into decisions.");
  const [canonicalUrl, setCanonicalUrl] = useState(`https://reviewintel.ai${selectedPath}`);
  const [keywords, setKeywords] = useState((selectedLanding?.keywords ?? ["AI review analyzer", "fake review detector"]).join(", "));
  const [robots, setRobots] = useState<RobotsMode>("index,follow");

  const previewTags = useMemo(() => keywords.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8), [keywords]);

  function loadPage(path: string) {
    const landing = Object.values(seoLandingPages).find((page) => `/${page.slug}` === path);
    const option = pageOptions.find((page) => page.path === path) ?? pageOptions[0];
    setSelectedPath(path);
    setTitle(landing?.metaTitle ?? option.title);
    setDescription(landing?.description ?? "Analyze product reviews with AI and get trusted shopper or seller intelligence.");
    setOgTitle(landing?.title ?? option.title);
    setOgDescription(landing?.description ?? "Fast AI review analysis for shoppers and sellers.");
    setTwitterTitle(landing?.title ?? option.title);
    setTwitterDescription(landing?.description ?? "ReviewIntel turns reviews into decisions.");
    setCanonicalUrl(`https://reviewintel.ai${path}`);
    setKeywords((landing?.keywords ?? ["AI review analyzer", "fake review detector"]).join(", "));
    setRobots(path.startsWith("/admin") ? "noindex,nofollow" : "index,follow");
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
      <article className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-ocean dark:text-cyan-300">SEO management</p>
            <h2 className="mt-2 text-3xl font-black text-ink dark:text-white">Page metadata controls</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Edit launch metadata drafts and preview how ReviewIntel appears in search and social cards.</p>
          </div>
          <label className="block md:min-w-72">
            <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Page</span>
            <select
              value={selectedPath}
              onChange={(event) => loadPage(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink outline-none focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              {pageOptions.map((page) => (
                <option key={page.path} value={page.path}>{page.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            ["Page title", title, setTitle],
            ["Meta description", description, setDescription],
            ["Open Graph title", ogTitle, setOgTitle],
            ["Open Graph description", ogDescription, setOgDescription],
            ["OG image", ogImage, setOgImage],
            ["Twitter/X card title", twitterTitle, setTwitterTitle],
            ["Twitter/X card description", twitterDescription, setTwitterDescription],
            ["Canonical URL", canonicalUrl, setCanonicalUrl],
            ["Keywords/tags", keywords, setKeywords]
          ].map(([label, value, setter]) => (
            <label key={label as string} className={label === "Keywords/tags" || label === "Meta description" || label === "Open Graph description" || label === "Twitter/X card description" ? "block md:col-span-2" : "block"}>
              <span className="text-sm font-black text-ink dark:text-white">{label as string}</span>
              <textarea
                value={value as string}
                onChange={(event) => (setter as (next: string) => void)(event.target.value)}
                rows={(label as string).includes("description") || label === "Keywords/tags" ? 3 : 1}
                className="mt-2 w-full resize-y rounded-2xl border border-line bg-white px-4 py-3 text-sm leading-6 text-ink outline-none focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </label>
          ))}
          <label className="block">
            <span className="text-sm font-black text-ink dark:text-white">Robots</span>
            <select
              value={robots}
              onChange={(event) => setRobots(event.target.value as RobotsMode)}
              className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink outline-none focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              <option value="index,follow">Index, follow</option>
              <option value="noindex,nofollow">Noindex, nofollow</option>
            </select>
          </label>
          <div className="rounded-2xl border border-teal/20 bg-teal/10 p-4">
            <p className="text-xs font-black uppercase text-teal">Sitemap status</p>
            <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              {robots.startsWith("index") ? "Included in launch sitemap draft" : "Excluded from indexing"}
            </p>
          </div>
        </div>
      </article>

      <aside className="space-y-5">
        <article className="rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">SEO preview card</p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-mist dark:border-white/10 dark:bg-white/[0.04]">
            <div className="grid h-36 place-items-center bg-[linear-gradient(135deg,#2356a3,#08b7a8,#ffb238)] text-white">
              <span className="rounded-2xl bg-white/18 px-4 py-2 text-sm font-black backdrop-blur">ReviewIntel OG</span>
            </div>
            <div className="p-4">
              <p className="text-sm font-black text-ocean dark:text-cyan-300">{ogTitle}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{ogDescription}</p>
              <p className="mt-3 truncate text-xs font-bold text-slate-500">{canonicalUrl}</p>
            </div>
          </div>
        </article>

        <article className="rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Search snippet</p>
          <h3 className="mt-3 text-xl font-black text-ocean dark:text-cyan-300">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {previewTags.map((tag) => (
              <span key={tag} className="rounded-full border border-line bg-mist px-3 py-1 text-xs font-black uppercase text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">{tag}</span>
            ))}
          </div>
        </article>
      </aside>
    </section>
  );
}
