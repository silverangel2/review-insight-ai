export type ClauseRef = { text: string; src: number };

import type { MeasureKind } from "./themeMeasurements";

export type SpecificFamily = {
  /** Stable id: "<theme-id>:<family-slug>". */
  id: string;
  /** RI's own plain-words rendering of the specific. No title words, no numerals that don't appear in matched clauses. */
  canonical: string;
  /** Literal variant patterns, matched against the lowercased clause text. */
  variants: RegExp[];
  /** Which theme sides this family may fire on. Praise families never fire on complaint themes. */
  sides: ("for" | "against")[];
  /** True when the canonical asserts a genuine lack ("no seal", "no greasy
   *  shine", "no scent"). Then a clause evidences it only when the clause
   *  itself asserts absence. Canonicals like "without constant adjusting"
   *  are NOT marked: their finding is positive ("holds the set
   *  temperature"), and positive clauses ("works perfectly") evidence it. */
  absenceAssert?: boolean;
  /** Optional: product-title keywords the canonical assumes (e.g. "with the
   *  charging case" only for earbud-type products). Skipped when absent or
   *  when no title is available. */
  titleHints?: RegExp[];
  /** Iteration 3: measurement kinds this family may refine. When the miner
   *  finds a qualifying (>= 2 reviews, compatible) group of one of these
   *  kinds inside THIS family's matched clauses, the bullet renders the
   *  measurement through measurementRender instead of the bare canonical.
   *  No measurementRender -> no measurement bullet; every printed word is
   *  still hand-written. */
  measurementKinds?: MeasureKind[];
  /** Iteration 3: render a traced measurement as the bullet's specific.
   *  Receives the miner's render value ("about 24 hours") and must return
   *  one complete continuable sentence fragment. */
  measurementRender?: (m: string) => string;
  /** Iteration 3: family ids whose claim materially conflicts with this
   *  one (same theme, opposite pole). When both fire (>= 2 reviews each)
   *  the bullet says so instead of picking a winner. A pole with < 2
   *  reviews never fires, so the minority is dropped silently, never
   *  amplified. */
  opposes?: string[];
  /** Iteration 3: hand-written disagreement wording for the opposes pair
   *  (set on ONE side of the pair), e.g. "some say it fits, others say it
   *  doesn't". Renders as: "buyers disagree — <disagreeText>, say N of M
   *  buyers." */
  disagreeText?: string;
  /** Canonical-discipline audit trail: verbatim clause fragments that
   *  justify a duration/extent word in the canonical the variants don't
   *  carry literally (e.g. "for a bedroom"). The discipline test requires
   *  every such word to be backed by a variant or an evidence phrase. */
  evidence?: string[];
};

export type FamilyHit = {
  family: SpecificFamily;
  /** Distinct review sources (src ids), sorted ascending. */
  sources: number[];
  /** Up to 3 verbatim matched clause texts (audit trail). */
  examples: string[];
};

