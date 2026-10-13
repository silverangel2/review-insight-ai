import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const root = new URL("..", import.meta.url).pathname;
const src = readFileSync(root + "components/advertising/FeaturedDeals.tsx", "utf8");
const slot = readFileSync(root + "components/advertising/AdSlot.tsx", "utf8");

test("featured deals: clear labels and Amazon Associates disclosure", () => {
  assert.match(src, /"Affiliate"/); assert.match(src, /"Sponsored"/);
  assert.match(src, /As an Amazon Associate, ReviewIntel earns from qualifying purchases\./);
  assert.match(src, /rel="noopener noreferrer sponsored"/);
});
test("featured deals: no Amazon image hotlinking; video lazy, muted, paused offscreen and under reduced motion", () => {
  assert.match(src, /amazon\\\.\|media-amazon/);
  assert.match(src, /preload="none"/); assert.match(src, /muted/);
  assert.match(src, /IntersectionObserver/); assert.match(src, /prefers-reduced-motion: reduce/);
  assert.match(src, /translateX/); assert.doesNotMatch(src, /transition-\[?(width|left)/);
});
test("AdSense content untouched (container only) and clicks still tracked", () => {
  assert.match(slot, /className="adsbygoogle block min-h-\[120px\] w-full"/);
  assert.match(slot, /eventType: "affiliate_click"/);
});
