"use client";

import { useEffect, useState } from "react";

type Settings = {
  full_auto_enabled: boolean;
  semi_auto_enabled: boolean;
  daily_time: string;
  platforms: string[];
  topics: string[];
  emergency_pause: boolean;
};

type SocialPost = {
  id: string;
  created_at: string;
  platform: string;
  status: string;
  topic: string;
  caption: string;
  error?: string | null;
  external_post_id?: string | null;
};

const platformOptions = ["facebook", "tiktok", "instagram"];
const topicOptions = ["shopper_tips", "seller_tips", "fake_review_warning"];

const defaultSettings: Settings = {
  full_auto_enabled: false,
  semi_auto_enabled: true,
  daily_time: "09:00",
  platforms: ["facebook"],
  topics: ["shopper_tips", "seller_tips", "fake_review_warning"],
  emergency_pause: false,
};

export default function AdminSocialAutoPost() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [status, setStatus] = useState("Loading social auto-post settings...");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const response = await fetch("/api/admin/social-autopost");
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setStatus(data.error || "Could not load social auto-post.");
        return;
      }

      setSettings(data.settings || defaultSettings);
      setPosts(data.posts || []);
      setStatus("Social auto-post settings loaded.");
    } catch {
      setStatus("Could not load social auto-post.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleArray(key: "platforms" | "topics", value: string) {
    setSettings((current) => {
      const list = current[key] || [];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

      return { ...current, [key]: next };
    });
  }

  async function saveSettings() {
    setSaving(true);
    setStatus("Saving social auto-post settings...");

    try {
      const response = await fetch("/api/admin/social-autopost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setStatus(data.error || "Could not save settings.");
        return;
      }

      setSettings(data.settings || settings);
      setPosts(data.posts || []);
      setStatus("Saved. Full auto will run only if enabled and connected.");
    } catch {
      setStatus("Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setSaving(true);
    setStatus("Running full auto post now...");

    try {
      const response = await fetch("/api/admin/social-autopost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run-now" }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setStatus(data.error || "Could not run social auto-post.");
        return;
      }

      setSettings(data.settings || settings);
      setPosts(data.posts || []);
      setStatus(data.result?.skipped ? data.result.reason : "Auto-post run finished. Check logs below.");
    } catch {
      setStatus("Could not run social auto-post.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[1.5rem] border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-950 sm:rounded-[2rem] sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
          Social auto-post
        </p>
        <h1 className="mt-3 text-2xl font-black text-ink dark:text-white sm:text-4xl">
          Full auto daily posts
        </h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
          Generate and publish ReviewIntel marketing posts automatically. Facebook Page posting is live when the connector keys exist. TikTok and Instagram stay logged as connector-required until approved tokens are added.
        </p>
      </div>

      <div className="rounded-[1.5rem] border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-950 sm:rounded-[2rem] sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-slate-900">
            <input
              type="checkbox"
              checked={settings.full_auto_enabled}
              onChange={(event) => setSettings({ ...settings, full_auto_enabled: event.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-black text-ink dark:text-white">Full auto enabled</span>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">
              Cron generates and posts automatically.
            </p>
          </label>

          <label className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-slate-900">
            <input
              type="checkbox"
              checked={settings.semi_auto_enabled}
              onChange={(event) => setSettings({ ...settings, semi_auto_enabled: event.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-black text-ink dark:text-white">Semi-auto enabled</span>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">
              Keep draft/approval mode available later.
            </p>
          </label>

          <label className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-400/30 dark:bg-rose-400/10">
            <input
              type="checkbox"
              checked={settings.emergency_pause}
              onChange={(event) => setSettings({ ...settings, emergency_pause: event.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-black text-rose-700 dark:text-rose-200">Emergency pause</span>
            <p className="mt-2 text-xs font-bold leading-5 text-rose-600 dark:text-rose-200/80">
              Stops all auto-posting immediately.
            </p>
          </label>
        </div>

        <label className="mt-5 block space-y-2">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Daily time</span>
          <input
            type="time"
            value={settings.daily_time}
            onChange={(event) => setSettings({ ...settings, daily_time: event.target.value })}
            className="w-full rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-black text-ink outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white sm:w-60"
          />
        </label>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Platforms</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {platformOptions.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => toggleArray("platforms", platform)}
                  className={`rounded-2xl px-4 py-2 text-xs font-black capitalize ${
                    settings.platforms.includes(platform)
                      ? "bg-ocean text-white"
                      : "bg-mist text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Topics</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {topicOptions.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleArray("topics", topic)}
                  className={`rounded-2xl px-4 py-2 text-xs font-black ${
                    settings.topics.includes(topic)
                      ? "bg-ocean text-white"
                      : "bg-mist text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {topic.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          <button
            type="button"
            onClick={runNow}
            disabled={saving}
            className="rounded-2xl bg-ocean px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            Run Full Auto Now
          </button>
        </div>

        <p className="mt-4 rounded-2xl bg-mist p-4 text-sm font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {status}
        </p>
      </div>

      <div className="rounded-[1.5rem] border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-950 sm:rounded-[2rem] sm:p-6">
        <h2 className="text-xl font-black text-ink dark:text-white">Post history</h2>
        <div className="mt-4 space-y-3">
          {posts.length ? posts.map((post) => (
            <article key={post.id} className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black capitalize text-ink dark:bg-slate-800 dark:text-white">
                  {post.platform}
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black capitalize text-ink dark:bg-slate-800 dark:text-white">
                  {post.status}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-300">
                  {new Date(post.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
                {post.caption}
              </p>
              {post.error ? (
                <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-black text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">
                  {post.error}
                </p>
              ) : null}
              {post.external_post_id ? (
                <p className="mt-3 text-xs font-black text-emerald-700 dark:text-emerald-300">
                  External post ID: {post.external_post_id}
                </p>
              ) : null}
            </article>
          )) : (
            <p className="rounded-2xl bg-mist p-4 text-sm font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
              No social posts logged yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
