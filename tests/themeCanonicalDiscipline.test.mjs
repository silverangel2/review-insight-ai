// Canonical discipline 2026-10-17 (iteration 3 hardening). A canonical may
// not assert duration/extent ("all day", "lasts for years", "1500 watts")
// unless a source clause asserts it. This test pins the rule statically:
// every duration/extent phrase in every canonical must be backed by either a
// family variant (whose regex matches the phrase) or an explicit `evidence`
// phrase (a verbatim clause fragment). Unfired families are checked too —
// the library must be honest before it ever fires.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const ts = jiti(root + "lib/themeSpecifics.ts");

const LEX = /\b(all day|every day|each day|within (?:a |about )?\d*\s*(?:minutes?|seconds?|hours?)|in (?:under |about )?\d+\s*(?:minutes?|seconds?|hours?)|\d+\s*(?:hours?|minutes?|seconds?|days?|weeks?|months?|years?|watts?|lbs?|pounds?|oz|dB)|forever|lasts?|never)\b/i;

function claimsOf(canonical) {
  const out = [];
  const re = new RegExp(LEX.source, "gi");
  let m;
  while ((m = re.exec(canonical))) out.push(m[0]);
  return out;
}

function backed(phrase, family) {
  // Backed when a variant regex matches the phrase itself...
  for (const v of family.variants) {
    try {
      if (new RegExp(v.source, "i").test(phrase)) return true;
    } catch { /* ignore */ }
  }
  // ...or every content word of the phrase appears in a variant or an
  // explicit evidence fragment.
  const words = phrase
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["the", "for", "and", "all"].includes(w));
  if (!words.length) return true;
  const hay = [...family.variants.map((v) => v.source), ...(family.evidence ?? [])]
    .join(" | ")
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}

test("every duration/extent claim in every canonical is variant- or evidence-backed", () => {
  const failures = [];
  let checked = 0;
  for (const fams of Object.values(ts.THEME_SPECIFICS)) {
    for (const f of fams) {
      for (const phrase of claimsOf(f.canonical)) {
        checked++;
        if (!backed(phrase, f)) {
          failures.push(`${f.id}: "${phrase}" in "${f.canonical}"`);
        }
      }
    }
  }
  assert.ok(checked > 0, "lexicon matched nothing — test is vacuous");
  assert.deepEqual(failures, [], `unbacked duration/extent claims:\n${failures.join("\n")}`);
});

test("the CeraVe hydration canonical no longer asserts 'all day'", () => {
  const fams = ts.THEME_SPECIFICS["hydration"];
  assert.ok(fams && fams.length > 0);
  for (const f of fams) {
    assert.ok(!/all day/i.test(f.canonical), `duration stretch survives [${f.id}]: ${f.canonical}`);
  }
});

test("family ids are stable for v2-fired families (rename audit)", () => {
  // hydration:all-day was renamed to hydration:locks-in during hardening;
  // the old id must be gone and the new one present.
  const ids = new Set();
  for (const fams of Object.values(ts.THEME_SPECIFICS)) for (const f of fams) ids.add(f.id);
  assert.ok(!ids.has("hydration:all-day"), "old stretched id still present");
  assert.ok(ids.has("hydration:locks-in"), "renamed family missing");
});
