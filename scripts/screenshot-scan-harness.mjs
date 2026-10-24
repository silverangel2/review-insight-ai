/**
 * Native screenshot-scan harness. Free, local, no OpenAI, no paid APIs.
 *
 *   npm run harness:screenshots
 *   node scripts/screenshot-scan-harness.mjs --grade-result ./some-result.json
 *
 * Identity fixtures always run. --grade-result grades a saved analyze payload
 * from a private preview. This script does not deploy and does not call
 * production.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const jiti = require("jiti")(path.join(root, "x.js"), { alias: { "@": root } });
const harness = jiti("./lib/screenshotScanHarness.ts");

const fixturePath = path.join(root, "fixtures/screenshot-scans/identity.json");
const outDir = path.join(root, "artifacts/screenshot-harness/latest");

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : "";
}

const fixtures = JSON.parse(readFileSync(fixturePath, "utf8"));
const checks = fixtures.map((fixture) => harness.gradeIdentityFixture(fixture));

const gradePath = argValue("--grade-result");
if (gradePath) {
  const saved = JSON.parse(readFileSync(path.resolve(gradePath), "utf8"));
  const payload = saved && saved.result ? saved.result : saved;
  checks.push(harness.gradeSavedScanResult(payload, {
    id: path.basename(gradePath),
    prominent: process.argv.includes("--prominent"),
    expectTitleExcludes: ["Official Outlet", "Available at a lower"],
  }));
}

const report = harness.harnessReport(checks);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "report.md"), report.markdown);
writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ ok: report.ok, pass: report.pass, fail: report.fail, checks }, null, 2));

process.stdout.write(report.markdown);
process.stdout.write(`\nArtifacts: ${path.join(outDir, "report.json")}\n`);
process.exit(report.ok ? 0 : 1);
