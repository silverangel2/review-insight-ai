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
            accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "",
            pageId: process.env.FACEBOOK_PAGE_ID || "",
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
      brand: "reviewintel",
      library: "reviewintel_current_uploaded",
      library_batch: "reviewintel-facebook-upload-20260730",
      approved_for_automation: true,
      selected_for_facebook: true,
      deleted: false,
      archived: false,
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
      return new Response("", { status: 200, headers: { "content-type": "video/mp4" } });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  }, {}, {
    generateFreshSocialReelVideo: async () => ({
      filename: "fresh-reel.mp4",
      objectPath: "social/videos/fresh-reel.mp4",
      publicUrl: generatedVideo.file_url,
      size: 12345,
      width: 1080,
      height: 1920,
      durationSeconds: 9,
      mimeType: "video/mp4",
      ffprobe: { format: { format_name: "mp4" } },
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
    );
    const reelResult = await api.resolveFacebookMediaForFormat(
      "shopper_tips",
      { queueDay: 1, cycleNumber: 1, recycleCount: 0 },
      "reel",
    );

    assert.equal(autoResult.media, null);
    assert.equal(autoResult.metadata.freshFacebookReel.fallback, "none");
    assert.equal(reelResult.media.id, generatedVideo.id);
    assert.equal(reelResult.media.media_type, "video");
    assert.equal(reelResult.freshReel.sourceImage.id, sourceImage.id);
  } finally {
    cleanup();
  }
});

