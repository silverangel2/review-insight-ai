import { createHash, randomUUID } from "crypto";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { mkdir, readFile, rm, stat } from "fs/promises";
import os from "os";
import path from "path";
import sharp from "sharp";
import ffprobeInstaller from "ffprobe-static";
import {
  publicSocialMediaStorageBucket,
  uploadPublicSupabaseObject,
} from "@/lib/supabasePublicStorage";

const width = 1080;
const height = 1920;
const sceneSeconds = 4;
const sceneCount = 5;
const totalSeconds = sceneSeconds * sceneCount;
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
  width: number;
  height: number;
  mimeType: "video/mp4";
  ffprobe: Record<string, unknown>;
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

function sceneOverlaySvg(input: { hook: string; support: string; cta: string; accent: string; scene: number; fontBase64: string }) {
  const font = "ReviewIntel Sans, Arial, sans-serif";
  const hook = wrapLines(input.hook, 23, 2);
  const support = wrapLines(input.support, 34, 3);
  const cta = wrapLines(input.cta, 24, 2);
  const common = `<text x="84" y="130" font-family="${font}" font-size="28" font-weight="700" fill="#ffffff" opacity="0.94">REVIEWINTEL</text><rect x="84" y="154" width="150" height="6" rx="3" fill="${input.accent}"/>`;
  const headline = (lines: string[], y: number, size = 72, color = "#ffffff") => `<text font-family="${font}">${textTspans(lines, 84, y, size, size + 10, color)}</text>`;
  let content = "";

  if (input.scene === 1) {
    content = `${headline(hook, 1210, 78)}<text font-family="${font}">${textTspans(support, 88, 1435, 34, 48, "#dbeafe")}</text><circle cx="900" cy="1540" r="118" fill="${input.accent}" opacity="0.18"/><circle cx="900" cy="1540" r="74" fill="none" stroke="${input.accent}" stroke-width="8" opacity="0.8"/>`;
  } else if (input.scene === 2) {
    content = `<rect x="84" y="880" width="912" height="510" rx="42" fill="#081526" opacity="0.88" stroke="#ffffff" stroke-opacity="0.18"/><text font-family="${font}">${textTspans(["The star rating is", "not the whole story."], 132, 1030, 62, 76, "#ffffff")}</text><rect x="132" y="1240" width="730" height="14" rx="7" fill="#334155"/><rect x="132" y="1240" width="420" height="14" rx="7" fill="${input.accent}"/><text x="132" y="1325" font-family="${font}" font-size="31" font-weight="700" fill="#bfdbfe">Repeated complaints can hide in the average.</text>`;
  } else if (input.scene === 3) {
    content = `<text font-family="${font}">${textTspans(["ReviewIntel", "scans the pattern."], 84, 500, 68, 82, "#ffffff")}</text><rect x="84" y="700" width="912" height="730" rx="44" fill="#f8fafc" opacity="0.97"/><rect x="132" y="770" width="816" height="70" rx="20" fill="#e0f2fe"/><circle cx="175" cy="805" r="14" fill="${input.accent}"/><text x="214" y="817" font-family="${font}" font-size="31" font-weight="700" fill="#0f172a">Scanning review signals</text><rect x="132" y="910" width="680" height="22" rx="11" fill="#cbd5e1"/><rect x="132" y="910" width="520" height="22" rx="11" fill="${input.accent}"/><text x="132" y="1030" font-family="${font}" font-size="32" font-weight="700" fill="#334155">Complaints found</text><text x="790" y="1030" font-family="${font}" font-size="40" font-weight="700" fill="#0f172a">18</text><text x="132" y="1150" font-family="${font}" font-size="32" font-weight="700" fill="#334155">Review quality</text><text x="790" y="1150" font-family="${font}" font-size="40" font-weight="700" fill="#0f172a">High</text><text x="132" y="1270" font-family="${font}" font-size="32" font-weight="700" fill="#334155">Risk signals</text><text x="790" y="1270" font-family="${font}" font-size="40" font-weight="700" fill="#0f172a">Clear</text>`;
  } else if (input.scene === 4) {
    content = `<text font-family="${font}">${textTspans(["A clearer score", "before you buy."], 84, 420, 70, 82, "#ffffff")}</text><circle cx="540" cy="1020" r="230" fill="#082f49" stroke="${input.accent}" stroke-width="14"/><text x="540" y="1095" text-anchor="middle" font-family="${font}" font-size="210" font-weight="700" fill="#ffffff">8.7</text><text x="540" y="1170" text-anchor="middle" font-family="${font}" font-size="32" font-weight="700" fill="#a5f3fc">BUYER CONFIDENCE</text><rect x="120" y="1430" width="840" height="20" rx="10" fill="#164e63"/><rect x="120" y="1430" width="730" height="20" rx="10" fill="${input.accent}"/><text x="120" y="1535" font-family="${font}" font-size="32" font-weight="700" fill="#e0f2fe">Strengths found</text><text x="820" y="1535" font-family="${font}" font-size="32" font-weight="700" fill="#ffffff">12</text>`;
  } else {
    content = `<rect x="84" y="820" width="912" height="650" rx="48" fill="#ffffff" opacity="0.96"/><text font-family="${font}">${textTspans(["Know the pattern.", "Shop with confidence."], 140, 1010, 65, 80, "#0f172a")}</text><text font-family="${font}">${textTspans(cta, 140, 1255, 38, 52, "#334155")}</text><rect x="140" y="1360" width="500" height="84" rx="42" fill="${input.accent}"/><text x="390" y="1416" text-anchor="middle" font-family="${font}" font-size="32" font-weight="700" fill="#082f49">TRY REVIEWINTEL</text>`;
  }

  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><defs><style>@font-face{font-family:'ReviewIntel Sans';src:url('data:font/ttf;base64,${input.fontBase64 || ""}') format('truetype');font-weight:100 900;}</style><linearGradient id="shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#020617" stop-opacity="0.88"/><stop offset="0.56" stop-color="#0f172a" stop-opacity="0.68"/><stop offset="1" stop-color="#075985" stop-opacity="0.86"/></linearGradient><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#020617" flood-opacity="0.4"/></filter></defs><rect width="1080" height="1920" fill="url(#shade)"/>${common}${content}</svg>`);
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
  const fontBase64 = (await readFile(path.join(process.cwd(), "public/fonts/ReviewIntelSans.ttf"))).toString("base64");

  const background = await sharp(input.imageBuffer)
    .resize(width, height, { fit: "cover", position: "attention" })
    .modulate({ brightness: 0.34, saturation: 0.86 })
    .png()
    .toBuffer();

  await sharp(background)
    .composite([
      {
        input: sceneOverlaySvg({
          hook,
          support,
          cta,
          accent,
          scene: input.scene,
          fontBase64,
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
    child.on("error", (error) => reject(new Error(`${path.basename(command)}: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${path.basename(command)} exited with code ${code}`));
    });
  });
}

async function resolveFfmpegPath() {
  const candidates = [
    process.env.FFMPEG_PATH?.trim(),
    process.platform === "linux" ? path.join(process.cwd(), "node_modules/@ffmpeg-installer/linux-x64/ffmpeg") : "",
    process.platform === "darwin" && process.arch === "arm64" ? path.join(process.cwd(), "node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg") : "",
    process.platform === "darwin" ? path.join(process.cwd(), "node_modules/@ffmpeg-installer/darwin-x64/ffmpeg") : "",
  ].filter(Boolean);
  const binary = candidates.find((candidate) => typeof candidate === "string" && existsSync(candidate)) as string | undefined;
  if (!binary) throw new Error("ffmpeg binary path is not available.");
  return binary;
}

function runProcessOutput(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => reject(new Error(`${path.basename(command)}: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `${path.basename(command)} exited with code ${code}`));
    });
  });
}

function resolveFfprobePath() {
  const packagePath = (ffprobeInstaller as { path?: string }).path || "";
  const candidates = [
    packagePath,
    process.platform === "darwin" && process.arch === "arm64" ? path.join(process.cwd(), "node_modules/ffprobe-static/bin/darwin/arm64/ffprobe") : "",
    process.platform === "darwin" ? path.join(process.cwd(), "node_modules/ffprobe-static/bin/darwin/x64/ffprobe") : "",
    process.platform === "linux" && process.arch === "x64" ? path.join(process.cwd(), "node_modules/ffprobe-static/bin/linux/x64/ffprobe") : "",
  ].filter(Boolean);
  const binary = candidates.find((candidate) => existsSync(candidate));
  if (!binary) throw new Error("ffprobe binary path is not available.");
  return binary;
}

async function probeGeneratedMp4(filePath: string, ffprobePath: string) {
  const raw = await runProcessOutput(ffprobePath, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", filePath]);
  const probe = JSON.parse(raw) as { streams?: Array<Record<string, unknown>>; format?: Record<string, unknown> };
  const video = (probe.streams || []).find((stream) => stream.codec_type === "video");
  const formatName = String(probe.format?.format_name || "");
  const widthValue = Number(video?.width);
  const heightValue = Number(video?.height);
  const durationValue = Number(video?.duration || probe.format?.duration);
  const sizeValue = Number(probe.format?.size);
  if (!formatName.split(",").includes("mp4") || video?.codec_name !== "h264" || !Number.isFinite(widthValue) || !Number.isFinite(heightValue) || Math.abs(widthValue / heightValue - 9 / 16) > 0.01 || !Number.isFinite(durationValue) || durationValue <= 0 || !Number.isFinite(sizeValue) || sizeValue <= 0 || sizeValue > publicSocialMaxBytes) {
    throw new Error("Generated Reel failed ffprobe validation for MP4, H.264, 9:16, duration, or file size.");
  }
  return { probe, width: widthValue, height: heightValue, durationSeconds: durationValue, size: sizeValue };
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
    const frames = Array.from({ length: sceneCount }, (_, index) => path.join(tmpDir, `scene-${index + 1}.png`));

    for (let scene = 1; scene <= sceneCount; scene += 1) {
      await createSceneFrame({
        imageBuffer,
        destination: frames[scene - 1],
        scene,
        captionPlan: input.captionPlan,
      });
    }

    const ffmpegPath = await resolveFfmpegPath();
    const sceneFilters = frames.map((_, index) => `[${index}:v]zoompan=z='min(zoom+0.0015,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${sceneSeconds * 30}:s=${width}x${height}:fps=30,format=yuv420p[v${index}]`).join(";");
    const concatInputs = Array.from({ length: sceneCount }, (_, index) => `[v${index}]`).join("");
    try {
      await runProcess(ffmpegPath, [
      "-y",
      ...frames.flatMap((frame) => ["-i", frame]),
      "-f",
      "lavfi",
      "-t",
      String(totalSeconds),
      "-i",
      audioTrack.lavfi,
      "-filter_complex",
      `${sceneFilters};${concatInputs}concat=n=${sceneCount}:v=1:a=0,format=yuv420p[v];[${sceneCount}:a]volume=${audioTrack.volume},afade=t=in:st=0:d=0.5,afade=t=out:st=19.2:d=0.8[a]`,
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
    } catch (error) {
      throw new Error(`Fresh Reel FFmpeg encode failed (${ffmpegPath}): ${error instanceof Error ? error.message : String(error)}`);
    }

    const ffprobePath = resolveFfprobePath();
    let validated;
    try {
      validated = await probeGeneratedMp4(outputPath, ffprobePath);
    } catch (error) {
      throw new Error(`Fresh Reel FFprobe validation failed (${ffprobePath}): ${error instanceof Error ? error.message : String(error)}`);
    }
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
      width: validated.width,
      height: validated.height,
      durationSeconds: validated.durationSeconds,
      mimeType: "video/mp4",
      ffprobe: validated.probe,
      audioTrack,
    } satisfies FreshReelVideoResult;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => null);
  }
}
