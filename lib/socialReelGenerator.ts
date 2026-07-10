import { createHash, randomUUID } from "crypto";
import { spawn } from "child_process";
import { mkdir, readFile, rm, stat } from "fs/promises";
import os from "os";
import path from "path";
import sharp from "sharp";
import {
  publicSocialMediaStorageBucket,
  uploadPublicSupabaseObject,
} from "@/lib/supabasePublicStorage";

const width = 1080;
const height = 1920;
const sceneSeconds = 3;
const totalSeconds = sceneSeconds * 3;
const publicSocialMaxBytes = 50 * 1024 * 1024;

export type ReelSourceImageInput = {
  id: string;
  title?: string | null;
  file_url: string;
  thumbnail_url?: string | null;
  topic?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type ReelCaptionPlan = {
  caption: string;
  hashtags: string[];
  websiteUrl: string;
  websiteShortUrl?: string;
  affiliateUrl: string;
  affiliateShortUrl?: string;
  affiliateRelevant?: boolean;
  cta: string;
  theme: string;
  overlayHook?: string;
  overlaySupport?: string;
  overlayCta?: string;
  discoveryTopic?: string;
  hashtagScore?: Record<string, number>;
};

export type ApprovedAudioTrack = {
  id: string;
  name: string;
  license: string;
  lavfi: string;
  volume: number;
};

export type FreshReelVideoResult = {
  filename: string;
  objectPath: string;
  publicUrl: string;
  size: number;
  durationSeconds: number;
  audioTrack: ApprovedAudioTrack;
};

export const approvedGeneratedAudioTracks: ApprovedAudioTrack[] = [
  {
    id: "ri-original-soft-pulse",
    name: "ReviewIntel Original Soft Pulse",
    license: "Original generated tone bed; royalty-free for ReviewIntel owned social media.",
    lavfi: "sine=frequency=196:sample_rate=44100",
    volume: 0.035,
  },
  {
    id: "ri-original-warm-lift",
    name: "ReviewIntel Original Warm Lift",
    license: "Original generated tone bed; royalty-free for ReviewIntel owned social media.",
    lavfi: "sine=frequency=261.63:sample_rate=44100",
    volume: 0.032,
  },
  {
    id: "ri-original-light-motion",
    name: "ReviewIntel Original Light Motion",
    license: "Original generated tone bed; royalty-free for ReviewIntel owned social media.",
    lavfi: "sine=frequency=329.63:sample_rate=44100",
    volume: 0.028,
  },
];

function cleanSupabaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

function cleanPublicSiteUrl(value: string) {
  return value.replace(/\/$/, "");
}

function safeText(value: unknown, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function compactText(value: unknown, maxLength: number) {
  const clean = safeText(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}...`;
}

function xmlEscape(value: unknown) {
  return safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapLines(value: unknown, maxChars: number, maxLines: number) {
  const words = safeText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
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

function textTspans(lines: string[], x: number, y: number, size: number, gap: number, color: string) {
  return lines
    .map(
      (line, index) =>
        `<tspan x="${x}" y="${y + index * gap}" font-size="${size}" font-weight="900" fill="${color}">${xmlEscape(line)}</tspan>`
    )
    .join("");
}

function seedNumber(seed: string) {
  return Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export function selectApprovedAudioTrack(seed: string) {
  const index = Math.abs(seedNumber(seed)) % approvedGeneratedAudioTracks.length;
  return approvedGeneratedAudioTracks[index];
}

function resolveSourceImageUrl(image: ReelSourceImageInput, publicSiteUrl: string) {
  const rawUrl = image.file_url || image.thumbnail_url || "";
  if (!rawUrl) throw new Error("Source image URL is missing.");
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) return rawUrl;
  if (rawUrl.startsWith("/")) return `${cleanPublicSiteUrl(publicSiteUrl)}${rawUrl}`;
  throw new Error("Source image URL must be an absolute URL or public ReviewIntel path.");
}

async function fetchImageBuffer(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Source image returned HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType && !contentType.toLowerCase().startsWith("image/")) {
    throw new Error("Source image URL did not return an image content type.");
  }

  return Buffer.from(await response.arrayBuffer());
}

function sceneOverlaySvg(input: {
  hook: string;
  support: string;
  cta: string;
  accent: string;
  scene: number;
}) {
  const hookLines = wrapLines(input.hook, 22, 2);
  const supportLines = input.scene === 1 ? wrapLines(input.support, 38, 2) : [];
  const ctaLines = input.scene === 3 ? wrapLines(input.cta, 24, 1) : [];
  const panelHeight = input.scene === 2 ? 0 : input.scene === 3 ? 330 : 410;
  const panelTop = input.scene === 3 ? 1320 : 1210;
  const panel = panelHeight
    ? `<rect x="86" y="${panelTop}" width="908" height="${panelHeight}" rx="44" fill="#ffffff" opacity="0.94" filter="url(#shadow)"/>`
    : "";
  const supportText = supportLines.length
    ? `<text font-family="Inter, Arial, sans-serif">${textTspans(supportLines, 144, panelTop + 210, 35, 48, "#475569")}</text>`
    : "";
  const ctaText = ctaLines.length
    ? `<rect x="144" y="${panelTop + 190}" width="440" height="78" rx="39" fill="${input.accent}" opacity="0.18"/>
    <text font-family="Inter, Arial, sans-serif">${textTspans(ctaLines, 184, panelTop + 240, 35, 42, "#0f172a")}</text>`
    : "";

  return Buffer.from(`
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#07111f" stop-opacity="0.68"/>
        <stop offset="0.56" stop-color="#12243b" stop-opacity="0.48"/>
        <stop offset="1" stop-color="#0f766e" stop-opacity="0.70"/>
      </linearGradient>
      <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.96"/>
        <stop offset="1" stop-color="#eef9ff" stop-opacity="0.90"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="24" stdDeviation="30" flood-color="#03101e" flood-opacity="0.38"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#shade)"/>
    <rect x="78" y="94" width="470" height="72" rx="36" fill="#ffffff" opacity="0.92"/>
    <text x="124" y="141" font-family="Inter, Arial, sans-serif" font-size="27" font-weight="950" letter-spacing="4" fill="#0f172a">REVIEWINTEL</text>
    ${panel}
    ${panelHeight ? `<text font-family="Inter, Arial, sans-serif">${textTspans(hookLines, 144, panelTop + 102, 66, 76, "#101827")}</text>` : ""}
    ${supportText}
    ${ctaText}
  </svg>`);
}

async function createSceneFrame(input: {
  imageBuffer: Buffer;
  destination: string;
  scene: number;
  captionPlan: ReelCaptionPlan;
}) {
  const accent = input.scene === 1 ? "#22d3ee" : input.scene === 2 ? "#34d399" : "#fbbf24";
  const hook = compactText(input.captionPlan.overlayHook || input.captionPlan.theme, 58);
  const support = compactText(
    input.captionPlan.overlaySupport || "ReviewIntel turns repeated review signals into clearer next steps.",
    92
  );
  const cta = compactText(input.captionPlan.overlayCta || input.captionPlan.cta, 28);

  const background = await sharp(input.imageBuffer)
    .resize(width, height, { fit: "cover" })
    .blur(22)
    .modulate({ brightness: 0.72, saturation: 1.08 })
    .png()
    .toBuffer();
  const hero = await sharp(input.imageBuffer)
    .resize(800, 800, { fit: "cover" })
    .png()
    .toBuffer();
  const frame = Buffer.from(`
    <svg width="860" height="860" viewBox="0 0 860 860" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="860" height="860" rx="62" fill="#ffffff" opacity="0.92"/>
      <rect x="30" y="30" width="800" height="800" rx="48" fill="#e2e8f0"/>
    </svg>`);

  await sharp(background)
    .composite([
      { input: frame, top: 238, left: 110 },
      { input: hero, top: 268, left: 140 },
      {
        input: sceneOverlaySvg({
          hook,
          support,
          cta,
          accent,
          scene: input.scene,
        }),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toFile(input.destination);
}

function runProcess(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
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

async function resolveFfmpegPath() {
  const mod = await import("@ffmpeg-installer/ffmpeg");
  const installer = (mod.default || mod) as { path?: string };

  if (!installer.path) {
    throw new Error("ffmpeg binary path is not available.");
  }

  return installer.path;
}

function safeFilenamePart(value: string) {
  return value
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48);
}

export async function generateFreshSocialReelVideo(input: {
  sourceImage: ReelSourceImageInput;
  captionPlan: ReelCaptionPlan;
  publicSiteUrl: string;
  supabaseUrl: string;
  serviceKey: string;
  audioSeed: string;
  fetcher?: typeof fetch;
}) {
  const sourceImageUrl = resolveSourceImageUrl(input.sourceImage, input.publicSiteUrl);
  const imageBuffer = await fetchImageBuffer(sourceImageUrl);
  const audioTrack = selectApprovedAudioTrack(input.audioSeed || input.sourceImage.id);
  const cleanId = safeFilenamePart(input.sourceImage.id || "source-image");
  const digest = createHash("sha1")
    .update(`${cleanId}-${input.captionPlan.caption}-${input.audioSeed}`)
    .digest("hex")
    .slice(0, 10);
  const filename = `reviewintel-fresh-reel-${new Date().toISOString().slice(0, 10)}-${cleanId}-${digest}.mp4`;
  const objectPath = `social/videos/${filename}`;
  const tmpDir = path.join(os.tmpdir(), `reviewintel-fresh-reel-${cleanId}-${randomUUID()}`);
  const outputPath = path.join(tmpDir, filename);

  await mkdir(tmpDir, { recursive: true });

  try {
    const frames = [1, 2, 3].map((scene) => path.join(tmpDir, `scene-${scene}.png`));

    for (let scene = 1; scene <= 3; scene += 1) {
      await createSceneFrame({
        imageBuffer,
        destination: frames[scene - 1],
        scene,
        captionPlan: input.captionPlan,
      });
    }

    await runProcess(await resolveFfmpegPath(), [
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
      "-f",
      "lavfi",
      "-t",
      String(totalSeconds),
      "-i",
      audioTrack.lavfi,
      "-filter_complex",
      `[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p,fps=30[v];[3:a]volume=${audioTrack.volume},afade=t=in:st=0:d=0.5,afade=t=out:st=8.2:d=0.8[a]`,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-shortest",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-movflags",
      "+faststart",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      outputPath,
    ]);

    const buffer = await readFile(outputPath);
    const size = await stat(outputPath).then((item) => item.size).catch(() => buffer.length);
    const { storageBucket } = publicSocialMediaStorageBucket();
    const publicUrl = await uploadPublicSupabaseObject({
      supabaseUrl: cleanSupabaseUrl(input.supabaseUrl),
      serviceKey: input.serviceKey,
      storageBucket,
      objectPath,
      body: new Blob([new Uint8Array(buffer)], { type: "video/mp4" }),
      contentType: "video/mp4",
      allowedMimeTypes: ["video/mp4", "image/png", "image/jpeg", "image/webp"],
      fileSizeLimit: publicSocialMaxBytes,
      fetcher: input.fetcher,
    });

    return {
      filename,
      objectPath,
      publicUrl,
      size,
      durationSeconds: totalSeconds,
      audioTrack,
    } satisfies FreshReelVideoResult;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => null);
  }
}
