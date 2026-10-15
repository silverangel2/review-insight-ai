// Piece C: per-store Amazon affiliate tags.
// amazon.com -> roamly02e-20 (Roamly Associates site list covers
// getreviewintel.com); amazon.ca -> legacy AMAZON_ASSOCIATE_TAG when set
// (e.g. reviewintel-20), else roamly060-20. Never double-tags.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

for (const key of [
  "AMAZON_ASSOCIATE_TAG",
  "AMAZON_ASSOCIATE_TAG_COM",
  "AMAZON_ASSOCIATE_TAG_CA",
]) {
  delete process.env[key];
}

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url).pathname;
const jiti = require("jiti")(root + "x.js", { alias: { "@": root } });

const affiliate = jiti(root + "lib/affiliate.ts");

const tagOf = (url) => {
  try {
    return new URL(url).searchParams.get("tag");
  } catch {
    return null;
  }
};

const tagCount = (url, name = "tag") => {
  const found = [];
  try {
    for (const [k, v] of new URL(url).searchParams.entries()) {
      if (k === name) found.push(v);
    }
  } catch { /* ignore */ }
  return found;
};

test("amazon.com links get roamly02e-20 by default", () => {
  const out = affiliate.buildAmazonAffiliateUrl("https://www.amazon.com/dp/B0DGJDKHRQ");
  assert.equal(tagOf(out), "roamly02e-20");
});

test("amazon.ca links get roamly060-20 when no legacy tag is set", () => {
  const out = affiliate.buildAmazonAffiliateUrl("https://www.amazon.ca/dp/B0DGJDKHRQ");
  assert.equal(tagOf(out), "roamly060-20");
});

test("amazon.ca keeps the legacy tag when AMAZON_ASSOCIATE_TAG is set", () => {
  process.env.AMAZON_ASSOCIATE_TAG = "reviewintel-20";
  try {
    const out = affiliate.buildAmazonAffiliateUrl("https://www.amazon.ca/dp/B0DGJDKHRQ");
    assert.equal(tagOf(out), "reviewintel-20");
  } finally {
    delete process.env.AMAZON_ASSOCIATE_TAG;
  }
});

test("legacy tag does not leak onto amazon.com links", () => {
  process.env.AMAZON_ASSOCIATE_TAG = "reviewintel-20";
  try {
    const out = affiliate.buildAmazonAffiliateUrl("https://www.amazon.com/dp/B0DGJDKHRQ");
    assert.equal(tagOf(out), "roamly02e-20");
  } finally {
    delete process.env.AMAZON_ASSOCIATE_TAG;
  }
});

test("per-store env overrides win over defaults", () => {
  process.env.AMAZON_ASSOCIATE_TAG_COM = "custom-com-20";
  process.env.AMAZON_ASSOCIATE_TAG_CA = "custom-ca-20";
  try {
    assert.equal(tagOf(affiliate.buildAmazonAffiliateUrl("https://amazon.com/dp/B0DGJDKHRQ")), "custom-com-20");
    assert.equal(tagOf(affiliate.buildAmazonAffiliateUrl("https://amazon.ca/dp/B0DGJDKHRQ")), "custom-ca-20");
  } finally {
    delete process.env.AMAZON_ASSOCIATE_TAG_COM;
    delete process.env.AMAZON_ASSOCIATE_TAG_CA;
  }
});

test("an already-tagged URL is never double-tagged", () => {
  const out = affiliate.buildAmazonAffiliateUrl(
    "https://www.amazon.com/dp/B0DGJDKHRQ?tag=someoneelse-20"
  );
  assert.deepEqual(tagCount(out), ["roamly02e-20"]);
});

test("non-amazon URLs pass through untouched", () => {
  const url = "https://example.com/product?tag=roamly02e-20";
  assert.equal(affiliate.buildAmazonAffiliateUrl(url), url);
  assert.equal(affiliate.buildAmazonAffiliateUrl("not a url"), "not a url");
});

test("getAmazonAssociateTag legacy export is unchanged", () => {
  assert.equal(affiliate.getAmazonAssociateTag(), "");
  process.env.AMAZON_ASSOCIATE_TAG = "reviewintel-20";
  try {
    assert.equal(affiliate.getAmazonAssociateTag(), "reviewintel-20");
  } finally {
    delete process.env.AMAZON_ASSOCIATE_TAG;
  }
});
