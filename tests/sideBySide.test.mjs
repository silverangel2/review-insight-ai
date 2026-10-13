import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const { buildRingConnShopperResult } = await import(root + "scripts/reviewintel-ringconn-shopper-fixture.mjs");

test("side by side: built from real scans, tagged Amazon links, honest summary", () => {
  process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG ||= "reviewintel-20";
  process.env.AMAZON_ASSOCIATE_TAG ||= "reviewintel-20";
  const { sideColumn, compareSummary } = jiti("./lib/sideBySide.ts");
  const real = buildRingConnShopperResult(root.replace(/\/$/, ""));
  const a = sideColumn({ ...real, exactListingUrl: "https://www.amazon.ca/dp/B0TEST0001" }, "scan_a");
  assert.match(a.buyUrl, /[?&]tag=/); assert.equal(a.isAffiliate, true); assert.equal(a.buyLabel, "Check price on Amazon");
  for (const p of [...a.answer.loves, ...a.answer.complaints]) if (p.quote) assert.ok(JSON.stringify(real).includes(p.quote.replace(/…$/, "").slice(0, 40)));
  const thin = sideColumn({ product: { title: "Other" } }, "scan_b");
  assert.equal(thin.buyUrl, null);
  assert.match(compareSummary(a, thin), /don't pick a side/);
  const higher = compareSummary(a, { ...a, title: "B", answer: { ...a.answer, score: 3 } });
  assert.match(higher, /scores higher based on what real buyers wrote/);
});
