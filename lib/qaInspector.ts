/**
 * QA Inspector — ReviewIntel's read-only post-render quality guard.
 *
 * Commissioned 2026-10-16 (bot round, Junel): after every deploy the
 * inspector test-reads STORED scan results — the exact payload the result
 * page renders — and hunts the defect classes Junel has banned. It never
 * edits, fixes, or rewrites a result; every finding becomes a
 * ledger-shaped escalation record for a human (or the keeper lane runner).
 *
 * Pure logic, no I/O: all persistence is done by the caller (see
 * lib/qaInspectorLane.ts for the keeper-lane-shaped runner).
 *
 * Zero OpenAI. Score math untouched. Read-only by design: there is no
 * write path to scan results in this file.
 */

export type QaDefectClass =
  | "verdict_word"
  | "placeholder"
  | "empty_row"
  | "aggregate_twice"
  | "unbacked_warning"
  | "authenticity_label";

export type QaFinding = {
  scanId: string;
  defectClass: QaDefectClass;
  /** The exact offending string, truncated to a readable window. */
  offendingString: string;
  /** Dotted field path where it was found, e.g. "decisionBrief.factRows[2].text". */
  field: string;
};

export type QaInspectResult = {
  scanId: string;
  findings: QaFinding[];
  inspectedAt: string;
};

export type QaBatchReport = {
  inspected: number;
  findings: QaFinding[];
  findingsByScan: Record<string, QaFinding[]>;
  recordErrors: Array<{ scanId: string; error: string }>;
  inspectedAt: string;
};

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const isArr = Array.isArray;

/** Verdict-slot vocabulary the shopper may ever see (plus the thin-evidence state).
 * Derived from messages/<locale>.json Brief.verdict.{buy,wait,skip,lowConfidence}
 * (Translator, bot round) — the inspector is locale-aware at the verdict slot
 * (audit 1E). Stored payloads are English-canonical today, but a translated
 * "Acheter" in a verdict slot must NOT false-positive as a verdict_word
 * finding. Legacy banned words (Review first, AVOID, …) still fire in general
 * customer copy in ANY locale — that check is unchanged below. */
const VERDICT_WORDS = new Set([
  // English (canonical)
  "buy",
  "wait",
  "skip",
  "low confidence",
  // fr — Brief.verdict.buy/wait/skip/lowConfidence
  "acheter",
  "attendre",
  "passer",
  "confiance faible",
  // es
  "comprar",
  "esperar",
  "omitir",
  "poca confianza",
  // de
  "kaufen",
  "abwarten",
  "überspringen",
  "geringe zuversicht",
  // hi
  "खरीदें",
  "रुकें",
  "छोड़ें",
  "कम आत्मविश्वास",
  // zh
  "购买",
  "等等",
  "跳过",
  "信心不足"
]);
const VERDICT_SLOT_KEYS = new Set([
  "verdict",
  "shopperverdict",
  "displayverdict",
  "verdictword",
  "verdictlabel",
  "decisionword",
  "kind", // ShopperAnswer.kind: buy | wait | skip | not_enough — internal leaks flag here
  "label", // ShopperAnswer.label + answer-card headline label
]);

/** Internal verdict vocabulary that must never appear in customer copy. */
const LEGACY_VERDICT_ENUMS = /\b(REVIEW\s*FIRST|AVOID|DO\s*NOT\s*BUY(?:\s*YET)?|VERIFIED\s*BUY|LEANING\s*(?:BUY|WAIT|SKIP)|NOT_ENOUGH|NOT\s*ENOUGH(?:\s*EVIDENCE)?|NOT_SCORED|NOT\s*SCORED|NO_SCORE|NO\s*SCORE)\b/;
const REVIEW_FIRST_PROPER = /\bReview first\b/;

/** Internal "__"-style placeholders (round-3 regression: __generic_concern). */
const PLACEHOLDER_RE = /__[A-Za-z][A-Za-z0-9_]*(?:__)?/g;
const PLACEHOLDER_ALLOWLIST = new Set(["bold", "italic", "underline", "em", "strong"]);

/** Authenticity labels approved for the answer card (round 2, PR #50). */
const AUTH_LABELS = new Set([
  "Few AI-like signs",
  "Some AI-like signs",
  "Strong AI-like pattern",
]);

