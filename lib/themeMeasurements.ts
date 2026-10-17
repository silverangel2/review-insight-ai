/**
 * Measurements miner — iteration 3 of RI's native findings engine (2026-10-17,
 * Junel: "push further"). Deterministic, zero external AI.
 *
 * Extracts buyer-stated measurements from COMPLETE clauses (value + unit),
 * normalizes units, and clusters compatible values. A measurement only ever
 * prints when >= 2 DISTINCT reviews state compatible values; every printed
 * number traces to the source clauses carried on the group. Conflicting
 * measurement poles (>= 2 reviews each) surface as an honest disagreement
 * instead of a picked winner.
 *
 * Deliberate limits: numerals only ("two days" is skipped — stated in the
 * report); negation scoped over the number rejects ("doesn't keep cold for
 * 24 hours" never evidences 24 hours).
 */

export type MeasureKind =
  | "duration"
  | "power"
  | "weight"
  | "length"
  | "temperature"
  | "db"
  | "count";

export type ClauseRef = { text: string; src: number };

export type MeasurementGroup = {
  kind: MeasureKind;
  /** Render unit, e.g. "hours", "watts", "°F". */
  unit: string;
  /** Normalized lo/hi (minutes, watts, oz, inches, °F, dB, count). */
  lo: number;
  hi: number;
  /** Plain render: "about 24 hours" / "about 20–30 hours". */
  renderValue: string;
  /** Distinct review sources, ascending. */
  sources: number[];
  /** Up to 3 verbatim clause texts (audit trail). */
  examples: string[];
};

// --- unit normalization -----------------------------------------------------

type UnitDef = {
  /** canonical render word for this unit family */
  word: string;
  /** factor to the kind's normalized unit */
  toNorm: number;
  /** normalized unit name (for tolerance math) */
  norm: string;
};

const DURATION_UNITS: Record<string, UnitDef> = {
  hour: { word: "hours", toNorm: 60, norm: "minutes" },
  hours: { word: "hours", toNorm: 60, norm: "minutes" },
  hr: { word: "hours", toNorm: 60, norm: "minutes" },
  hrs: { word: "hours", toNorm: 60, norm: "minutes" },
  minute: { word: "minutes", toNorm: 1, norm: "minutes" },
  minutes: { word: "minutes", toNorm: 1, norm: "minutes" },
  min: { word: "minutes", toNorm: 1, norm: "minutes" },
  mins: { word: "minutes", toNorm: 1, norm: "minutes" },
  second: { word: "seconds", toNorm: 1 / 60, norm: "minutes" },
  seconds: { word: "seconds", toNorm: 1 / 60, norm: "minutes" },
  sec: { word: "seconds", toNorm: 1 / 60, norm: "minutes" },
  secs: { word: "seconds", toNorm: 1 / 60, norm: "minutes" },
};
const POWER_UNITS: Record<string, UnitDef> = {
  watt: { word: "watts", toNorm: 1, norm: "watts" },
  watts: { word: "watts", toNorm: 1, norm: "watts" },
};
const WEIGHT_UNITS: Record<string, UnitDef> = {
  lb: { word: "pounds", toNorm: 16, norm: "oz" },
  lbs: { word: "pounds", toNorm: 16, norm: "oz" },
  pound: { word: "pounds", toNorm: 16, norm: "oz" },
  pounds: { word: "pounds", toNorm: 16, norm: "oz" },
  oz: { word: "ounces", toNorm: 1, norm: "oz" },
  ounce: { word: "ounces", toNorm: 1, norm: "oz" },
  ounces: { word: "ounces", toNorm: 1, norm: "oz" },
  kg: { word: "kilograms", toNorm: 35.274, norm: "oz" },
  kgs: { word: "kilograms", toNorm: 35.274, norm: "oz" },
  kilogram: { word: "kilograms", toNorm: 35.274, norm: "oz" },
  kilograms: { word: "kilograms", toNorm: 35.274, norm: "oz" },
};
const LENGTH_UNITS: Record<string, UnitDef> = {
  foot: { word: "feet", toNorm: 12, norm: "inches" },
  feet: { word: "feet", toNorm: 12, norm: "inches" },
  ft: { word: "feet", toNorm: 12, norm: "inches" },
  inch: { word: "inches", toNorm: 1, norm: "inches" },
  inches: { word: "inches", toNorm: 1, norm: "inches" },
  in: { word: "inches", toNorm: 1, norm: "inches" },
  cm: { word: "cm", toNorm: 1 / 2.54, norm: "inches" },
  mm: { word: "mm", toNorm: 1 / 25.4, norm: "inches" },
};
const TEMP_UNITS: Record<string, UnitDef> = {
  f: { word: "°F", toNorm: 1, norm: "°F" },
  c: { word: "°F", toNorm: 1, norm: "°F" }, // converted on parse, not by factor
};
const DB_UNITS: Record<string, UnitDef> = {
  db: { word: "dB", toNorm: 1, norm: "dB" },
  decibel: { word: "dB", toNorm: 1, norm: "dB" },
  decibels: { word: "dB", toNorm: 1, norm: "dB" },
};
const COUNT_NOUNS = new Set(["wash", "washes", "use", "uses", "cycle", "cycles", "charge", "charges", "load", "loads", "flush", "flushes"]);

