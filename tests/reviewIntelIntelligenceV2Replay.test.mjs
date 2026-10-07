import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

import { installOfflineGuard } from "../scripts/reviewintel-offline-guard.mjs";
import { replayScan } from "../scripts/reviewintel-replay-scan.mjs";

installOfflineGuard();

const require = createRequire(import.meta.url);
const jiti = require("jiti")(process.cwd(), {
  alias: { "@": process.cwd() },
});

const production = {
  ...jiti("./lib/productSearchVerifier.ts"),
  ...jiti("./lib/reviewEvidenceAdjudication.ts"),
  ...jiti("./lib/reviewEvidenceDeterminism.ts"),
  ...jiti("./lib/productIdentityTokens.ts"),
  ...jiti("./lib/nativeReviewRetrieval.ts"),
};

test("historical V2 capture remains unchanged and refuses a silent scorer-version replay", () => {
  const bytes = fs.readFileSync("tests/fixtures/reviewintel/ninja-crispi-intelligence-v2.json");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "4af7a6057610d8b0d2fdf6e26b5745e08b0bb107456b96280ca499b3f6d0bac9");
  const capture = JSON.parse(bytes);
  assert.equal(capture.events.find((event) => event.stage === "evaluation").data.result.buyScore, 7.4);
  assert.throws(() => replayScan(capture, production), /SCORER_VERSION_MISMATCH/);
});

test("V3 baseline remains historical after the negation-safe scorer revision", () => {
  const bytes = fs.readFileSync("tests/fixtures/reviewintel/ninja-crispi-intelligence-v3.json");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "eab92f398850ffd8e9894ec0b0506fd589274074bb14a06645f42d052b83cebf");
  assert.throws(() => replayScan(JSON.parse(bytes), production), /SCORER_VERSION_MISMATCH/);
});

test("V4 baseline remains historical after stricter value and expectation grounding", () => {
  const capture = JSON.parse(fs.readFileSync("tests/fixtures/reviewintel/ninja-crispi-intelligence-v4.json", "utf8"));
  assert.equal(capture.provenance.scorerVersion, "deterministic-evidence-scorer-v4");
  assert.throws(() => replayScan(capture, production), /SCORER_VERSION_MISMATCH/);
});

test("V5 baseline replays the unchanged seven-review corpus with grounded claims exactly", () => {
  const fixturePath =
    "tests/fixtures/reviewintel/ninja-crispi-intelligence-v5.json";

  assert.ok(fs.existsSync(fixturePath));

  const capture = JSON.parse(
    fs.readFileSync(fixturePath, "utf8"),
  );

  const result = replayScan(capture, production);
  assert.equal(capture.provenance.kind, "DERIVED_OFFLINE_NOT_LIVE_RUNTIME_PROOF");
  assert.equal(result.final.scorerVersion, production.DETERMINISTIC_SCORER_VERSION);

  assert.equal(result.exactReplay, true);
  assert.equal(result.final.buyScore, 7.4);
  assert.equal(result.final.customerVerdict, "BUY");

  const strengths = new Map(
    result.final.strengths.map((item) => [
      item.claim,
      item.supportCount,
    ]),
  );

  const complaints = new Map(
    result.final.complaints.map((item) => [
      item.claim,
      item.supportCount,
    ]),
  );

  assert.equal(
    strengths.get("easy to clean or maintain"),
    4,
  );

  assert.equal(
    strengths.has("easy to use or set up"),
    false,
  );

  assert.equal(
    strengths.get("attractive design or appearance"),
    2,
  );

  assert.equal(
    strengths.get("good cooking results"),
    2,
  );

  assert.equal(strengths.has("good value for the price"), false);
  assert.equal(result.final.valueForMoney, "Unknown");
  assert.equal(result.final.strengths.length, 4);

  assert.equal(
    strengths.get("useful features or functions"),
    1,
  );

  assert.equal(
    complaints.get(
      "cracking or material durability problems",
    ),
    1,
  );

  for (const claim of [
    ...result.final.strengths,
    ...result.final.complaints,
  ]) {
    assert.equal(
      claim.provenance,
      "ACCEPTED_WRITTEN_REVIEW",
    );

    assert.ok(claim.sourceHashes.length > 0);
    assert.ok(claim.sourceIds.length > 0);
  }
});
