/**
 * Production-equivalent regression tests for the ReviewIntel evidence-research
 * pipeline.
 *
 * The previous 39/39 suite only matched regexes against source text, which is
 * why it passed while production still returned NOT_ENOUGH for real products.
 * These tests EXECUTE the actual orchestration code (lib/openAiWebSearch and
 * lib/adaptiveReviewResearch) with a mocked fetch, proving:
 *
 * - web research runs when enabled, is skipped when disabled/missing
 * - adaptive research stops when sufficient, stagnant, or at the call cap
 * - at most 5 web-search calls per scan, Firecrawl stays fallback-only
 * - insufficient-evidence UI never implies "no complaints exist"
 *
 * Zero paid calls: fetch is fully mocked; no network traffic leaves the box.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = new URL("../", import.meta.url);
const TSC = new URL("../node_modules/.bin/tsc", import.meta.url).pathname;

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

/** Compile the two dependency-light lib modules and return their exports. */
let compiled = null;
function loadModules() {
  if (compiled) return compiled;
  const dir = mkdtempSync(join(tmpdir(), "ri-research-test-"));
  const tsconfig = join(dir, "tsconfig.json");
  writeFileSync(
    tsconfig,
    JSON.stringify({
      compilerOptions: {
        target: "es2022",
        module: "commonjs",
        moduleResolution: "node",
        strict: false,
        skipLibCheck: true,
        esModuleInterop: true,
        outDir: join(dir, "out"),
        baseUrl: new URL("../", import.meta.url).pathname,
        paths: { "@/*": ["./*"] },
        typeRoots: [new URL("../node_modules/@types", import.meta.url).pathname],
        types: ["node"],
      },
      include: [
        new URL("../lib/openAiWebSearch.ts", import.meta.url).pathname,
        new URL("../lib/adaptiveReviewResearch.ts", import.meta.url).pathname,
      ],
    })
  );
  execFileSync(TSC, ["-p", tsconfig], { stdio: "pipe" });
  const outDir = join(dir, "out");
  // Rewrite the @/ path alias to relative requires in emitted JS.
  for (const f of ["openAiWebSearch.js", "adaptiveReviewResearch.js"]) {
    const p = join(outDir, f);
    writeFileSync(p, readFileSync(p, "utf8").replace(/@\/lib\//g, "./"));
  }
  compiled = {
    web: require(join(outDir, "openAiWebSearch.js")),
    research: require(join(outDir, "adaptiveReviewResearch.js")),
  };
  return compiled;
}

/** Install a fetch mock; returns the recorded calls. */
function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(calls.length, init);
  };
  return calls;
}

function openAiJsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

function reviewJson(snippetCount) {
  const reviewSnippets = Array.from({ length: snippetCount }, (_, i) => ({
    source: `buyer-${i}`,
    snippet: `buyer signal ${i} about the exact product`,
    sentiment: "positive",
    evidenceType: "buyer comment",
  }));
  return { output_text: JSON.stringify({ reviewSnippets }) };
}

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const k of Object.keys(vars)) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    });
}