// --- parsing ---------------------------------------------------------------

type Parsed = {
  kind: MeasureKind;
  normValue: number;
  unitWord: string;
  /** original unit token, for render-unit majority vote */
  unitToken: string;
  index: number;
  /** count-noun for the "count" kind (compatibility only within a noun) */
  noun?: string;
};

const RE: Record<Exclude<MeasureKind, "count" | "temperature">, RegExp> = {
  duration:
    /(\d+(?:\.\d+)?)\s*(?:-|–)?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b|(\d+(?:\.\d+)?)h(?![a-z])/gi,
  power: /(\d+(?:\.\d+)?)\s*(watts?)(?![a-z])|(\d+(?:\.\d+)?)w(?![a-z])/gi,
  weight: /(\d+(?:\.\d+)?)\s*(lbs?|pounds?|oz|ounces?|kgs?|kilograms?)\b/gi,
  length: /(\d+(?:\.\d+)?)\s*(feet|foot|ft|inches?|in|cm|mm)\b/gi,
  db: /(\d+(?:\.\d+)?)\s*(db|decibels?)\b/gi,
};
const TEMP_RE = /(-?\d+(?:\.\d+)?)\s*°\s*([fc])\b|(-?\d+(?:\.\d+)?)\s*degrees?\s*([fc])\b/gi;
const COUNT_RE = /(\d+)\s*(washes?|uses?|cycles?|charges?|loads?|flushes?)\b/gi;

