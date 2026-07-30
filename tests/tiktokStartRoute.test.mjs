import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadTikTokStartRoute({ clientKeyConfigured = false, authUrl = "https://www.tiktok.com/v2/auth/authorize/?state=test" } = {}) {
  const source = readFileSync(resolve("app/api/auth/tiktok/start/route.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const cjsModule = { exports: {} };
  const context = {
    URL,
    console,
    exports: cjsModule.exports,
    module: cjsModule,
    require: (id) => {
      if (id === "next/server") {
        function MockResponse(body, init = {}) {
          return {
            body,
            status: init.status || 200,
            headers: init.headers || {},
          };
        }
        MockResponse.redirect = (url, status = 307) => ({
          status,
          headers: { location: String(url) },
          cookies: { set: () => undefined },
        });
        return { NextResponse: MockResponse };
      }
      if (id === "@/lib/tiktokConnector") {
        return {
          getTikTokAuthUrl: () => authUrl,
          getTikTokOAuthHealth: () => ({
            clientKeyConfigured,
            clientSecretConfigured: false,
            redirectUri: "https://getreviewintel.com/api/auth/tiktok/callback",
            scopes: ["user.info.basic", "video.upload"],
            directPostRequested: false,
            draftUploadRequested: true,
            approvalSafe: true,
          }),
        };
      }

      return require(id);
    },
  };
  context.globalThis = context;

  vm.runInNewContext(compiled, context, { filename: "app/api/auth/tiktok/start/route.ts" });
  return cjsModule.exports;
}

test("TikTok start returns a handled configuration response when client key is missing", async () => {
  const route = loadTikTokStartRoute();
  const response = await route.GET();

  assert.equal(response.status, 409);
  assert.match(response.body, /TIKTOK_CLIENT_KEY is missing/);
});

test("TikTok start redirects to TikTok when OAuth client key is configured", async () => {
  const route = loadTikTokStartRoute({ clientKeyConfigured: true });
  const response = await route.GET();

  assert.equal(response.status, 307);
  assert.equal(response.headers.location, "https://www.tiktok.com/v2/auth/authorize/?state=test");
});
