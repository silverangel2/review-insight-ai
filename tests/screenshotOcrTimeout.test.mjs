import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const src = readFileSync(new URL("../lib/reviewScreenshotOcr.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");
const cfgPath = ["../next.config.ts", "../next.config.mjs", "../next.config.js"].map(p => new URL(p, import.meta.url)).find(u => existsSync(u));
const cfg = readFileSync(cfgPath, "utf8");

test("tesseract wasm/worker/lang files are traced into the analyze and review-screenshot functions", () => {
  for (const route of ['"/api/analyze"', '"/api/review-screenshot"']) {
    const i = cfg.indexOf(route);
    assert.ok(i > 0, `${route} tracing include missing`);
    const block = cfg.slice(i, cfg.indexOf("]", i));
    assert.match(block, /tesseract\.js-core\/\*\.wasm/);
    assert.match(block, /tesseract\.js\/src\/worker-script/);
    assert.match(block, /@tesseract\.js-data\/eng/);
  }
});

test("OCR is raced against a hard timeout and never hangs the caller", () => {
  assert.match(src, /SCREENSHOT_OCR_TIMEOUT_MS = 15_000/);
  assert.match(src, /Promise\.race\(\[work, timeout\]\)/);
  assert.match(src, /terminate\(\)/);
});

test("analyze route falls back to the link when OCR fails, instead of hanging or failing", () => {
  const i = route.indexOf("async function extractScreenshotFacts");
  const body = route.slice(i, i + 1200);
  assert.match(body, /try \{\s*const ocr = await ocrReviewScreenshot\([\s\S]{0,120}return productFactsFromOcr\(ocr\)/);
  assert.match(body, /catch \(error\)/);
  assert.doesNotMatch(body, /Not scored|Not enough evidence/);
});

test("runtime: a never-settling OCR worker is abandoned at the timeout", async () => {
  const mod = jiti("./lib/reviewScreenshotOcr.ts");
  let terminated = false;
  const loader = async () => ({ createWorker: async () => ({ recognize: () => new Promise(() => {}), terminate: async () => { terminated = true; } }) });
  const t0 = Date.now();
  await assert.rejects(mod.ocrReviewScreenshot(Buffer.from("x"), { timeoutMs: 200, loader }), /did not finish/);
  assert.ok(Date.now() - t0 < 1500);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(terminated, true);
});
