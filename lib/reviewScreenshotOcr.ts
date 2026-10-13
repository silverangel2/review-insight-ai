import { createHash } from "node:crypto";
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

export type ScreenshotOcrLine = { text: string; confidence: number };
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
  let worker: OcrWorker | undefined;
  let timedOut = false;
  const run = async (): Promise<ScreenshotOcrResult> => {
    const { createWorker, langPath, gzip } = await (opts.loader ?? loadCreateWorker)();
    const w = await createWorker("eng", 1, { langPath, gzip, cacheMethod: "none", logger: () => undefined, errorHandler: () => undefined });
    worker = w;
    if (timedOut) { void w.terminate().catch(() => null); throw new ScreenshotOcrTimeoutError(timeoutMs); }
    const { data } = await w.recognize(image, {}, { blocks: true, text: true });
    const lines: ScreenshotOcrLine[] = [];
    for (const block of data.blocks || []) for (const para of block.paragraphs || []) for (const line of para.lines || []) {
      lines.push({ text: String(line.text || "").replace(/\s+/g, " ").trim(), confidence: Number(line.confidence) || 0 });
    }
    return { fileSha256, ocrConfidence: Number(data.confidence) || 0, lines: lines.filter(l => l.text), engine: "tesseract.js" };
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