const NEG_RE = /\b(not|never|no|nor|without|isn't|aren't|wasn't|weren't|can't|cannot|couldn't|won't|wouldn't|shouldn't|haven't|hasn't|hadn't|don't|doesn't|didn't)\b/g;
const BOUND_RE = /\b(and|but)\b/g;

function lastIdx(re: RegExp, s: string): number {
  let idx = -1;
  for (const m of s.matchAll(re)) idx = m.index ?? -1;
  return idx;
}

/** A measurement is rejected when a negation scopes over it. */
function negated(lower: string, matchIndex: number): boolean {
  const before = lower.slice(0, matchIndex);
  const markIdx = lastIdx(NEG_RE, before);
  if (markIdx < 0) return false;
  const boundIdx = lastIdx(BOUND_RE, before);
  return markIdx > boundIdx;
}

function unitOf(token: string, table: Record<string, UnitDef>): UnitDef | null {
  return table[token.toLowerCase()] ?? null;
}

function parseKind(text: string, kind: MeasureKind): Parsed[] {
  const out: Parsed[] = [];
  const lower = text.toLowerCase();
  const push = (value: number, unitToken: string, def: UnitDef, index: number, noun?: string) => {
    if (negated(lower, index)) return;
    out.push({ kind, normValue: value * def.toNorm, unitWord: def.word, unitToken: unitToken.toLowerCase(), index, noun });
  };
  if (kind === "temperature") {
    for (const m of text.matchAll(TEMP_RE)) {
      const v = parseFloat(m[1] ?? m[3]);
      const u = (m[2] ?? m[4]).toLowerCase();
      if (!isFinite(v)) continue;
      const idx = m.index ?? 0;
      if (negated(lower, idx)) continue;
      const f = u === "c" ? v * 9 / 5 + 32 : v;
      out.push({ kind, normValue: f, unitWord: "°F", unitToken: u, index: idx });
    }
    return out;
  }
  if (kind === "count") {
    for (const m of text.matchAll(COUNT_RE)) {
      const v = parseInt(m[1], 10);
      const noun = m[2].toLowerCase().replace(/s$/, "");
      const idx = m.index ?? 0;
      if (negated(lower, idx) || !COUNT_NOUNS.has(m[2].toLowerCase())) continue;
      out.push({ kind, normValue: v, unitWord: pluralCount(noun, v), unitToken: noun, index: idx, noun });
    }
    return out;
  }
  const re = RE[kind];
  re.lastIndex = 0;
  for (const m of text.matchAll(re)) {
    const v = parseFloat(m[1] ?? m[3]);
    const tok = (m[2] ?? m[4] ?? "").toLowerCase();
    if (!isFinite(v)) continue;
    const table =
      kind === "duration" ? DURATION_UNITS
      : kind === "power" ? POWER_UNITS
      : kind === "weight" ? WEIGHT_UNITS
      : kind === "length" ? LENGTH_UNITS
      : DB_UNITS;
    // duration "h" bare and power "w" bare arrive via the second alternative.
    const def = unitOf(tok, table) ?? (tok === "" && kind === "duration" ? DURATION_UNITS.hour : null) ?? (tok === "" && kind === "power" ? POWER_UNITS.watt : null);
    if (!def) continue;
    push(v, tok || (kind === "duration" ? "hours" : "watts"), def, m.index ?? 0);
  }
  return out;
}

export function extractMeasurements(text: string, kinds: MeasureKind[]): Parsed[] {
  const out: Parsed[] = [];
  for (const k of kinds) out.push(...parseKind(text, k));
  return out.sort((a, b) => a.index - b.index);
}

// --- compatibility + grouping -----------------------------------------------

/** Per-kind relative tolerance; temperature and dB use absolute tolerances. */
const TOL: Record<MeasureKind, { rel?: number; abs?: number }> = {
  duration: { rel: 0.25 },
  power: { rel: 0.1 },
  weight: { rel: 0.15 },
  length: { rel: 0.15 },
  temperature: { abs: 8 },
  db: { abs: 5 },
  count: { rel: 0.25 },
};

function compatible(kind: MeasureKind, a: number, b: number): boolean {
  const t = TOL[kind];
  if (t.abs !== undefined) return Math.abs(a - b) <= t.abs;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return lo === 0 ? hi === 0 : (hi - lo) / lo <= (t.rel ?? 0.2);
}

// --- render ------------------------------------------------------------------

function fmtNum(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Plural for count nouns: wash→washes, use→uses, cycle→cycles, charge→charges, load→loads, flush→flushes. */
function pluralCount(noun: string, n: number): string {
  if (n === 1) return noun;
  if (noun === "wash" || noun === "flush") return noun + "es";
  return noun + "s";
}

function plural(word: string, n: number): string {
  if (word === "°F" || word === "dB" || word === "cm" || word === "mm") return word;
  if (n === 1) return word.replace(/s$/, "");
  return word;
}

/** Majority original unit among members; ties prefer the larger unit. */
function renderUnitWord(kind: MeasureKind, members: Parsed[]): string {
  const votes = new Map<string, { def: UnitDef; n: number }>();
  for (const p of members) {
    const table =
      kind === "duration" ? DURATION_UNITS
      : kind === "power" ? POWER_UNITS
      : kind === "weight" ? WEIGHT_UNITS
      : kind === "length" ? LENGTH_UNITS
      : kind === "temperature" ? TEMP_UNITS
      : kind === "count" ? null
      : DB_UNITS;
    const def = table ? unitOf(p.unitToken, table) : null;
    if (!def) continue;
    const e = votes.get(def.word) ?? { def, n: 0 };
    e.n++;
    votes.set(def.word, e);
  }
  if (kind === "count") {
    const noun = members[0]?.noun ?? "use";
    const v = members[0]?.normValue ?? 0;
    return pluralCount(noun, v);
  }
  let best: { def: UnitDef; n: number } | null = null;
  for (const e of votes.values()) {
    if (!best || e.n > best.n || (e.n === best.n && e.def.toNorm > best.def.toNorm)) best = e;
  }
  return best ? best.def.word : kind === "temperature" ? "°F" : kind === "db" ? "dB" : "units";
}

function fromNorm(kind: MeasureKind, normValue: number, unitWord: string): number {
  const table =
    kind === "duration" ? DURATION_UNITS
    : kind === "power" ? POWER_UNITS
    : kind === "weight" ? WEIGHT_UNITS
    : kind === "length" ? LENGTH_UNITS
    : null;
  if (!table) return normValue;
  for (const def of Object.values(table)) {
    if (def.word === unitWord) return normValue / def.toNorm;
  }
  return normValue;
}

// --- main entry ----------------------------------------------------------------

/**
 * Mine measurement groups from the theme's clauses. A group qualifies only
 * with >= 2 DISTINCT review sources and mutually compatible values. Returns
 * groups sorted by distinct-source count desc, then kind asc (deterministic).
 */
export function mineMeasurements(clauses: ClauseRef[], kinds: MeasureKind[]): MeasurementGroup[] {
  if (!clauses.length || !kinds.length) return [];
  type Hit = { p: Parsed; src: number; text: string };
  const hits: Hit[] = [];
  for (const c of clauses) {
    for (const p of extractMeasurements(c.text, kinds)) {
      hits.push({ p, src: c.src, text: c.text });
    }
  }
  // Cluster per kind (count additionally split by noun).
  const groups: MeasurementGroup[] = [];
  const byKind = new Map<string, Hit[]>();
  for (const h of hits) {
    const k = h.p.kind + (h.p.noun ? `:${h.p.noun}` : "");
    const arr = byKind.get(k) ?? [];
    arr.push(h);
    byKind.set(k, arr);
  }
  for (const arr of byKind.values()) {
    const sorted = [...arr].sort((a, b) => a.p.normValue - b.p.normValue);
    let cluster: Hit[] = [];
    let clusterMax = 0;
    const flush = () => {
      const srcs = [...new Set(cluster.map((h) => h.src))].sort((a, b) => a - b);
      if (cluster.length && srcs.length >= 2) {
        const kind = cluster[0].p.kind;
        const lo = Math.min(...cluster.map((h) => h.p.normValue));
        const hi = Math.max(...cluster.map((h) => h.p.normValue));
        const unit = renderUnitWord(kind, cluster.map((h) => h.p));
        const rlo = fmtNum(fromNorm(kind, lo, unit));
        const rhi = fmtNum(fromNorm(kind, hi, unit));
        const range = rlo === rhi ? `${rlo} ${plural(unit, parseFloat(rlo))}` : `${rlo}–${rhi} ${plural(unit, parseFloat(rhi))}`;
        groups.push({
          kind,
          unit,
          lo,
          hi,
          renderValue: `about ${range}`,
          sources: srcs,
          examples: cluster.map((h) => h.text).filter((t, i, a) => a.indexOf(t) === i).slice(0, 3),
        });
      }
      cluster = [];
    };
    for (const h of sorted) {
      if (!cluster.length || compatible(h.p.kind, clusterMax, h.p.normValue)) {
        cluster.push(h);
        clusterMax = Math.max(clusterMax, h.p.normValue);
      } else {
        flush();
        cluster.push(h);
        clusterMax = h.p.normValue;
      }
    }
    flush();
  }
  groups.sort(
    (a, b) => b.sources.length - a.sources.length || (a.kind < b.kind ? -1 : 1)
  );
  return groups;
}

/**
 * Measurement disagreement: two groups of the same kind that both qualify
 * (>= 2 sources each) but hold incompatible values. Returns the strongest
 * such pair, or null. Each pole carries its own verbatim examples — the
 * bullet renders both.
 */
export function measurementDisagreement(
  groups: MeasurementGroup[]
): { a: MeasurementGroup; b: MeasurementGroup } | null {
  let best: { a: MeasurementGroup; b: MeasurementGroup } | null = null;
  let bestScore = 0;
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i];
      const b = groups[j];
      if (a.kind !== b.kind) continue;
      // Incompatible: the ranges don't overlap within tolerance.
      if (compatible(a.kind, a.lo, b.hi) || compatible(a.kind, a.hi, b.lo)) continue;
      const score = a.sources.length + b.sources.length;
      if (score > bestScore) {
        bestScore = score;
        best = { a, b };
      }
    }
  }
  return best;
}

/** Render a disagreement pole range: "10 to 30 hours". */
export function disagreementRange(pair: { a: MeasurementGroup; b: MeasurementGroup }): string {
  const lo = Math.min(pair.a.lo, pair.b.lo);
  const hi = Math.max(pair.a.hi, pair.b.hi);
  const unit = pair.a.unit;
  const rlo = fmtNum(fromNorm(pair.a.kind, lo, unit));
  const rhi = fmtNum(fromNorm(pair.a.kind, hi, unit));
  return `${rlo} to ${rhi} ${plural(unit, parseFloat(rhi))}`;
}
