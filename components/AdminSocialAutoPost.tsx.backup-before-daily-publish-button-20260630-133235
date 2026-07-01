"use client";

import { useEffect, useState } from "react";

const socialPublishingHelpText = {
  postNow: "Post Now / Test publishes one post immediately so you can verify Facebook/TikTok.",
  daily: "Enable Daily Publishing uses the scheduled cron and advances the 100-day built-in content cycle only after successful posts.",
};


type Settings = {
  full_auto_enabled: boolean;
  semi_auto_enabled: boolean;
  daily_time: string;
  platforms: string[];
  topics: string[];
  emergency_pause: boolean;
  cycle_length?: number;
  posts_per_day?: number;
  recycle_after_days?: number;
};

type SocialPost = {
  id: string;
  created_at: string;
  platform: string;
  status: string;
  topic: string;
  caption: string;
  hashtags?: string[];
  metadata?: {
    content?: {
      shortVideoScript?: string;
      altText?: string;
      link?: string;
    };
    shortVideoScript?: string;
    altText?: string;
    link?: string;
    note?: string;
    connectorRequired?: boolean;
  } | null;
  error?: string | null;
  external_post_id?: string | null;
};

type SocialMedia = {
  id: string;
  created_at: string;
  title?: string | null;
  media_type: "image" | "video" | string;
  file_url: string;
  thumbnail_url?: string | null;
  alt_text?: string | null;
  topic?: string | null;
  tags?: string[] | null;
  is_active: boolean;
  used_count?: number | null;
  last_used_at?: string | null;
};

type ConnectorHealth = {
  ok: boolean;
  status: "ready" | "warning" | "failed" | string;
  graphVersion?: string;
  page?: {
    id?: string;
  };
  sampleMediaUrl?: string;
  checks?: Array<{
    label: string;
    status: "passed" | "warning" | "failed";
    detail: string;
  }>;
};

const platformOptions = ["facebook", "instagram", "tiktok", "linkedin", "x", "youtube_shorts", "pinterest", "reddit"];
const topicOptions = ["shopper_tips", "seller_tips", "fake_review_warning", "buyer_mistakes", "competitor_watch", "trust_signals"];

const defaultSettings: Settings = {
  full_auto_enabled: false,
  semi_auto_enabled: true,
  daily_time: "09:00",
  platforms: ["facebook"],
  topics: ["shopper_tips", "seller_tips", "fake_review_warning"],
  emergency_pause: false,
  cycle_length: 100,
  posts_per_day: 1,
  recycle_after_days: 100,
};

