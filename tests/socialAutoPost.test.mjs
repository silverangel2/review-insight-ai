import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function withEnv(env) {
  const original = new Map();

  for (const [key, value] of Object.entries(env)) {
    original.set(key, process.env[key]);
    process.env[key] = value;
  }

  return () => {
    for (const [key, value] of original.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function loadSocialAutoPost(fetchMock, env = {}, reelGenerator = {}) {
  const restoreEnv = withEnv({
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    NEXT_PUBLIC_SITE_URL: "https://getreviewintel.com",
    SOCIAL_AFFILIATE_POSTS_ENABLED: "true",
    SOCIAL_AFFILIATE_URL: "https://www.amazon.com/dp/test-product",
    SOCIAL_AUTOPOST_MEDIA_SOURCE: "codex_library",
    ...env,
  });
  const source = readFileSync(resolve("lib/socialAutoPost.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const cjsModule = { exports: {} };
  const context = {
    Blob,
    Headers,
    Request,
    Response,
    URL,
    URLSearchParams,
    clearTimeout,
    console,
    decodeURIComponent,
    encodeURIComponent,
    exports: cjsModule.exports,
    fetch: fetchMock,
    module: cjsModule,
    process,
    require: (id) => {
      if (id === "fs" || id === "path") return require(id);
      if (id === "@/lib/affiliate") {
        return {
          buildAffiliateUrl: (value) => `${value}?tag=reviewintel-test`,
          getAffiliateDisclosure: () => "Disclosure",
          getAmazonAssociateTag: () => "reviewintel-test",
          isSupportedAffiliateUrl: (value) => String(value).includes("amazon."),
        };
      }
      if (id === "@/lib/facebookConnector") {
        return {
          getFacebookPageAccessTokenForPosting: async () => ({
            accessToken: "",
            pageId: "",
            source: "test",
          }),
        };
      }
      if (id === "@/lib/socialMediaTopics") return { HOMEPAGE_VIDEO_TOPIC: "homepage_video" };
      if (id === "@/lib/socialReelGenerator") {
        return {
          selectApprovedAudioTrack: (seed) => ({
            id: `track-${String(seed || "default").slice(0, 8)}`,
            name: "Test original audio",
            license: "Test original audio license",
          }),
          generateFreshSocialReelVideo:
            reelGenerator.generateFreshSocialReelVideo ||
            (async () => {
              throw new Error("fresh reel generator unavailable");
            }),
        };
      }
      if (id === "@/lib/socialReelContent") {
        return {
          buildMinimalReelContentPlan: (input) => ({
            caption: [
              "The rating is only the surface. The repeated review pattern is where the useful signal starts.",
              "",
              `See how it works: ${input.websiteShortUrl}`,
              `Helpful review tools: ${input.affiliateShortUrl}`,
            ].join("\n"),
            hashtags: ["CustomerReviews", "ReviewAnalysis", "CustomerFeedback", "EcommerceSellers", "ReviewIntel"],
            websiteUrl: input.websiteUrl,
            websiteShortUrl: input.websiteShortUrl,
            affiliateUrl: input.affiliateUrl,
            affiliateShortUrl: input.affiliateShortUrl,
            affiliateRelevant: true,
            cta: "See how it works",
            theme: "The rating is only the surface.",
            overlayHook: "Reviews reveal the real story.",
            overlaySupport: "ReviewIntel turns repeated buyer signals into a clearer decision.",
            overlayCta: "See how it works",
            discoveryTopic: "customer_reviews",
            hashtagScore: {
              topicalRelevance: 1,
              audienceFit: 1,
              repetitionRisk: 0,
              spamRisk: 0,
              total: 1,
            },
          }),
          formatMinimalReelCaption: (plan) => `${plan.caption}\n\n#${plan.hashtags.join(" #")}`,
          parseHashtagsFromCaption: (caption) =>
            Array.from(String(caption || "").matchAll(/#([a-zA-Z0-9]+)/g)).map((match) => match[1]),
          validateMinimalReelContentPlan: () => ({ ok: true, errors: [] }),
        };
      }
      if (id === "@/lib/socialRedirects") {
        return {
          resolveAmazonAffiliateDestination: () => "https://www.amazon.com/dp/test-product?tag=reviewintel-test",
          resolveReviewIntelStartDestination: () => "https://getreviewintel.com",
          shortAffiliateUrl: () => "https://getreviewintel.com/recommends",
          shortReviewIntelUrl: () => "https://getreviewintel.com/start",
        };
      }
      if (id === "@/lib/supabasePublicStorage") {
        return {
          probeFacebookAccessibleUrl: async ({ url }) => {
            if (!url) return { ok: false, error: "Media URL is missing." };
            try {
              const head = await fetchMock(url, { method: "HEAD", cache: "no-store" });
              if (head.ok) return { ok: true, status: head.status };
              if (head.status !== 405 && head.status !== 501) {
                return { ok: false, status: head.status, error: `Media HEAD returned HTTP ${head.status}.` };
              }
            } catch (error) {
              return {
                ok: false,
                error: error instanceof Error ? error.message : "Media HEAD check failed.",
              };
            }

            try {
              const ranged = await fetchMock(url, {
                method: "GET",
                headers: { Range: "bytes=0-0" },
                cache: "no-store",
              });
              return ranged.ok || ranged.status === 206
                ? { ok: true, status: ranged.status }
                : { ok: false, status: ranged.status, error: `Media range GET returned HTTP ${ranged.status}.` };
            } catch (error) {
              return {
                ok: false,
                error: error instanceof Error ? error.message : "Media range GET check failed.",
              };
            }
          },
        };
      }
      if (id === "@/lib/tiktokConnector") {
        return {
          getTikTokAccessTokenForPosting: async () => ({
            accessToken: "",
            accountName: null,
            scopes: [],
            source: "test",
          }),
          getTikTokOAuthHealth: () => ({
            clientKeyConfigured: false,
            clientSecretConfigured: false,
            directPostRequested: false,
            redirectUri: "",
            scopes: [],
          }),
        };
      }

      return require(id);
    },
    setTimeout,
  };
  context.globalThis = context;

  vm.runInNewContext(compiled, context, { filename: "lib/socialAutoPost.ts" });

  return {
    api: cjsModule.exports.__socialAutoPostTest,
    cleanup: restoreEnv,
  };
}

test("media probe rejects URLs that fail HEAD", async () => {
  const calls = [];
  const { api, cleanup } = loadSocialAutoPost(async (input, init = {}) => {
    calls.push({ url: String(input), method: init.method || "GET" });
    return jsonResponse({ message: "Bucket not found" }, 400);
  });

  try {
    const result = await api.probePublicMediaUrl({
      id: "video-1",
      media_type: "video",
      file_url: "https://cdn.example.test/private-video.mp4",
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.match(result.error, /HEAD returned HTTP 400/);
    assert.deepEqual(calls.map((call) => call.method), ["HEAD"]);
  } finally {
    cleanup();
  }
});

test("Facebook media selection generates a fresh public video for auto and explicit Reel publishing", async () => {
  const sourceImage = {
    id: "uploaded-image-1",
    media_type: "image",
    file_url: "https://cdn.example.test/source-image.jpg",
    title: "Recent uploaded source",
    topic: "shopper_tips",
    tags: ["Uploaded"],
    metadata: {
      uploaded_via: "admin_social_media_upload",
      storage_bucket: "reviewintel-social-public",
    },
  };
  const generatedVideo = {
    id: "fresh-video-1",
    media_type: "video",
    mime_type: "video/mp4",
    file_url: "https://cdn.example.test/fresh-reel.mp4",
    title: "Fresh generated reel",
    topic: "shopper_tips",
    tags: ["FreshReel"],
    metadata: {
      generated_by: "scheduled_fresh_reel_generator",
      source_image_id: sourceImage.id,
    },
  };
  const { api, cleanup } = loadSocialAutoPost(async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";

    if (url.includes("/rest/v1/admin_social_media")) {
      const parsed = new URL(url);
      const mediaType = parsed.searchParams.get("media_type");
      if (method === "POST") return jsonResponse([generatedVideo]);
      if (method === "PATCH") return jsonResponse([{ ...generatedVideo, metadata: { ...generatedVideo.metadata, generated_mp4_id: generatedVideo.id } }]);
      if (mediaType === "eq.video") return jsonResponse([]);
      if (mediaType === "eq.image") return jsonResponse([sourceImage]);
      return jsonResponse([]);
    }

    if (url.includes("/rest/v1/admin_social_posts")) {
      return jsonResponse([]);
    }

    if (url === generatedVideo.file_url && init.method === "HEAD") {
      return new Response("", { status: 200 });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }, {}, {
    generateFreshSocialReelVideo: async () => ({
      filename: "fresh-reel.mp4",
      objectPath: "social/videos/fresh-reel.mp4",
      publicUrl: generatedVideo.file_url,
      size: 12345,
      durationSeconds: 9,
      audioTrack: {
        id: "track-test",
        name: "Test original audio",
        license: "Test original audio license",
      },
    }),
  });

  try {
    const autoResult = await api.resolveFacebookMediaForFormat(
      "shopper_tips",
      { queueDay: 1, cycleNumber: 1, recycleCount: 0 },
      "auto",
      null,
    );
    const reelResult = await api.resolveFacebookMediaForFormat(
      "shopper_tips",
      { queueDay: 1, cycleNumber: 1, recycleCount: 0 },
      "reel",
      null,
    );

    assert.equal(autoResult.media.id, generatedVideo.id, JSON.stringify(autoResult.metadata));
    assert.equal(autoResult.media.media_type, "video");
    assert.equal(autoResult.freshReel.sourceImage.id, sourceImage.id);
    assert.equal(autoResult.contentOverride.hashtags.length > 0, true);
    assert.equal(autoResult.finalCaptionOverride.includes("https://getreviewintel.com/start"), true);
    assert.equal(autoResult.finalCaptionOverride.includes("https://getreviewintel.com/recommends"), true);
    assert.equal(autoResult.finalCaptionOverride.includes("https://www.amazon.com/dp/test-product"), false);
    assert.equal(autoResult.freshReel.captionPlan.overlayHook, "Reviews reveal the real story.");
    assert.equal(autoResult.freshReel.captionPlan.hashtags.length, 5);
    assert.equal(autoResult.metadata.freshFacebookReel.public_probe.status, 200);
    assert.equal(autoResult.metadata.freshFacebookReel.affiliate_url, "https://www.amazon.com/dp/test-product?tag=reviewintel-test");
    assert.equal(autoResult.metadata.freshFacebookReel.affiliate_short_url, "https://getreviewintel.com/recommends");
    assert.equal(reelResult.media.id, generatedVideo.id);
    assert.equal(reelResult.media.media_type, "video");
    assert.equal(reelResult.freshReel.sourceImage.id, sourceImage.id);
  } finally {
    cleanup();
  }
});

test("Facebook auto media selection falls back to an image when fresh Reel generation has a network failure", async () => {
  const image = {
    id: "codex-image-network",
    media_type: "image",
    file_url: "/uploads/social/reviewintel-premium-day-02-test.png",
    title: "Fallback image",
    topic: "shopper_tips",
    tags: ["CodexLibrary"],
    metadata: { codex_library: true },
  };
  const { api, cleanup } = loadSocialAutoPost(async (input) => {
    const url = String(input);

    if (url.includes("/rest/v1/admin_social_media")) {
      const parsed = new URL(url);
      const mediaType = parsed.searchParams.get("media_type");
      if (mediaType === "eq.video") return jsonResponse([]);
      if (mediaType === "eq.image") return jsonResponse([image]);
      return jsonResponse([]);
    }

    if (url.includes("/rest/v1/admin_social_posts")) {
      return jsonResponse([]);
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }, {}, {
    generateFreshSocialReelVideo: async () => {
      throw new Error("network down");
    },
  });

  try {
    const result = await api.resolveFacebookMediaForFormat(
      "shopper_tips",
      { queueDay: 1, cycleNumber: 1, recycleCount: 0 },
      "auto",
      null,
    );

    assert.equal(result.media.id, image.id);
    assert.equal(result.metadata.freshFacebookReel.error, "network down");
    assert.equal(result.metadata.freshFacebookReel.fallback, "image");
  } finally {
    cleanup();
  }
});

test("media probe falls back to a range GET when HEAD is unsupported", async () => {
  const calls = [];
  const { api, cleanup } = loadSocialAutoPost(async (input, init = {}) => {
    calls.push({ url: String(input), method: init.method || "GET", range: init.headers?.Range || "" });
    if (init.method === "HEAD") return new Response("", { status: 405 });
    return new Response("x", { status: 206 });
  });

  try {
    const result = await api.probePublicMediaUrl({
      id: "video-1",
      media_type: "video",
      file_url: "https://cdn.example.test/video.mp4",
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 206);
    assert.deepEqual(
      calls.map((call) => `${call.method}:${call.range}`),
      ["HEAD:", "GET:bytes=0-0"],
    );
  } finally {
    cleanup();
  }
});

test("Facebook explicit Reel skips safely when the selected source image is inside cooldown", async () => {
  const image = {
    id: "recent-source-image",
    media_type: "image",
    file_url: "https://cdn.example.test/recent-source.jpg",
    title: "Recent source",
    topic: "shopper_tips",
    metadata: { uploaded_via: "admin_social_media_upload" },
  };
  const { api, cleanup } = loadSocialAutoPost(async (input) => {
    const url = String(input);

    if (url.includes("/rest/v1/admin_social_media")) {
      const parsed = new URL(url);
      const mediaType = parsed.searchParams.get("media_type");
      if (mediaType === "eq.video") {
        return jsonResponse([
          {
            id: "fresh-video-using-recent-source",
            media_type: "video",
            created_at: new Date().toISOString(),
            metadata: {
              generated_by: "scheduled_fresh_reel_generator",
              generated_at: new Date().toISOString(),
              source_image_id: image.id,
            },
          },
        ]);
      }
      if (mediaType === "eq.image") return jsonResponse([image]);
      return jsonResponse([]);
    }

    if (url.includes("/rest/v1/admin_social_posts")) {
      return jsonResponse([]);
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  try {
    const result = await api.resolveFacebookMediaForFormat(
      "shopper_tips",
      { queueDay: 1, cycleNumber: 1, recycleCount: 0 },
      "reel",
      null,
    );

    assert.equal(result.media, null);
    assert.equal(result.metadata.freshFacebookReel.fallback, "none");
    assert.match(result.metadata.freshFacebookReel.error, /cooldown/);
  } finally {
    cleanup();
  }
});
