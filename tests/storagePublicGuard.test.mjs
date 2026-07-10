import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import {
  assertFacebookAccessibleUrl as assertScriptAccessibleUrl,
  assertSafePublicSocialMediaBucket as assertScriptSafePublicBucket,
  ensurePublicSupabaseStorageBucket as ensureScriptBucket,
  probeFacebookAccessibleUrl as probeScriptAccessibleUrl,
  publicSocialMediaStorageBucket as scriptPublicSocialMediaStorageBucket,
  supabasePublicObjectUrl as scriptPublicObjectUrl,
  uploadPublicSupabaseObject as uploadScriptPublicObject,
} from "../scripts/social-storage-public.mjs";

const require = createRequire(import.meta.url);

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function loadStorageHelper() {
  const source = readFileSync(resolve("lib/supabasePublicStorage.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const cjsModule = { exports: {} };
  const context = {
    AbortController,
    DOMException,
    Response,
    URL,
    clearTimeout,
    console,
    encodeURIComponent,
    exports: cjsModule.exports,
    fetch: async () => {
      throw new Error("fetcher must be injected");
    },
    module: cjsModule,
    require,
    setTimeout,
  };
  context.globalThis = context;

  vm.runInNewContext(compiled, context, { filename: "lib/supabasePublicStorage.ts" });
  return cjsModule.exports;
}

function makeInput(fetcher) {
  return {
    supabaseUrl: "https://supabase.test/",
    serviceKey: "service-role-test-key",
    storageBucket: "reviewintel-media",
    allowedMimeTypes: ["video/mp4", "image/png"],
    fileSizeLimit: 100,
    fetcher,
  };
}

function privateBucketUpdateFailsFetcher() {
  return async (input, init = {}) => {
    const method = init.method || "GET";

    if (method === "GET") return jsonResponse({ id: "reviewintel-media", public: false });
    if (method === "PUT") return jsonResponse({ message: "not allowed" }, 403);

    throw new Error(`Unexpected ${method} ${input}`);
  };
}

function privateBucketStaysPrivateFetcher() {
  let getCount = 0;

  return async (input, init = {}) => {
    const method = init.method || "GET";

    if (method === "GET") {
      getCount += 1;
      return jsonResponse({ id: "reviewintel-media", public: false, getCount });
    }
    if (method === "PUT") return jsonResponse({ ok: true });

    throw new Error(`Unexpected ${method} ${input}`);
  };
}

function privateBucketBecomesPublicFetcher(calls) {
  let getCount = 0;

  return async (input, init = {}) => {
    const method = init.method || "GET";
    calls.push(method);

    if (method === "GET") {
      getCount += 1;
      return jsonResponse({ id: "reviewintel-media", public: getCount > 1 });
    }
    if (method === "PUT") return jsonResponse({ ok: true });

    throw new Error(`Unexpected ${method} ${input}`);
  };
}

const routeStorage = loadStorageHelper();

for (const [label, helper] of [
  [
    "route helper",
    {
      ensurePublicSupabaseStorageBucket: routeStorage.ensurePublicSupabaseStorageBucket,
      assertFacebookAccessibleUrl: routeStorage.assertFacebookAccessibleUrl,
      assertSafePublicSocialMediaBucket: routeStorage.assertSafePublicSocialMediaBucket,
      probeFacebookAccessibleUrl: routeStorage.probeFacebookAccessibleUrl,
      publicSocialMediaStorageBucket: routeStorage.publicSocialMediaStorageBucket,
      supabasePublicObjectUrl: routeStorage.supabasePublicObjectUrl,
      uploadPublicSupabaseObject: routeStorage.uploadPublicSupabaseObject,
    },
  ],
  [
    "generator helper",
    {
      ensurePublicSupabaseStorageBucket: ensureScriptBucket,
      assertFacebookAccessibleUrl: assertScriptAccessibleUrl,
      assertSafePublicSocialMediaBucket: assertScriptSafePublicBucket,
      probeFacebookAccessibleUrl: probeScriptAccessibleUrl,
      publicSocialMediaStorageBucket: scriptPublicSocialMediaStorageBucket,
      supabasePublicObjectUrl: scriptPublicObjectUrl,
      uploadPublicSupabaseObject: uploadScriptPublicObject,
    },
  ],
]) {
  test(`${label} rejects public URLs when an existing private bucket cannot be updated`, async () => {
    await assert.rejects(
      helper.ensurePublicSupabaseStorageBucket(makeInput(privateBucketUpdateFailsFetcher())),
      /not allowed|could not be made public/,
    );
  });

  test(`${label} verifies the bucket is public after an update`, async () => {
    await assert.rejects(
      helper.ensurePublicSupabaseStorageBucket(makeInput(privateBucketStaysPrivateFetcher())),
      /must be public/,
    );
  });

  test(`${label} returns only after a private bucket is verified public`, async () => {
    const calls = [];
    const bucket = await helper.ensurePublicSupabaseStorageBucket(makeInput(privateBucketBecomesPublicFetcher(calls)));

    assert.equal(bucket.public, true);
    assert.deepEqual(calls, ["GET", "PUT", "GET"]);
  });

  test(`${label} defaults social media to a dedicated public bucket`, () => {
    const defaultBucket = helper.publicSocialMediaStorageBucket({});
    assert.equal(defaultBucket.storageBucket, "reviewintel-social-public");
    assert.equal(defaultBucket.source, "default");
    assert.equal(
      helper.publicSocialMediaStorageBucket({ SUPABASE_MEDIA_BUCKET: "reviewintel-media" }).storageBucket,
      "reviewintel-social-public",
    );
    assert.equal(
      helper.publicSocialMediaStorageBucket({ SUPABASE_PUBLIC_SOCIAL_MEDIA_BUCKET: "reviewintel-reels-public" }).storageBucket,
      "reviewintel-reels-public",
    );
  });

  test(`${label} rejects known private/shared buckets for public social media`, () => {
    assert.throws(
      () => helper.assertSafePublicSocialMediaBucket({
        storageBucket: "reviewintel-media",
        env: {},
      }),
      /reserved for private\/shared media/,
    );
  });

  test(`${label} confirms a public MP4 object URL returns 200 for Facebook fetch`, async () => {
    const publicUrl = helper.supabasePublicObjectUrl({
      supabaseUrl: "https://supabase.test/",
      storageBucket: "reviewintel-social-public",
      objectPath: "social/reel.mp4",
    });
    const calls = [];
    const result = await helper.assertFacebookAccessibleUrl({
      url: publicUrl,
      fetcher: async (input, init = {}) => {
        calls.push({ url: String(input), method: init.method || "GET" });
        return new Response("", { status: 200 });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.deepEqual(calls, [{ url: publicUrl, method: "HEAD" }]);
  });

  test(`${label} rejects private or unreachable MP4 URLs`, async () => {
    const result = await helper.probeFacebookAccessibleUrl({
      url: "https://supabase.test/storage/v1/object/public/reviewintel-media/social/private-reel.mp4",
      fetcher: async () => new Response("", { status: 400 }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.match(result.error, /HEAD returned HTTP 400/);
  });

  test(`${label} upload helper returns only Facebook-fetchable URLs`, async () => {
    const calls = [];
    const publicUrl = await helper.uploadPublicSupabaseObject({
      supabaseUrl: "https://supabase.test/",
      serviceKey: "service-role-test-key",
      storageBucket: "reviewintel-social-public",
      objectPath: "social/reel.mp4",
      body: "mp4-bytes",
      contentType: "video/mp4",
      allowedMimeTypes: ["video/mp4"],
      fileSizeLimit: 100,
      fetcher: async (input, init = {}) => {
        const url = String(input);
        const method = init.method || "GET";
        calls.push({ url, method });

        if (url.endsWith("/storage/v1/bucket/reviewintel-social-public") && method === "GET") {
          return jsonResponse({ id: "reviewintel-social-public", public: true });
        }

        if (url.endsWith("/storage/v1/object/reviewintel-social-public/social/reel.mp4") && method === "POST") {
          return jsonResponse({ Key: "social/reel.mp4" });
        }

        if (url.endsWith("/storage/v1/object/public/reviewintel-social-public/social/reel.mp4") && method === "HEAD") {
          return new Response("", { status: 200 });
        }

        throw new Error(`Unexpected ${method} ${url}`);
      },
    });

    assert.equal(
      publicUrl,
      "https://supabase.test/storage/v1/object/public/reviewintel-social-public/social/reel.mp4",
    );
    assert.deepEqual(
      calls.map((call) => call.method),
      ["GET", "POST", "HEAD"],
    );
  });

  test(`${label} upload helper rejects uploaded objects that are not Facebook-fetchable`, async () => {
    await assert.rejects(
      helper.uploadPublicSupabaseObject({
        supabaseUrl: "https://supabase.test/",
        serviceKey: "service-role-test-key",
        storageBucket: "reviewintel-social-public",
        objectPath: "social/private-reel.mp4",
        body: "mp4-bytes",
        contentType: "video/mp4",
        allowedMimeTypes: ["video/mp4"],
        fileSizeLimit: 100,
        fetcher: async (input, init = {}) => {
          const url = String(input);
          const method = init.method || "GET";

          if (url.endsWith("/storage/v1/bucket/reviewintel-social-public") && method === "GET") {
            return jsonResponse({ id: "reviewintel-social-public", public: true });
          }

          if (url.endsWith("/storage/v1/object/reviewintel-social-public/social/private-reel.mp4") && method === "POST") {
            return jsonResponse({ Key: "social/private-reel.mp4" });
          }

          if (url.endsWith("/storage/v1/object/public/reviewintel-social-public/social/private-reel.mp4") && method === "HEAD") {
            return new Response("", { status: 400 });
          }

          throw new Error(`Unexpected ${method} ${url}`);
        },
      }),
      /Media HEAD returned HTTP 400/,
    );
  });

  test(`${label} reports network failures while checking public media URLs`, async () => {
    const result = await helper.probeFacebookAccessibleUrl({
      url: "https://supabase.test/storage/v1/object/public/reviewintel-media/social/reel.mp4",
      fetcher: async () => {
        throw new Error("network down");
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, "network down");
  });

  test(`${label} reports timeout failures while checking public media URLs`, async () => {
    const result = await helper.probeFacebookAccessibleUrl({
      url: "https://supabase.test/storage/v1/object/public/reviewintel-media/social/reel.mp4",
      timeoutMs: 100,
      fetcher: async (_input, init = {}) =>
        new Promise((resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          setTimeout(() => resolve(new Response("", { status: 200 })), 1000);
        }),
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, "Media fetch timed out.");
  });
}

test("public object URL builder uses the verified public storage path", () => {
  assert.equal(
    routeStorage.supabasePublicObjectUrl({
      supabaseUrl: "https://supabase.test/",
      storageBucket: "reviewintel-social-public",
      objectPath: "social/reel.mp4",
    }),
    "https://supabase.test/storage/v1/object/public/reviewintel-social-public/social/reel.mp4",
  );
  assert.equal(
    scriptPublicObjectUrl({
      supabaseUrl: "https://supabase.test/",
      storageBucket: "reviewintel-social-public",
      objectPath: "social/reel.mp4",
    }),
    "https://supabase.test/storage/v1/object/public/reviewintel-social-public/social/reel.mp4",
  );
});
