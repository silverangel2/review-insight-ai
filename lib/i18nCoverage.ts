/**
 * TRANSLATOR bot — coverage hunter (2026-10-16, bot round).
 *
 * Inventories customer-facing strings:
 *  (a) dictionary coverage: en leaf keys vs each locale (missing / empty /
 *      identical-to-en);
 *  (b) hard-coded user-visible strings in app/ + components/ customer
 *      surfaces that bypass the messages system (heuristic, conservative —
 *      flags candidates, never guesses);
 *  (c) the scan-result/brief copy surface: which Brief-dictionary source
 *      strings still appear as raw literals in the brief producers/render.
 *
 * Deterministic, zero LLM. Output is machine-readable JSON shaped so a
 * keeper lane can escalate from `summary` later (counts + worst gaps).
 */
import * as fs from "node:fs";
import * as path from "node:path";

export const SUPPORTED_LOCALES = ["en", "fr", "es", "de", "hi", "zh"] as const;

type Rec = Record<string, unknown>;

export type DictLocaleCoverage = {
  total: number;
  translated: number;
  missing: string[];
  empty: string[];
  identicalToEn: string[];
  /** Identical to en by construction (placeholder-only strings like "{unreadable} {retry}"). */
  identicalPlaceholderOnly: string[];
};

function flattenLeaves(value: unknown, prefix: string, out: Map<string, string>): void {
  if (typeof value === "string") {
    out.set(prefix, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenLeaves(item, `${prefix}[${index}]`, out));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Rec)) {
      flattenLeaves(item, prefix ? `${prefix}.${key}` : key, out);
    }
  }
}

function readMessages(messagesDir: string, locale: string): Map<string, string> {
  const file = path.join(messagesDir, `${locale}.json`);
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  const out = new Map<string, string>();
  flattenLeaves(raw, "", out);
  return out;
}

/** (a) Dictionary coverage per locale against en. */
export function dictionaryCoverage(rootDir: string): { en: number; locales: Record<string, DictLocaleCoverage> } {
  const messagesDir = path.join(rootDir, "messages");
  const en = readMessages(messagesDir, "en");
  const locales: Record<string, DictLocaleCoverage> = {};
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === "en") continue;
    const dict = readMessages(messagesDir, locale);
    const missing: string[] = [];
    const empty: string[] = [];
    const identicalToEn: string[] = [];
    const identicalPlaceholderOnly: string[] = [];
    let translated = 0;
    for (const [key, enValue] of en) {
      const value = dict.get(key);
      if (value === undefined) {
        missing.push(key);
      } else if (!value.trim()) {
        empty.push(key);
      } else if (value === enValue) {
        identicalToEn.push(key);
        // A value that is only placeholders + punctuation is identical by
        // construction (e.g. "{unreadable} {retry}"), not a translation gap.
        if (!/[A-Za-zÀ-ÿĀ-ž\u4e00-\u9fff\u0900-\u097f]/.test(value.replace(/\{[^}]*\}/g, ""))) {
          identicalPlaceholderOnly.push(key);
        }
      } else {
        translated += 1;
      }
    }
    locales[locale] = { total: en.size, translated, missing, empty, identicalToEn, identicalPlaceholderOnly };
  }
  return { en: en.size, locales };
}

// ---------------------------------------------------------------------------
// (b) Hard-coded UI string scan (heuristic, conservative).
// ---------------------------------------------------------------------------

