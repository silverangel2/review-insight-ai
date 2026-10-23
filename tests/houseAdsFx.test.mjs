// House Ads Engine — FX (entrance + rotation crossfade) targeted tests.
// Covers the pure rotation helpers the slot component runs on: the
// advance index, its agreement with the established seed order, and the
// pause gate's truth table.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });
const houseAds = jiti("./lib/houseAds.ts");

test("rotation index: advances by one and wraps; degenerate lengths are safe", () => {
  assert.equal(houseAds.nextHouseAdIndex(0, 4), 1);
  assert.equal(houseAds.nextHouseAdIndex(2, 4), 3);
  assert.equal(houseAds.nextHouseAdIndex(3, 4), 0);
  assert.equal(houseAds.nextHouseAdIndex(0, 1), 0);
  assert.equal(houseAds.nextHouseAdIndex(0, 0), 0);
  assert.equal(houseAds.nextHouseAdIndex(-1, 4), 0);
});

test("rotation walk: stepping from the hourly pick visits the seed order, each creative once", () => {
  for (const context of ["home", "result"]) {
    const candidates = houseAds.houseAdCandidates(context);
    for (const seed of [0, 1, 5, 123456]) {
      const start = candidates.findIndex(
        (c) => c.id === houseAds.pickHouseAd(context, seed).id,
      );
      assert.ok(start >= 0, `${context} seed ${seed}: start not in candidates`);
      const visited = new Set();
      let index = start;
      for (let step = 0; step < candidates.length; step++) {
        assert.equal(
          candidates[index].id,
          houseAds.pickHouseAd(context, seed + step).id,
          `${context} seed ${seed} step ${step}`,
        );
        visited.add(index);
        index = houseAds.nextHouseAdIndex(index, candidates.length);
      }
      assert.equal(visited.size, candidates.length, `${context}: full cycle visits all`);
      assert.equal(index, start, `${context}: cycle returns to start`);
    }
  }
});

test("rotation gate: every pause condition blocks the advance on its own", () => {
  const open = {
    documentHidden: false,
    inView: true,
    hovered: false,
    dismissed: false,
    candidateCount: 4,
  };
  assert.equal(houseAds.houseAdRotationAllowed(open), true);
  assert.equal(houseAds.houseAdRotationAllowed({ ...open, documentHidden: true }), false);
  assert.equal(houseAds.houseAdRotationAllowed({ ...open, inView: false }), false);
  assert.equal(houseAds.houseAdRotationAllowed({ ...open, hovered: true }), false);
  assert.equal(houseAds.houseAdRotationAllowed({ ...open, dismissed: true }), false);
  assert.equal(houseAds.houseAdRotationAllowed({ ...open, candidateCount: 1 }), false);
  assert.equal(houseAds.houseAdRotationAllowed({ ...open, candidateCount: 0 }), false);
});
