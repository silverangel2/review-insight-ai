import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadSocialReelContent() {
  const source = readFileSync(resolve("lib/socialReelContent.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const cjsModule = { exports: {} };
  const context = {
    Date,
    Set,
    console,
    exports: cjsModule.exports,
    module: cjsModule,
    require,
  };
  context.globalThis = context;

  vm.runInNewContext(compiled, context, { filename: "lib/socialReelContent.ts" });
  return cjsModule.exports;
}

test("balanced Reel hashtags use 4 to 7 tags with the required category mix", () => {
  const content = loadSocialReelContent();
  const result = content.selectBalancedReelHashtags({
    socialTopic: "seller_tips",
    seed: "queue-1",
    date: new Date("2026-07-10T00:00:00Z"),
  });
  const validation = content.validateBalancedHashtagSet({
    hashtags: result.hashtags,
    topic: result.topic,
  });

  assert.equal(result.hashtags.length >= 4, true);
  assert.equal(result.hashtags.length <= 7, true);
  assert.equal(validation.ok, true, validation.errors.join(" "));
  assert.equal(validation.categoryCounts.broad, 1);
  assert.equal(validation.categoryCounts.niche >= 2, true);
  assert.equal(validation.categoryCounts.niche <= 3, true);
  assert.equal(validation.categoryCounts.audience, 1);
  assert.equal(validation.categoryCounts.branded, 1);
});

test("balanced Reel hashtags include no duplicates and always include ReviewIntel", () => {
  const content = loadSocialReelContent();
  const result = content.selectBalancedReelHashtags({
    socialTopic: "trust_signals",
    seed: "queue-2",
    date: new Date("2026-07-10T00:00:00Z"),
  });
  const lower = result.hashtags.map((tag) => tag.toLowerCase());

  assert.equal(new Set(lower).size, result.hashtags.length);
  assert.equal(lower.includes("reviewintel"), true);
});

test("balanced Reel hashtags avoid repeating a full recent set within cooldown", () => {
  const content = loadSocialReelContent();
  const first = content.selectBalancedReelHashtags({
    socialTopic: "shopper_tips",
    seed: "queue-3",
    date: new Date("2026-07-10T00:00:00Z"),
  });
  const second = content.selectBalancedReelHashtags({
    socialTopic: "shopper_tips",
    seed: "queue-3",
    recentHashtagSets: [first.hashtags],
    date: new Date("2026-07-10T00:00:00Z"),
  });

  assert.notEqual(first.hashtags.map((tag) => tag.toLowerCase()).sort().join("|"), second.hashtags.map((tag) => tag.toLowerCase()).sort().join("|"));
});

test("hashtag validation rejects spammy or irrelevant stuffing", () => {
  const content = loadSocialReelContent();
  const validation = content.validateBalancedHashtagSet({
    hashtags: ["Viral", "FYP", "Trending", "CustomerReviews", "ReviewIntel"],
    topic: "customer_reviews",
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.score.spamRisk > 0, true);
  assert.match(validation.errors.join(" "), /spam|approved topical|niche|audience/i);
});

test("hashtag scoring rewards topical relevance and audience fit", () => {
  const content = loadSocialReelContent();
  const result = content.selectBalancedReelHashtags({
    socialTopic: "competitor_watch",
    seed: "queue-4",
    date: new Date("2026-07-10T00:00:00Z"),
  });

  assert.equal(result.topic, "online_visibility");
  assert.equal(result.score.topicalRelevance >= 0.85, true);
  assert.equal(result.score.audienceFit, 1);
  assert.equal(result.score.spamRisk, 0);
});

test("minimal Reel plan keeps overlay short and free of hashtags or raw URLs", () => {
  const content = loadSocialReelContent();
  const plan = content.buildMinimalReelContentPlan({
    socialTopic: "shopper_tips",
    queueDay: 1,
    cycleNumber: 1,
    sourceImageId: "source-1",
    websiteUrl: "https://getreviewintel.com/pricing?utm_source=facebook",
    websiteShortUrl: "https://getreviewintel.com/start",
    affiliateUrl: "https://www.amazon.com/dp/B000TEST?tag=reviewintel-20",
    affiliateShortUrl: "https://getreviewintel.com/recommends",
    date: new Date("2026-07-10T00:00:00Z"),
  });
  const validation = content.validateMinimalReelContentPlan(plan);

  assert.equal(validation.ok, true, validation.errors.join(" "));
  assert.equal(plan.overlayHook.length <= content.reelOverlayLimits.hook, true);
  assert.equal(plan.overlaySupport.length <= content.reelOverlayLimits.support, true);
  assert.equal(plan.overlayCta.length <= content.reelOverlayLimits.cta, true);
  assert.equal([plan.overlayHook, plan.overlaySupport, plan.overlayCta].join(" ").includes("http"), false);
  assert.equal([plan.overlayHook, plan.overlaySupport, plan.overlayCta].join(" ").includes("#"), false);
});

test("minimal Reel caption uses short branded links and puts hashtags at the end", () => {
  const content = loadSocialReelContent();
  const plan = content.buildMinimalReelContentPlan({
    socialTopic: "buyer_mistakes",
    queueDay: 2,
    cycleNumber: 1,
    sourceImageId: "source-2",
    websiteUrl: "https://getreviewintel.com/?long=destination",
    websiteShortUrl: "https://getreviewintel.com/start",
    affiliateUrl: "https://www.amazon.com/dp/B000TEST?tag=reviewintel-20",
    affiliateShortUrl: "https://getreviewintel.com/recommends",
    date: new Date("2026-07-10T00:00:00Z"),
  });
  const finalCaption = content.formatMinimalReelCaption(plan);
  const hashtagIndex = finalCaption.indexOf("#");

  assert.equal(finalCaption.includes("https://getreviewintel.com/start"), true);
  assert.equal(finalCaption.includes("https://getreviewintel.com/recommends"), true);
  assert.equal(finalCaption.includes("https://www.amazon.com/dp/"), false);
  assert.equal(hashtagIndex > finalCaption.indexOf(plan.caption), true);
  assert.deepEqual(content.parseHashtagsFromCaption(finalCaption), plan.hashtags);
});
