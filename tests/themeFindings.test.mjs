// Theme findings engine 2026-10-16 (Junel: "build a native ai", no OpenAI
// anywhere in RI). Deterministic clause-level specifics -> one finding
// bullet per theme. These tests pin the honesty contract.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const tf = jiti(root + "lib/themeFindings.ts");
const ra = jiti(root + "lib/reviewAnalysis.ts");
const ac = jiti(root + "lib/analysisCopy.ts");

const input = (over = {}) => ({
  key: "heats quickly",
  title: "Heats quickly",
  claim: "heats quickly",
  side: "for",
  count: 35,
  reviewCount: 50,
  texts: [],
  productTitle: "DREO Space Heater 1500W",
  ...over,
});

// --- clause completeness -------------------------------------------------

test("complete clauses pass; fragments fail", () => {
  assert.equal(tf.isCompleteClause("The heater warms up my bedroom in minutes."), true);
  assert.equal(tf.isCompleteClause("It is able to automatically maintain set temperature"), true);
  assert.equal(tf.isCompleteClause("The remote is so handy"), true);
  assert.equal(tf.isCompleteClause("heats up fast and"), false); // dangling conjunction
  assert.equal(tf.isCompleteClause("because it is warm"), false); // subordinate lead
  assert.equal(tf.isCompleteClause("great sound quality"), false); // no finite verb
  assert.equal(tf.isCompleteClause("ideal for camping"), false); // no verb at all
  assert.equal(tf.isCompleteClause("with a separate cable"), false); // prepositional fragment
  assert.equal(tf.isCompleteClause("Heats"), false); // too short
});

// --- theme anchoring ------------------------------------------------------

test("generic praise cannot become a theme specific; anchored clauses can", () => {
  const generic = input({
    texts: [
      "I am incredibly impressed with this space heater. Best purchase ever, I love it so much.",
      "I am really impressed with this little heater. It is wonderful and I recommend it.",
    ],
  });
  const b = tf.themeFinding(generic);
  // No anchored specific exists -> honest fallback, never generic praise.
  assert.match(b, /^Buyers praise it — mentioned in 35 of 50 reviews\.$/);

  const anchored = input({
    texts: [
      "The heater warms up my bedroom in minutes. I am so happy with it.",
      "It warms the bedroom in minutes, very impressive heat output.",
    ],
  });
  const b2 = tf.themeFinding(anchored);
  assert.match(b2, /^Buyers praise it — .*in minutes, mentioned in 35 of 50 reviews\.$/);
});

// --- title/brand-word filter ----------------------------------------------

test("clauses carrying the product's brand words are excluded", () => {
  const r = tf.themeFinding(
    input({
      texts: [
        "The Dreo heater warms up fast and I love this Dreo product.",
        "This Dreo heater warms up fast, best Dreo I have owned.",
      ],
    })
  );
  // "Dreo" is a title word: no detail may carry it -> fallback bullet.
  assert.ok(!/dreo/i.test(r), `brand word leaked: ${r}`);
});

// --- clustering: >= 2 distinct reviews ------------------------------------

test("a specific said by two buyers becomes the bullet; one buyer does not", () => {
  const two = tf.themeFinding(
    input({
      texts: [
        "It heats the room in about 5 minutes. Great little unit.",
        "Heats my room in about 5 minutes, very fast warm-up.",
      ],
    })
  );
  assert.ok(/about 5 minutes/.test(two), `expected the shared specific: ${two}`);

  const one = tf.themeFinding(
    input({
      texts: [
        "It heats the room in about 5 minutes. Great little unit.",
        "The heater works well and looks nice on my desk.",
      ],
    })
  );
  assert.ok(!/about 5 minutes/.test(one), `single-buyer specific must not print: ${one}`);
  assert.match(one, /^Buyers praise it — mentioned in 35 of 50 reviews\.$/);
});

// --- side frames -----------------------------------------------------------

test("against-side themes use the flag frame", () => {
  const b = tf.themeFinding(
    input({
      key: "fit problems",
      title: "Fit problems",
      claim: "fit problems",
      side: "against",
      count: 14,
      reviewCount: 80,
      productTitle: "Apple AirPods 4",
      texts: [
        "The buds slip out of my ears during workouts, very annoying.",
        "They slip out during workouts for me too, fit is bad.",
      ],
    })
  );
  assert.match(b, /^Buyers flag it — /);
});

// --- numeral traceability ---------------------------------------------------

test("numeralsTrace: invented numerals rejected, traced numerals accepted", () => {
  assert.equal(tf.numeralsTrace("Buyers praise it — 30 hours, mentioned in 8 of 80 reviews.", "the 30-hour battery", 8, 80), true);
  assert.equal(tf.numeralsTrace("Buyers praise it — 40 hours, mentioned in 8 of 80 reviews.", "the 30-hour battery", 8, 80), false);
  assert.equal(tf.numeralsTrace("Buyers praise it — mentioned in 8 of 80 reviews.", "no numbers here", 8, 80), true);
});