const TECHNICAL_RE = /^(\s*[{}\][(),;:=]|.*=>|.*\/\*|\*\/)/;
const URL_OR_PATH_RE = /^(https?:|mailto:|tel:|\/|#|@|www\.)/;
const SINGLE_TOKEN_RE = /^[A-Za-z0-9_.$-]+$/;
const HAS_LETTER_RE = /[A-Za-zÀ-ÿĀ-ž\u4e00-\u9fff\u0900-\u097f]/;

function looksTechnical(text: string): boolean {
  const t = text.trim();
  if (t.length < 4) return true;
  if (!HAS_LETTER_RE.test(t)) return true;
  if (TECHNICAL_RE.test(t)) return true;
  if (URL_OR_PATH_RE.test(t)) return true;
  // className-style single tokens ("text-sm", "ri-card") are not copy.
  if (SINGLE_TOKEN_RE.test(t) && /[-_]/.test(t)) return true;
  // CSS-ish fragments.
  if (/:\s*[^ ]+;/.test(t) || /^\d+(\.\d+)?(px|rem|em|%|vh|vw)$/.test(t)) return true;
  // JS operator fragments leaking through ("0 && number").
  if (/&&|\|\||===|!==/.test(t)) return true;
  return false;
}

function jsxTextCandidates(source: string): string[] {
  const found: string[] = [];
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("{/*") || trimmed.startsWith("*")) continue;
    const re = />\s*([^<>{}\n]+?)\s*</g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      const text = match[1].trim().replace(/&[a-z]+;/g, " ");
      if (!looksTechnical(text)) found.push(text);
    }
  }
  return found;
}

const I18N_IMPORT_RE =
  /useTranslations|NextIntlClientProvider|getUiTextTranslation|getDictionary|briefI18n|from ["']next-intl["']|from ["']@\/lib\/i18n["']/;

function walkTsx(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "api" || entry.name === "node_modules") continue;
      walkTsx(full, out);
    } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name) && !/\.test\./.test(entry.name) && !/\.stories\./.test(entry.name)) {
      out.push(full);
    }
  }
}

export type HardcodedFileReport = {
  file: string;
  candidates: number;
  samples: string[];
  usesI18n: boolean;
};

export type HardcodedCoverage = {
  filesScanned: number;
  totalCandidates: number;
  byFile: HardcodedFileReport[];
  noI18nImport: string[];
};

/** (b) Scan app/ + components/ for JSX copy that bypasses the dictionaries. */
export function hardcodedCoverage(rootDir: string, maxFiles = 80, samplesPerFile = 8): HardcodedCoverage {
  const files: string[] = [];
  for (const dir of ["app", "components"]) {
    const full = path.join(rootDir, dir);
    if (fs.existsSync(full)) walkTsx(full, files);
  }
  const byFile: HardcodedFileReport[] = [];
  let totalCandidates = 0;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const candidates = jsxTextCandidates(source);
    totalCandidates += candidates.length;
    if (candidates.length === 0) continue;
    byFile.push({
      file: path.relative(rootDir, file),
      candidates: candidates.length,
      samples: candidates.slice(0, samplesPerFile),
      usesI18n: I18N_IMPORT_RE.test(source),
    });
  }
  byFile.sort((a, b) => b.candidates - a.candidates);
  const noI18nImport = byFile.filter((f) => !f.usesI18n).map((f) => f.file);
  return { filesScanned: files.length, totalCandidates, byFile: byFile.slice(0, maxFiles), noI18nImport };
}

// ---------------------------------------------------------------------------
// (c) Brief copy surface: dictionary-backed vs still hard-coded.
// ---------------------------------------------------------------------------

const BRIEF_SURFACE_FILES = [
  "lib/briefNarration.ts",
  "lib/shopperAnswer.ts",
  "lib/briefI18n.ts",
  "components/DecisionBrief.tsx",
];

/**
 * English source strings that MUST reach the shopper only through the Brief
 * dictionary. If one still appears as a raw literal in a producer/render
 * file (outside the dictionary JSON itself), the surface is not fully wired.
 */
export const BRIEF_SENTINELS: string[] = [
  "Should you buy it?",
  "Marketplace rating",
  "Ratings counted",
  "How sure we are",
  "Value for money",
  "Review authenticity",
  "Only real written reviews and the marketplace rating feed the score.",
  "Why you'd buy it",
  "Why you might not",
  "How we checked",
  "Analysis of real written buyer reviews and the marketplace rating.",
  "We're independent",
  "No complaint repeats across buyers",
  "These concerns came up across multiple buyers",
  "No buyer complaints in the reviews we read",
  "Buyers are mostly positive about this product.",
  "Based on {basis}.",
  "Few AI-like signs",
  "Some AI-like signs",
  "Strong AI-like pattern",
  "can't prove who wrote a review",
  "Buying Score / 100",
];

