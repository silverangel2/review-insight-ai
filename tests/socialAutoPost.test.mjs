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

function loadSocialAutoPost(fetchMock, env = {}) {
  const restoreEnv = withEnv({
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    NEXT_PUBLIC_SITE_URL: "https://getreviewintel.com",
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
          buildAffiliateUrl: (value) => value,
          getAffiliateDisclosure: () => "Disclosure",
          getAmazonAssociateTag: () => "",
          isSupportedAffiliateUrl: () => false,
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

test("Facebook media selection keeps a reachable generated video for auto and explicit Reel publishing", async () => {
  const video = {
    id: "codex-video-2",
    media_type: "video",
    file_url: "https://cdn.example.test/public-video.mp4",
    title: "Reachable generated reel",
    topic: "shopper_tips",
    tags: ["CodexLibrary"],
    metadata: { codex_library: true },
  };
  const { api, cleanup } = loadSocialAutoPost(async (input, init = {}) => {
    const url = String(input);

    if (url.includes("/rest/v1/admin_social_media")) {
      const parsed = new URL(url);
      const mediaType = parsed.searchParams.get("media_type");
      if (mediaType === "eq.video") return jsonResponse([video]);
      return jsonResponse([]);
    }

    if (url === video.file_url && init.method === "HEAD") {
      return new Response("", { status: 200 });
    }

    throw new Error(`Unexpected fetch: ${url}`);
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

    assert.equal(autoResult.media.id, video.id);
    assert.equal(autoResult.media.media_type, "video");
    assert.equal(autoResult.metadata, undefined);
    assert.equal(reelResult.media.id, video.id);
    assert.equal(reelResult.media.media_type, "video");
    assert.equal(reelResult.metadata, undefined);
  } finally {
    cleanup();
  }
});

test("Facebook auto media selection falls back to an image when video probing has a network failure", async () => {
  const video = {
    id: "codex-video-network",
    media_type: "video",
    file_url: "https://cdn.example.test/network-failure.mp4",
    title: "Network failure reel",
    topic: "shopper_tips",
    tags: ["CodexLibrary"],
    metadata: { codex_library: true },
  };
  const image = {
    id: "codex-image-network",
    media_type: "image",
    file_url: "/uploads/social/reviewintel-premium-day-02-test.png",
    title: "Fallback image",
    topic: "shopper_tips",
    tags: ["CodexLibrary"],
    metadata: { codex_library: true },
  };
  const { api, cleanup } = loadSocialAutoPost(async (input, init = {}) => {
    const url = String(input);

    if (url.includes("/rest/v1/admin_social_media")) {
      const parsed = new URL(url);
      const mediaType = parsed.searchParams.get("media_type");
      if (mediaType === "eq.video") return jsonResponse([video]);
      if (mediaType === "eq.image") return jsonResponse([image]);
      return jsonResponse([]);
    }

    if (url === video.file_url && init.method === "HEAD") {
      throw new Error("network down");
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  try {
    const result = await api.resolveFacebookMediaForFormat(
      "shopper_tips",
      { queueDay: 1, cycleNumber: 1, recycleCount: 0 },
      "auto",
      null,
    );

    assert.equal(result.media.id, image.id);
    assert.equal(result.metadata.skippedFacebookVideo.probe.error, "network down");
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

test("Facebook auto media selection falls back to an image when the preferred video is unfetchable", async () => {
  const video = {
    id: "codex-video-1",
    media_type: "video",
    file_url: "https://cdn.example.test/private-video.mp4",
    title: "Broken generated reel",
    topic: "shopper_tips",
    tags: ["CodexLibrary"],
    metadata: { codex_library: true },
  };
  const image = {
    id: "codex-image-1",
    media_type: "image",
    file_url: "/uploads/social/reviewintel-premium-day-01-test.png",
    title: "Fallback image",
    topic: "shopper_tips",
    tags: ["CodexLibrary"],
    metadata: { codex_library: true },
  };
  const { api, cleanup } = loadSocialAutoPost(async (input, init = {}) => {
    const url = String(input);

    if (url.includes("/rest/v1/admin_social_media")) {
      const parsed = new URL(url);
      const mediaType = parsed.searchParams.get("media_type");
      if (mediaType === "eq.video") return jsonResponse([video]);
      if (mediaType === "eq.image") return jsonResponse([image]);
      return jsonResponse([]);
    }

    if (url === video.file_url && init.method === "HEAD") {
      return jsonResponse({ message: "Bucket not found" }, 400);
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  try {
    const result = await api.resolveFacebookMediaForFormat(
      "shopper_tips",
      { queueDay: 1, cycleNumber: 1, recycleCount: 0 },
      "auto",
      null,
    );

    assert.equal(result.media.id, image.id);
    assert.equal(result.media.media_type, "image");
    assert.equal(result.metadata.skippedFacebookVideo.id, video.id);
    assert.equal(result.metadata.skippedFacebookVideo.probe.status, 400);
    assert.equal(result.metadata.skippedFacebookVideo.fallback, "image");
  } finally {
    cleanup();
  }
});