test("Facebook auto media selection fails closed when fresh Reel generation has a network failure", async () => {
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
    );

    assert.equal(result.media, null);
    assert.match(result.metadata.freshFacebookReel.error, /network down|Fresh Facebook Reel generation failed/);
    assert.equal(result.metadata.freshFacebookReel.fallback, "none");
    assert.equal(result.metadata.freshFacebookReel.blockedDirectImageUpload, true);
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

test("Facebook Reel publisher uses video_reels start upload and finish phases", async () => {
  const calls = [];
  const { api, cleanup } = loadSocialAutoPost(async (input, init = {}) => {
    const url = String(input);
    const bodyText = init.body?.toString?.() || "";
    calls.push({ url, method: init.method || "GET", headers: init.headers || {}, body: bodyText });

    if (url.includes("/video_reels") && bodyText.includes("upload_phase=start")) {
      return jsonResponse({
        video_id: "fb-video-1",
        upload_url: "https://rupload.facebook.com/video-upload/v25.0/fb-video-1",
      });
    }

    if (url.includes("rupload.facebook.com/video-upload")) {
      assert.equal(init.headers.Authorization, "OAuth page-token-test");
      assert.equal(init.headers.file_url, "https://cdn.example.test/fresh-reel.mp4");
      return jsonResponse({ success: true });
    }

    if (url.includes("/video_reels") && bodyText.includes("upload_phase=finish")) {
      assert.match(bodyText, /video_state=PUBLISHED/);
      assert.match(bodyText, /description=ReviewIntel/);
      return jsonResponse({ success: true, post_id: "fb-post-1" });
    }

    if (url.includes("/page-id-test/videos") && url.includes("fields=id%2Cpermalink_url%2Cmedia_type%2Cis_reel%2Ccreated_time%2Cdescription")) {
      return jsonResponse({ data: [{ id: "fb-reel-1", permalink_url: "https://www.facebook.com/reel/fb-reel-1", description: "ReviewIntel Reel caption" }] });
    }

    if (url.includes("/v25.0/fb-video-1?")) {
      return jsonResponse({ id: "fb-video-1", permalink_url: "https://www.facebook.com/reel/fb-video-1", media_type: "reel", is_reel: true });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  try {
    const result = await api.postToFacebookReel({
      graphVersion: "v25.0",
      pageId: "page-id-test",
      pageToken: "page-token-test",
      caption: "ReviewIntel Reel caption",
      mediaUrl: "https://cdn.example.test/fresh-reel.mp4",
    });

    assert.equal(result.ok, true);
    assert.equal(result.externalPostId, "fb-reel-1");
    assert.equal(result.metadata.facebookReel.posted_as, "reel");
    assert.equal(result.metadata.facebookReel.media_type, "reel");
    assert.equal(result.metadata.facebookReel.permalink, "https://www.facebook.com/reel/fb-reel-1");
    assert.deepEqual(
      calls.map((call) => call.url.includes("rupload") ? "upload" : new URL(call.url).pathname),
      ["/v25.0/page-id-test/video_reels", "upload", "/v25.0/page-id-test/video_reels", "/v25.0/page-id-test/videos", "/v25.0/fb-video-1"],
    );
  } finally {
    cleanup();
  }
});

test("Facebook Reel publisher rejects image media without calling feed or photos", async () => {
  const calls = [];
  const { api, cleanup } = loadSocialAutoPost(async (input, init = {}) => {
    calls.push({ url: String(input), method: init.method || "GET" });
    throw new Error("unexpected Meta call");
  }, {
    FACEBOOK_PAGE_ID: "page-id-test",
    FACEBOOK_PAGE_ACCESS_TOKEN: "page-token-test",
    SOCIAL_AUTOPOST_FACEBOOK_FORMAT: "reel",
  });

  try {
    const result = await api.postToFacebookPage("caption", {
      id: "image-1",
      media_type: "image",
      file_url: "https://cdn.example.test/image.jpg",
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /requires an approved public MP4/);
    assert.equal(calls.length, 0);
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
    );

    assert.equal(result.media, null);
    assert.equal(result.metadata.freshFacebookReel.fallback, "none");
    assert.equal(result.metadata.freshFacebookReel.requiresVideo, true);
    assert.equal(result.metadata.freshFacebookReel.blockedDirectImageUpload, true);
    assert.equal(result.metadata.freshFacebookReel.generated_mp4_id, null);
    assert.equal(result.metadata.freshFacebookReel.public_url, null);
    assert.equal(Array.isArray(result.metadata.freshFacebookReel.hashtags), true);
    assert.equal(result.metadata.freshFacebookReel.hashtags.length, 0);
    assert.match(result.metadata.freshFacebookReel.error, /cooldown/);
  } finally {
    cleanup();
  }
});

test("Facebook Reel source selection rejects deleted and archived library rows without legacy fallback", async () => {
  const source = readFileSync(resolve("lib/socialAutoPost.ts"), "utf8");
  assert.equal(source.includes("codexLibrarySocialMedia("), false);
  assert.match(source, /metadata->>library_batch=eq\./);
  assert.match(source, /approved_for_automation=eq\.true/);
  assert.match(source, /selected_for_facebook=eq\.true/);

  const deleted = {
    id: "deleted-old-image",
    media_type: "image",
    file_url: "https://cdn.example.test/deleted.png",
    metadata: {
      brand: "reviewintel",
      library: "reviewintel_current_uploaded",
      library_batch: "reviewintel-facebook-upload-20260730",
      approved_for_automation: true,
      selected_for_facebook: true,
      deleted: true,
      archived: false,
    },
  };
  const { api, cleanup } = loadSocialAutoPost(async (input) => {
    const url = String(input);
    if (url.includes("admin_social_media") && url.includes("media_type=eq.video")) return jsonResponse([]);
    if (url.includes("admin_social_media") && url.includes("media_type=eq.image")) return jsonResponse([deleted]);
    if (url.includes("admin_social_posts")) return jsonResponse([]);
    throw new Error(`Unexpected fetch: ${url}`);
  }, {}, { generateFreshSocialReelVideo: async () => { throw new Error("should not render"); } });

  try {
    const result = await api.resolveFacebookMediaForFormat("shopper_tips", { queueDay: 1, cycleNumber: 1, recycleCount: 0 }, "reel");
    assert.equal(result.media, null);
    assert.equal(result.metadata.freshFacebookReel.fallback, "none");
  } finally {
    cleanup();
  }
});

test("Codex media guard does not hide uploaded admin social media from fresh Reel generation", async () => {
  const { api, cleanup } = loadSocialAutoPost(async () => jsonResponse([]));

  try {
    assert.equal(api.sourceMode(), "codex_library");
    assert.equal(api.shouldForceCodexMediaTable("admin_social_media"), false);
    assert.equal(api.shouldForceCodexMediaTable("social_media_library"), true);
  } finally {
    cleanup();
  }
});

test("social media source mode defaults to mixed so uploaded media can line up first", async () => {
  const { api, cleanup } = loadSocialAutoPost(async () => jsonResponse([]), {
    SOCIAL_AUTOPOST_MEDIA_SOURCE: "",
  });

  try {
    assert.equal(api.sourceMode(), "mixed");
  } finally {
    cleanup();
  }
});
