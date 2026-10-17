// Measurements miner 2026-10-17 (iteration 3). Buyer-stated measurements
// (value + unit) print only when >= 2 DISTINCT reviews state compatible
// values; every printed number traces to source clauses. Conflicting poles
// (>= 2 each) surface as disagreement; a lone minority pole is dropped.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const tm = jiti(root + "lib/themeMeasurements.ts");
const tf = jiti(root + "lib/themeFindings.ts");

const C = (text, src) => ({ text, src });

// --- traceability: >= 2 distinct reviews -------------------------------------

test("a number stated by one review never forms a group", () => {
  const g = tm.mineMeasurements(
    [C("It keeps drinks cold for about 24 hours, amazing.", 1), C("Keeps water cold for hours.", 2)],
    ["duration"]
  );
  assert.equal(g.length, 0, "single-buyer measurement must not print");
});

test("two reviews stating the same measurement form a group", () => {
  const g = tm.mineMeasurements(
    [C("It keeps drinks cold for about 24 hours, amazing.", 1), C("Keeping drinks cold for 24 hours is normal.", 2)],
    ["duration"]
  );
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].sources, [1, 2]);
  assert.equal(g[0].renderValue, "about 24 hours");
  assert.equal(g[0].examples.length, 2);
});

test("compatible values cluster into a range", () => {
  const g = tm.mineMeasurements(
    [
      C("Battery lasts about 20 hours on a charge.", 1),
      C("I get 24 hours of battery easily.", 2),
      C("Around 22 hours per charge for me.", 3),
    ],
    ["duration"]
  );
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].sources, [1, 2, 3]);
  assert.match(g[0].renderValue, /^about 20–2\d hours$/);
});

// --- unit normalization --------------------------------------------------------

test("90 minutes and 1.5 hours are the same measurement", () => {
  const g = tm.mineMeasurements(
    [C("It runs for 90 minutes straight.", 1), C("I get about 1.5 hours of runtime.", 2)],
    ["duration"]
  );
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].sources, [1, 2]);
});

test("2.2 lbs and 35 ounces are compatible", () => {
  const g = tm.mineMeasurements(
    [C("It weighs just 2.2 lbs, very light.", 1), C("Only 35 ounces on my scale.", 2)],
    ["weight"]
  );
  assert.equal(g.length, 1);
});

// --- disagreement ---------------------------------------------------------------

test("two incompatible poles (>= 2 reviews each) disagree", () => {
  const g = tm.mineMeasurements(
    [
      C("Battery lasts about 30 hours on a charge.", 1),
      C("I get 30 hours of battery easily.", 2),
      C("Battery dies after 10 hours, terrible.", 3),
      C("Only 10 hours of battery for me.", 4),
    ],
    ["duration"]
  );
  const d = tm.measurementDisagreement(g);
  assert.ok(d, "disagreement expected");
  assert.equal(tm.disagreementRange(d), "10 to 30 hours");
});

test("a lone minority pole is dropped, never amplified", () => {
  const g = tm.mineMeasurements(
    [
      C("Battery lasts about 30 hours on a charge.", 1),
      C("I get 30 hours of battery easily.", 2),
      C("Battery dies after 10 hours, terrible.", 3),
    ],
    ["duration"]
  );
  assert.equal(tm.measurementDisagreement(g), null);
  assert.equal(g.length, 1);
  assert.equal(g[0].renderValue, "about 30 hours");
});

// --- polarity: negated measurements never count -----------------------------------

test("a negated measurement is rejected", () => {
  const g = tm.mineMeasurements(
    [
      C("It does not keep drinks cold for 24 hours, sadly.", 1),
      C("Keeping drinks cold for 24 hours is normal.", 2),
    ],
    ["duration"]
  );
  assert.equal(g.length, 0);
});

// --- kind scoping ------------------------------------------------------------------