export type BriefSurfaceCoverage = {
  dictionaryKeys: string[];
  /** sentinel -> files where it still appears as a raw literal */
  rawLiteralsByFile: Record<string, string[]>;
  wiredFiles: string[];
};

/** Strip comments so doc-comments mentioning a sentinel are not flagged. */
function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

export function briefSurfaceCoverage(rootDir: string): BriefSurfaceCoverage {
  const en = readMessages(path.join(rootDir, "messages"), "en");
  const dictionaryKeys = [...en.keys()].filter((k) => k.startsWith("Brief."));
  const rawLiteralsByFile: Record<string, string[]> = {};
  for (const sentinel of BRIEF_SENTINELS) {
    const hits: string[] = [];
    for (const rel of BRIEF_SURFACE_FILES) {
      const full = path.join(rootDir, rel);
      if (!fs.existsSync(full)) continue;
      const source = stripComments(fs.readFileSync(full, "utf8"));
      // lib/briefI18n.ts legitimately names dictionary keys (types), never
      // the English sentences — but check anyway; a sentence literal there
      // would be a wiring miss.
      if (source.includes(sentinel)) hits.push(rel);
    }
    if (hits.length) rawLiteralsByFile[sentinel] = hits;
  }
  return { dictionaryKeys, rawLiteralsByFile, wiredFiles: BRIEF_SURFACE_FILES };
}

// ---------------------------------------------------------------------------
// Full report.
// ---------------------------------------------------------------------------

export type CoverageReport = {
  generatedAt: string;
  root: string;
  dictionary: { en: number; locales: Record<string, DictLocaleCoverage> };
  hardcoded: HardcodedCoverage;
  briefSurface: BriefSurfaceCoverage;
  summary: {
    needsAttention: boolean;
    reasons: string[];
    worstGaps: Array<{ area: string; detail: string; count: number }>;
  };
};

export function runCoverage(rootDir: string): CoverageReport {
  const dictionary = dictionaryCoverage(rootDir);
  const hardcoded = hardcodedCoverage(rootDir);
  const briefSurface = briefSurfaceCoverage(rootDir);

  const reasons: string[] = [];
  const worstGaps: Array<{ area: string; detail: string; count: number }> = [];

  for (const [locale, cov] of Object.entries(dictionary.locales)) {
    const gap = cov.missing.length + cov.empty.length;
    if (gap > 0) {
      reasons.push(`${locale}: ${cov.missing.length} keys missing, ${cov.empty.length} empty (en fallback renders)`);
      worstGaps.push({ area: "dictionary", detail: `${locale} missing+empty keys`, count: gap });
    }
    if (cov.identicalToEn.length > 0) {
      worstGaps.push({ area: "dictionary", detail: `${locale} keys identical to en`, count: cov.identicalToEn.length });
    }
  }
  const rawCount = Object.keys(briefSurface.rawLiteralsByFile).length;
  if (rawCount > 0) {
    reasons.push(`${rawCount} brief sentinel strings still hard-coded in producer/render files`);
    for (const [sentinel, files] of Object.entries(briefSurface.rawLiteralsByFile)) {
      worstGaps.push({ area: "brief-surface", detail: `"${sentinel.slice(0, 48)}" in ${files.join(", ")}`, count: files.length });
    }
  }
  for (const file of hardcoded.byFile.slice(0, 5)) {
    worstGaps.push({ area: "hardcoded-copy", detail: `${file.file} (${file.usesI18n ? "uses i18n" : "no i18n import"})`, count: file.candidates });
  }
  worstGaps.sort((a, b) => b.count - a.count);

  return {
    generatedAt: new Date().toISOString(),
    root: rootDir,
    dictionary,
    hardcoded,
    briefSurface,
    summary: { needsAttention: reasons.length > 0, reasons, worstGaps: worstGaps.slice(0, 15) },
  };
}

export function writeCoverageReport(report: CoverageReport, outPath: string): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
}
