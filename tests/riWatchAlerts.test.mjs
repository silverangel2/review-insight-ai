// Piece B: library-based watchlist change detection (pure, deterministic).
// No network, no Supabase, no email provider in this file's process.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
]) {
  delete process.env[key];
}

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const alerts = jiti(root + "lib/riWatchAlerts.ts");

const snap = (rating, count, hash = null) => ({
  aggregateRating: rating,
  reviewCount: count,
  hash,
});

test("snapshot hash is deterministic for the same library row", () => {
  const row = { aggregate_rating: 4.2, review_count: 37, scan_count: 3 };
  const a = alerts.snapshotFromLibraryRow(row);
  const b = alerts.snapshotFromLibraryRow(row);
  assert.equal(a.hash, b.hash);
  assert.equal(a.aggregateRating, 4.2);
  assert.equal(a.reviewCount, 37);
});

test("snapshot hash moves when the rating or counts move", () => {
  const a = alerts.snapshotFromLibraryRow({ aggregate_rating: 4.2, review_count: 37, scan_count: 3 });
  const b = alerts.snapshotFromLibraryRow({ aggregate_rating: 4.5, review_count: 37, scan_count: 3 });
  const c = alerts.snapshotFromLibraryRow({ aggregate_rating: 4.2, review_count: 40, scan_count: 3 });
  assert.notEqual(a.hash, b.hash);
  assert.notEqual(a.hash, c.hash);
});

test("no baseline yet: record silently, never alert", () => {
  const next = alerts.snapshotFromLibraryRow({ aggregate_rating: 4.2, review_count: 37, scan_count: 1 });
  const d = alerts.decideLibraryWatchAlert(snap(4.2, 37, null), next);
  assert.equal(d.alert, false);
  assert.equal(d.reason, "no_baseline");
});

test("identical hash: no change, no alert", () => {
  const next = alerts.snapshotFromLibraryRow({ aggregate_rating: 4.2, review_count: 37, scan_count: 1 });
  const d = alerts.decideLibraryWatchAlert({ aggregateRating: 4.2, reviewCount: 37, hash: next.hash }, next);
  assert.equal(d.alert, false);
  assert.equal(d.reason, "no_change");
});

test("rating moved by >= 0.3: alert (rating_changed)", () => {
  const prev = { aggregateRating: 4.2, reviewCount: 37, hash: "oldhash" };
  const next = { aggregateRating: 3.8, reviewCount: 37, hash: "newhash" };
  const d = alerts.decideLibraryWatchAlert(prev, next);
  assert.equal(d.alert, true);
  assert.equal(d.reason, "rating_changed");
});

test("rating wobble under 0.3 with no real growth: no alert", () => {
  const prev = { aggregateRating: 4.2, reviewCount: 37, hash: "oldhash" };
  const next = { aggregateRating: 4.1, reviewCount: 40, hash: "newhash" };
  const d = alerts.decideLibraryWatchAlert(prev, next);
  assert.equal(d.alert, false);
  assert.equal(d.reason, "no_change");
});

test("review count grew by >= 10: alert (new_evidence)", () => {
  const prev = { aggregateRating: 4.2, reviewCount: 37, hash: "oldhash" };
  const next = { aggregateRating: 4.2, reviewCount: 47, hash: "newhash" };
  const d = alerts.decideLibraryWatchAlert(prev, next);
  assert.equal(d.alert, true);
  assert.equal(d.reason, "new_evidence");
});

test("alert email content carries unwatch + preferences links, no series language", () => {
  const c = alerts.watchAlertEmailContent({
    productName: "AirPods 4",
    reason: "rating_changed",
    previousRating: 4.2,
    rating: 3.8,
    reviewCount: 40,
    resultUrl: "https://www.amazon.ca/dp/B0DGJDKHRQ",
    unwatchUrl: "https://getreviewintel.com/api/product-watches?token=abc",
    preferencesUrl: "https://getreviewintel.com/email-preferences",
  });
  assert.match(c.subject, /AirPods 4/);
  assert.match(c.text, /Stop watching this product/);
  assert.match(c.text, /never get a reminder series/);
  assert.match(c.html, /email-preferences/);
  assert.doesNotMatch(c.text + c.html, /reward|prize|discount|coupon/i);
});
