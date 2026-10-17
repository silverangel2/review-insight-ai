// Theme findings engine 2026-10-16/17 (Junel: "build a native ai", no
// OpenAI anywhere in RI). Iteration 2: specifics library (lib/themeSpecifics.ts)
// + humanized render ("up to 30 hours with the case, say 8 of 62 buyers."),
// boilerplate banned. These tests pin the honesty + render contract.
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

// --- humanized render: no boilerplate ---------------------------------------

test("no bullet carries boilerplate scaffolding", () => {
  const fixtures = [
    input({
      key: "heats quickly",
      texts: [
        "The heater warms up my bedroom in minutes. I am so happy with it.",
        "It warms the bedroom in minutes, very impressive heat output.",
      ],
    }),
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
    }),
    input({ texts: ["I am incredibly impressed. Best purchase ever."] }),
  ];
  for (const f of fixtures) {
    const b = tf.themeFinding(f);
    assert.ok(b, "a bullet always renders when texts exist");
    assert.ok(!/Buyers (praise|flag) it/.test(b), `boilerplate leaked: ${b}`);
    assert.ok(!/mentioned in \d+ of \d+ reviews/.test(b), `v1 render leaked: ${b}`);
  }
});

// --- family tier -------------------------------------------------------------

test("the specifics library wins over the extract tier when a family fires", () => {
  const b = tf.themeFinding(
    input({
      texts: [
        "The heater warms up my bedroom in minutes. I am so happy with it.",
        "It warms the bedroom in minutes, very impressive heat output.",
      ],
    })
  );
  assert.match(b, /^heats a room up in minutes, say 35 of 50 buyers\.$/);

  const audit = tf.themeFindingAudit(
    input({
      texts: [
        "The heater warms up my bedroom in minutes. I am so happy with it.",
        "It warms the bedroom in minutes, very impressive heat output.",
      ],
    })
  );
  assert.equal(audit.tier, "family");
  assert.equal(audit.familyId, "heat:in-minutes");
  assert.equal(audit.examples.length, 2);
  assert.ok(audit.examples[0].toLowerCase().includes("minutes"));
});

// --- theme anchoring + honest fallback --------------------------------------

test("generic praise cannot become a theme specific; anchored clauses can", () => {
  const generic = input({
    texts: [
      "I am incredibly impressed with this space heater. Best purchase ever, I love it so much.",
      "I am really impressed with this little heater. It is wonderful and I recommend it.",
    ],
  });
  const b = tf.themeFinding(generic);
  // No anchored specific exists -> honest tally fallback, never generic praise.
  assert.match(b, /^35 of 50 buyers mention it\.$/);
  assert.equal(tf.themeFindingAudit(generic).tier, "fallback");
});

// --- title/brand-word filter --------------------------------------------------

test("clauses carrying the product's brand words are excluded from the extract tier", () => {
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

// --- clustering: >= 2 distinct reviews ---------------------------------------

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
  assert.match(one, /^\d+ of 50 buyers mention it\.$/);
});

// --- numeral traceability ------------------------------------------------------

test("numeralsTrace: invented numerals rejected, traced numerals accepted", () => {
  assert.equal(tf.numeralsTrace("up to 30 hours with the case, say 8 of 80 buyers.", "the 30-hour battery", 8, 80), true);
  assert.equal(tf.numeralsTrace("up to 40 hours with the case, say 8 of 80 buyers.", "the 30-hour battery", 8, 80), false);
  assert.equal(tf.numeralsTrace("8 of 80 buyers mention it.", "no numbers here", 8, 80), true);
});

test("a family numeral that cannot trace is rejected at render", () => {
  // The battery family claims "30 hours": its bullets only survive when a
  // matched clause carries "30". numeralsTrace is the gate; exercise it.
  const audit = tf.themeFindingAudit(
    input({
      key: "battery life",
      title: "Strong battery life",
      claim: "battery life",
      count: 8,
      reviewCount: 62,
      productTitle: "Apple AirPods 4",
      texts: [
        "The ultra-compact charging case provides up to 30 hours of total battery life for long trips.",
        "The 30-hour battery life means I am charging less frequently now.",
      ],
    })
  );
  assert.equal(audit.tier, "family");
  assert.match(audit.bullet, /^up to 30 hours with the charging case, say 8 of 62 buyers\.$/);
  assert.equal(tf.numeralsTrace(audit.bullet, audit.examples.join(" "), 8, 62), true);
});