export default function AdminSocialAutoPost() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [media, setMedia] = useState<SocialMedia[]>([]);
  const [mediaForm, setMediaForm] = useState({
    title: "",
    media_type: "image",
    file_url: "",
    thumbnail_url: "",
    topic: "",
    tags: "",
  });
  const [status, setStatus] = useState("Loading social auto-post settings...");
  const [facebookCheck, setFacebookCheck] = useState<ConnectorHealth | null>(null);
  const [tiktokCheck, setTikTokCheck] = useState<ConnectorHealth | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

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

      const mediaResponse = await fetch("/api/admin/social-media");
      const mediaData = await mediaResponse.json().catch(() => ({}));
      if (mediaResponse.ok && mediaData.ok) {
        setMedia(mediaData.media || []);
      }

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
      setStatus(
        data.result?.skipped
          ? data.result.reason
          : data.result?.ok === false
            ? data.result.reason || "Auto-post failed. Check failed logs below."
            : "Auto-post run finished. Check logs below."
      );
    } catch {
      setStatus("Could not run social auto-post.");
    } finally {
      setSaving(false);
    }
  }

  async function checkFacebook() {
    setSaving(true);
    setStatus("Checking Facebook connector...");

    try {
      const response = await fetch("/api/admin/social-autopost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "facebook-check" }),
      });

      const data = await response.json().catch(() => ({}));
      const facebook = data.facebook as ConnectorHealth | undefined;

      if (facebook) {
        setFacebookCheck(facebook);
      }

      setStatus(
        facebook?.status === "ready"
          ? "Facebook connector is ready."
          : facebook?.status === "warning"
            ? "Facebook connector has warnings. Review the checks below."
            : data.error || "Facebook connector is not ready. Review the checks below."
      );
    } catch {
      setStatus("Could not check Facebook connector.");
    } finally {
      setSaving(false);
    }
  }

  async function checkTikTok() {
    setSaving(true);
    setStatus("Checking TikTok connector...");

    try {
      const response = await fetch("/api/admin/social-autopost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tiktok-check" }),
      });

      const data = await response.json().catch(() => ({}));
      const tiktok = data.tiktok as ConnectorHealth | undefined;

      if (tiktok) {
        setTikTokCheck(tiktok);
      }

      setStatus(
        tiktok?.status === "ready"
          ? "TikTok connector is ready."
          : tiktok?.status === "warning"
            ? "TikTok connector has warnings. Review the checks below."
            : data.error || "TikTok connector is not ready. Review the checks below."
      );
    } catch {
      setStatus("Could not check TikTok connector.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadMediaFiles(files: File[]) {
    const selectedFiles = files.filter(Boolean);

    if (!selectedFiles.length) return;

    setUploadingMedia(true);
    setStatus(`Uploading ${selectedFiles.length} media file${selectedFiles.length === 1 ? "" : "s"}...`);

    let uploadedCount = 0;
    let lastUpload:
      | {
          title?: string;
          mediaType?: string;
          url?: string;
          thumbnailUrl?: string;
        }
      | null = null;

    try {
      for (const file of selectedFiles) {
        const form = new FormData();
        form.append("file", file);

        const uploadResponse = await fetch("/api/admin/social-media/upload", {
          method: "POST",
          body: form,
        });

        const uploadData = await uploadResponse.json().catch(() => ({}));

        if (!uploadResponse.ok || !uploadData.ok) {
          setStatus(uploadData.error || `Could not upload ${file.name}.`);
          continue;
        }

        lastUpload = uploadData;

        const saveResponse = await fetch("/api/admin/social-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: uploadData.title || file.name,
            media_type: uploadData.mediaType || (file.type.startsWith("video/") ? "video" : "image"),
            file_url: uploadData.url,
            thumbnail_url: uploadData.thumbnailUrl || "",
            alt_text: uploadData.title || file.name,
            topic: mediaForm.topic,
            tags: mediaForm.tags,
          }),
        });

        const saveData = await saveResponse.json().catch(() => ({}));

        if (!saveResponse.ok || !saveData.ok) {
          setStatus(saveData.error || `Uploaded ${file.name}, but could not add it to the library.`);
          continue;
        }

        uploadedCount += 1;
      }

      if (lastUpload) {
        setMediaForm((current) => ({
          ...current,
          title: "",
          media_type: lastUpload?.mediaType || current.media_type,
          file_url: "",
          thumbnail_url: "",
        }));
      }

      await load();
      setStatus(
        uploadedCount === selectedFiles.length
          ? `Uploaded and added ${uploadedCount} media file${uploadedCount === 1 ? "" : "s"} to the library.`
          : `Added ${uploadedCount} of ${selectedFiles.length} media files. Check any failed files and try again.`
      );
    } catch {
      setStatus("Could not upload media.");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function addMedia() {
    setSaving(true);
    setStatus("Adding social media item...");

    try {
      const response = await fetch("/api/admin/social-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mediaForm),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setStatus(data.error || "Could not add media.");
        return;
      }

      setMedia((current) => [data.media, ...current]);
      setMediaForm({
        title: "",
        media_type: "image",
        file_url: "",
        thumbnail_url: "",
        topic: "",
        tags: "",
      });
      setStatus("Media added to the 100-day social library.");
    } catch {
      setStatus("Could not add media.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleMediaActive(item: SocialMedia) {
    setSaving(true);
    setStatus(item.is_active ? "Pausing media item..." : "Reactivating media item...");

    try {
      const response = await fetch("/api/admin/social-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-active",
          id: item.id,
          is_active: !item.is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setStatus(data.error || "Could not update media item.");
        return;
      }

      setMedia((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, is_active: !item.is_active } : entry))
      );
      setStatus("Media item updated.");
    } catch {
      setStatus("Could not update media item.");
    } finally {
      setSaving(false);
    }
  }

  function connectorCard(label: string, check: ConnectorHealth | null) {
    if (!check) return null;

    return (
      <div className="mt-4 rounded-2xl border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              {label} connector
            </p>
            <h3 className="mt-1 text-lg font-black text-ink dark:text-white">
              {check.status === "ready" ? "Ready to publish" : check.status === "warning" ? "Needs review" : "Not ready yet"}
            </h3>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase ${
            check.status === "ready"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200"
              : check.status === "warning"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200"
                : "bg-rose-100 text-rose-800 dark:bg-rose-400/10 dark:text-rose-200"
          }`}>
            {check.status}
          </span>
        </div>

        <div className="mt-3 grid gap-2">
          {check.checks?.map((item) => (
            <div key={item.label} className="rounded-xl bg-mist p-3 dark:bg-slate-950">
              <p className={`text-xs font-black uppercase tracking-[0.12em] ${
                item.status === "passed"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : item.status === "warning"
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-rose-700 dark:text-rose-300"
              }`}>
                {item.status} · {item.label}
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-600 dark:text-slate-300">
                {item.detail}
              </p>
            </div>
          ))}
        </div>

        {check.sampleMediaUrl ? (
          <p className="mt-3 truncate text-xs font-bold text-slate-500 dark:text-slate-400">
            Sample image: {check.sampleMediaUrl}
          </p>
        ) : null}
      </div>
    );
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
          Generate ReviewIntel organic-growth posts automatically. Facebook and TikTok can publish when their platform tokens are approved and connected; Instagram, LinkedIn, X, YouTube Shorts, Pinterest, and Reddit create ready-to-post drafts until their official connectors are added.
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
              Cron generates posts automatically. Connected platforms publish; unconnected platforms save drafts.
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
              Keep draft/approval mode available for platforms that need manual review.
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

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Cycle length</span>
            <input
              type="number"
              min={1}
              max={365}
              value={settings.cycle_length ?? 100}
              onChange={(event) => setSettings({ ...settings, cycle_length: Number(event.target.value) || 100 })}
              className="w-full rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-black text-ink outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
            <p className="text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">Default is 100 unique queue days before reinventing.</p>
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Posts per day</span>
            <input
              type="number"
              min={1}
              max={12}
              value={settings.posts_per_day ?? 1}
              onChange={(event) => setSettings({ ...settings, posts_per_day: Number(event.target.value) || 1 })}
              className="w-full rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-black text-ink outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
            <p className="text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">Cron runs this many queue batches daily when full auto is enabled.</p>
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Reinvent after</span>
            <input
              type="number"
              min={1}
              max={365}
              value={settings.recycle_after_days ?? 100}
              onChange={(event) => setSettings({ ...settings, recycle_after_days: Number(event.target.value) || 100 })}
              className="w-full rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-black text-ink outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
            <p className="text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">AI refreshes old themes with a new angle after this count.</p>
          </label>
        </div>

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
            Post Now / Test / Test
          </button>
          <button
            type="button"
            onClick={checkFacebook}
            disabled={saving}
            className="rounded-2xl border border-ocean/30 bg-white px-5 py-3 text-sm font-black text-ocean shadow-soft disabled:opacity-60 dark:border-cyan-300/30 dark:bg-slate-900 dark:text-cyan-200"
          >
            Check Facebook
          </button>
          <button
            type="button"
            onClick={checkTikTok}
            disabled={saving}
            className="rounded-2xl border border-rose-300/40 bg-white px-5 py-3 text-sm font-black text-rose-600 shadow-soft disabled:opacity-60 dark:border-rose-300/30 dark:bg-slate-900 dark:text-rose-200"
          >
            Check TikTok
          </button>
        </div>

        <p className="mt-4 rounded-2xl bg-mist p-4 text-sm font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {status}
        </p>

        {connectorCard("Facebook", facebookCheck)}
        {connectorCard("TikTok", tiktokCheck)}
      </div>

      <div className="rounded-[1.5rem] border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-950 sm:rounded-[2rem] sm:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Social media library
          </p>
          <h2 className="mt-1 text-xl font-black text-ink dark:text-white">
            Photos/videos for the 100-day queue
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
            Upload photos/videos once, then ReviewIntel rotates active media through the AI queue with new captions, hooks, and hashtags.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-ocean/30 bg-cyan-50/60 p-4 dark:border-cyan-300/20 dark:bg-cyan-300/10">
          <div className="mb-4 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-soft dark:border-white/10 dark:bg-slate-900">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-ocean dark:text-cyan-300">
              Built-in safety pack
            </p>
            <p className="mt-1 text-sm font-black text-ink dark:text-white">
              100 ReviewIntel house images are embedded and ready for the queue.
            </p>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">
              Uploaded advertiser/sponsor media rotates first. If no active upload is available, ReviewIntel posts its own branded creative automatically.
            </p>
          </div>
          <label className="block cursor-pointer rounded-2xl bg-white px-4 py-4 text-sm font-black text-ink shadow-soft dark:bg-slate-900 dark:text-white">
            <span>{uploadingMedia ? "Uploading..." : "Upload photos/videos"}</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              disabled={uploadingMedia || saving}
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                void uploadMediaFiles(files);
                event.target.value = "";
              }}
              className="sr-only"
            />
          </label>
          <p className="mt-2 text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">
            Uploads stay in the ReviewIntel media library. Connected platforms can publish; unconnected platforms create ready-to-post drafts.
          </p>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_150px]">
          <input
            value={mediaForm.file_url}
            onChange={(event) => setMediaForm((current) => ({ ...current, file_url: event.target.value }))}
            placeholder="Image/video URL or uploaded path"
            className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
          <select
            value={mediaForm.media_type}
            onChange={(event) => setMediaForm((current) => ({ ...current, media_type: event.target.value }))}
            className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-black text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
          <input
            value={mediaForm.title}
            onChange={(event) => setMediaForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Title"
            className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
          <input
            value={mediaForm.topic}
            onChange={(event) => setMediaForm((current) => ({ ...current, topic: event.target.value }))}
            placeholder="Topic, e.g. shopper_tips"
            className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
          <input
            value={mediaForm.thumbnail_url}
            onChange={(event) => setMediaForm((current) => ({ ...current, thumbnail_url: event.target.value }))}
            placeholder="Thumbnail URL optional"
            className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
          <input
            value={mediaForm.tags}
            onChange={(event) => setMediaForm((current) => ({ ...current, tags: event.target.value }))}
            placeholder="Tags separated by comma"
            className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <button
          type="button"
          onClick={addMedia}
          disabled={saving || !mediaForm.file_url.trim()}
          className="mt-4 rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-ink"
        >
          Add media to library
        </button>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {media.length ? media.map((item) => (
            <article key={item.id} className="rounded-2xl border border-line bg-mist p-3 dark:border-white/10 dark:bg-slate-900">
              <div className="flex gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white dark:bg-slate-950">
                  {item.media_type === "image" ? (
                    <img src={item.thumbnail_url || item.file_url} alt={item.alt_text || item.title || "Social media item"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-black text-slate-500">
                      VIDEO
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-ink dark:text-white">
                    {item.title || item.file_url}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300">
                    {item.media_type} · used {item.used_count || 0}x
                  </p>
                  {item.topic ? (
                    <p className="mt-1 text-xs font-black text-ocean dark:text-cyan-300">
                      {item.topic}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleMediaActive(item)}
                disabled={saving}
                className={`mt-3 rounded-xl px-3 py-2 text-xs font-black ${
                  item.is_active
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {item.is_active ? "Active" : "Paused"}
              </button>
            </article>
          )) : (
            <p className="rounded-2xl bg-mist p-4 text-sm font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
              No media added yet. Add image/video URLs to feed the 100-day automation.
            </p>
          )}
        </div>
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
                <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${
                  post.status === "posted"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200"
                    : post.status === "draft_ready"
                      ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-400/10 dark:text-cyan-200"
                      : post.status === "failed"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-400/10 dark:text-rose-200"
                        : "bg-white text-ink dark:bg-slate-800 dark:text-white"
                }`}>
                  {post.status.replaceAll("_", " ")}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-300">
                  {new Date(post.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
                {post.caption}
              </p>
              {post.hashtags?.length ? (
                <p className="mt-3 text-xs font-black leading-5 text-ocean dark:text-cyan-300">
                  #{post.hashtags.join(" #")}
                </p>
              ) : null}
              {post.metadata?.shortVideoScript || post.metadata?.content?.shortVideoScript ? (
                <details className="mt-3 rounded-xl bg-white p-3 text-xs font-bold leading-5 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                  <summary className="cursor-pointer font-black text-ink dark:text-white">
                    Short video script
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap font-sans">
                    {post.metadata.shortVideoScript || post.metadata.content?.shortVideoScript}
                  </pre>
                </details>
              ) : null}
              {post.metadata?.connectorRequired || post.metadata?.note ? (
                <p className="mt-3 rounded-xl bg-cyan-50 p-3 text-xs font-black text-cyan-800 dark:bg-cyan-400/10 dark:text-cyan-200">
                  {post.metadata.note || "Connector required before direct publishing."}
                </p>
              ) : null}
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