/** Every known incoming theme-key form -> canonical theme id. */
const THEME_KEY_ALIASES: Record<string, string> = {
  // --- proof-render forms: normalizeThemeKey(themeLabel) ---
  "clear sound quality": "sound-quality",
  "strong battery life": "battery",
  "pairing and connectivity": "pairing",
  "comfortable fit": "comfortable-fit",
  "call quality": "call-quality",
  "fit problems": "fit-problems",
  "fit isn't secure for everyone": "fit-problems",
  "good design": "design",
  "easy to use": "easy-use",
  "temperature control": "temperature-control",
  "heats quickly": "heats-quickly",
  "quiet operation": "quiet",
  "remote control": "remote",
  "solid build quality": "build-quality",
  "safety features": "safety",
  "does what it promises": "works-well",
  "good packaging": "packaging",
  "chops fast": "chops-fast",
  "sharp blades": "sharp-blades",
  "easy to clean": "easy-clean",
  "hard to clean": "hard-clean",
  "catch container": "catch-container",
  "blades too sharp — finger cuts": "cut-risk",
  "sturdy build": "sturdy",
  "blade variety": "blade-variety",
  "durability issues": "durability",
  "hard to press": "hard-press",
  "deep hydration": "hydration",
  "good for eczema and sensitive skin": "eczema-skin",
  "breakouts and irritation": "breakouts",
  "absorbs without grease": "absorbs",
  "fragrance-free": "fragrance-free",
  "no safety seal": "no-seal",
  // --- Owala FreeSip 32oz (proof3, drinkware) ---
  "keeps drinks cold 24 hours": "cold-retention",
  "keeps drinks cold": "cold-retention",
  "stays cold": "cold-retention",
  "cold retention": "cold-retention",
  "leak-proof": "leakproof",
  "leak proof": "leakproof",
  "no leaks": "leakproof",
  "sip or swig lid": "spout",
  "sip or swig spout": "spout",
  "freesip spout": "spout",
  "straw and spout": "spout",
  "doesn't fit cup holders": "cupholder",
  "does not fit cup holders": "cupholder",
  "cup holder fit": "cupholder",
  "cup holder": "cupholder",
  "dents and scratches": "durability",
  "dents easily": "durability",
  "scratches easily": "durability",
  "straw problems": "straw",
  "straw falls out": "straw",
  "straw detaches": "straw",
  "missing straw": "straw",
  "mold in lid": "cleaning",
  "mold in straw": "cleaning",
  "hard to clean lid": "cleaning",
  "heavy and bulky": "weight",
  "feels heavy": "weight",
  // --- production claim forms (claimClauseEvidence / scorer) ---
  "sound quality": "sound-quality",
  "battery life": "battery",
  "long battery life": "battery",
  "fit not secure": "fit-problems",
  "easy to use or set up": "easy-use",
  "difficult or confusing use or setup": "easy-use",
  "easy to clean or maintain": "easy-clean",
  "difficult cleaning or maintenance": "hard-clean",
  "good cooking results": "cooking-results",
  "fast or efficient performance": "chops-fast",
  "reliable or durable performance": "durability",
  "cracking or material durability problems": "durability",
  "solid build or product quality": "build-quality",
  "build or product quality problems": "build-quality",
  "attractive design or appearance": "design",
  "works well or performs as expected": "works-well",
  "good value for the price": "value",
  "weak, slow, or overheating performance": "weak-performance",
  "reliability or failure problems": "reliability-problems",
  "return or refund problems": "return-refund",
  "capacity or performance is not enough": "capacity",
  "useful features or functions": "features",
  "unanswered customer support": "support",
  "customer service": "support",
  "shipping": "shipping",
};

/** Canonicalize any incoming theme key to a library theme id. */
export function canonicalThemeId(key: string): string {
  const low = String(key ?? "").trim().toLowerCase();
  if (THEME_KEY_ALIASES[low]) return THEME_KEY_ALIASES[low];
  const stripped = low.replace(/^(dim|kw):/, "").trim();
  return THEME_KEY_ALIASES[stripped] ?? stripped;
}

// ---------------------------------------------------------------------------
// Polarity scope: is the variant match inside a negation/absence scope?
// ---------------------------------------------------------------------------

