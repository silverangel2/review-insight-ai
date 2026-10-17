// ============================================================================
// ReviewIntel analysis copy deck (2026-10-15, Phase 9 amendment).
//
// A HUGE, human-sounding sentence library for the decision-brief factors.
// PURE DATA + deterministic selection helpers. No thresholds, no tally logic,
// no facts live here — every frame fires only when lib/reviewAnalysis.ts has
// earned it from real tallies (support counts, bands, sub-aspect hits,
// co-occurrence, opposing signals). Frames never introduce facts; they only
// rephrase what the data already proved.
//
// SELECTION (deterministic):
//   pickFrame(frames, seed, used) -> the frame at hash(seed) % frames.length,
//   walking forward while its opener (first 5 words) is already used on this
//   page. The seed is built from a stable hash of the product's TALLY
//   SIGNATURE (theme set + bands + sub-aspect hits + review count), so:
//     - same corpus  -> same text on every visit (byte-identical re-renders)
//     - different corpus -> different frames, naturally
//     - no two factors on one rendered page start with the same frame
//
// Register: plain buyer language, varied rhythm and openers, zero corporate
// filler ("furthermore" / "in conclusion" are banned).
// ============================================================================

/** FNV-1a: tiny, stable, dependency-free. Same input -> same number, forever. */
export function hashSignature(sig: string): number {
  let h = 2166136261;
  for (let i = 0; i < sig.length; i++) {
    h ^= sig.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A frame's opener: first 5 words, lowercased. Used for page-level de-dupe. */
export function openerOf(text: string): string {
  return text
    .split(/\s+/)
    .slice(0, 5)
    .join(" ")
    .toLowerCase()
    .replace(/[.,:;!?—–-]+$/g, "");
}

/** Fill {slots} in a frame template. Unknown slots are left as-is (loud). */
export function renderFrame(template: string, slots: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (slots[k] !== undefined ? slots[k] : `{${k}}`));
}

/**
 * Deterministically pick a frame. Walks forward from the hashed start while
 * the opener is already used on this page, so no two factors on one brief
 * ever start with the same frame. The walk itself is deterministic, so
 * re-renders are byte-identical.
 */
export function pickFrame(frames: string[], seed: string, used: Set<string>): string {
  const n = frames.length;
  if (n === 0) return "";
  const start = hashSignature(seed) % n;
  for (let k = 0; k < n; k++) {
    const f = frames[(start + k) % n];
    const op = openerOf(f);
    if (!used.has(op)) {
      used.add(op);
      return f;
    }
  }
  const f = frames[start];
  used.add(openerOf(f));
  return f;
}

// ---------------------------------------------------------------------------
// FOR-side leads, by rank among the page's for-themes.
// ---------------------------------------------------------------------------

export const FOR_LEAD_STRONGEST: string[] = [
  "Buyers return to this more than any other point",
  "If the reviews had a headline, this would be it",
  "This is what buyers can't stop talking about",
  "More than anything else, buyers love this",
  "The reviews keep circling back to this",
  "Ask buyers what stands out and this is the answer",
  "This dominates the conversation in the reviews",
  "The single biggest theme across the reviews",
  "Buyers lead with this almost every time",
  "Nothing else gets this much love in the reviews",
  "The reviews are loudest about this",
  "This is the first thing buyers mention, and the most",
];

export const FOR_LEAD_SECOND: string[] = [
  "Buyer after buyer mentions this as well",
  "Right behind it, buyers keep naming this",
  "This comes up almost as often",
  "Nearly as many buyers point to this",
  "The next thing buyers rave about",
  "Buyers dwell on this one too",
  "This earns its own chorus in the reviews",
  "Almost as many reviews land here",
  "The runner-up in the reviews, by a mile",
  "Buyers keep coming back to this too",
];

export const FOR_LEAD_REST: string[] = [
  "This comes through as well",
  "Buyers give this its due too",
  "This rounds out the picture",
  "The reviews nod to this as well",
  "Buyers mention this warmly in passing",
  "This gets its share of praise",
  "Not the headline, but buyers notice this",
  "The reviews quietly agree on this",
];

/** Value-dimension leads: price talk gets its own register. */
export const VALUE_LEADS: string[] = [
  "On value, buyers are clear",
  "When it comes to the price, buyers land here",
  "Buyers do the math and like the answer",
  "For the money, this is where buyers land",
  "Price comes up constantly — in a good way",
  "Buyers keep justifying the price, happily",
  "The price-to-quality ratio gets its own fan club",
  "Nobody feels overcharged — buyers say so outright",
];

// ---------------------------------------------------------------------------
// AGAINST-side leads.
// ---------------------------------------------------------------------------

export const AGAINST_LEAD_TOP: string[] = [
  "The most repeated complaint in the reviews",
  "The complaint buyers repeat most",
  "If there's a sore spot, this is it",
  "Buyers agree on the weak point",
  "This is where the reviews turn critical",
  "The reviews converge on this problem",
  "No complaint comes up more than this",
  "This is the thing buyers warn each other about",
];

export const AGAINST_LEAD_OTHER: string[] = [
  "This complaint comes up again and again",
  "Buyers keep flagging this too",
  "The reviews grumble about this one",
  "This one won't go away in the reviews",
  "Buyer after buyer trips over this",
  "The reviews keep docking points here",
  "This surfaces too often to ignore",
  "Buyers circle this as the next issue",
];

/** One-off concerns: single honest sentences with a {theme} slot. */
export const ONE_OFF_LEADS: string[] = [
  "One buyer flagged {theme}",
  "A single buyer ran into {theme}",
  "This came up once: {theme}",
  "One buyer reported {theme} — worth knowing",
  "A lone buyer mentioned {theme}",
  "One review raises {theme}",
  "A single report describes {theme}",
  "One buyer's experience included {theme}",
];

// ---------------------------------------------------------------------------
// Strength lines, by band (and share within the repeated band).
// ---------------------------------------------------------------------------

export const STRENGTH_DOMINANT_FIRST: string[] = [
  "It's the strongest pattern in the reviews.",
  "No other point comes close.",
  "It beats every other theme by a mile.",
  "This is the reviews' clearest signal.",
  "The weight of opinion leaves no doubt here.",
  "It towers over everything else buyers mention.",
  "This is as close to consensus as reviews get.",
  "The reviews speak with one voice here.",
  "Nothing else buyers mention comes close.",
  "It leads the reviews by a wide margin.",
];

export const STRENGTH_DOMINANT: string[] = [
  "It's one of the strongest patterns in the reviews.",
  "It ranks among the reviews' clearest signals.",
  "The reviews are emphatic about this.",
  "This is one of the loudest themes in the reviews.",
  "Buyers are unusually united on this.",
  "It stands out sharply from the rest.",
  "The reviews keep landing here with force.",
  "This is a top-tier theme by any count.",
];

export const STRENGTH_HALF: string[] = [
  "About half the reviews mention it.",
  "Roughly half of buyers bring it up.",
  "It shows up in around half the reviews.",
  "Close to half the buyers land here.",
  "Half the reviews can't be wrong about this.",
  "A full half of buyers make this point.",
  "It comes up in review after review — about half of them.",
  "Mentioned about as often as not, which is a lot.",
];

export const STRENGTH_REPEATED: string[] = [
  "It's mentioned by buyer after buyer.",
  "Review after review says the same.",
  "The reviews repeat this like a refrain.",
  "Buyers say it independently, again and again.",
  "It echoes through the reviews.",
  "This is a steady drumbeat in the reviews.",
  "The reviews keep confirming each other here.",
  "Different buyers, same point, over and over.",
  "It recurs too often to be coincidence.",
  "The pattern repeats across the reviews.",
];

export const STRENGTH_FEW: string[] = [
  "A few buyers raise it.",
  "A handful of buyers mention it.",
  "It comes up in a few reviews.",
  "A small number of buyers point to this.",
  "A few reviewers land here.",
  "It's a minority view, but a real one.",
  "Only a few buyers say it, but they say it clearly.",
  "A modest slice of the reviews mentions it.",
];

/** Short closers: earned only by dominant-band factors. Restate the pattern, add no facts. */
export const CLOSERS: string[] = [
  "That kind of consistency is the tell.",
  "It's the pattern, not the exception.",
  "That breadth is what makes it convincing.",
  "Hard to argue with that level of agreement.",
  "You don't get this kind of alignment by accident.",
  "The reviews agree with each other on this one.",
  "That's about as solid as review evidence gets.",
  "When reviews align like this, it means something.",
];

// ---------------------------------------------------------------------------
// Caveat clauses ({note} slot): the same theme has real signals on the
// other side, so the factor doesn't pretend unanimity.
// ---------------------------------------------------------------------------

export const CAVEATS: string[] = [
  ", with only isolated notes that {note}",
  " — though a few buyers found {note}",
  ", even if a handful of buyers report {note}",
  " — not unanimous: some buyers say {note}",
  ", with the odd buyer noting {note}",
  " — a small minority found {note}",
  ", though isolated reports mention {note}",
  " — a few dissenting buyers point to {note}",
  ", barring scattered notes that {note}",
  " — with scattered pushback that {note}",
];

/** Against-side caveat: the same theme also earned real praise. */
export const AGAINST_CAVEATS: string[] = [
  " — though some buyers report the opposite.",
  ", even if not every buyer agrees.",
  " — a few buyers had no issue with it at all.",
  ", though some buyers were perfectly happy.",
  " — not every buyer had this experience.",
  ", with a few buyers pushing back on it.",
];

// ---------------------------------------------------------------------------
// 2026-10-16 frame strip: standalone caveat sentences for the theme-basis
// path. The regular theme path no longer prints pattern sentences, so an
// evidenced opposing signal is voiced as its own sentence (hard rule: never
// hide an EVIDENCED negative signal). {note} carries the real opposing note;
// the register mirrors the approved CAVEATS above.
// ---------------------------------------------------------------------------
export const STANDALONE_CAVEATS_FOR: string[] = [
  "A few buyers found {note}.",
  "Not every buyer agrees — some found {note}.",
  "A small minority reported {note}.",
];

export const STANDALONE_CAVEATS_AGAINST: string[] = [
  "A few buyers had no issue with it at all.",
  "Though some buyers were perfectly happy.",
  "Not every buyer had this experience.",
];

// ---------------------------------------------------------------------------
// Co-occurrence bridges ({a} = this theme's noun, {b} = the paired theme).
// ---------------------------------------------------------------------------

export const CO_PAIR_BRIDGES: string[] = [
  ", and pair that {a} with {b}",
  ", often mentioning {b} in the same breath",
  " — buyers tend to bring up {b} right alongside it",
  ", with {b} coming up alongside",
  " — and they connect it to {b}",
  ", {b} usually mentioned in the same review",
  " — {b} gets named alongside it, again and again",
  ", and {b} is part of the same story",
];

// ---------------------------------------------------------------------------
// Dimension depth: titles, sub-aspect keyword sets + human phrase variants,
// pairing nouns, caveat notes, and loose signals for mapping stray text.
// ---------------------------------------------------------------------------

export type AspectDef = {
  id: string;
  /** Lowercase keywords; matched whole-word against review text. */
  words: string[];
  /** Human phrase variants — picked deterministically, never invented facts. */
  phrases: string[];
};

export type DimensionDepth = {
  title: string;
  /** Band-aware titles: when a title would otherwise embed a quantity claim
   * ("one buyer"), the title must agree with the factor's actual support
   * band — title and body are always chosen from the same shelf. */
  bandTitles?: Partial<Record<"dominant" | "repeated" | "single", string>>;
  /** Noun for the co-occurrence bridge, e.g. "comfort". */
  pairNoun?: string;
  /** {note} content when the same theme has opposing signals, e.g. "the fit feels less secure for some people". */
  againstNote?: string;
  /** Lead-family override ("value" uses VALUE_LEADS). */
  leadFamily?: "value";
  /**
   * SEVERITY class (hard rule 2026-10-15): "red" dimensions are isolated-but-
   * serious negatives — authenticity/counterfeit, safety, stopped-working-
   * entirely, scam/never-arrived. They get explicit red-flag framing even at
   * count 1, and sort first on the against side. Ordinary negatives
   * (fit preference, slow shipping, price grumbles) keep normal one-off
   * framing. A strong Buy never dilutes red-flag wording.
   */
  severity?: "red";
  /** Red-flag detail sentences: {single} for count 1, {plural} for count >= 2. "One buyer" stays in the sentence — visible, not exaggerated. */
  redDetail?: { single: string; plural: string };
  /** Loose keywords mapping stray text (Phase 5 mining) to this dimension. */
  signals?: string[];
  /** For-side sub-aspects. */
  aspects?: AspectDef[];
  /** Against-side sub-aspects. */
  againstAspects?: AspectDef[];
};

export const DIMENSION_DEPTH: Record<string, DimensionDepth> = {
  "comfortable fit": {
    title: "Comfortable, lightweight fit",
    pairNoun: "comfort",
    againstNote: "the fit feels less secure for some people",
    aspects: [
      {
        id: "secure",
        words: ["stay in", "stays in", "stay put", "stays put", "secure", "won't fall", "don't fall", "doesn't fall", "didn't fall", "workout", "running", "exercise", "gym", "active", "sports"],
        phrases: ["stay secure during activity", "stay put even during workouts"],
      },
      {
        id: "no-ache",
        words: ["don't ache", "doesn't ache", "didn't ache", "no ache", "no pain", "pain-free", "pain free", "forget i'm wearing", "forget they're wearing", "all day", "long wear", "for hours", "extended wear"],
        phrases: ["don't ache over long use", "stay comfortable through all-day wear"],
      },
      {
        id: "light",
        words: ["lightweight", "barely feel", "feather", "so light", "light as"],
        phrases: ["feel light", "feel barely-there light"],
      },
    ],
  },
  "sound quality": {
    title: "Clear sound quality",
    pairNoun: "clear sound",
    againstNote: "the sound falls flat for some listeners",
    aspects: [
      {
        id: "clear",
        words: ["clear", "crisp", "vocals", "treble", "clarity"],
        phrases: ["deliver clear vocals", "sound crisp and clear"],
      },
      {
        id: "bass",
        words: ["bass", "deep sound", "punchy", "rich sound", "low end"],
        phrases: ["pump out strong bass", "deliver deep, punchy bass"],
      },
      {
        id: "calls",
        words: ["call quality", "calls are clear", "microphone", "mic is", "mic quality", "phone calls", "on calls"],
        phrases: ["keep calls clear even in noise", "handle phone calls well"],
      },
    ],
  },
  "battery life": {
    title: "Strong battery life",
    pairNoun: "battery life",
    againstNote: "the battery drains faster for some",
    aspects: [
      {
        id: "lasts",
        words: ["lasts days", "days of", "long battery", "all-day battery", "charge lasts", "lasts for days", "lasts all day"],
        phrases: ["run for days on a charge", "stretch for days between charges"],
      },
      {
        id: "case-fast",
        words: ["case charges", "charges fast", "quick charge", "fast charging", "charged quickly", "top up"],
        phrases: ["top up fast in the case", "charge back up quickly in the case"],
      },
    ],
    againstAspects: [
      {
        id: "drains",
        words: ["drains", "dies fast", "doesn't last", "doesnt last", "poor battery", "short battery", "drains fast", "battery dies"],
        phrases: ["drains faster than expected", "doesn't last the day"],
      },
    ],
  },
  "good value for the price": {
    title: "Worth the price",
    pairNoun: "the value",
    againstNote: "the price feels steep for what you get",
    leadFamily: "value",
    aspects: [
      {
        id: "worth",
        words: ["worth it", "worth the", "good value", "for the price", "bang for buck", "bang for the buck"],
        phrases: ["find it worth it against pricier alternatives", "call it real value for the money"],
      },
      {
        id: "gift",
        words: ["gift", "bought for my", "got one for", "present for"],
        phrases: ["buy them as gifts", "pick them up as gifts for family"],
      },
    ],
  },
  "easy to use": {
    title: "Easy to use",
    pairNoun: "ease of use",
    againstNote: "setup trips up some buyers",
    aspects: [
      {
        id: "setup",
        words: ["easy setup", "set up", "setup was", "pairing was easy", "paired instantly", "pair easily", "pairs instantly", "connects instantly"],
        phrases: ["set up in minutes", "pair in seconds"],
      },
      {
        id: "intuitive",
        words: ["intuitive", "simple to use", "easy to use", "user-friendly", "user friendly", "straightforward"],
        phrases: ["keep controls simple and intuitive", "stay easy to figure out"],
      },
    ],
  },
  "build quality": {
    title: "Solid build quality",
    pairNoun: "build quality",
    againstNote: "it doesn't hold up for everyone",
    aspects: [
      {
        id: "solid",
        words: ["well made", "solid", "sturdy", "premium feel", "feels premium", "durable", "well-built", "well built"],
        phrases: ["feel solid and well made", "feel premium in the hand"],
      },
      {
        id: "holds-up",
        words: ["holds up", "lasted", "months later", "still going", "after a year", "holding up"],
        phrases: ["holds up over months of use", "still going strong months later"],
      },
    ],
    againstAspects: [
      {
        id: "flimsy",
        words: ["flimsy", "cheap", "broke", "cracked", "fell apart", "poor quality", "cheaply made"],
        phrases: ["feels cheap and flimsy", "doesn't hold up"],
      },
    ],
  },
  "fast or efficient performance": {
    title: "Fast, efficient performance",
    pairNoun: "performance",
    againstNote: "it lags for some buyers",
    aspects: [
      {
        id: "quick",
        words: ["fast", "quick", "speedy", "responsive", "snappy", "no lag", "speed"],
        phrases: ["run quick and responsive", "respond with no lag"],
      },
      {
        id: "dependable",
        words: ["dependable", "reliable", "consistent", "every time", "works every", "day after day"],
        phrases: ["stay dependable day after day", "perform consistently every time"],
      },
    ],
  },
  "great design": {
    title: "Good design",
    pairNoun: "design",
    aspects: [
      {
        id: "look",
        words: ["look great", "sleek", "stylish", "beautiful", "nice design", "modern", "looks great", "good looking"],
        phrases: ["look sleek", "look the part"],
      },
    ],
  },
  "works well or performs as expected": {
    title: "Does what it promises",
    pairNoun: "reliability",
    aspects: [
      {
        id: "expected",
        words: ["as expected", "as advertised", "does what", "works great", "works well", "no surprises", "no issues", "flawlessly"],
        phrases: ["does exactly what it promises", "works as advertised with no surprises"],
      },
    ],
  },
  "customer service": {
    title: "Customer service",
    pairNoun: "support",
    againstNote: "support disappointed some buyers",
    aspects: [
      {
        id: "helpful",
        words: ["helpful", "resolved", "replaced", "refund", "support was", "customer service"],
        phrases: ["come with support that actually helps", "get quick resolutions when things go wrong"],
      },
    ],
  },
  "shipping": {
    title: "Shipping",
    pairNoun: "delivery",
    againstNote: "delivery was slow for some",
    aspects: [
      {
        id: "fast-delivery",
        words: ["arrived quickly", "fast delivery", "quick shipping", "arrived early", "two days", "fast shipping", "quick delivery"],
        phrases: ["arrive quickly", "show up fast and well packed"],
      },
    ],
  },
  "packaging": {
    title: "Good packaging",
    aspects: [
      {
        id: "packed",
        words: ["well packed", "well-packaged", "protected", "packaging was", "arrived intact"],
        phrases: ["arrive well packed and protected", "stay protected by solid packaging"],
      },
    ],
  },
  "fit not secure": {
    title: "Fit isn't secure for everyone",
    signals: ["loose", "fall out", "falls out", "fell out", "slip", "not secure", "uncomfortable", "don't stay", "dont stay", "won't stay", "wont stay", "stay in"],
    againstAspects: [
      {
        id: "slips",
        words: ["fall out", "falls out", "fell out", "slip out", "slips out", "won't stay", "wont stay", "don't stay", "dont stay", "loose", "keeps falling"],
        phrases: ["slip or fall out", "won't stay put"],
      },
      {
        id: "ache",
        words: ["hurt", "hurts", "ache", "aches", "pain", "painful", "sore", "uncomfortable", "bother", "irritat"],
        phrases: ["ache or hurt over time", "feel uncomfortable after a while"],
      },
    ],
  },
  "suspected counterfeit": {
    title: "Watch the seller, not just the product",
    severity: "red",
    redDetail: {
      single: "one buyer believed the unit received wasn't genuine",
      plural: "several buyers reported the unit wasn't genuine",
    },
    signals: ["counterfeit", "fake", "not genuine", "knockoff", "replica", "not authentic", "inauthentic"],
  },
  "overheating": {
    title: "Overheating reports",
    severity: "red",
    redDetail: {
      single: "one buyer reported the product overheating",
      plural: "several buyers reported the product overheating",
    },
    againstNote: "heat issues affected some units",
    signals: ["overheat", "overheating", "overheated", "too hot", "melt", "melted", "scorch", "hot to touch"],
  },
  "fire": {
    title: "Fire or smoke reports",
    severity: "red",
    redDetail: {
      single: "one buyer reported fire or smoke",
      plural: "several buyers reported fire or smoke",
    },
    signals: ["fire", "flame", "flames", "smoke", "smoking", "spark", "sparks", "caught fire"],
  },
  "burns": {
    title: "Burn reports",
    severity: "red",
    redDetail: {
      single: "one buyer reported burns",
      plural: "several buyers reported burns",
    },
    signals: ["burn", "burns", "burned", "burnt"],
  },
  "electric shock": {
    title: "Electric shock reports",
    severity: "red",
    redDetail: {
      single: "one buyer reported an electric shock",
      plural: "several buyers reported electric shocks",
    },
    signals: ["shock", "shocked", "electrocut", "electric shock"],
  },
  "injury": {
    title: "Injury reports",
    severity: "red",
    redDetail: {
      single: "one buyer reported an injury",
      plural: "several buyers reported injuries",
    },
    signals: ["injur", "hospital", "cut my", "bled"],
  },
  "stopped working": {
    title: "Stopped working",
    severity: "red",
    redDetail: {
      single: "one buyer reported the product stopped working entirely",
      plural: "several buyers reported the product stopped working",
    },
    signals: ["stopped working", "stopping working", "quit working", "died", "dead", "no longer works", "won't turn on", "wont turn on", "stopped charging"],
  },
  "never arrived": {
    title: "Never arrived",
    severity: "red",
    redDetail: {
      single: "one buyer reported the product never arrived",
      plural: "several buyers reported the product never arrived",
    },
    signals: ["never arrived", "didn't arrive", "didnt arrive", "never came", "scam", "scammed", "not delivered", "didn't deliver", "didnt deliver", "no delivery"],
  },
  "defective": {
    title: "Arrived defective",
    signals: ["defective", "faulty", "dead on arrival", "doa", "arrived broken", "arrived damaged", "never worked", "didn't work"],
  },
  "broke": {
    title: "Broke during use",
    signals: ["broke", "broken", "cracked", "fell apart", "came apart", "snapped"],
  },
  "__generic_concern": {
    title: "A concern raised by one buyer",
    bandTitles: {
      dominant: "The complaint buyers repeat most",
      repeated: "A complaint several buyers raise",
      single: "A concern raised by one buyer",
    },
  },
};

/** Alias keys that share a canonical dimension's depth. */
export const DIMENSION_ALIASES: Record<string, string> = {
  "great sound": "sound quality",
  "long battery life": "battery life",
  "great value": "good value for the price",
  "good value": "good value for the price",
  "ease of use": "easy to use",
  "durable": "build quality",
  "durability": "build quality",
  "fast performance": "fast or efficient performance",
  "design": "great design",
  "works as expected": "works well or performs as expected",
  "works well": "works well or performs as expected",
  "performs as expected": "works well or performs as expected",
  "delivery": "shipping",
  "loose fit": "fit not secure",
  "not secure": "fit not secure",
  "counterfeit": "suspected counterfeit",
  "fake product": "suspected counterfeit",
  "not genuine": "suspected counterfeit",
};

/** Resolve a normalized theme key to its depth entry (aliases included). */
export function depthFor(key: string): DimensionDepth | null {
  if (DIMENSION_DEPTH[key]) return DIMENSION_DEPTH[key];
  const alias = DIMENSION_ALIASES[key];
  if (alias && DIMENSION_DEPTH[alias]) return DIMENSION_DEPTH[alias];
  return null;
}

// ---------------------------------------------------------------------------
// Red-flag frames (hard rule 2026-10-15): isolated-but-serious negatives get
// an explicit red-flag sentence, composed from the dimension's redDetail.
// "One buyer" stays in the sentence — visible AND not exaggerated. A strong
// Buy never dilutes this wording. Same determinism + no-repeat-openers rules.
// ---------------------------------------------------------------------------

export const RED_FLAG_FRAMES: string[] = [
  "There is one red flag: {detail}.",
  "One red flag to know about: {detail}.",
  "A single red flag surfaced in the reviews: {detail}.",
  "The reviews hold one red flag: {detail}.",
  "One serious concern came up: {detail}.",
  "Flagging one red flag plainly: {detail}.",
  "Before anything else — one red flag: {detail}.",
  "A red flag worth your attention: {detail}.",
];

export const RED_FLAG_PLURAL_FRAMES: string[] = [
  "Red flags in the reviews: {detail}.",
  "Multiple red flags came up: {detail}.",
  "The red flags buyers raised: {detail}.",
  "Serious concerns surfaced: {detail}.",
  "Flagging the red flags plainly: {detail}.",
  "These red flags are hard to ignore: {detail}.",
];

// ---------------------------------------------------------------------------
// Review-authenticity sentences (Phase 10). Plain words, never an accusation:
// always "AI-like signs/pattern", never "fake reviewer". The {signals} slot
// names the fired features in the moderate/high frames.
// ---------------------------------------------------------------------------

export const AUTH_LOW: string[] = [
  "The reviews read like real buyers: varied wording, concrete details, and a natural spread of opinions.",
  "Nothing here trips our pattern checks — the reviews sound like different people with different experiences.",
  "The corpus looks human: diverse phrasing, specific observations, no template feel.",
  "These reviews pass the smell test — varied, specific, and independently worded.",
  "Real-buyer markers throughout: different words, concrete details, mixed enthusiasm.",
  "No AI-like pattern here. The reviews vary the way independent buyers do.",
];

export const AUTH_MODERATE_BASE: string[] = [
  "Some reviews {signals} — an AI-like pattern we watch for.",
  "We see mild AI-like signs: some reviews {signals}.",
  "A few pattern flags here — some reviews {signals}.",
  "Not conclusive, but some reviews {signals}, which is an AI-like pattern.",
  "Mixed authenticity: some reviews {signals}.",
  "Worth a grain of salt — some reviews {signals}.",
];

export const AUTH_HIGH_BASE: string[] = [
  "The reviews {signals} — a strong AI-like pattern across the corpus.",
  "Strong AI-like pattern: the reviews {signals}.",
  "These reviews {signals}, which is the classic AI-like shape.",
  "The pattern is hard to miss — the reviews {signals}.",
  "High AI-like pattern: reviews {signals}.",
  "Across the corpus, the reviews {signals} — strongly AI-like.",
];

/** Plain-words clause per forensics feature, for the {signals} slot. */
export const AUTH_SIGNAL_CLAUSES: Record<string, string> = {
  repetition: "repeat the same phrasing",
  template: "follow the same template",
  specificity: "praise without concrete details",
  uniformity: "sound uniformly enthusiastic",
  lexical: "reuse a small set of words",
};

// ---------------------------------------------------------------------------
// Result-brief satisfaction pass (2026-10-16). Plain-words frames for the
// How-we-checked fold. Facts are filled only from tallies present in the
// result — the frames carry grammar, never facts.
// ---------------------------------------------------------------------------

/** The one basis sentence: what actually backs this verdict. {basis} is filled in. */
export const BASIS_FRAMES: string[] = [
  "Based on {basis}.",
  "This is based on {basis}.",
  "We based this verdict on {basis}.",
  "Here's what backs this: {basis}.",
];

/** The one limits sentence: the written reviews come from one store's pages. {store} is filled in. */
export const LIMITS_SINGLE_SOURCE_FRAMES: string[] = [
  "The written reviews come from {store}'s pages — reviews on other stores aren't part of this check.",
  "One thing to know: the written reviews are from {store}'s pages only, so other stores' reviews aren't in this check.",
  "A caveat: only {store}'s written reviews fed this check — other stores' reviews didn't.",
  "Keep in mind the written reviews are from {store}'s pages — this doesn't cover other stores.",
];

/** The plain honesty note for the authenticity fold: a pattern check, never an authorship verdict. */
export const AUTH_HONESTY: string[] = [
  "This checks review text for patterns only — it can't prove who wrote a review.",
  "It's a text-pattern check, not a verdict on the reviewer — it can't prove who wrote what.",
  "Think of it as a pattern scan of the wording: it can't tell you who actually wrote a review.",
];
