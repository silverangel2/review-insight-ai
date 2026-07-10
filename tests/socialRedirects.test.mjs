import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadSocialRedirects() {
  const source = readFileSync(resolve("lib/socialRedirects.ts"), "utf8");
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
    process,
    require: (id) => {
      if (id === "@/lib/affiliate") {
        return {
          buildAffiliateUrl: (value) => {
            const parsed = new URL(value);
            parsed.searchParams.set("tag", "reviewintel-20");
            return parsed.toString();
          },
          isSupportedAffiliateUrl: (value) => {
            try {
              const host = new URL(value).hostname.replace(/^www\./, "");
              return host === "amazon.com" || host.endsWith(".amazon.com");
            } catch {
              return false;
            }
          },
        };
      }

      return require(id);
    },
  };
  context.globalThis = context;

  vm.runInNewContext(compiled, context, { filename: "lib/socialRedirects.ts" });
  return cjsModule.exports;
}

test("short branded redirect URLs use fixed ReviewIntel routes", () => {
  const redirects = loadSocialRedirects();
  const env = { NEXT_PUBLIC_SITE_URL: "https://getreviewintel.com/" };

  assert.equal(redirects.shortReviewIntelUrl(env), "https://getreviewintel.com/start");
  assert.equal(redirects.shortAffiliateUrl(env), "https://getreviewintel.com/recommends");
  assert.equal(redirects.resolveReviewIntelStartDestination(env), "https://getreviewintel.com");
});

test("affiliate redirect preserves Amazon tracking parameters", () => {
  const redirects = loadSocialRedirects();
  const destination = redirects.resolveAmazonAffiliateDestination({
    SOCIAL_AFFILIATE_URL: "https://www.amazon.com/dp/B000TEST?psc=1&tag=old-tag",
  });
  const parsed = new URL(destination);

  assert.equal(parsed.hostname, "www.amazon.com");
  assert.equal(parsed.searchParams.get("psc"), "1");
  assert.equal(parsed.searchParams.get("tag"), "reviewintel-20");
});

test("redirect resolution does not create an open redirect", () => {
  const redirects = loadSocialRedirects();
  const env = {
    NEXT_PUBLIC_SITE_URL: "https://getreviewintel.com",
    url: "https://evil.example/path",
    to: "https://evil.example/path",
  };

  assert.equal(redirects.shortReviewIntelUrl(env), "https://getreviewintel.com/start");
  assert.equal(redirects.shortAffiliateUrl(env), "https://getreviewintel.com/recommends");
  assert.notEqual(redirects.shortReviewIntelUrl(env), "https://evil.example/path");
});

test("link validation rejects private and local redirect destinations", () => {
  const redirects = loadSocialRedirects();

  assert.equal(redirects.normalizePublicHttpUrl("http://127.0.0.1:3000"), "");
  assert.equal(redirects.normalizePublicHttpUrl("http://localhost:3000"), "");
  assert.equal(redirects.normalizePublicHttpUrl("https://reviewintel.local"), "");
  assert.equal(redirects.normalizePublicHttpUrl("getreviewintel.com"), "https://getreviewintel.com");
});
