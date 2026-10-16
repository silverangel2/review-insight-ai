// ReviewIntel AI-pattern forensics (Phase 10) tests.
// Deterministic corpus forensics: repetition, template skeletons,
// specificity density, uniformity, lexical diversity -> Low/Moderate/High.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const ai = jiti(root + "lib/aiPatternForensics.ts");

const fx = (bodies) => ({
  reviewEvidence: {
    evidenceAdjudication: {
      acceptedRecords: bodies.map((body, i) => ({ id: `r${i}`, stableEvidenceHash: `h${i}`, body })),
    },
  },
});

// Synthetic templated corpus: repetitive, generic, uniformly ecstatic.
const templated = Array.from({ length: 8 }, (_, i) =>
  `This product is amazing! I love it so much. Highly recommend to everyone. Best purchase ever!${i % 2 ? " So happy!" : ""}`
);

const natural = [
  "Love these AirPods! The sound quality is clear, they're lightweight and comfortable.",
  "Bought them for my teenager, and they absolutely love them!",
  "These pair well with Apple products as you'd expect.",
  "Great sound and easy setup. Using them every day for work calls.",
  "Battery lasts me all day at the office, no complaints at all.",
  "Comfortable enough to forget I'm wearing them during long walks.",
  "Bought a second pair for my wife after trying mine for a week.",
  "The case charges fast and the fit is much better than my old pair.",
  "Sound is crisp and calls are clear even on windy streets.",
  "Good value compared to the Pro model, does everything I need.",
  "I found them a little uncomfortable and not secure enough in my ears.",
  "The packaging was damaged when it arrived, had to contact support.",
];

test("synthetic templated corpus grades High with every feature recorded", () => {
  const p = ai.analyzeAiPatterns(fx(templated));
  assert.equal(p.insufficient, false);
  assert.equal(p.grade, "high");
  assert.ok(p.points >= 5, `expected 5+ points, got ${p.points}`);
  assert.equal(p.features.length, 5);
  assert.ok(p.features.every((f) => f.points > 0), "every feature should fire on the templated corpus");
  assert.ok(p.features.every((f) => f.detail.length > 0), "every grade must be explainable");
  assert.equal(ai.authRowFor(p), "Strong AI-like pattern");
});

test("varied natural corpus grades Low", () => {
  const p = ai.analyzeAiPatterns(fx(natural));
  assert.equal(p.insufficient, false);
  assert.equal(p.grade, "low");
  assert.ok(p.points <= 1, `expected <=1 point, got ${p.points}`);
  assert.equal(ai.authRowFor(p), "Few AI-like signs");
  const sentence = ai.authSentenceFor(p);
  assert.ok(sentence && sentence.length > 20);
});

test("small corpus (<4 reviews): insufficient-data, never a faked grade", () => {
  const p = ai.analyzeAiPatterns(fx(natural.slice(0, 3)));
  assert.equal(p.insufficient, true);
  assert.equal(p.grade, null);
  assert.equal(ai.authRowFor(p), "—");
  assert.equal(ai.authSentenceFor(p), null);
});

test("no-accusation wording: patterns described, no one accused", () => {
  const banned = /\bfake reviewer\b|\bfake reviews\b|\bfraud\b|\bbot\b|\bsockpuppet\b|\bastroturf\b|\bpaid review/i;
  for (const bodies of [templated, natural]) {
    const p = ai.analyzeAiPatterns(fx(bodies));
    const row = ai.authRowFor(p);
    const sentence = ai.authSentenceFor(p) || "";
    assert.ok(!banned.test(row), `accusation in row: ${row}`);
    assert.ok(!banned.test(sentence), `accusation in sentence: ${sentence}`);
    assert.ok(/AI-like/i.test(row + sentence), "must stay in AI-like pattern language");
  }
});

test("forensics is pure: input untouched, byte-identical re-renders", () => {
  const input = fx(natural);
  const before = JSON.stringify(input);
  const first = JSON.stringify(ai.analyzeAiPatterns(input));
  assert.equal(JSON.stringify(input), before, "analyzeAiPatterns must not mutate its input");
  assert.equal(JSON.stringify(ai.analyzeAiPatterns(input)), first);
});

test("moderate band is reachable: mild repetition only", () => {
  const mild = [
    "Great product, works exactly as described. Very happy with this purchase.",
    "Great product, works exactly as described. Very happy with this purchase!",
    "Solid quality and fast shipping. Does what it promises every day.",
    "Terrible experience, stopped working after two days. Returning it.",
    "Decent for the price but the instructions were confusing to follow.",
    "Battery life is okay, nothing special, lasts a normal day.",
  ];
  const p = ai.analyzeAiPatterns(fx(mild));
  assert.equal(p.insufficient, false);
  assert.ok(["low", "moderate"].includes(p.grade), `got ${p.grade}`);
  // the duplicated pair must at least register on repetition
  const rep = p.features.find((f) => f.key === "repetition");
  assert.ok(rep.points >= 1, "near-duplicate pair should fire repetition");
});