/** Subtrees that carry raw review evidence — never customer copy, never inspected. */
const SKIP_ROOT_KEYS = new Set([
  "acceptedrecords",
  "reviewevidence",
  "evidenceadjudication",
  "corpus",
  "librarycorpus",
  "reviews",
  "reviewbodies",
  "storedcorpus",
  "rawreviews",
]);

/** Fact-row-shaped arrays may live under these keys. */
const FACT_ROW_KEYS = new Set(["factrows", "fact_rows", "rows"]);

const snippet = (s: string, max = 140): string =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s;

type StringHit = { value: string; path: string };

function walkCustomerStrings(node: unknown, path: string, out: StringHit[]): void {
  if (typeof node === "string") {
    if (node.trim()) out.push({ value: node, path });
    return;
  }
  if (isArr(node)) {
    node.forEach((item, i) => walkCustomerStrings(item, `${path}[${i}]`, out));
    return;
  }
  if (isObj(node)) {
    for (const key of Object.keys(node)) {
      if (SKIP_ROOT_KEYS.has(key.toLowerCase())) continue;
      walkCustomerStrings(node[key], path ? `${path}.${key}` : key, out);
    }
  }
}

function lastKey(path: string): string {
  const m = path.replace(/\[\d+\]/g, "").split(".").pop() || "";
  return m.toLowerCase();
}

/** (a) Verdict words anywhere in customer copy outside Buy/Wait/Skip. */
function checkVerdictWord(scanId: string, record: Rec, strings: StringHit[]): QaFinding[] {
  const findings: QaFinding[] = [];
  for (const { value, path } of strings) {
    const key = lastKey(path);
    const text = value.trim();
    if (VERDICT_SLOT_KEYS.has(key)) {
      const normalized = text.toLowerCase().replace(/\s+/g, " ");
      if (normalized && !VERDICT_WORDS.has(normalized)) {
        findings.push({
          scanId,
          defectClass: "verdict_word",
          offendingString: snippet(text),
          field: path,
        });
        continue;
      }
    }
    // Legacy verdict enums leaking into general customer copy.
    const enumHit = LEGACY_VERDICT_ENUMS.exec(text) || REVIEW_FIRST_PROPER.exec(text);
    if (enumHit && !VERDICT_WORDS.has(text.toLowerCase())) {
      // Skip verdict slots — already reported above.
      if (VERDICT_SLOT_KEYS.has(key)) continue;
      findings.push({
        scanId,
        defectClass: "verdict_word",
        offendingString: snippet(enumHit[0]),
        field: path,
      });
    }
  }
  return dedupeFindings(findings);
}

/** (b) "__"-style internal placeholder strings in customer-facing fields. */
function checkPlaceholders(scanId: string, strings: StringHit[]): QaFinding[] {
  const findings: QaFinding[] = [];
  for (const { value, path } of strings) {
    PLACEHOLDER_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PLACEHOLDER_RE.exec(value)) !== null) {
      const inner = m[0].replace(/^__|__$/g, "").replace(/_$/, "").toLowerCase();
      if (!inner || PLACEHOLDER_ALLOWLIST.has(inner)) continue;
      findings.push({
        scanId,
        defectClass: "placeholder",
        offendingString: snippet(m[0]),
        field: path,
      });
      break; // one finding per field is enough
    }
  }
  return findings;
}

/** (c) Empty/dash fact rows (a row rendered with value "—", "" or null). */
function checkEmptyRows(scanId: string, record: Rec): QaFinding[] {
  const findings: QaFinding[] = [];
  const visit = (node: unknown, path: string): void => {
    if (isArr(node)) {
      const rows = node.filter(isObj);
      for (const row of rows) {
        const keys = Object.keys(row).map((k) => k.toLowerCase());
        const term = String(row.term ?? row.label ?? row.name ?? "").trim();
        const hasValueKey = keys.some((k) => ["text", "value", "rating", "count", "stars"].includes(k));
        if (term && hasValueKey) {
          const v = row.text ?? row.value;
          const textOk =
            (typeof v === "string" && v.trim() !== "" && v.trim() !== "—") ||
            (v !== null && v !== undefined && typeof v !== "string");
          const numOk = [row.rating, row.count, row.stars].some(
            (n) => typeof n === "number" && Number.isFinite(n)
          );
          if (!textOk && !numOk) {
            findings.push({
              scanId,
              defectClass: "empty_row",
              offendingString: snippet(`"${term}" → (no displayable value)`),
              field: path,
            });
          }
        }
      }
      node.forEach((item, i) => visit(item, `${path}[${i}]`));
      return;
    }
    if (isObj(node)) {
      for (const key of Object.keys(node)) {
        if (FACT_ROW_KEYS.has(key.toLowerCase())) {
          visit(node[key], path ? `${path}.${key}` : key);
        } else if (!SKIP_ROOT_KEYS.has(key.toLowerCase())) {
          visit(node[key], path ? `${path}.${key}` : key);
        }
      }
    }
  };
  visit(record, "");
  return findings;
}