function researchArgs(overrides = {}) {
  const { web } = loadModules();
  return {
    store: "Amazon.ca",
    brand: "Takki",
    productName: "Takki 150W Peak Portable Power Station",
    model: null,
    price: 129.99,
    rating: 4.1,
    reviewCount: 2366,
    product: "Takki 150W Peak Portable",
    reviewSearchIdentity: "Takki 150W Peak Portable Power Station",
    outputLanguage: "English",
    checkedListingUrl: "https://www.amazon.ca/dp/B0EXAMPLE",
    checkedListingTitle: "Takki 150W Peak Portable Power Station",
    collectedWrittenReviewsPrompt: "(no written reviews collected)",
    reliableSignalTarget: 20,
    adaptiveMaxPasses: 5,
    openAiWebSearchContext: web.createOpenAiWebSearchContext({ maxCalls: 5 }),
    collectedWrittenReviewCount: () => 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Config gating: enabled / disabled / missing
// ---------------------------------------------------------------------------

test("WEB_SEARCH_ENABLED: web research executes and stops when sufficient", async () => {
  const { web, research } = loadModules();
  await withEnv(
    { REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED: "true", OPENAI_API_KEY: "test-key" },
    async () => {
      assert.equal(web.isOpenAiWebSearchEnabled(), true);
      const calls = mockFetch(async () => openAiJsonResponse(reviewJson(25)));
      const out = await research.runAdaptiveReviewResearch(researchArgs());
      assert.equal(out.webSearchEnabled, true);
      assert.equal(out.stopReason, "sufficient");
      assert.ok(out.webSearchCalls >= 1 && out.webSearchCalls <= 5);
      assert.ok(calls.length >= 1, "fetch must be called when enabled");
      const bodies = calls.map((c) => JSON.parse(c.init.body));
      assert.ok(
        bodies.every((b) => Array.isArray(b.tools) && b.tools[0].type === "web_search"),
        "every research call must use the web_search tool"
      );
    }
  );
});

test("WEB_SEARCH_DISABLED: zero calls, explicit disabled stop, no fetch", async () => {
  const { web, research } = loadModules();
  await withEnv(
    { REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED: "false", OPENAI_API_KEY: "test-key" },
    async () => {
      assert.equal(web.isOpenAiWebSearchEnabled(), false);
      const calls = mockFetch(async () => {
        throw new Error("fetch must not be called when disabled");
      });
      const out = await research.runAdaptiveReviewResearch(researchArgs());
      assert.equal(out.webSearchEnabled, false);
      assert.equal(out.stopReason, "web_search_disabled");
      assert.equal(out.webSearchCalls, 0);
      assert.equal(calls.length, 0);
    }
  );
});

test("WEB_SEARCH_MISSING_CONFIG: missing env fails closed like disabled", async () => {
  const { web, research } = loadModules();
  await withEnv(
    { REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED: undefined, OPENAI_API_KEY: "test-key" },
    async () => {
      assert.equal(web.isOpenAiWebSearchEnabled(), false);
      const calls = mockFetch(async () => {
        throw new Error("fetch must not be called when config is missing");
      });
      const out = await research.runAdaptiveReviewResearch(researchArgs());
      assert.equal(out.stopReason, "web_search_disabled");
      assert.equal(out.webSearchCalls, 0);
      assert.equal(calls.length, 0);
    }
  );
});

test("disabled web search is recorded in diagnostics as skippedDisabled", async () => {
  const { web } = loadModules();
  await withEnv({ REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED: undefined }, async () => {
    const ctx = web.createOpenAiWebSearchContext({ maxCalls: 5 });
    mockFetch(async () => {
      throw new Error("no fetch");
    });
    const res = await web.callOpenAiWebSearchResponse({
      input: "test",
      context: ctx,
      purpose: "diag-test",
    });
    assert.equal(res.skipped, true);
    assert.equal(res.skipReason, "disabled");
    assert.equal(res.usedWebSearch, false);
    assert.equal(ctx.diagnostics.skippedDisabled, 1);
    assert.equal(ctx.diagnostics.calls, 0);
  });
});

// ---------------------------------------------------------------------------
// Adaptive loop behavior: stagnation, call cap, sufficiency
// ---------------------------------------------------------------------------

test("STAGNATION: two consecutive empty passes stop the loop", async () => {
  const { research } = loadModules();
  await withEnv(
    { REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED: "true", OPENAI_API_KEY: "test-key" },
    async () => {
      mockFetch(async () => openAiJsonResponse(reviewJson(0)));
      const out = await research.runAdaptiveReviewResearch(researchArgs());
      assert.equal(out.stopReason, "stagnant");
      assert.equal(out.passesExecuted, 2);
      assert.ok(out.webSearchCalls <= 2);
    }
  );
});

test("MAX_5_CALLS: slow-but-improving research never exceeds 5 calls", async () => {
  const { research } = loadModules();
  await withEnv(
    { REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED: "true", OPENAI_API_KEY: "test-key" },
    async () => {
      // Each pass adds exactly 1 new distinct signal: improving, never sufficient.
      let n = 0;
      const calls = mockFetch(async () => {
        n += 1;
        const parsed = { reviewSnippets: [{ source: `buyer-${n}`, snippet: `distinct buyer signal ${n}`, sentiment: "positive", evidenceType: "buyer comment" }] };
        return openAiJsonResponse({ output_text: JSON.stringify(parsed) });
      });
      const out = await research.runAdaptiveReviewResearch(
        researchArgs({ reliableSignalTarget: 20 })
      );
      assert.ok(out.webSearchCalls <= 5, `calls=${out.webSearchCalls}`);
      assert.ok(calls.length <= 5, `fetch calls=${calls.length}`);
      assert.equal(out.passesExecuted, 5);
    }
  );
});

test("ADAPTIVE_RESEARCH: improving then sufficient stops early", async () => {
  const { research } = loadModules();
  await withEnv(
    { REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED: "true", OPENAI_API_KEY: "test-key" },
    async () => {
      let n = 0;
      mockFetch(async () => {
        n += 1;
        // Pass 1: 5 signals, pass 2: 25 signals -> sufficient after pass 2.
        return openAiJsonResponse(reviewJson(n === 1 ? 5 : 25));
      });
      const out = await research.runAdaptiveReviewResearch(researchArgs());
      assert.equal(out.stopReason, "sufficient");
      assert.equal(out.passesExecuted, 2);
      assert.ok(out.webSearchCalls <= 2);
    }
  );
});

// ---------------------------------------------------------------------------
// Structural guarantees (source-level, locked in)
// ---------------------------------------------------------------------------

test("FIRECRAWL_FALLBACK_ONLY: adaptive research never calls Firecrawl", () => {
  const researchSrc = source("lib/adaptiveReviewResearch.ts");
  assert.doesNotMatch(researchSrc, /import[^;]*firecrawl/i);
  assert.doesNotMatch(researchSrc, /runFirecrawlFallback/);
  assert.doesNotMatch(researchSrc, /firecrawlFallback\(/);
  const evidenceSrc = source("lib/reviewEvidence.ts");
  // Firecrawl may only appear in the dedicated fallback path, not the loop.
  assert.match(evidenceSrc, /runFirecrawlFallback/);
  const loopCall = evidenceSrc.match(
    /runAdaptiveReviewResearch\(\{[\s\S]*?\}\);/
  );
  assert.ok(loopCall, "adaptive loop must be invoked");
  assert.doesNotMatch(loopCall[0], /firecrawl/i);
});

test("INSUFFICIENT_UI: not_enough state shows truthful unavailable copy", () => {
  const ui = source("components/ResultsClient.tsx");
  assert.match(ui, /noStrengthsUnavailable/);
  assert.match(ui, /noComplaintsUnavailable/);
  assert.match(
    ui,
    /reviewEvidenceState === "not_enough" \? copy\.noStrengthsUnavailable : copy\.noStrengths/
  );
  assert.match(
    ui,
    /reviewEvidenceState === "not_enough" \? copy\.noComplaintsUnavailable : copy\.noComplaints/
  );
  // The misleading copy must not be used for the not_enough state.
  assert.doesNotMatch(
    ui,
    /reviewEvidenceState === "not_enough" \? copy\.noStrengths[^U]/
  );
});

test("disabled web research is surfaced in insufficient-evidence notes", () => {
  const evidence = source("lib/reviewEvidence.ts");
  assert.match(evidence, /webResearchDisabledNote/);
  assert.match(evidence, /REVIEWINTEL_OPENAI_WEB_SEARCH_ENABLED is not enabled/);
});

test("query ladder restored in adaptive research prompt", () => {
  const researchSrc = source("lib/adaptiveReviewResearch.ts");
  assert.match(researchSrc, /QUERY_LADDER/);
  assert.match(researchSrc, /exact product title \+ reviews/);
  assert.match(researchSrc, /mandatory query ladder/i);
});

test("metadata-derived pseudo strengths are still forbidden", () => {
  const evidence = source("lib/reviewEvidence.ts");
  // The 040f974 behavior (metadata -> strengths/complaints) must not return.
  assert.doesNotMatch(
    evidence,
    /listingEvidenceForCollection\?\.rating[\s\S]{0,200}repeatedPraises\s*=\s*\[/
  );
});

test("aggregate metadata still cannot satisfy evidence sufficiency", () => {
  const evidence = source("lib/reviewEvidence.ts");
  // The 7d99a43 behavior (rating/reviewCount as evidence) must not return.
  assert.match(evidence, /zeroWrittenReviewEvidence/);
  assert.match(
    evidence,
    /Marketplace rating\/review count from a screenshot or listing is metadata only/
  );
});
