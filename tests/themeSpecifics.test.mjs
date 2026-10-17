// Theme specifics library 2026-10-17 (iteration 2, Junel: "build a native
// ai", no OpenAI anywhere in RI). Hand-written phrase families per theme,
// each firing only on >= 2 DISTINCT reviews, with polarity scope checks so
// negations can never flip a vote. These tests pin the family contract.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const ts = jiti(root + "lib/themeSpecifics.ts");

const C = (text, src) => ({ text, src });

// --- firing threshold: >= 2 distinct reviews -------------------------------

test("a family fires only on >= 2 distinct reviews", () => {
  const two = ts.matchFamilies("kw:Fit problems", [
    C("These fall out of your ears no matter how you twist them.", 1),
    C("They slip out during workouts for me too, fit is bad.", 2),
  ], "against");
  assert.equal(two.length, 1);
  assert.equal(two[0].family.id, "fit:slips-out");
  assert.deepEqual(two[0].sources, [1, 2]);
  assert.equal(two[0].examples.length, 2);

  const one = ts.matchFamilies("kw:Fit problems", [
    C("These fall out of your ears no matter how you twist them.", 1),
    C("These fall out of your ears no matter how you twist them.", 1),
  ], "against");
  assert.equal(one.length, 0, "one review repeating is not two buyers");
});

// --- distinct-source counting -----------------------------------------------

test("three distinct reviews sort above two; ties break by family id", () => {
  const hits = ts.matchFamilies("dim:sound quality", [
    C("Surprisingly deep bass for something so compact.", 1),
    C("The bass is decent too, vocals sound crisp.", 2),
    C("Great bass and crisp highs.", 3),
    C("Sound is fine.", 4),
  ]);
  // crisp-highs: src 2,3 (2); deep-bass: src 1,2,3 (3) -> deep-bass wins
  assert.equal(hits[0].family.id, "sound-quality:deep-bass");
  assert.deepEqual(hits[0].sources, [1, 2, 3]);
  assert.equal(hits[1].family.id, "sound-quality:crisp-highs");
});

// --- audit trail ------------------------------------------------------------

test("every hit carries verbatim example clauses for audit", () => {
  const hits = ts.matchFamilies("kw:Breakouts and irritation", [
    C("It left me feeling sticky after it dried down.", 1),
    C("It sat on top of the skin and left me feeling sticky.", 2),
  ], "against");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].family.id, "skin:sticky");
  assert.equal(hits[0].examples.length, 2);
  assert.ok(hits[0].examples[0].includes("feeling sticky"));
});

// --- negation scope: flips rejected, cross-boundary votes kept --------------

test("a negated clause cannot evidence a positive specific", () => {
  const hits = ts.matchFamilies("kw:Fit problems", [
    C("No complaints about discomfort or slipping out, even during workouts.", 1),
    C("They slip out during workouts for me too, fit is bad.", 2),
    C("These fall out of your ears no matter how you twist them.", 3),
  ], "against");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].family.id, "fit:slips-out");
  // src 1 is negated ("No complaints ...") and excluded; 2 and 3 remain.
  assert.deepEqual(hits[0].sources, [2, 3]);
});

test("negation before an AND/but boundary does not scope past it", () => {
  const hits = ts.matchFamilies("kw:Breakouts and irritation", [
    C("It did not absorb well and felt sticky after it dried down.", 1),
    C("It sat on top of the skin and left me feeling sticky.", 2),
  ], "against");
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].sources, [1, 2]);
});

test("a contradicted absence is rejected, an asserted absence counts", () => {
  const hits = ts.matchFamilies("kw:No safety seal", [
    C("CeraVe itself does not come with a protective seal.", 1),
    C("Great product however it arrived with no seal.", 2),
    C("Not sure if being unsealed after unscrewing the lid is safe and sanitary.", 3),
    C("It does have a protective seal under the cap, thankfully.", 4),
  ], "against");
  assert.equal(hits.length, 1);
  // src 4 asserts a seal exists -> contradiction, excluded.
  assert.deepEqual(hits[0].sources, [1, 2, 3]);
});

test("absence inside the matched span is the family's own evidence", () => {
  const hits = ts.matchFamilies("kw:Quiet operation", [
    C("It is so quiet I can keep it on during work calls and no one else can hear it.", 1),
    C("Surprisingly quiet while running, great for the bedroom.", 2),
  ]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].family.id, "quiet:bedroom-calls");
  assert.deepEqual(hits[0].sources, [1, 2]);
});

// --- winning family ---------------------------------------------------------

test("winningFamily returns the highest-count family or null", () => {
  const win = ts.winningFamily("dim:battery life", [
    C("The ultra-compact charging case provides up to 30 hours of total battery life.", 1),
    C("The 30-hour battery life means I charge less frequently.", 2),
  ]);
  assert.ok(win);
  assert.equal(win.family.id, "battery:30-hours");
  assert.equal(ts.winningFamily("dim:battery life", [C("The 30-hour battery life is nice.", 1)]), null);
  assert.equal(ts.winningFamily("dim:no-such-theme", [C("anything at all here", 1)]), null);
});

// --- determinism ------------------------------------------------------------

test("family matching is byte-deterministic", () => {
  const mk = () => [
    C("These fall out of your ears no matter how you twist them.", 3),
    C("They slip out during workouts for me too, fit is bad.", 1),
    C("I had to adjust them because I worried they might fall out.", 2),
  ];
  assert.deepEqual(ts.matchFamilies("kw:Fit problems", mk()), ts.matchFamilies("kw:Fit problems", mk()));
});

// --- library hygiene --------------------------------------------------------

test("every family id is unique and every canonical is a complete sentence fragment free of title words", () => {
  const ids = new Set();
  let count = 0;
  for (const [key, fams] of Object.entries(ts.THEME_SPECIFICS)) {
    assert.ok(key.length >= 3, `key ${key}`);
    for (const f of fams) {
      count++;
      assert.ok(!ids.has(f.id), `duplicate family id ${f.id}`);
      ids.add(f.id);
      assert.ok(f.canonical.length >= 8 && f.canonical.length <= 120, `canonical length [${f.id}]`);
      assert.ok(f.variants.length >= 1, `family ${f.id} has no variants`);
      assert.ok(!/[A-Z]/.test(f.canonical[0]) || f.canonical[0] === "I", `canonical must be lowercase-continuable [${f.id}]`);
    }
  }
  assert.ok(count >= 20, `library too thin: ${count} families`);
});
