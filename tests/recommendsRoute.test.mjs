import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadRecommendsRoute({ adsEnabled = false, amazonEnabled = false, affiliateDestination = null } = {}) {
  const source = readFileSync(resolve("app/recommends/route.ts"), "utf8");
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
        return {
          NextResponse: {
            redirect: (url, status = 307) => ({ status, headers: { location: String(url) } }),
          },
        };
      }
      if (id === "@/lib/adConfig") {
        return {
          affiliatePartnerIsEnabled: (partner) => partner === "amazon" && amazonEnabled,
        };
      }
      if (id === "@/lib/adSettingsStore") {
        return {
          readAdSettings: async () => ({
            adsEnabled,
            affiliatePartners: { amazon: amazonEnabled },
          }),
        };
      }
      if (id === "@/lib/socialRedirects") {
        return {
          resolveAmazonAffiliateDestination: () => affiliateDestination,
          resolveReviewIntelStartDestination: () => "https://getreviewintel.com",
        };
      }

      return require(id);
    },
  };
  context.globalThis = context;

  vm.runInNewContext(compiled, context, { filename: "app/recommends/route.ts" });
  return cjsModule.exports;
}

test("recommends route falls back to the start page when affiliate is disabled", async () => {
  const route = loadRecommendsRoute();
  const response = await route.GET();

  assert.equal(response.status, 307);
  assert.equal(response.headers.location, "https://getreviewintel.com");
});

test("recommends route redirects to affiliate destination when configured", async () => {
  const route = loadRecommendsRoute({
    adsEnabled: true,
    amazonEnabled: true,
    affiliateDestination: "https://www.amazon.com/dp/B000TEST?tag=reviewintel-20",
  });
  const response = await route.GET();

  assert.equal(response.status, 307);
  assert.equal(response.headers.location, "https://www.amazon.com/dp/B000TEST?tag=reviewintel-20");
});