/** (d) Marketplace aggregate rating+count stated twice in one brief payload. */
function checkAggregateTwice(scanId: string, record: Rec, strings: StringHit[]): QaFinding[] {
  // Find the aggregate numbers from known aggregate fields.
  const found: { rating: number | null; count: number | null } = { rating: null, count: null };
  const findNumbers = (node: unknown): void => {
    if (isArr(node)) return node.forEach(findNumbers);
    if (!isObj(node)) return;
    for (const key of Object.keys(node)) {
      const k = key.toLowerCase();
      const v = node[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        if (k.includes("rating") && !k.includes("count") && v >= 1 && v <= 5 && found.rating === null) found.rating = v;
        if ((k.includes("count") || k.includes("ratings") || k.includes("total")) && Number.isInteger(v) && v > 20 && found.count === null) found.count = v;
      }
      if (!SKIP_ROOT_KEYS.has(k)) findNumbers(v);
    }
  };
  findNumbers(record);
  const rating = found.rating;
  const count = found.count;
  if (rating === null || count === null) return [];

  const ratingRe = new RegExp(`\\b${String(rating).replace(".", "\\.")}\\s*(?:★|stars?|\\/5)?`);
  const countPlain = count.toLocaleString("en-US");
  const countNoComma = String(count);
  const mentions: StringHit[] = [];
  for (const hit of strings) {
    if (!ratingRe.test(hit.value)) continue;
    if (hit.value.includes(countPlain) || hit.value.includes(countNoComma)) {
      mentions.push(hit);
    }
  }
  if (mentions.length < 2) return [];
  return [
    {
      scanId,
      defectClass: "aggregate_twice",
      offendingString: snippet(`rating+count stated ${mentions.length}× (e.g. ${mentions[1].value.trim().slice(0, 60)}…)`),
      field: mentions[1].path,
    },
  ];
}

/** (e) Warning/factor claims with zero backing evidence entries behind them. */
function checkUnbackedWarnings(scanId: string, record: Rec): QaFinding[] {
  const findings: QaFinding[] = [];
  const flag = (value: string, path: string) => {
    if (!value.trim()) return;
    findings.push({ scanId, defectClass: "unbacked_warning", offendingString: snippet(value), field: path });
  };
  const visit = (node: unknown, path: string): void => {
    if (isArr(node)) {
      node.forEach((item, i) => visit(item, `${path}[${i}]`));
      return;
    }
    if (!isObj(node)) return;
    for (const key of Object.keys(node)) {
      const k = key.toLowerCase();
      if (SKIP_ROOT_KEYS.has(k)) continue;
      const childPath = path ? `${path}.${key}` : key;
      const v = node[key];
      // Post-R3 evidence gate suppresses unbacked warning strings — anything
      // left in these channels on a stored result is a defect.
      if (k === "consistency_warnings" && isArr(v)) {
        v.forEach((item, i) => {
          if (typeof item === "string" && item.trim()) flag(item, `${childPath}[${i}]`);
        });
        continue;
      }
      // ShopperPoint loves/complaints: a claim with no source ids and no
      // quote has nothing behind it.
      if ((k === "loves" || k === "complaints") && isArr(v)) {
        v.forEach((item, i) => {
          if (!isObj(item)) return;
          const claim = String(item.claim ?? "").trim();
          const ids = item.sourceIds;
          const hashes = item.sourceHashes;
          const quote = item.quote;
          const hasBacking = (isArr(ids) && ids.length > 0) || (isArr(hashes) && hashes.length > 0) || (typeof quote === "string" && quote.trim().length > 0);
          if (claim && !hasBacking) flag(claim, `${childPath}[${i}].claim`);
        });
        continue;
      }
      visit(v, childPath);
    }
  };
  visit(record, "");
  return findings;
}