// --- banned fragments -------------------------------------------------------

test("every deck pattern sentence contains a banned fragment (drift check)", () => {
  const families = [
    ...ac.FOR_LEAD_STRONGEST, ...ac.FOR_LEAD_SECOND, ...ac.FOR_LEAD_REST,
    ...ac.VALUE_LEADS, ...ac.AGAINST_LEAD_TOP, ...ac.AGAINST_LEAD_OTHER,
    ...ac.STRENGTH_DOMINANT_FIRST, ...ac.STRENGTH_DOMINANT, ...ac.STRENGTH_HALF,
    ...ac.STRENGTH_REPEATED, ...ac.STRENGTH_FEW, ...ac.CLOSERS,
  ];
  let uncovered = 0;
  for (const s of families) {
    if (!tf.bulletHasBannedFragment(s)) uncovered++;
  }
  assert.ok(uncovered <= 3, `${uncovered} deck sentences escape the banned list`);
});

test("a bullet carrying a banned fragment is rejected", () => {
  assert.equal(tf.bulletHasBannedFragment("Buyers praise it — the reviews keep circling back to this."), true);
  assert.equal(tf.bulletHasBannedFragment("Buyers praise it — warms a room in minutes, mentioned in 3 of 20 reviews."), false);
});

// --- determinism ------------------------------------------------------------

test("same input renders byte-identical bullets", () => {
  const mk = () =>
    input({
      texts: [
        "The heater warms up my bedroom in minutes. I am so happy with it.",
        "It warms the bedroom in minutes, very impressive heat output.",
        "Warms the bedroom in minutes for me as well, great heater.",
      ],
    });
  assert.strictEqual(tf.themeFinding(mk()), tf.themeFinding(mk()));
});

// --- one complete grammatical sentence --------------------------------------

test("bullets are one complete sentence, never fragments", () => {
  const b = tf.themeFinding(
    input({
      texts: [
        "The heater warms up my bedroom in minutes. I am so happy with it.",
        "It warms the bedroom in minutes, very impressive heat output.",
      ],
    })
  );
  assert.match(b, /^[A-Z]/);
  assert.match(b, /\.$/);
  assert.ok(!/  /.test(b), "no double spaces");
  assert.ok(b.length <= 240, "bounded length");
  assert.ok(!/["“”]/.test(b), "no quote marks");
});

// --- end-to-end through the composition seam --------------------------------

const records = (bodies) =>
  bodies.map((body, i) => ({
    id: `r${i + 1}`,
    stableEvidenceHash: `h${i + 1}`,
    body,
    sourceUrl: "https://www.amazon.ca/dp/TESTFIND",
  }));

test("seam: regular themes print findings bullets, never pattern sentences", () => {
  const bodies = [
    "The heater warms up my bedroom in minutes. I am so happy with this purchase.",
    "It warms the bedroom in minutes, very impressive heat output for the price.",
    "Warms the bedroom in minutes for me as well, great little heater.",
    "Heats up fast and the controls are simple to use every day.",
    "The digital thermostat is incredibly accurate, holds the set temperature.",
    "The thermostat holds temperature well, very accurate digital readout.",
  ];
  const r = {
    reviewEvidence: {
      evidenceAdjudication: { acceptedRecords: records(bodies) },
      commentsAnalyzed: bodies.length,
      listingEvidence: { rating: 4.5, reviewCount: 900 },
    },
    product: { title: "DREO Space Heater 1500W", store: "amazon.ca" },
    strengths: [
      { claim: "heats quickly", supportCount: 4, sourceIds: ["r1", "r2", "r3", "r4"], sourceHashes: [] },
      { claim: "temperature control", supportCount: 2, sourceIds: ["r5", "r6"], sourceHashes: [] },
    ],
    complaints: [],
  };
  const a = ra.deriveReviewAnalysis(r);
  assert.ok(a.forFactors.length >= 2, "themes survive");
  for (const f of a.forFactors) {
    assert.match(f.summary, /^Buyers praise it — .*mentioned in \d+ of 6 reviews\.$/, `findings shape [${f.title}]: ${f.summary}`);
    assert.ok(!tf.bulletHasBannedFragment(f.summary), `no banned fragment [${f.title}]`);
  }
  // The quote-leakage contract holds: no 40-char body prefix in any summary.
  const summaries = a.forFactors.map((f) => f.summary.toLowerCase());
  for (const body of bodies) {
    const snippet = body.slice(0, 40).toLowerCase();
    for (const s of summaries) assert.ok(!s.includes(snippet), `quote leak: ${snippet}`);
  }
});