const NEG_TEST = /\b(not|never|no|nor|without|isn't|aren't|wasn't|weren't|can't|cannot|couldn't|won't|wouldn't|shouldn't|haven't|hasn't|hadn't|don't|doesn't|didn't)\b/;
/** Absence assertions: "no seal", "without", "fragrance-free", "zero greasy". */
const ABSENCE_TEST = /\b(no|without|never|none|zero|lacks?|lacking)\b|-\bfree\b/;
const NEG_ABSENCE_ALL =
  /\b(not|never|no|nor|without|none|lacks?|lacking|isn't|aren't|wasn't|weren't|can't|cannot|couldn't|won't|wouldn't|shouldn't|haven't|hasn't|hadn't|don't|doesn't|didn't)\b|-\bfree\b/g;
/** Clause splitters: a negation before one does not scope past it ("didn't
 * absorb well AND felt sticky"). "or" is deliberately NOT a boundary: "no
 * complaints about discomfort OR slipping out" stays negated. "," is not a
 * boundary either: "sinks in quickly, doesn't leave a greasy shine" keeps
 * the negation in scope. */
const BOUNDARY_ALL = /\b(and|but)\b/g;

function lastIndexOfAll(re: RegExp, s: string): number {
  let idx = -1;
  for (const m of s.matchAll(re)) idx = m.index ?? -1;
  return idx;
}

/**
 * Is the variant match inside the scope of a negation/absence? A marker
 * scopes over the match only when no "and"/"but" boundary sits between
 * them. Absence inside the matched span itself ("no seal", "no one else
 * can hear") is the family's own evidence definition, not a flip.
 */
function scopedAbsenceBefore(lower: string, matchIndex: number): boolean {
  const before = lower.slice(0, matchIndex);
  const markIdx = lastIndexOfAll(NEG_ABSENCE_ALL, before);
  if (markIdx < 0) return false;
  const boundIdx = lastIndexOfAll(BOUNDARY_ALL, before);
  return markIdx > boundIdx;
}

function polarityAgrees(
  family: SpecificFamily,
  clauseLower: string,
  matchIndex: number,
  matchText: string
): boolean {
  if (family.absenceAssert === true) {
    // The canonical asserts a genuine lack ("no seal", "no greasy shine",
    // "no scent"). A clause evidences it only when the clause itself
    // asserts absence anywhere: "no seal", "doesn't leave a greasy shine",
    // "fragrance-free", "zero greasy feeling". "It does have a protective
    // seal" is rejected — a genuine contradiction, not evidence.
    return ABSENCE_TEST.test(clauseLower) || NEG_TEST.test(clauseLower);
  }
  // Positive canonical: the match counts unless a negation/absence marker
  // scopes over it ("No complaints about discomfort or slipping out").
  // Absence inside the matched span itself ("no one else can hear") is the
  // family's own evidence definition, not a flip.
  void matchText;
  return !scopedAbsenceBefore(clauseLower, matchIndex);
}

// ---------------------------------------------------------------------------
// Matching.
// ---------------------------------------------------------------------------

/**
 * Match a theme's families against its bucketed clauses.
 * Returns firing families (>= 2 distinct sources), sorted by distinct
 * source count desc, then family id asc (fully deterministic).
 */
export function matchFamilies(
  key: string,
  clauses: ClauseRef[],
  side: "for" | "against" = "for",
  productTitle?: string
): FamilyHit[] {
  const id = canonicalThemeId(key);
  const fams = THEME_SPECIFICS[id];
  if (!fams || fams.length === 0) return [];
  const hits: FamilyHit[] = [];
  for (const f of fams) {
    if (!f.sides.includes(side)) continue;
    if (f.titleHints && productTitle && !f.titleHints.some((h) => h.test(productTitle))) continue;
    const srcSet = new Set<number>();
    const examples: string[] = [];
    for (const c of clauses) {
      const low = c.text.toLowerCase();
      let matched: { index: number; text: string } | null = null;
      for (const re of f.variants) {
        const m = low.match(re);
        if (m && m.index !== undefined && (!matched || m.index < matched.index)) {
          matched = { index: m.index, text: m[0] };
        }
      }
      if (!matched) continue;
      if (!polarityAgrees(f, low, matched.index, matched.text)) continue;
      srcSet.add(c.src);
      if (examples.length < 3) examples.push(c.text);
    }
    if (srcSet.size >= 2) {
      hits.push({
        family: f,
        sources: [...srcSet].sort((a, b) => a - b),
        examples,
      });
    }
  }
  hits.sort(
    (a, b) => b.sources.length - a.sources.length || (a.family.id < b.family.id ? -1 : 1)
  );
  return hits;
}

/** The winning family for a theme: highest distinct-source count, or null. */
export function winningFamily(
  key: string,
  clauses: ClauseRef[],
  side: "for" | "against" = "for",
  productTitle?: string
): FamilyHit | null {
  const hits = matchFamilies(key, clauses, side, productTitle);
  return hits.length ? hits[0] : null;
}

/**
 * Iteration 3: ALL clauses matched by one family (not just the 3 audit
 * examples) — the measurement miner's evidence set. Same matching +
 * polarity rules as matchFamilies.
 */
export function familyMatchedClauses(
  family: SpecificFamily,
  clauses: ClauseRef[]
): ClauseRef[] {
  const out: ClauseRef[] = [];
  for (const c of clauses) {
    const low = c.text.toLowerCase();
    let matched: { index: number; text: string } | null = null;
    for (const re of family.variants) {
      const m = low.match(re);
      if (m && m.index !== undefined && (!matched || m.index < matched.index)) {
        matched = { index: m.index, text: m[0] };
      }
    }
    if (!matched) continue;
    if (!polarityAgrees(family, low, matched.index, matched.text)) continue;
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Complaint severity order (iteration 3). Complaint bullets render:
// safety > outright failure > durability > annoyance — safety first
// regardless of tally size. The curated red-flag path
// (lib/analysisCopy.ts) is untouched and NOT duplicated: red flags keep
// their own sentence and their own first position.
// ---------------------------------------------------------------------------

const SEVERITY: Record<string, number> = {
  safety: 0,
  "cut-risk": 0,
  "reliability-problems": 1,
  "weak-performance": 1,
  "works-well": 1, // against-side only: the product does not do what it promises
  durability: 2,
  "build-quality": 2,
  sturdy: 2,
  straw: 2,
};

/** Severity rank for a theme key (against-side complaints). 0 = safety ... 3 = annoyance (default). */
export function severityRank(key: string): number {
  return SEVERITY[canonicalThemeId(key)] ?? 3;
}

// ---------------------------------------------------------------------------
// The library. Canonical phrases are RI's own words; every one is written
// from the actual clause texts in the v1 proof corpora (AirPods 4 x62,
// DREO x44, Fullstar x35, CeraVe x29) and is auditable clause-by-clause.
// Families whose matches could not be defended were cut before writing.
// ---------------------------------------------------------------------------

export const THEME_SPECIFICS: Record<string, SpecificFamily[]> = {
  // ---------------- AirPods 4 ----------------
  "sound-quality": [
    {
      id: "sound-quality:deep-bass",
      canonical: "deep, rich bass",
      sides: ["for"],
      variants: [
        /\bdeep bass\b/,
        /\bbass (?:is|was|sounds?) (?:deep|decent|rich|punchy|great)\b/,
        /\bgreat bass\b/,
      ],
    },
    {
      id: "sound-quality:crisp-highs",
      canonical: "crisp highs and clear vocals",
      sides: ["for"],
      variants: [/\bcrisp highs?\b/, /\bvocals sound crisp\b/, /\bclear vocals\b/],
    },
  ],
  battery: [
    {
      id: "battery:30-hours",
      canonical: "up to 30 hours with the charging case",
      sides: ["for"],
      titleHints: [/earbud|airpod|headphone|earphone/i],
      variants: [/\b30 ?hours?\b/, /\b30-hour\b/],
      measurementKinds: ["duration"],
      measurementRender: (m) => `lasts ${m} on a charge`,
    },
    {
      id: "battery:long-charge",
      canonical: "a long-lasting charge",
      sides: ["for"],
      variants: [
        /\blong (?:lasting )?charge\b/,
        /\blast(?:s|ed)? (?:all|a full) day\b/,
        /\bimpressive battery life\b/,
        /\bbattery life is (?:solid|excellent|impressive)\b/,
      ],
    },
  ],
  pairing: [
    {
      id: "pairing:quick-instant",
      canonical: "easy pairing that connects instantly",
      sides: ["for"],
      variants: [
        /\bpairs? quickly\b/,
        /\bquickly (?:it |they )?pairs?\b/,
        /\bpair(?:ing)? (?:is|was) (?:quick|fantastic|effortless)\b/,
        /\bpairs? fantastic(?:ally)?\b/,
        /\bconnect(?:s|ed)? instantly\b/,
        /\beasy to set up and connect\b/,
      ],
    },
  ],
  "call-quality": [
    {
      id: "call:clear-noisy",
      canonical: "clear call quality",
      sides: ["for"],
      variants: [
        /\bcall clarity\b/,
        /\bmicrophone quality\b/,
        /\bvoice quality\b/,
        /\bvoice isolation\b/,
        /\bhear you clearly\b/,
        /\bcalls? (?:stay|sound) clear\b/,
      ],
    },
  ],
  "comfortable-fit": [
    {
      id: "fit:comfy-long",
      canonical: "comfortable to wear without ear fatigue",
      sides: ["for"],
      titleHints: [/earbud|airpod|headphone|earphone|headset/i],
      variants: [
        /\ball.?day comfort\b/,
        /\bcomfortable .*long\b/,
        /\bno (?:aches|ear fatigue)\b/,
        /\bwithout.*fatigue\b/,
        /\bsecure fit.*comfortable\b/,
      ],
    },
  ],
  "fit-problems": [
    {
      id: "fit:slips-out",
      canonical: "the buds slip or fall out",
      sides: ["against"],
      titleHints: [/earbud|airpod|headphone|earphone/i],
      variants: [
        /\bslips?(?: out)?\b/,
        /\bslipping\b/,
        /\bfall(?:s|ing)? out\b/,
        /\bfell out\b/,
        /\bwon'?t stay\b/,
        /\bdon'?t stay\b/,
        /\bkeeps? falling\b/,
        /\bloose fitting\b/,
        /\bnot secure\b/,
      ],
    },
    {
      id: "fit:ache",
      canonical: "they hurt or feel uncomfortable over longer wear",
      sides: ["against"],
      variants: [
        /\bhurt(?:s)?\b/,
        /\bache[sd]?\b/,
        /\bpainful\b/,
        /\bsore\b/,
        /\buncomfortable\b/,
      ],
    },
  ],
  design: [
    {
      id: "design:sleek-light",
      canonical: "sleek, lightweight design",
      sides: ["for"],
      variants: [/\bsleek design\b/, /\blightweight\b.*\bfeel\b/, /\bshort ['"]?stem['"]?\b/],
    },
  ],
  // ---------------- DREO Space Heater ----------------
  "temperature-control": [
    {
      id: "temp:holds-set",
      canonical: "the thermostat holds the set temperature without constant adjusting",
      sides: ["for"],
      variants: [
        /\bthermostat works perfectly\b/,
        /\bthermostat (?:is|was) (?:incredibly )?accurate\b/,
        /\bmaintain(?:ing|s)? (?:the )?(?:set |perfect )?temperature\b/,
        /\bautomatically turn off and turn back on\b/,
        /\bno babysitting\b/,
        /\bwithout.*constantly adjust/,
        /\bholds? (?:the )?temperature\b/,
      ],
      evidence: ["very consistent at maintaining the temperature I set", "without constantly adjusting the settings"],
    },
  ],
  "heats-quickly": [
    {
      id: "heat:in-minutes",
      canonical: "heats a room up in minutes",
      sides: ["for"],
      variants: [
        /\b(warms?|heats?)(?: up)? .* in (?:minutes|seconds|no time)\b/,
        /\b(warms?|heats?)(?: up)? .* in (?:about |just |under |less than )?\d+ (?:minutes|seconds)\b/,
        /\btakes? (?:about |just |under |a good )?\d+ (?:minutes|seconds) to (?:\w+ )?(?:heat|warm)/,
        /\bwarms? up .* quickly\b/,
        /\broom in (?:minutes|seconds|no time)\b/,
      ],
      measurementKinds: ["duration"],
      measurementRender: (m) => `heats a room up in ${m}`,
      evidence: ["heats up the whole room in minutes"],
    },
    {
      id: "heat:1500w",
      canonical: "1500 watts of heating power",
      sides: ["for"],
      variants: [/\b1500 ?w(?:atts)?\b/],
      measurementKinds: ["power"],
      measurementRender: (m) => `${m} of heating power`,
    },
  ],
  quiet: [
    {
      id: "quiet:bedroom-calls",
      canonical: "quiet enough for a bedroom or the office, even on work calls",
      sides: ["for"],
      titleHints: [/heater|fan|purifier|humidifier|dehumidifier/i],
      variants: [
        /\bquiet enough\b/,
        /\bsurprisingly quiet\b/,
        /\bvery quiet\b/,
        /\bquiet compared to\b/,
        /\bno one else can hear\b/,
      ],
      evidence: ["great for the bedroom", "keep it on even when I'm on work calls"],
    },
  ],
  remote: [
    {
      id: "remote:from-bed",
      canonical: "control it from the couch, bed, or across the room",
      sides: ["for"],
      variants: [
        /\bfrom (?:my |the )?bed\b/,
        /\bget out of (?:my )?chair\b/,
        /\bacross the room\b/,
        /\bso handy\b/,
        /\bgame.?changer\b/,
        /\bdon'?t (?:even )?have to get up\b/,
      ],
    },
  ],
  safety: [
    {
      id: "safety:tip-overheat",
      canonical: "tip-over or overheat shut-off protection",
      sides: ["for"],
      variants: [
        /\btip.?over (?:and |&) ?overheat\b/,
        /\bshut.?s? off if.*tips?\b/,
        /\btip.?over protection\b/,
        /\boverheat protection\b/,
        /\bpeace of mind\b/,
      ],
    },
  ],
  // ---------------- Fullstar Vegetable Chopper ----------------
  "easy-use": [
    {
      id: "use:veggies-simple",
      canonical: "makes prepping veggies simple",
      sides: ["for"],
      titleHints: [/chopper|kitchen|food processor|mandoline|dicer|vegetable/i],
      variants: [
        /\bmakes prepping .* simple\b/,
        /\bchops? up .* really well\b/,
        /\bso many functions\b/,
        /\beasy to use and clean\b/,
      ],
    },
    {
      id: "use:effortless-controls",
      canonical: "simple, effortless controls",
      sides: ["for"],
      variants: [/\beffortless\b/, /\bsimple to use\b/, /\bforce sensors\b/],
    },
  ],
  "chops-fast": [
    {
      id: "chop:time-saver",
      canonical: "chops through veggies in a fraction of knife time",
      sides: ["for"],
      titleHints: [/chopper|kitchen|food processor|mandoline|dicer|knife|vegetable/i],
      variants: [
        /\btime saver\b/,
        /\bsaves? so much time\b/,
        /\bin record time\b/,
        /\bhalf the time\b/,
        /\bchopping fast\b/,
        /\bchops? food in less\b/,
      ],
      measurementKinds: ["duration"],
      measurementRender: (m) => `chops through veggies in ${m}`,
      evidence: ["less than half the time using a knife", "chopped in record time"],
    },
  ],
  "sharp-blades": [
    {
      id: "blades:sharp",
      canonical: "very sharp blades that handle cuts well",
      sides: ["for"],
      variants: [
        /\bsuper sharp\b/,
        /\bvery sharp\b/,
        /\bnice and sharp\b/,
        /\bblades are sharp\b/,
        /\bsharp!\b/,
      ],
    },
  ],
  "easy-clean": [
    {
      id: "clean:easy",
      canonical: "cleans up easily",
      sides: ["for"],
      variants: [
        /\beasy clean.?up\b/,
        /\bcleans? up easily\b/,
        /\bdishwasher safe\b/,
        /\beasy to clean afterwards?\b/,
      ],
    },
  ],
  "hard-clean": [
    {
      id: "clean:stuck-grooves",
      canonical: "food gets stuck in the blades",
      sides: ["against"],
      variants: [
        /\bfood .* stuck\b/,
        /\bgets? stuck\b/,
        /\bgrooves\b/,
        /\bcrevices\b/,
        /\btricky to clean\b/,
        /\btough to clean\b/,
      ],
    },
  ],
  "catch-container": [
    {
      id: "container:catches",
      canonical: "chopped food drops straight into the catch container",
      sides: ["for"],
      titleHints: [/chopper|dicer|mandoline/i],
      variants: [
        /\bdrops? into.*container\b/,
        /\bcaught in the storage\b/,
        /\bcatches? all.*chopped\b/,
      ],
    },
  ],
  "cut-risk": [
    {
      id: "blades:cut-risk",
      canonical: "watch your fingers — the blades can slice during handling and washing",
      sides: ["against"],
      variants: [
        /\bsliced my finger\b/,
        /\bwatch your fingers\b/,
        /\bbe careful.*handl/,
        /\bbrush.*against.*blade\b/,
      ],
    },
  ],
  "blade-variety": [
    {
      id: "blades:variety",
      canonical: "multiple blade options and attachments",
      sides: ["for"],
      titleHints: [/chopper|blade|knife|mandoline|dicer/i],
      variants: [/\bblade options\b/, /\bmultiple .* blades?\b/, /\battachments\b/],
    },
  ],
  durability: [
    {
      id: "durability:flimsy",
      canonical: "feels flimsy — buyers worry the top will snap off",
      sides: ["against"],
      titleHints: [/chopper|dicer/i],
      variants: [/\bflimsy\b/, /\bsnap off\b/],
    },
  ],
  "hard-press": [
    {
      id: "press:thump",
      canonical: "needs a hard thump on the lid to chop through",
      sides: ["against"],
      titleHints: [/chopper|dicer|mandoline/i],
      variants: [/\bpunch the lid\b/, /\bgood thump\b/, /\bneeds? .* thump\b/],
    },
  ],
  // ---------------- CeraVe Moisturizing Cream ----------------
  hydration: [
    {
      id: "hydration:locks-in",
      canonical: "locks in moisture, even right after a shower",
      sides: ["for"],
      variants: [
        /\bhydrated for hours\b/,
        /\bmoisturis(?:e|i)sed all day\b/,
        /\blocks? in (?:the )?moisture\b/,
        /\bright after a shower\b/,
      ],
      measurementKinds: ["duration"],
      measurementRender: (m) => `locks in moisture for ${m}`,
      evidence: ["locks in moisture with no oily residue"],
    },
  ],
  "eczema-skin": [
    {
      id: "skin:eczema",
      canonical: "gentle enough for eczema-prone, extremely dry skin",
      sides: ["for"],
      variants: [
        /\beczema\b/,
        /\bextremely dry skin\b/,
        /\bsensitive skin\b/,
        /\bdermatologist recommended\b/,
      ],
    },
  ],
  breakouts: [
    {
      id: "skin:sticky",
      canonical: "feels sticky for some — it sits on top of the skin instead of absorbing",
      sides: ["against"],
      variants: [
        /\bfelt sticky\b/,
        /\bfeeling sticky\b/,
        /\bsat on top of the skin\b/,
        /\bdidn'?t absorb well\b/,
      ],
    },
  ],
  absorbs: [
    {
      id: "skin:absorbs",
      canonical: "absorbs quickly with no greasy shine",
      sides: ["for"],
      absenceAssert: true,
      variants: [
        /\babsorbs? (?:completely|quickly)\b/,
        /\bsinks? in quickly\b/,
        /\bsoaks? into.*skin\b/,
        /\bgreasy shine\b/,
        /\bzero greasy\b/,
      ],
      measurementKinds: ["duration"],
      measurementRender: (m) => `absorbs in ${m}`,
    },
  ],
  "fragrance-free": [
    {
      id: "scent:none",
      canonical: "no scent at all",
      sides: ["for"],
      absenceAssert: true,
      variants: [/\bno scent\b/, /\bfragrance.?free\b/],
    },
  ],
  "no-seal": [
    {
      id: "seal:none",
      canonical: "arrives with no protective seal under the lid",
      sides: ["against"],
      absenceAssert: true,
      variants: [
        /\b(?:no )?(?:protective )?seal\b/,
        /\bunsealed\b/,
        /\bwithout a protective seal\b/,
      ],
    },
  ],

  "cord-cable": [
    {
      id: "cord:long-reach",
      canonical: "a long cord that reaches the outlet",
      sides: ["for"],
      variants: [
        /\blong cord\b/,
        /\bcord reaches\b/,
        /\bextra.?long cord\b/,
        /\bcord is (?:plenty|nice and) long\b/,
      ],
    },
    {
      id: "cord:too-short",
      canonical: "the cord is too short",
      sides: ["against"],
      variants: [
        /\bcord (?:is|feels) too short\b/,
        /\bshort(?:ish)? cord\b/,
        /\bwish the cord were longer\b/,
        /\bcord .* barely reaches\b/,
      ],
    },
  ],

  "charging-speed": [
    {
      id: "charge:fast",
      canonical: "charges up quickly",
      sides: ["for"],
      variants: [
        /\bcharges?(?: up)? (?:really |so )?fast\b/,
        /\bfast charging\b/,
        /\bquick charge\b/,
        /\bcharged? in (?:under |about )?\d+\s*(?:min|hour)/,
      ],
    },
    {
      id: "charge:slow",
      canonical: "takes a long time to charge",
      sides: ["against"],
      variants: [
        /\bslow to charge\b/,
        /\bcharging is slow\b/,
        /\btakes (?:so |too )?long to charge\b/,
        /\bcharges? (?:so |really )?slowly\b/,
      ],
    },
  ],

  // ---------------- Owala FreeSip 32oz (proof3, drinkware) ----------------
  "cold-retention": [
    {
      id: "cold:24h",
      canonical: "keeps drinks cold for up to 24 hours",
      sides: ["for"],
      titleHints: [/owala|bottle|tumbler|flask|cup|mug/i],
      variants: [
        /\bcold for (?:up to )?24 hours\b/,
        /\bkeeping drinks cold for 24 hours\+?\b/,
        /\bholds? ice for (?:about |up to )?24 hours\b/,
        /\bice for (?:about |up to )?24 hours\b/,
        /\bcold water all day long\b/,
        /\bkeeps? (?:my |your )?drinks? cold all day\b/,
        /\bcold retention is great\b/,
      ],
      measurementKinds: ["duration"],
      measurementRender: (m) => `keeps drinks cold for ${m}`,
    },
  ],
  leakproof: [
    {
      id: "leak:proof",
      canonical: "leak-proof — toss it in a bag without spills",
      sides: ["for"],
      titleHints: [/owala|bottle|tumbler|flask|cup/i],
      variants: [
        /\bleak.?proof\b/,
        /\bno leaks?\b/,
        /\bno spills\b/,
        /\bwon'?t leak\b/,
        /\bdoesn'?t leak\b/,
        /\bavoid spills\b/,
        /\bnot have to worry about leaking\b/,
      ],
    },
  ],
  spout: [
    {
      id: "spout:dual",
      canonical: "sip through the straw or swig from the wide spout",
      sides: ["for"],
      titleHints: [/owala|bottle|tumbler/i],
      variants: [
        /\bsip or swig\b/,
        /\bsip through the straw\b/,
        /\bswig from the (?:wide )?spout\b/,
        /\bsip or chug\b/,
        /\bstraw or the drinking part\b/,
        /\bbuilt.?in straw\b/,
        /\bbest spout\b/,
      ],
    },
  ],
  cupholder: [
    {
      id: "cupholder:too-wide",
      canonical: "too wide for standard cup holders",
      sides: ["against"],
      titleHints: [/owala|bottle|tumbler/i],
      variants: [
        /\bdoesn'?t fit (?:in )?(?:a |my |most standard )?cup ?holders?\b/,
        /\bdoes not fit (?:in )?(?:a |my |most standard )?cup ?holders?\b/,
        /\btoo wide to fit in a (?:drink|cup) holder\b/,
        /\bnot fit in a cup ?holder\b/,
      ],
      opposes: ["cupholder:fits"],
      disagreeText: "some say it doesn't fit in cup holders, others say it does",
    },
    {
      id: "cupholder:fits",
      canonical: "fits standard cup holders",
      sides: ["for"],
      titleHints: [/owala|bottle|tumbler/i],
      variants: [/\bfits?(?: perfectly)? into (?:my )?car'?s? cup ?holders?\b/],
    },
  ],
  straw: [
    {
      id: "straw:detaches",
      canonical: "the straw can fall out or detach",
      sides: ["against"],
      titleHints: [/owala|bottle|tumbler/i],
      variants: [
        /\bstraw (?:constantly )?falls? out\b/,
        /\bstraw detach/,
        /\bstraw came out\b/,
      ],
    },
    {
      id: "straw:missing",
      canonical: "arrives missing the straw",
      sides: ["against"],
      titleHints: [/owala|bottle|tumbler/i],
      variants: [/\bmissing the straw\b/, /\bno straw (?:in|included)/],
    },
  ],
  cleaning: [
    {
      id: "clean:mold-risk",
      canonical: "the lid and straw need thorough cleaning to avoid mold",
      sides: ["against"],
      titleHints: [/owala|bottle|tumbler/i],
      variants: [
        /\bmold\b/,
        /\btraps? moisture\b/,
        /\bmoisture.?trap/,
        /\bhard to clean (?:the )?(?:lid|straw)\b/,
      ],
    },
    {
      id: "clean:owala-easy",
      canonical: "easy to clean, lid and straw included",
      sides: ["for"],
      titleHints: [/owala|bottle|tumbler/i],
      variants: [
        /\beasy to clean\b/,
        /\bsuper easy to clean\b/,
        /\beasy to take apart and clean\b/,
      ],
    },
  ],
  weight: [
    {
      id: "weight:heavy",
      canonical: "feels heavy and bulky",
      sides: ["against"],
      titleHints: [/owala|bottle|tumbler|flask/i],
      variants: [
        /\bfeels? heavy\b/,
        /\bbulky\b/,
        /\btoo heavy\b/,
      ],
      measurementKinds: ["weight"],
      measurementRender: (m) => `weighs ${m}`,
    },
  ],
};