// --- banned fragments -----------------------------------------------------------

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
  assert.equal(tf.bulletHasBannedFragment("the reviews keep circling back to this"), true);
  assert.equal(tf.bulletHasBannedFragment("up to 30 hours with the case, say 8 of 80 buyers."), false);
});

// --- determinism -----------------------------------------------------------------

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

// --- one complete grammatical sentence ---------------------------------------------

test("bullets are one complete sentence, never fragments", () => {
  const b = tf.themeFinding(
    input({
      texts: [
        "The heater warms up my bedroom in minutes. I am so happy with it.",
        "It warms the bedroom in minutes, very impressive heat output.",
      ],
    })
  );
  assert.match(b, /^[A-Za-z]/);
  assert.match(b, /\.$/);
  assert.ok(!/  /.test(b), "no double spaces");
  assert.ok(b.length <= 240, "bounded length");
  assert.ok(!/["“”]/.test(b), "no quote marks");
});

// --- end-to-end through the composition seam ----------------------------------------

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
  const heat = a.forFactors.find((f) => /heat/i.test(f.title));
  assert.match(heat.summary, /^heats a room up in minutes, say 4 of 6 buyers\.$/, `family bullet [${heat.title}]: ${heat.summary}`);
  for (const f of a.forFactors) {
    assert.ok(!/Buyers (praise|flag) it/.test(f.summary), `boilerplate [${f.title}]: ${f.summary}`);
    assert.ok(!tf.bulletHasBannedFragment(f.summary), `no banned fragment [${f.title}]`);
  }
  // The quote-leakage contract holds: no 40-char body prefix in any summary.
  const summaries = a.forFactors.map((f) => f.summary.toLowerCase());
  for (const body of bodies) {
    const snippet = body.slice(0, 40).toLowerCase();
    for (const s of summaries) assert.ok(!s.includes(snippet), `quote leak: ${snippet}`);
  }
});

// --- iteration 3: star-profile context -------------------------------------------

const starInput = (stars, over = {}) =>
  input({
    key: "fit problems",
    title: "Fit problems",
    claim: "fit problems",
    side: "against",
    count: 6,
    reviewCount: 62,
    productTitle: "Apple AirPods 4",
    texts: [
      "The buds slip out of my ears during workouts, very annoying.",
      "They slip out during workouts for me too, fit is bad.",
      "These fall out of your ears no matter how you twist them.",
      "I had to adjust them because I worried they might fall out.",
    ],
    stars,
    ...over,
  });

test("star context: low-star concentration is named on complaint bullets", () => {
  const b = tf.themeFinding(starInput([1, 2, 5, 2]));
  assert.match(
    b,
    /^the buds slip or fall out, say 6 of 62 buyers — almost all from 1- and 2-star reviews\.$/
  );
});

test("star context: skipped silently when stars are absent, thin, or high", () => {
  assert.match(tf.themeFinding(starInput(undefined)), /^the buds slip or fall out, say 6 of 62 buyers\.$/);
  assert.match(tf.themeFinding(starInput([1, 2, null])), /^the buds slip or fall out, say 6 of 62 buyers\.$/);
  assert.match(tf.themeFinding(starInput([5, 4, 5, 5])), /^the buds slip or fall out, say 6 of 62 buyers\.$/);
  // Praise side never carries a star note (expected, not news).
  const praiseHeat = tf.themeFinding(
    input({
      key: "heats quickly",
      stars: [1, 1, 2, 2],
      texts: [
        "The heater warms up my bedroom in minutes. I am so happy with it.",
        "It warms the bedroom in minutes, very impressive heat output.",
      ],
    })
  );
  assert.ok(!/star/.test(praiseHeat), `praise bullet carried a star note: ${praiseHeat}`);
});

test("star context: stars are never invented — a null array behaves like absent", () => {
  const b = tf.themeFinding(starInput([null, null, null, null]));
  assert.ok(!/star/.test(b), `star note without star data: ${b}`);
});