/** (f) Authenticity label outside the three approved values. */
function checkAuthenticityLabel(scanId: string, record: Rec): QaFinding[] {
  const findings: QaFinding[] = [];
  const visit = (node: unknown, path: string, parentKey = ""): void => {
    if (isArr(node)) {
      node.forEach((item, i) => visit(item, `${path}[${i}]`, parentKey));
      return;
    }
    if (!isObj(node)) return;
    // Fact-row form: term "Review authenticity" with a text value.
    if (typeof node.term === "string" && node.term.toLowerCase() === "review authenticity") {
      const v = typeof node.text === "string" ? node.text.trim() : "";
      if (v && !AUTH_LABELS.has(v)) {
        findings.push({
          scanId,
          defectClass: "authenticity_label",
          offendingString: snippet(v),
          field: path,
        });
      }
      return;
    }
    for (const key of Object.keys(node)) {
      const k = key.toLowerCase();
      if (SKIP_ROOT_KEYS.has(k)) continue;
      const childPath = path ? `${path}.${key}` : key;
      const v = node[key];
      const looksAuth =
        k === "authrow" || k === "authenticity" || k === "authlabel" ||
        k === "aipatternlabel" || (k === "text" && parentKey.toLowerCase().includes("auth"));
      if (looksAuth && typeof v === "string" && v.trim() && !AUTH_LABELS.has(v.trim())) {
        findings.push({
          scanId,
          defectClass: "authenticity_label",
          offendingString: snippet(v.trim()),
          field: childPath,
        });
        continue;
      }
      visit(v, childPath, k);
    }
  };
  visit(record, "");
  return findings;
}

function dedupeFindings(findings: QaFinding[]): QaFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.defectClass}|${f.field}|${f.offendingString}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scanIdOf(record: Rec): string {
  const meta = isObj(record.meta) ? record.meta : {};
  return String(
    record.scanId ?? record.scan_id ?? meta.scanId ?? record.scanRef ?? record.scan_ref ?? "unknown"
  ).trim() || "unknown";
}

/**
 * Inspect one stored scan result. Never throws: a malformed record yields
 * zero findings plus a record-level error in the batch report, never an
 * exception — the inspector must fail soft per record.
 */
export function inspectStoredResult(record: unknown): QaInspectResult {
  const inspectedAt = new Date().toISOString();
  if (!isObj(record)) {
    return { scanId: "unknown", findings: [], inspectedAt };
  }
  const scanId = scanIdOf(record);
  try {
    const strings: StringHit[] = [];
    walkCustomerStrings(record, "", strings);
    const findings = dedupeFindings([
      ...checkVerdictWord(scanId, record, strings),
      ...checkPlaceholders(scanId, strings),
      ...checkEmptyRows(scanId, record),
      ...checkAggregateTwice(scanId, record, strings),
      ...checkUnbackedWarnings(scanId, record),
      ...checkAuthenticityLabel(scanId, record),
    ]);
    return { scanId, findings, inspectedAt };
  } catch (err) {
    return { scanId, findings: [], inspectedAt };
  }
}

/** Batch: inspect a list of stored results, grouped by scan. Fail-soft per record. */
export function inspectStoredResults(records: unknown[]): QaBatchReport {
  const perScan: QaFinding[][] = [];
  const findingsByScan: Record<string, QaFinding[]> = {};
  const recordErrors: Array<{ scanId: string; error: string }> = [];
  let inspected = 0;
  for (const record of records) {
    if (!isObj(record)) {
      recordErrors.push({ scanId: "unknown", error: "record is not a stored-result object" });
      continue;
    }
    try {
      const result = inspectStoredResult(record);
      inspected += 1;
      findingsByScan[result.scanId] = result.findings;
      perScan.push(result.findings);
    } catch (err) {
      recordErrors.push({
        scanId: "unknown",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return {
    inspected,
    findings: perScan.flat(),
    findingsByScan,
    recordErrors,
    inspectedAt: new Date().toISOString(),
  };
}
