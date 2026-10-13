import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(root + p, "utf8");

test("motion is short, transform/opacity only, and off for reduced-motion users", () => {
  const css = read("app/globals.css");
  const block = css.slice(css.indexOf("/* ReviewIntel motion"));
  assert.match(block, /@media \(prefers-reduced-motion: no-preference\)/);
  for (const ms of [...block.matchAll(/(\d+)ms/g)].map(m => Number(m[1]))) assert.ok(ms >= 0 && ms <= 600, `duration ${ms}ms`);
  assert.doesNotMatch(block.replace(/box-shadow[^;]*;|background-color[^,;]*/g, ""), /\b(width|height|top|left|margin)\s*:/);
  assert.match(read("components/motion/CountUp.tsx"), /prefers-reduced-motion: reduce/);
  assert.match(read("components/motion/HeroVerdictCycle.tsx"), /prefers-reduced-motion: reduce/);
  assert.match(read("components/ReviewIntelScanOverlay.tsx"), /scaleX\(/);
});

test("count-up renders the real final score for SSR and screen readers", () => {
  const src = read("components/motion/CountUp.tsx");
  assert.match(src, /aria-hidden="true" className="tabular-nums">\{value\.toFixed/);
  assert.match(src, /sr-only">\{value\.toFixed/);
});