test("watts do not parse when only duration is requested", () => {
  const g = tm.mineMeasurements(
    [C("The 1500 watts of power heats fast.", 1), C("1500 watts is plenty.", 2)],
    ["duration"]
  );
  assert.equal(g.length, 0);
  const g2 = tm.mineMeasurements(
    [C("The 1500 watts of power heats fast.", 1), C("1500 watts is plenty.", 2)],
    ["power"]
  );
  assert.equal(g2.length, 1);
  assert.equal(g2[0].renderValue, "about 1500 watts");
});

// --- engine wiring --------------------------------------------------------------------

test("engine: measurement disagreement outranks the family bullet", () => {
  const a = tf.themeFindingAudit({
    key: "heats quickly",
    title: "Heats quickly",
    claim: "heats quickly",
    side: "for",
    count: 4,
    reviewCount: 44,
    texts: [
      "It heats the room in about 5 minutes, and I love it.",
      "Warms up in about 5 minutes for me too, very fast.",
      "It takes about 15 minutes to heat the whole room.",
      "Takes 15 minutes to really warm up the space.",
    ],
    productTitle: "DREO Space Heater 1500W",
  });
  assert.equal(a.tier, "disagreement");
  assert.match(a.bullet, /^buyers disagree — claims range from 5 to 15 minutes, say 4 of 44 buyers\.$/);
  assert.ok(a.disagreement.poleA.examples.length >= 2);
  assert.ok(a.disagreement.poleB.examples.length >= 2);
});

test("engine: a traced measurement refines a numberless canonical", () => {
  const a = tf.themeFindingAudit({
    key: "heats quickly",
    title: "Heats quickly",
    claim: "heats quickly",
    side: "for",
    count: 2,
    reviewCount: 44,
    texts: [
      "It heats the room in about 5 minutes, and I love it.",
      "Warms up in about 5 minutes for me too, very fast.",
    ],
    productTitle: "DREO Space Heater 1500W",
  });
  assert.equal(a.tier, "measurement");
  assert.match(a.bullet, /^heats a room up in about 5 minutes, say 2 of 44 buyers\.$/);
});

test("engine: a lone minority pole never becomes a disagreement", () => {
  const a = tf.themeFindingAudit({
    key: "cup holder",
    title: "Doesn't fit cup holders",
    claim: "cup holder",
    side: "against",
    count: 3,
    reviewCount: 21,
    texts: [
      "It does not fit in my cup holder at all, so annoying.",
      "Does not fit in a cup holder, I may return it.",
      "It fits perfectly into my car's cup holder, love it.",
    ],
    productTitle: "Owala FreeSip 32oz",
  });
  assert.equal(a.tier, "family");
  assert.match(a.bullet, /^too wide for standard cup holders, say 3 of 21 buyers\.$/);
});

test("engine: fired opposes pair renders a hand-written disagreement", () => {
  const a = tf.themeFindingAudit({
    key: "cup holder",
    title: "Doesn't fit cup holders",
    claim: "cup holder",
    side: "against",
    count: 4,
    reviewCount: 21,
    texts: [
      "It does not fit in my cup holder at all, so annoying.",
      "Does not fit in a cup holder, I may return it.",
      "It fits perfectly into my car's cup holder, love it.",
      "Fits into my car's cup holder with no problem at all.",
    ],
    productTitle: "Owala FreeSip 32oz",
  });
  assert.equal(a.tier, "disagreement");
  assert.match(
    a.bullet,
    /^buyers disagree — some say it doesn't fit in cup holders, others say it does, say 4 of 21 buyers\.$/
  );
});

// --- determinism -----------------------------------------------------------------------

test("mining is byte-deterministic", () => {
  const mk = () => [
    C("Battery lasts about 30 hours on a charge.", 2),
    C("I get 30 hours of battery easily.", 1),
  ];
  assert.deepEqual(tm.mineMeasurements(mk(), ["duration"]), tm.mineMeasurements(mk(), ["duration"]));
});
