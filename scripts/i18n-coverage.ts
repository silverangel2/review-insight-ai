#!/usr/bin/env node
/**
 * TRANSLATOR bot — coverage hunter CLI (2026-10-16, bot round).
 *
 * Runnable from the repo root:
 *   npx jiti scripts/i18n-coverage.ts --out <report.json> [--root <dir>]
 *
 * Writes a machine-readable JSON coverage report:
 *  (a) dictionary coverage per locale vs en,
 *  (b) hard-coded user-visible strings in app/ + components/ (heuristic),
 *  (c) brief copy surface: dictionary-backed vs still hard-coded.
 * Deterministic, zero LLM.
 */
import * as path from "node:path";
import { runCoverage, writeCoverageReport } from "../lib/i18nCoverage";

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const scriptDir = path.dirname(process.argv[1] || __filename);
const root = argValue("--root") || path.resolve(scriptDir, "..");
const out = argValue("--out");

if (!out) {
  console.error("usage: npx jiti scripts/i18n-coverage.ts --out <report.json> [--root <dir>]");
  process.exit(2);
}

const report = runCoverage(path.resolve(root));
writeCoverageReport(report, path.resolve(out));

const { dictionary, hardcoded, summary } = report;
console.log(`dictionary: en=${dictionary.en} leaves`);
for (const [locale, cov] of Object.entries(dictionary.locales)) {
  console.log(
    `  ${locale}: translated=${cov.translated}/${cov.total} missing=${cov.missing.length} empty=${cov.empty.length} ` +
      `identical-to-en=${cov.identicalToEn.length} (placeholder-only=${cov.identicalPlaceholderOnly.length})`
  );
}
console.log(`hardcoded: ${hardcoded.totalCandidates} candidates across ${hardcoded.filesScanned} files`);
console.log(
  `brief surface: ${report.briefSurface.dictionaryKeys.length} Brief dict keys, ` +
    `${Object.keys(report.briefSurface.rawLiteralsByFile).length} sentinels still hard-coded`
);
console.log(`needsAttention=${summary.needsAttention}`);
for (const reason of summary.reasons) console.log(`  - ${reason}`);
console.log(`report written to ${path.resolve(out)}`);
