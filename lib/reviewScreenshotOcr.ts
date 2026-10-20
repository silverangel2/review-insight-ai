import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { CollectedReview } from "./reviewCollector";
import { adjudicateReviewEvidence } from "./reviewEvidenceAdjudication";
import { verifyProductCandidate } from "./productSearchVerifier";

/**
 * Free, local OCR of user-uploaded review screenshots (tesseract.js, bundled
 * English data; no network). OCR output is only *candidate* text: it goes
 * through the same exact-product adjudication as retrieved reviews. Words and
 * blocks below the confidence floor are dropped, never repaired or guessed.
 */
export const SCREENSHOT_OCR_VERSION = "review-screenshot-ocr-v1";
export const MIN_BLOCK_CONFIDENCE = 70;

export type ScreenshotOcrLine = { text: string; confidence: number; bbox?: { x0: number; y0: number; x1: number; y1: number } };
export type ScreenshotOcrResult = {
  fileSha256: string;
  ocrConfidence: number;
  lines: ScreenshotOcrLine[];
  engine: string;
};
export type ScreenshotReviewCandidate = CollectedReview & {
  evidenceType: "WRITTEN_REVIEW";
  provenance: { source: "user_screenshot"; fileSha256: string; ocrConfidence: number; blockConfidence: number; ocrVersion: string };
};

export const SCREENSHOT_OCR_TIMEOUT_MS = 15_000;

export class ScreenshotOcrTimeoutError extends Error {
  code = "SCREENSHOT_OCR_TIMEOUT";
  constructor(ms: number) { super(`Screenshot OCR did not finish within ${ms}ms`); }
}

/**
 * Why a second, upscaled pass exists (measured 2026-10-20 on the live Crock-Pot proof
 * images): tesseract at native scale garbles small text — the Walmart title line read as
 * "Crock Pot? atpolabedives Siowcooker Bn" at confidence 32, below every facts floor, so
 * the scan fell into the no-identity fallback despite a perfectly readable screenshot.
 * The same image upscaled 3x (lanczos, grayscale) reads the title cleanly at 83. Worker
 * parameters (user_defined_dpi, PSM) do NOT rescue it; only real pixels do. The upscale
 * uses the repo's bundled ffmpeg (same binary the social-reel lane ships) and is strictly
 * best-effort: any failure keeps the native-scale result, never the other way round.
 */
export const OCR_TARGET_WIDTH = 2700;
export const OCR_MAX_UPSCALE = 3;

/** Pixel dimensions from PNG/JPEG headers only; null for anything else (no upscale). */
export function imagePixelSize(image: Buffer): { width: number; height: number } | null {
  if (image.length > 24 && image[0] === 0x89 && image[1] === 0x50 && image[2] === 0x4e && image[3] === 0x47) {
    return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
  }
  if (image.length > 4 && image[0] === 0xff && image[1] === 0xd8) {
    let i = 2;
    while (i + 9 < image.length) {
      if (image[i] !== 0xff) { i += 1; continue; }
      const marker = image[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: image.readUInt16BE(i + 5), width: image.readUInt16BE(i + 7) };
      }
      i += 2 + image.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** Upscale factor that brings a small screenshot into the size regime OCR reads well. */
export function ocrUpscaleFactor(image: Buffer): number {
  const size = imagePixelSize(image);
  if (!size || !size.width) return 1;
  return Math.max(1, Math.min(OCR_MAX_UPSCALE, Math.round(OCR_TARGET_WIDTH / size.width)));
}

async function ocrFfmpegCandidates(): Promise<string[]> {
  const candidates: string[] = [];
  const fromCwd = process.platform === "linux"
    ? path.join(process.cwd(), "node_modules/@ffmpeg-installer/linux-x64/ffmpeg")
    : process.platform === "darwin" && process.arch === "arm64"
      ? path.join(process.cwd(), "node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg")
      : process.platform === "darwin"
        ? path.join(process.cwd(), "node_modules/@ffmpeg-installer/darwin-x64/ffmpeg")
        : "";
  if (fromCwd) candidates.push(fromCwd);
  try {
    // The installer's own resolved binary path (what scripts/generate-social-videos.mjs
    // uses) — covers runtimes whose cwd is not the repo root.
    const installer = await import("@ffmpeg-installer/ffmpeg") as { path?: string; default?: { path?: string } };
    const installerPath = installer.path ?? installer.default?.path;
    if (installerPath) candidates.push(installerPath);
  } catch { /* installer unavailable — cwd candidate only */ }
  return candidates;
}

/** Upscale + grayscale via the bundled ffmpeg. Null on ANY failure (best-effort only). */
export async function upscaleImageForOcr(image: Buffer, factor: number): Promise<Buffer | null> {
  const binary = (await ocrFfmpegCandidates()).find(candidate => { try { return existsSync(candidate); } catch { return false; } });
  if (!binary || factor <= 1) return null;
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: Buffer | null) => { if (!settled) { settled = true; resolve(value); } };
    try {
      const proc = spawn(binary, [
        "-v", "error", "-i", "pipe:0",
        "-vf", `scale=iw*${factor}:ih*${factor}:flags=lanczos,format=gray`,
        "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1",
      ], { stdio: ["pipe", "pipe", "pipe"] });
      const chunks: Buffer[] = [];
      const killer = setTimeout(() => { try { proc.kill("SIGKILL"); } catch { /* already gone */ } done(null); }, 10_000);
      proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      proc.on("error", () => { clearTimeout(killer); done(null); });
      proc.on("close", (code) => { clearTimeout(killer); done(code === 0 && chunks.length ? Buffer.concat(chunks) : null); });
      proc.stdin.on("error", () => undefined);
      proc.stdin.end(image);
    } catch { done(null); }
  });
}