// --- iteration 3: severity-ordered complaints ---------------------------------------

test("severityRank: safety > failure > durability > annoyance", () => {
  const ts = jiti(root + "lib/themeSpecifics.ts");
  assert.equal(ts.severityRank("cut-risk"), 0);
  assert.equal(ts.severityRank("reliability-problems"), 1);
  assert.equal(ts.severityRank("durability"), 2);
  assert.equal(ts.severityRank("hard-clean"), 3);
  assert.equal(ts.severityRank("some-unknown-theme"), 3);
  // Alias forms resolve too.
  assert.equal(ts.severityRank("Blades too sharp — finger cuts"), 0);
  assert.equal(ts.severityRank("kw:Durability issues"), 2);
});

test("seam: complaints render safety-first regardless of tally size", () => {
  const bodies = [
    "The blades are dull and it is hard to clean the grooves.",
    "Food gets stuck in the blades and grooves, annoying.",
    "I sliced my finger open on the blade while washing it, be careful.",
    "Watch your fingers, the blade cut me during handling.",
    "The top feels flimsy and might snap off soon.",
  ];
  const r = {
    reviewEvidence: {
      evidenceAdjudication: {
        acceptedRecords: bodies.map((body, i) => ({ id: `r${i + 1}`, body, rating: i < 2 ? 2 : 3 })),
      },
      commentsAnalyzed: bodies.length,
      listingEvidence: { rating: 4.4, reviewCount: 900 },
    },
    product: { title: "Fullstar Vegetable Chopper (PRO 4-in-1)", store: "amazon" },
    strengths: [],
    complaints: [
      { claim: "hard to clean", supportCount: 2, sourceIds: ["r1", "r2"], sourceHashes: [] },
      { claim: "blades too sharp — finger cuts", supportCount: 2, sourceIds: ["r3", "r4"], sourceHashes: [] },
      { claim: "durability issues", supportCount: 1, sourceIds: ["r5"], sourceHashes: [] },
    ],
  };
  const a = ra.deriveReviewAnalysis(r);
  const titles = a.againstFactors.map((f) => f.title);
  // cut-risk (safety, sev 0) outranks hard-clean (sev 3) despite equal tallies.
  assert.ok(titles.indexOf("Blades too sharp — finger cuts") < titles.indexOf("Hard to clean"),
    `severity order broken: ${titles.join(" | ")}`);
  for (const f of a.againstFactors) {
    assert.ok(!tf.bulletHasBannedFragment(f.summary), `no banned fragment [${f.title}]`);
  }
});

// --- iteration 3: learning-loop candidates never affect rendering --------------------

test("the candidates artifact is never read by the engine", () => {
  const { readFileSync } = require("node:fs");
  // The learning loop's proposals live ONLY in proof3/candidates.md. The
  // engine must never load them: no import/read of the artifact or its
  // producer script. (Pre-existing unrelated "candidates" identifiers —
  // the v1 detail extractor, image-URL fallbacks — are out of scope.)
  for (const f of ["lib/themeFindings.ts", "lib/themeSpecifics.ts", "lib/themeMeasurements.ts", "lib/reviewAnalysis.ts"]) {
    const src = readFileSync(root + f, "utf8");
    assert.ok(!/candidates\.md|propose-candidates|family candidate/i.test(src), `${f} references the candidates artifact`);
  }
});

test("rendering is invariant to the candidates artifact existing", () => {
  const { writeFileSync, unlinkSync, existsSync } = require("node:fs");
  const probe = input({
    key: "heats quickly",
    texts: [
      "The heater warms up my bedroom in minutes. I am so happy with it.",
      "It warms the bedroom in minutes, very impressive heat output.",
    ],
  });
  const before = tf.themeFindingAudit(probe);
  const path = root + "proof3/candidates.md";
  const had = existsSync(path);
  const prev = had ? require("node:fs").readFileSync(path, "utf8") : null;
  writeFileSync(path, "# fake candidates\n\n## heat:in-minutes\n- bogus candidate: warms the bedroom\n");
  const after = tf.themeFindingAudit(probe);
  if (had) writeFileSync(path, prev);
  else unlinkSync(path);
  assert.deepEqual(after, before, "candidates artifact changed rendering");
});
