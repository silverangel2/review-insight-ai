#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import sharp from "sharp";
import {
  assertFacebookAccessibleUrl,
  ensurePublicSupabaseStorageBucket,
  supabasePublicObjectUrl,
} from "./social-storage-public.mjs";

const cwd = process.cwd();
const width = 1080;
const height = 1920;
const sceneSeconds = 3;
const totalSeconds = sceneSeconds * 3;
const codexImagePattern = /^reviewintel-premium-day-\d{2}-.+\.(?:png|jpg|jpeg|webp)$/i;
const defaultTopics = [
  "shopper_tips",
  "seller_tips",
  "fake_review_warning",
  "buyer_mistakes",
  "competitor_watch",
  "trust_signals",
];

const topicCopy = {
  shopper_tips: {
    hook: "A high rating can still hide buyer warnings.",
    insight: "ReviewIntel checks repeated complaints, trust signals, and buying risk before checkout.",
    cta: "Scan the product before you buy.",
  },
  seller_tips: {
    hook: "Reviews are product strategy, not just feedback.",
    insight: "ReviewIntel turns buyer language into clearer product fixes and positioning moves.",
    cta: "Use review intelligence to improve faster.",
  },
  fake_review_warning: {
    hook: "Star ratings alone are not enough.",
    insight: "ReviewIntel looks for review quality, repeated patterns, and AI-like signals.",
    cta: "Check the review pattern first.",
  },
  buyer_mistakes: {
    hook: "One missed warning can turn into a bad purchase.",
    insight: "ReviewIntel helps shoppers check limits, complaints, return risk, and real buyer experience.",
    cta: "Know the pattern before checkout.",
  },
  competitor_watch: {
    hook: "Competitor complaints can become your advantage.",
    insight: "ReviewIntel shows sellers where buyers are frustrated and where better products can win.",
    cta: "Compare the review signals.",
  },
  trust_signals: {
    hook: "Trust comes from repeated buyer evidence.",
    insight: "ReviewIntel separates useful review patterns from empty praise and weak signals.",
    cta: "Turn messy reviews into a clear decision.",
  },
};

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function loadLocalEnv() {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") return;

  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(cwd, filename);
    if (!existsSync(filePath)) continue;

    const raw = readFileSync(filePath, "utf8");

    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const key = match[1];
      if (process.env[key]) continue;

      let value = match[2].trim();
      if (!value || value.startsWith("#")) continue;
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/$/, "");
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";
const storageBucket =
  process.env.SUPABASE_SOCIAL_MEDIA_BUCKET ||
  process.env.SUPABASE_MEDIA_BUCKET ||
  process.env.SUPABASE_STORAGE_BUCKET ||
  "reviewintel-media";

const jsonMode = hasArg("--json");
const localOnly = hasArg("--local-only");
const requestedLimit = Number(argValue("--limit", process.env.CODEX_SOCIAL_VIDEO_LIMIT || "100"));
const limit = Math.max(1, Math.min(100, Number.isFinite(requestedLimit) ? requestedLimit : 100));

function isProductionRuntime() {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}

function log(message) {
  if (!jsonMode) console.log(message);
}