const ocrLineKey = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Merge two OCR passes over the same image. Lines are deduped by normalized text (a
 * line read by both keeps its better confidence), then RE-ORDERED by page geometry —
 * normalized (y, x) of each line's bounding box — because downstream title scoring
 * assumes true reading order (product block first, recommendations last). Without
 * the geometry sort, appending a second pass's lines pushes bottom-of-page
 * recommendation rows into title contention. Lines without a bbox keep their
 * relative order after the placed lines. Nothing is invented — every merged line
 * was read by one of the passes.
 */
export function mergeOcrLines(
  primary: ScreenshotOcrLine[],
  extra: ScreenshotOcrLine[],
  primarySize?: { width: number; height: number } | null,
  extraSize?: { width: number; height: number } | null,
): ScreenshotOcrLine[] {
  const entries: Array<{ line: ScreenshotOcrLine; size: { width: number; height: number } | null }> = [];
  const byKey = new Map<string, ScreenshotOcrLine>();
  for (const line of primary) {
    const copy = { ...line };
    entries.push({ line: copy, size: primarySize ?? null });
    const key = ocrLineKey(copy.text);
    if (key && !byKey.has(key)) byKey.set(key, copy);
  }
  for (const line of extra) {
    const key = ocrLineKey(line.text);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      const copy = { ...line };
      entries.push({ line: copy, size: extraSize ?? null });
      byKey.set(key, copy);
    } else if (line.confidence > existing.confidence) existing.confidence = line.confidence;
  }
  const placed = entries.map(({ line, size }, order) => {
    const ny = line.bbox && size?.height ? line.bbox.y0 / size.height : Number.POSITIVE_INFINITY;
    const nx = line.bbox && size?.width ? line.bbox.x0 / size.width : Number.POSITIVE_INFINITY;
    return { line, order, ny, nx };
  });
  placed.sort((a, b) => (a.ny - b.ny) || (a.nx - b.nx) || (a.order - b.order));
  return placed.map(p => p.line);
}

type OcrWorker = { recognize: (...args: unknown[]) => Promise<any>; terminate: () => Promise<unknown> }; // eslint-disable-line @typescript-eslint/no-explicit-any
type CreateWorker = (...args: unknown[]) => Promise<OcrWorker>;

async function loadCreateWorker(): Promise<{ createWorker: CreateWorker; langPath?: string; gzip?: boolean }> {
  // Dynamic import (kept external to the Next bundle via serverExternalPackages).
  const tesseract = await import("tesseract.js");
  const createWorker = (tesseract as { createWorker?: unknown; default?: { createWorker?: unknown } }).createWorker
    ?? (tesseract as { default?: { createWorker?: unknown } }).default?.createWorker;
  const engModule = await import("@tesseract.js-data/eng") as { langPath?: string; gzip?: boolean; default?: { langPath?: string; gzip?: boolean } };
  const eng = engModule.langPath ? engModule : (engModule.default || {});
  if (typeof createWorker !== "function") throw new Error("tesseract.js createWorker unavailable");
  return { createWorker: createWorker as CreateWorker, langPath: eng.langPath, gzip: eng.gzip };
}

