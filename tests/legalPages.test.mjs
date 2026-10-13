import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
const root = new URL("..", import.meta.url).pathname;
const read = p => readFileSync(root + p, "utf8");
test("legal pages exist, are marked draft, and carry the required wording", () => {
  const t = read("lib/trustContent.ts");
  for (const slug of ["affiliate-disclosure", "ad-policy", "advertiser-terms"]) assert.ok(existsSync(root + `app/${slug}/page.tsx`), slug);
  assert.match(t, /As an Amazon Associate, ReviewIntel earns from qualifying purchases\./);
  assert.match(t, /We're independent and not affiliated with or endorsed by any brand; results are based on public buyer reviews\./);
  assert.equal((t.match(/draft: true/g) || []).length >= 6, true);
  assert.match(read("components/TrustPage.tsx"), /Draft, have a lawyer review/);
  for (const href of ["/terms", "/privacy", "/affiliate-disclosure", "/ad-policy", "/advertiser-terms"]) assert.match(t, new RegExp(`href: "${href}"`));
  assert.match(read("components/ShopperAnswerCard.tsx"), /INDEPENDENCE_STATEMENT/);
  assert.match(read("components/SiteFooter.tsx"), /AMAZON_ASSOCIATES_DISCLOSURE/);
});
