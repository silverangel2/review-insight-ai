"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  automatedSeoPages,
  defaultSeoDraftForPath,
  type RobotsMode,
  type SeoDraft,
} from "@/lib/seoAutomation";

const STORAGE_KEY = "reviewintel:admin-seo-drafts";
const pageOptions = automatedSeoPages.map((page) => ({
  label: page.label,
  path: page.path,
}));

function readStoredDrafts() {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Record<string, SeoDraft>) : {};
  } catch {
    return {};
  }
}

export function AdminSEOManager() {
  const [selectedPath, setSelectedPath] = useState("/analyze");
  const [drafts, setDrafts] = useState<Record<string, SeoDraft>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("Drafts save in this browser until you click Save SEO Settings.");

  useEffect(() => {
    let alive = true;
    const localDrafts = readStoredDrafts();
    setDrafts(localDrafts);

    void fetch("/api/admin/seo/settings")
      .then((response) => response.json())
      .then((data) => {
        if (!alive) return;
        if (data?.settings && typeof data.settings === "object") {
          setDrafts({
            ...localDrafts,
            ...(data.settings as Record<string, SeoDraft>),
          });
          setStatus("Loaded saved SEO settings.");
        }
      })
      .catch(() => {
        if (alive) setStatus("Loaded local SEO drafts. Real saved settings could not be loaded.");
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  }, [drafts]);

  const draft = useMemo(
    () => drafts[selectedPath] ?? defaultSeoDraftForPath(selectedPath),
    [drafts, selectedPath]
  );

  function loadPage(path: string) {
    setSelectedPath(path);
    setDrafts((current) => current[path] ? current : { ...current, [path]: defaultSeoDraftForPath(path) });
  }

  function updateDraft(patch: Partial<SeoDraft>) {
    setDrafts((current) => ({
      ...current,
      [selectedPath]: {
        ...(current[selectedPath] ?? defaultSeoDraftForPath(selectedPath)),
        ...patch
      }
    }));
    setStatus("Saved locally.");
  }

  function resetDraft() {
    updateDraft(defaultSeoDraftForPath(selectedPath));
    setStatus("Reset to the ReviewIntel default draft.");
  }

  async function saveSeoSettings() {
    const nextDraft = drafts[selectedPath] ?? defaultSeoDraftForPath(selectedPath);
    const nextDrafts = {
      ...drafts,
      [selectedPath]: nextDraft,
    };

    setIsSaving(true);
    setStatus("Saving SEO settings...");

    try {
      const response = await fetch("/api/admin/seo/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: selectedPath,
          draft: nextDraft,
          settings: nextDrafts,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setStatus(data.error || "SEO settings save failed.");
        return;
      }

      setDrafts(data.settings as Record<string, SeoDraft>);
      setStatus(`Saved SEO settings for ${selectedPath}.`);
    } catch {
      setStatus("SEO settings save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function autoBuildSeo() {
    setIsSaving(true);
    setStatus("Auto-building SEO for all public pages...");

    try {
      const response = await fetch("/api/admin/seo/automate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setStatus(data.error || "SEO automation failed.");
        return;
      }

      setDrafts(data.settings as Record<string, SeoDraft>);
      setStatus(`Auto-built SEO for ${data.pageCount || 0} public pages.`);
    } catch {
      setStatus("SEO automation failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus("Choose a PNG, JPG, WEBP, or GIF image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setStatus("SEO image is too large. Keep it under 2 MB for fast social previews.");
      return;
    }

    const formData = new FormData();
    formData.set("image", file);

    const response = await fetch("/api/admin/seo/image", {
      method: "POST",
      body: formData
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.url) {
      setStatus(data.error || "SEO image upload failed.");
      return;
    }

    updateDraft({ ogImage: String(data.url) });
    setStatus(`Uploaded SEO image: ${file.name}`);
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
      <article className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-ocean dark:text-cyan-300">SEO manager</p>
            <h2 className="mt-2 text-3xl font-black text-ink dark:text-white">Clean page setup</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Set the title, description, canonical URL, index setting, and share image for each public page.
            </p>
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

        <div className="mt-6 grid gap-4">
          <label className="block">
            <span className="text-sm font-black text-ink dark:text-white">Search title</span>
            <input
              value={draft.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </label>

          <label className="block">
            <span className="text-sm font-black text-ink dark:text-white">Search description</span>
            <textarea
              value={draft.description}
              onChange={(event) => updateDraft({ description: event.target.value })}
              rows={3}
              className="mt-2 w-full resize-y rounded-2xl border border-line bg-white px-4 py-3 text-sm leading-6 text-ink outline-none focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <label className="block">
              <span className="text-sm font-black text-ink dark:text-white">SEO image upload</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => void handleImageUpload(event)}
                className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-slate-600 outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-black file:text-white focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:file:bg-white dark:file:text-ink"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-ink dark:text-white">Image URL or uploaded preview</span>
              <input
                value={draft.ogImage}
                onChange={(event) => updateDraft({ ogImage: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <label className="block">
              <span className="text-sm font-black text-ink dark:text-white">Canonical URL</span>
              <input
                value={draft.canonicalUrl}
                onChange={(event) => updateDraft({ canonicalUrl: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-ink dark:text-white">Robots</span>
              <select
                value={draft.robots}
                onChange={(event) => updateDraft({ robots: event.target.value as RobotsMode })}
                className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink outline-none focus:border-ocean focus:ring-4 focus:ring-ocean/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                <option value="index,follow">Index, follow</option>
                <option value="noindex,nofollow">Noindex, nofollow</option>
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-teal/20 bg-teal/10 p-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-bold text-teal">{status}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void autoBuildSeo()}
                disabled={isSaving}
                className="rounded-xl bg-ocean px-4 py-2 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300"
              >
                Auto-build all SEO
              </button>
              <button
                type="button"
                onClick={() => void saveSeoSettings()}
                disabled={isSaving}
                className="rounded-xl bg-ink px-4 py-2 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 dark:bg-white dark:text-ink"
              >
                {isSaving ? "Saving..." : "Save SEO Settings"}
              </button>
              <button
                type="button"
                onClick={resetDraft}
                className="rounded-xl border border-teal/40 bg-white px-4 py-2 text-sm font-black text-teal transition hover:border-teal dark:bg-gradient-to-r from-sky-600 to-teal-500"
              >
                Reset this page
              </button>
            </div>
          </div>
        </div>
      </article>

      <aside className="space-y-5">
        <article className="rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Social preview</p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-mist dark:border-white/10 dark:bg-white/[0.04]">
            {draft.ogImage ? (
              <div
                aria-label="SEO preview image"
                className="h-40 w-full bg-slate-100 bg-cover bg-center dark:bg-white/5"
                style={{ backgroundImage: `url(${draft.ogImage})` }}
              />
            ) : (
              <div className="grid h-40 place-items-center bg-[linear-gradient(135deg,#2356a3,#08b7a8,#ffb238)] text-white">
                <span className="rounded-2xl bg-white/20 px-4 py-2 text-sm font-black backdrop-blur">ReviewIntel</span>
              </div>
            )}
            <div className="p-4">
              <p className="text-sm font-black text-ocean dark:text-cyan-300">{draft.title}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{draft.description}</p>
              <p className="mt-3 truncate text-xs font-bold text-slate-500">{draft.canonicalUrl}</p>
            </div>
          </div>
        </article>

        <article className="rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Search preview</p>
          <h3 className="mt-3 text-xl font-black text-ocean dark:text-cyan-300">{draft.title}</h3>
          <p className="mt-2 truncate text-xs font-bold text-teal">{draft.canonicalUrl}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{draft.description}</p>
          <p className="mt-4 rounded-xl border border-line bg-mist px-3 py-2 text-xs font-black uppercase text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
            {draft.robots === "index,follow" ? "Ready for sitemap" : "Hidden from search"}
          </p>
        </article>
      </aside>
    </section>
  );
}