/**
 * OCR one screenshot with a hard timeout. If the tesseract worker crashes (e.g. its .wasm
 * is missing from the deployed bundle) its promise can never settle, so the whole call is
 * raced against a timer, the worker is terminated in the background, and the caller gets a
 * ScreenshotOcrTimeoutError it can fall back from instead of hanging the scan.
 */
export async function ocrReviewScreenshot(
  image: Buffer,
  opts: { timeoutMs?: number; loader?: typeof loadCreateWorker } = {},
): Promise<ScreenshotOcrResult> {
  const fileSha256 = createHash("sha256").update(image).digest("hex");
  const timeoutMs = opts.timeoutMs ?? SCREENSHOT_OCR_TIMEOUT_MS;
  const startedAt = Date.now();
  let worker: OcrWorker | undefined;
  let timedOut = false;
  const run = async (): Promise<ScreenshotOcrResult> => {
    const { createWorker, langPath, gzip } = await (opts.loader ?? loadCreateWorker)();
    const w = await createWorker("eng", 1, { langPath, gzip, cacheMethod: "none", logger: () => undefined, errorHandler: () => undefined });
    worker = w;
    if (timedOut) { void w.terminate().catch(() => null); throw new ScreenshotOcrTimeoutError(timeoutMs); }
    const recognizeLines = async (buf: Buffer): Promise<{ lines: ScreenshotOcrLine[]; confidence: number }> => {
      const { data } = await w.recognize(buf, {}, { blocks: true, text: true });
      const lines: ScreenshotOcrLine[] = [];
      for (const block of data.blocks || []) for (const para of block.paragraphs || []) for (const line of para.lines || []) {
        const text = String(line.text || "").replace(/\s+/g, " ").trim();
        const bbox = line.bbox && Number.isFinite(line.bbox.x0) && Number.isFinite(line.bbox.y0)
          ? { x0: line.bbox.x0, y0: line.bbox.y0, x1: line.bbox.x1, y1: line.bbox.y1 }
          : undefined;
        lines.push({ text, confidence: Number(line.confidence) || 0, ...(bbox ? { bbox } : {}) });
      }
      return { lines: lines.filter(l => l.text), confidence: Number(data.confidence) || 0 };
    };
    const native = await recognizeLines(image);
    let lines = native.lines;
    let ocrConfidence = native.confidence;
    // Second pass over an upscaled copy: small-text screenshots (full-page captures,
    // downscaled phone shots) garble exactly the lines that identify the product.
    // The pass is skipped when the native read is already confident, and it races
    // only the REMAINING time budget — if it cannot finish, the native result is
    // returned untouched, so this enhancement can never make a scan worse than
    // the native-only behavior it replaces.
    const factor = ocrUpscaleFactor(image);
    const nativeConfident = native.confidence >= 85 && native.lines.length >= 10;
    const remainingMs = timeoutMs - (Date.now() - startedAt) - 250;
    if (factor > 1 && !nativeConfident && remainingMs > 1_500) {
      const enhancedWork = (async (): Promise<{ lines: ScreenshotOcrLine[]; confidence: number } | null> => {
        const upscaled = await upscaleImageForOcr(image, factor).catch(() => null);
        if (!upscaled) return null;
        return recognizeLines(upscaled);
      })();
      enhancedWork.catch(() => null); // a late rejection after the sub-race must not go unhandled
      const enhanced = await Promise.race([
        enhancedWork,
        new Promise<null>(resolve => setTimeout(() => resolve(null), remainingMs)),
      ]).catch(() => null);
      if (enhanced) {
        const nativeSize = imagePixelSize(image);
        const enhancedSize = nativeSize ? { width: nativeSize.width * factor, height: nativeSize.height * factor } : null;
        lines = mergeOcrLines(native.lines, enhanced.lines, nativeSize, enhancedSize);
        ocrConfidence = Math.max(ocrConfidence, enhanced.confidence);
      }
    }
    return { fileSha256, ocrConfidence, lines, engine: "tesseract.js" };
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { timedOut = true; reject(new ScreenshotOcrTimeoutError(timeoutMs)); }, timeoutMs);
  });
  const work = run();
  work.catch(() => null); // a late rejection after the timeout must not become unhandled
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    const w = worker;
    if (w) void Promise.resolve().then(() => w.terminate()).catch(() => null);
  }
}