function storageHeaders(extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

function hasSupabase() {
  return Boolean(supabaseUrl && serviceKey);
}

async function restFetch(resource, init = {}) {
  if (!hasSupabase()) throw new Error("Supabase is not configured.");

  const response = await fetch(`${supabaseUrl}/rest/v1/${resource}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : text || "Supabase request failed.";
    throw new Error(message);
  }

  return data;
}

async function ensureStorageBucket() {
  if (!hasSupabase() || localOnly) return false;

  await ensurePublicSupabaseStorageBucket({
    supabaseUrl,
    serviceKey,
    storageBucket,
    allowedMimeTypes: ["video/mp4", "image/png", "image/jpeg", "image/webp"],
    fileSizeLimit: 100 * 1024 * 1024,
  });

  return true;
}

async function uploadVideoToStorage(filePath, filename) {
  if (!hasSupabase() || localOnly) return "";

  await ensureStorageBucket();

  const buffer = await readFile(filePath);
  const objectPath = `social/videos/${filename}`;
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${encodeURIComponent(storageBucket)}/${objectPath}`,
    {
      method: "POST",
      headers: storageHeaders({
        "Content-Type": "video/mp4",
        "Cache-Control": "31536000",
        "x-upsert": "true",
      }),
      body: buffer,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || "Supabase Storage upload failed.");
  }

  const publicUrl = supabasePublicObjectUrl({
    supabaseUrl,
    storageBucket,
    objectPath,
  });

  await assertFacebookAccessibleUrl({ url: publicUrl });

  return publicUrl;
}

function localSocialDir() {
  return path.join(cwd, "public", "uploads", "social");
}

function outputRoot() {
  if (isProductionRuntime()) {
    return path.join(os.tmpdir(), "reviewintel-social-videos");
  }

  return path.join(localSocialDir(), "videos");
}

function publicLocalVideoUrl(filename) {
  if (isProductionRuntime()) return "";
  return `/uploads/social/videos/${filename}`;
}

function listCodexImages() {
  try {
    return readdirSync(localSocialDir())
      .filter((file) => codexImagePattern.test(file))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((file) => ({
        file,
        publicUrl: `/uploads/social/${file}`,
        path: path.join(localSocialDir(), file),
      }));
  } catch {
    return [];
  }
}

function safeTopic(topic, index) {
  const clean = String(topic || "").trim();
  return clean || defaultTopics[index % defaultTopics.length] || "shopper_tips";
}

function compactText(value, maxLength = 130) {
  const clean = String(value || "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/#[A-Za-z0-9_]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}...`;
}

function captionSentences(caption) {
  return String(caption || "")
    .replace(/https?:\/\/\S+/g, "")
    .split(/(?<=[.!?])\s+/)
    .map((item) => compactText(item, 150))
    .filter((item) => item.length > 18);
}

function sceneCopy(source, index) {
  const topic = safeTopic(source.topic, index);
  const fallback = topicCopy[topic] || topicCopy.shopper_tips;
  const sentences = captionSentences(source.caption);
  const script = String(source.shortVideoScript || "");
  const scriptLines = script
    .split(/\r?\n/)
    .map((item) => item.replace(/^(Hook|Show|Explain|CTA):\s*/i, "").trim())
    .filter(Boolean);

  return {
    hook: compactText(scriptLines[0] || sentences[0] || fallback.hook, 96),
    insight: compactText(scriptLines[1] || sentences[1] || fallback.insight, 132),
    cta: compactText(scriptLines[2] || sentences[2] || fallback.cta, 92),
    topic,
  };
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapLines(value, maxChars, maxLines) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }

    if (lines.length === maxLines) break;
  }

  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function textTspans(lines, x, y, size, gap, weight = 900, color = "#f8fbff") {
  return lines
    .map((line, index) => (
      `<tspan x="${x}" y="${y + index * gap}" font-size="${size}" font-weight="${weight}" fill="${color}">${xmlEscape(line)}</tspan>`
    ))
    .join("");
}

function sceneOverlaySvg({ label, eyebrow, title, body, cta, accent }) {
  const titleLines = wrapLines(title, 18, 4);
  const bodyLines = wrapLines(body, 30, 4);

  return Buffer.from(`
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#061524" stop-opacity="0.70"/>
        <stop offset="0.55" stop-color="#102a43" stop-opacity="0.45"/>
        <stop offset="1" stop-color="#0f766e" stop-opacity="0.72"/>
      </linearGradient>
      <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.94"/>
        <stop offset="1" stop-color="#ecfeff" stop-opacity="0.88"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="28" stdDeviation="34" flood-color="#00111f" flood-opacity="0.40"/>
      </filter>
    </defs>
    <rect width="1080" height="1920" fill="url(#shade)"/>
    <circle cx="860" cy="250" r="260" fill="${accent}" opacity="0.28"/>
    <circle cx="140" cy="1580" r="330" fill="#38bdf8" opacity="0.18"/>
    <rect x="80" y="105" width="920" height="96" rx="48" fill="#ffffff" opacity="0.94"/>
    <text x="130" y="167" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="7" fill="#0f172a">REVIEWINTEL</text>
    <text x="805" y="167" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="900" fill="#0f766e">${xmlEscape(label)}</text>
    <rect x="80" y="1115" width="920" height="620" rx="60" fill="url(#card)" filter="url(#shadow)"/>
    <text x="130" y="1215" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="900" letter-spacing="7" fill="#2563eb">${xmlEscape(eyebrow)}</text>
    <text font-family="Inter, Arial, sans-serif">${textTspans(titleLines, 130, 1310, 76, 86, 950, "#101827")}</text>
    <text font-family="Inter, Arial, sans-serif">${textTspans(bodyLines, 130, 1560, 34, 48, 800, "#475569")}</text>
    <rect x="130" y="1638" width="560" height="70" rx="35" fill="${accent}" opacity="0.16"/>
    <text x="170" y="1684" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="950" fill="#0f172a">${xmlEscape(cta)}</text>
    <text x="130" y="1810" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="900" fill="#dffcff">getreviewintel.com</text>
  </svg>`);
}

async function createSceneFrame({ sourceImage, destination, scene, copy }) {
  const accent = scene === 1 ? "#22d3ee" : scene === 2 ? "#34d399" : "#fbbf24";
  const label = scene === 1 ? "HOOK" : scene === 2 ? "INSIGHT" : "CTA";
  const title = scene === 1 ? copy.hook : scene === 2 ? copy.insight : copy.cta;
  const body =
    scene === 1
      ? "The star rating is only the surface."
      : scene === 2
        ? "Repeated buyer patterns matter more than one loud review."
        : "Upload. Scan. Decide with clearer review intelligence.";
  const cta = scene === 3 ? "Try ReviewIntel" : "Scan before checkout";

  let background;
  if (sourceImage?.path && existsSync(sourceImage.path)) {
    background = await sharp(sourceImage.path)
      .resize(width, height, { fit: "cover" })
      .blur(20)
      .modulate({ brightness: 0.72, saturation: 1.08 })
      .png()
      .toBuffer();
  } else {
    background = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: "#0f172a",
      },
    }).png().toBuffer();
  }

  const overlays = [
    {
      input: sceneOverlaySvg({
        label,
        eyebrow: scene === 1 ? "BEFORE YOU BUY" : scene === 2 ? "BUYER SIGNAL" : "NEXT STEP",
        title,
        body,
        cta,
        accent,
      }),
      top: 0,
      left: 0,
    },
  ];

  if (sourceImage?.path && existsSync(sourceImage.path)) {
    const hero = await sharp(sourceImage.path)
      .resize(800, 800, { fit: "cover" })
      .png()
      .toBuffer();
    const frame = Buffer.from(`
      <svg width="860" height="860" viewBox="0 0 860 860" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="860" height="860" rx="62" fill="#ffffff" opacity="0.92"/>
        <rect x="30" y="30" width="800" height="800" rx="48" fill="#e2e8f0"/>
      </svg>`);
    overlays.push({ input: frame, top: 240, left: 110 });
    overlays.push({ input: hero, top: 270, left: 140 });
  }

  await sharp(background).composite(overlays).png().toFile(destination);
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${path.basename(command)} exited with code ${code}`));
    });
  });
}

async function renderVideo(source, index, sourceImage) {
  const cleanId = String(source.id || source.source_post_id || `codex-${index + 1}`)
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48);
  const digest = createHash("sha1").update(`${cleanId}-${source.caption || ""}-${source.topic || ""}`).digest("hex").slice(0, 8);
  const filename = `reviewintel-codex-reel-${String(index + 1).padStart(3, "0")}-${digest}.mp4`;
  const outDir = outputRoot();
  const outputPath = path.join(outDir, filename);

  await mkdir(outDir, { recursive: true });

  if (existsSync(outputPath)) {
    return { outputPath, filename, existed: true };
  }

  const tmpDir = path.join(os.tmpdir(), `reviewintel-video-${cleanId}-${randomUUID()}`);
  await mkdir(tmpDir, { recursive: true });

  try {
    const copy = sceneCopy(source, index);
    const frames = [1, 2, 3].map((scene) => path.join(tmpDir, `scene-${scene}.png`));

    for (let scene = 1; scene <= 3; scene += 1) {
      await createSceneFrame({
        sourceImage,
        destination: frames[scene - 1],
        scene,
        copy,
      });
    }

    await runProcess(ffmpegInstaller.path, [
      "-y",
      "-loop",
      "1",
      "-t",
      String(sceneSeconds),
      "-i",
      frames[0],
      "-loop",
      "1",
      "-t",
      String(sceneSeconds),
      "-i",
      frames[1],
      "-loop",
      "1",
      "-t",
      String(sceneSeconds),
      "-i",
      frames[2],
      "-filter_complex",
      "[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p,fps=30[v]",
      "-map",
      "[v]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-movflags",
      "+faststart",
      "-pix_fmt",
      "yuv420p",
      outputPath,
    ]);

    return { outputPath, filename, existed: false };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => null);
  }
}

async function fetchExistingVideoSourceIds() {
  if (!hasSupabase()) return new Set();

  const rows = await restFetch(
    "admin_social_media?select=id,metadata,media_type&media_type=eq.video&limit=1000"
  ).catch(() => []);

  if (!Array.isArray(rows)) return new Set();

  return new Set(
    rows
      .map((row) => row?.metadata?.source_post_id)
      .filter(Boolean)
      .map(String)
  );
}

async function fetchSocialPosts() {
  if (!hasSupabase()) return [];

  const rows = await restFetch(
    `admin_social_posts?select=id,topic,caption,hashtags,metadata,created_at&order=created_at.desc&limit=${limit}`
  ).catch(() => []);

  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => String(row?.caption || "").trim())
    .map((row, index) => ({
      id: String(row.id || `post-${index + 1}`),
      source_post_id: String(row.id || `post-${index + 1}`),
      topic: safeTopic(row.topic, index),
      caption: String(row.caption || ""),
      shortVideoScript: String(row.metadata?.content?.shortVideoScript || row.metadata?.shortVideoScript || ""),
      created_at: row.created_at || null,
    }));
}

function fallbackSources(images) {
  return images.slice(0, limit).map((image, index) => {
    const topic = safeTopic("", index);
    const copy = topicCopy[topic] || topicCopy.shopper_tips;

    return {
      id: image.file.replace(/\.[a-z0-9]+$/i, ""),
      source_post_id: image.file.replace(/\.[a-z0-9]+$/i, ""),
      topic,
      caption: `${copy.hook} ${copy.insight} ${copy.cta}`,
      shortVideoScript: "",
      created_at: null,
    };
  });
}

async function insertMediaRow(row) {
  if (!hasSupabase() || hasArg("--no-db")) return null;

  const withMime = { ...row, mime_type: "video/mp4" };

  try {
    const rows = await restFetch("admin_social_media", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(withMime),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  } catch (error) {
    if (!String(error?.message || "").toLowerCase().includes("mime_type")) {
      throw error;
    }

    const rows = await restFetch("admin_social_media", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }
}

async function main() {
  const images = listCodexImages();
  const existingSourceIds = await fetchExistingVideoSourceIds();
  const socialPosts = await fetchSocialPosts();
  const postSourceIds = new Set(socialPosts.map((source) => String(source.source_post_id || source.id || "")));
  const imageFallbackSources = fallbackSources(images).filter((source) => {
    const sourceId = String(source.source_post_id || source.id || "");
    return sourceId && !postSourceIds.has(sourceId);
  });
  const sources = [...socialPosts, ...imageFallbackSources].slice(0, limit);
  const generated = [];
  const skipped = [];
  const failed = [];

  log(`Generating ReviewIntel Codex social videos from ${sources.length} source records...`);

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const sourcePostId = String(source.source_post_id || source.id || `source-${index + 1}`);

    if (existingSourceIds.has(sourcePostId)) {
      skipped.push({ source_post_id: sourcePostId, reason: "video already registered" });
      continue;
    }

    const sourceImage = images[index % Math.max(1, images.length)] || null;

    try {
      const rendered = await renderVideo(source, index, sourceImage);
      const size = await stat(rendered.outputPath).then((item) => item.size).catch(() => 0);
      let fileUrl = "";
      let storage = "local";

      try {
        fileUrl = await uploadVideoToStorage(rendered.outputPath, rendered.filename);
        if (fileUrl) storage = "supabase";
      } catch (error) {
        if (isProductionRuntime()) throw error;
      }

      if (!fileUrl) {
        fileUrl = publicLocalVideoUrl(rendered.filename);
      }

      if (!fileUrl) {
        throw new Error("Generated video needs Supabase Storage in production.");
      }

      const now = new Date().toISOString();
      const topic = safeTopic(source.topic, index);
      const mediaRow = {
        title: `ReviewIntel Codex reel - ${topic.replace(/_/g, " ")}`,
        media_type: "video",
        file_url: fileUrl,
        thumbnail_url: sourceImage?.publicUrl || null,
        alt_text: "ReviewIntel vertical social video generated from the Codex premium social library.",
        topic,
        tags: ["ReviewIntel", "CodexLibrary", "VerticalReel", "SocialVideo", topic],
        is_active: true,
        used_count: 0,
        metadata: {
          codex_library: true,
          media_type: "video",
          mime_type: "video/mp4",
          source_post_id: sourcePostId,
          video_duration_seconds: totalSeconds,
          format: "vertical_reel",
          generated_by: "codex_video_generator",
          source_image: sourceImage?.publicUrl || null,
          file_size_bytes: size,
          storage,
        },
        created_at: now,
        updated_at: now,
      };

      const inserted = await insertMediaRow(mediaRow);

      generated.push({
        source_post_id: sourcePostId,
        file_url: fileUrl,
        media_id: inserted?.id || null,
        storage,
        size,
      });

      log(`Generated ${rendered.filename}`);
    } catch (error) {
      failed.push({
        source_post_id: sourcePostId,
        error: error instanceof Error ? error.message : "Video generation failed.",
      });
    }
  }

  const result = {
    ok: failed.length === 0 || generated.length > 0,
    generated_count: generated.length,
    skipped_count: skipped.length,
    failed_count: failed.length,
    generated,
    skipped,
    failed,
  };

  if (jsonMode) {
    console.log(JSON.stringify(result));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const result = {
    ok: false,
    error: error instanceof Error ? error.message : "Codex social video generation failed.",
  };

  if (jsonMode) console.log(JSON.stringify(result));
  else console.error(result.error);
  process.exitCode = 1;
});
