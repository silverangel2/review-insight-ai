import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadAdminSocialMediaRoute({ assertFacebookAccessibleUrl, supabaseInsert }) {
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
          supabaseFetch: async () => [],
          supabaseInsert,
          supabaseUpdate: async () => ({}),
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
  let insertCalls = 0;
  const route = loadAdminSocialMediaRoute({
    assertFacebookAccessibleUrl: async () => {
      throw new Error("Media HEAD returned HTTP 400.");
    },
    supabaseInsert: async () => {
      insertCalls += 1;
      return {};
    },
  });

  const response = await route.POST(jsonRequest({
    file_url: "https://supabase.test/storage/v1/object/public/reviewintel-media/social/private-reel.mp4",
    media_type: "video",
  }));

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, "Media HEAD returned HTTP 400.");
  assert.equal(insertCalls, 0);
});

test("admin social media insert stores accessible absolute media URLs", async () => {
  let insertedRow = null;
  const route = loadAdminSocialMediaRoute({
    assertFacebookAccessibleUrl: async () => ({ ok: true, status: 200 }),
    supabaseInsert: async (_table, row) => {
      insertedRow = row;
      return { id: "media-1", ...row };
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