const separator = /^(?:\d(?:\.\d)?\s+out of\s+5\s+stars|reviewed in .+ on .+|verified purchase|helpful|report|\d+ people found this helpful)$/i;

/** Split OCR lines into review-sized blocks; UI chrome and low-confidence lines are discarded. */
export function screenshotTextToReviewCandidates(ocr: ScreenshotOcrResult, minConfidence = MIN_BLOCK_CONFIDENCE): { candidates: ScreenshotReviewCandidate[]; droppedLowConfidence: number } {
  const blocks: ScreenshotOcrLine[][] = [[]];
  const ratings: Array<number | null> = [null];
  let dropped = 0;
  // Text before the first review marker is page chrome (title, price), not a review.
  const firstMarker = ocr.lines.findIndex(line => /^(\d(?:\.\d)?)\s+out of\s+5\s+stars|^reviewed in /i.test(line.text));
  for (const line of firstMarker > 0 ? ocr.lines.slice(firstMarker) : ocr.lines) {
    const star = line.text.match(/^(\d(?:\.\d)?)\s+out of\s+5\s+stars/i);
    if (star || /^reviewed in /i.test(line.text)) {
      if (blocks[blocks.length - 1].length) { blocks.push([]); ratings.push(null); }
      if (star) ratings[ratings.length - 1] = Number(star[1]);
      continue;
    }
    if (separator.test(line.text)) continue;
    if (line.confidence < minConfidence) { dropped += 1; continue; }
    blocks[blocks.length - 1].push(line);
  }
  const candidates = blocks.flatMap((block, index) => {
    const body = block.map(l => l.text).join(" ")
      .replace(/(?:brief|full) content visible,? double tap to read (?:full|brief) content\.?/gi, " ")
      .replace(/\s+/g, " ").trim();
    if (body.length < 25) return [];
    const blockConfidence = Math.round(Math.min(...block.map(l => l.confidence)));
    return [{
      source: "user_screenshot",
      // A distinct, non-retailer source host: screenshots never borrow a listing's provenance.
      sourceUrl: `https://user-screenshot.reviewintel.local/${ocr.fileSha256}`,
      reviewId: `${ocr.fileSha256.slice(0, 16)}-${index}`,
      rating: ratings[index],
      body,
      date: null,
      verified: null,
      reviewStructureVerified: false,
      evidenceType: "WRITTEN_REVIEW" as const,
      provenance: { source: "user_screenshot" as const, fileSha256: ocr.fileSha256, ocrConfidence: ocr.ocrConfidence, blockConfidence, ocrVersion: SCREENSHOT_OCR_VERSION },
    }];
  });
  return { candidates, droppedLowConfidence: dropped };
}

/**
 * Screenshot reviews are tied to the product only if the screenshot itself
 * shows a product title that verifies against the requested product.
 */
export function adjudicateScreenshotReviews(ocr: ScreenshotOcrResult, product: { productName: string; brand?: string | null; model?: string | null; exactListingUrl?: string | null }) {
  const { candidates, droppedLowConfidence } = screenshotTextToReviewCandidates(ocr);
  const titleLine = ocr.lines.find(line => line.confidence >= MIN_BLOCK_CONFIDENCE && line.text.length >= 12 &&
    verifyProductCandidate({ scanId: "screenshot-identity", productName: product.productName, brand: product.brand || undefined, model: product.model || undefined }, { url: product.exactListingUrl || "https://user-screenshot.invalid/", title: line.text }).canCollectReviews);
  const records = candidates.map(c => ({ ...c, reviewStructureVerified: Boolean(titleLine), reviewedProductName: titleLine?.text || null, reviewedBrand: titleLine ? product.brand || null : null }));
  const corpus = adjudicateReviewEvidence(records, {
    productName: product.productName, brand: product.brand || "", model: product.model || undefined,
    exactListingAccepted: Boolean(titleLine), exactListingUrl: product.exactListingUrl || "", exactListingTitle: titleLine?.text || product.productName,
  } as Parameters<typeof adjudicateReviewEvidence>[1]);
  return { titleVerified: Boolean(titleLine), candidates: records, droppedLowConfidence, corpus };
}
