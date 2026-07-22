import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function responseJson(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === null ? "" : JSON.stringify(body)),
  };
}

function loadAdminSocialMediaRoute({ assertFacebookAccessibleUrl, supabaseFetch }) {
  const source = readFileSync(resolve("app/api/admin/social-media/route.ts"), "utf8");
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
    URL,
    console,
    exports: cjsModule.exports,
    module: cjsModule,
    require: (id) => {
      if (id === "next/server") {
        return {
          NextResponse: {
            json: (body, init = {}) => ({
              body,
              status: init.status || 200,
            }),
          },
        };
      }
      if (id === "@/lib/adminAccess") {
        return { adminSessionFromRequest: async () => ({ email: "admin@test.local" }) };
      }
      if (id === "@/lib/supabaseServer") {
        return {
          supabaseFetch,
        };
      }
      if (id === "@/lib/supabasePublicStorage") {
        return { assertFacebookAccessibleUrl };
      }

      return require(id);
    },
  };
  context.globalThis = context;

  vm.runInNewContext(compiled, context, { filename: "app/api/admin/social-media/route.ts" });
  return cjsModule.exports;
}

function jsonRequest(body) {
  return {
    json: async () => body,
  };
}

test("admin social media insert rejects inaccessible absolute media URLs before storing", async () => {
  let supabaseCalls = 0;
  const route = loadAdminSocialMediaRoute({
    assertFacebookAccessibleUrl: async () => {
      throw new Error("Media HEAD returned HTTP 400.");
    },
    supabaseFetch: async () => {
      supabaseCalls += 1;
      return responseJson([]);
    },
  });

  const response = await route.POST(jsonRequest({
    file_url: "https://supabase.test/storage/v1/object/public/reviewintel-media/social/private-reel.mp4",
    media_type: "video",
  }));

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, "Media HEAD returned HTTP 400.");
  assert.equal(supabaseCalls, 0);
});

test("admin social media insert stores accessible absolute media URLs", async () => {
  let insertedRow = null;
  const route = loadAdminSocialMediaRoute({
    assertFacebookAccessibleUrl: async () => ({ ok: true, status: 200 }),
    supabaseFetch: async (path, init) => {
      assert.equal(path, "/rest/v1/admin_social_media");
      insertedRow = JSON.parse(init.body);
      return responseJson([{ id: "media-1", ...insertedRow }]);
    },
  });

  const response = await route.POST(jsonRequest({
    file_url: "https://supabase.test/storage/v1/object/public/reviewintel-media/social/public-reel.mp4",
    media_type: "video",
    title: "Public reel",
    topic: "shopper_tips",
    tags: ["CodexLibrary"],
  }));

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(insertedRow.file_url, "https://supabase.test/storage/v1/object/public/reviewintel-media/social/public-reel.mp4");
  assert.equal(insertedRow.media_type, "video");
});

test("admin social media GET parses raw Supabase REST rows", async () => {
  const route = loadAdminSocialMediaRoute({
    assertFacebookAccessibleUrl: async () => ({ ok: true, status: 200 }),
    supabaseFetch: async (path) => {
      assert.equal(path, "/rest/v1/admin_social_media?select=*&order=created_at.desc&limit=1000");
      return responseJson([
        {
          id: "media-1",
          media_type: "video",
          file_url: "https://supabase.test/storage/v1/object/public/reviewintel-social-public/social/videos/reel.mp4",
        },
        {
          id: "text-only",
          media_type: "text",
          file_url: "",
        },
      ]);
    },
  });

  const response = await route.GET(jsonRequest({}));

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.count, 1);
  assert.equal(response.body.media[0].id, "media-1");
});

test("clear library keeps selected Facebook and TikTok media", async () => {
  const deleted = [];
  const storageDeletes = [];
  const rows = [
    {
      id: "selected",
      media_type: "video",
      file_url: "https://supabase.test/storage/v1/object/public/reviewintel-social-public/social/videos/selected.mp4",
      metadata: { platform_usage: { facebook: true, tiktok: true, both: true } },
    },
    {
      id: "old",
      media_type: "image",
      file_url: "https://supabase.test/storage/v1/object/public/reviewintel-social-public/social/old.png",
      metadata: {},
    },
  ];

  const route = loadAdminSocialMediaRoute({
    assertFacebookAccessibleUrl: async () => ({ ok: true, status: 200 }),
    supabaseFetch: async (path, init = {}) => {
      if (String(path).startsWith("/storage/v1/object/")) {
        storageDeletes.push(path);
        return responseJson(null, 204);
      }

      if (init.method === "DELETE") {
        deleted.push(path);
        return responseJson(null, 204);
      }

      return responseJson(rows.filter((row) => !deleted.some((query) => String(query).includes(`id=eq.${row.id}`))));
    },
  });

  const response = await route.POST(jsonRequest({ action: "clear-library" }));

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.deleted_count, 1);
  assert.equal(response.body.media.length, 1);
  assert.equal(response.body.media[0].id, "selected");
  assert.equal(deleted[0], "/rest/v1/admin_social_media?id=eq.old");
  assert.equal(storageDeletes.length, 1);
});
