/**
 * The Wordsmith (commissioned 2026-10-16, Junel).
 *
 * The bot that gives the scan its exact words. It mines the adjudicated,
 * segregated written-review bodies already backing each theme signal and
 * extracts the buyers' REAL vocabulary — repeated specific noun-phrases /
 * feature phrases buyers actually used ("quick pairing", "charge twice a
 * day", "serial number sticker") — then weaves them into the decision-brief
 * factor sentences.
 *
 * Owner rules honored:
 * - Deterministic, zero LLM: same evidence in -> same words out. Frame
 *   choice is hashed from the page's tally signature; phrase ranking is
 *   (support count desc, specificity desc, first occurrence, phrase asc).
 * - Never a quote: mined phrases are 2-4 word vocabulary chunks, capped in
 *   length, and can never be a whole buyer sentence (a counting body must be
 *   strictly longer than the phrase).
 * - Never invents: a factor gets the buyer-words sentence only when mining
 *   earned phrases from that theme's own evidenced texts. Otherwise the
 *   honest tally-only forms render unchanged.
 * - Builds ON the round-3 evidence gate: wordsmith input is the same
 *   texts[] the gate already evidenced — it can never voice an unevidenced
 *   claim, and it never suppresses one (additive only).
 * - Negation-aware (NEGATORS window family, same as lib/buyingScore.ts):
 *   "doesn't last" is complaint vocabulary; "doesn't ache" is praise.
 * - Shopper surface: no review counts, no internal labels, no backstage
 *   words. Verdict words are untouched (guarded in lib/shopperVerdictWord).
 */

import { pickFrame } from "@/lib/analysisCopy";

export type WordsmithSide = "for" | "against";
export type WordsmithBand = "dominant" | "repeated" | "single";

export interface WordsmithSignalInput {
  /** Theme key (analysis key, for seed variety). */
  key: string;
  side: WordsmithSide;
  /** Written-review bodies already evidenced for this signal (deterministic order). */
  texts: string[];
  /** Page tally signature — seeds deterministic frame selection. */
  tallySig: string;
  band: WordsmithBand;
  /**
   * Curated phrases already woven into this factor's sentence (from the
   * dimension depth). Mined phrases overlapping them are dropped so the
   * sentence never says the same thing twice.
   */
  existingPhrases?: string[];
  /**
   * Product title from the listing (e.g. "Instant Pot Duo 7-in-1 Electric
   * Pressure Cooker, ..."). Mined specifics that consist solely of title
   * tokens are dropped ("instant pot" on an Instant Pot page is category
   * echo, not buyer vocabulary). Enrichment is skipped entirely when the
   * title is unavailable — enriching blindly is how category filler ends up
   * on the page.
   */
  productTitle?: string;
}

export interface WordsmithEnrichment {
  /** Buyer-words specifics sentence, or null when mining earned nothing. */
  specificLine: string | null;
  /** Red-flag evidence clause (severity signals only), or null. */
  redClause: string | null;
  /** The mined buyer vocabulary (for tests / introspection). */
  buyerWords: string[];
}

// ---------------------------------------------------------------------------
// Copy deck: frames carry grammar, never facts. {words} is filled only with
// mined buyer vocabulary; {report} only with a mined red-detail phrase.
// ---------------------------------------------------------------------------

// Hotfix 2026-10-16 (voice): the frames are SPECIFICS-FIRST. The mined
// buyer vocabulary leads the sentence; the attribution is a short tail.
// "The specifics buyers cite: multipoint connection and windy street
// calls" became "multipoint connection and windy street calls — that's
// what buyers keep naming." Junel's bar is the Takki register: every line
// a concrete paraphrase carrying a fact (uses, weights, hours,
// accessories), zero filler frames. The miner never invents — it prints
// only phrases the corpus actually repeated (hard limit).
const BUYER_WORDS_FRAMES: string[] = [
  "{words} — that's what buyers keep naming.",
  "{words}, in the reviewers' own specifics.",
  "{words}: the detail that keeps coming up.",
  "What buyers name, again and again: {words}.",
  "{words} — the recurring detail across reviews.",
];

const BUYER_WORDS_SINGLE_FRAMES: string[] = [
  "{words} — that's what the one buyer named.",
  "Described in that review as {words}.",
  "That buyer got specific: {words}.",
];

/** Red-detail clause: grammatically continues a redDetail sentence. */
const RED_CLAUSE_FRAMES: string[] = [
  " — the report named {report}.",
  " — described in the report as {report}.",
  " — the report called out {report}.",
];

// ---------------------------------------------------------------------------
// Token / n-gram mining.
// ---------------------------------------------------------------------------

const STOP = new Set(
  (
    "a,an,the,and,or,but,if,then,else,for,with,of,to,in,on,at,by,as,is,are,was," +
    "were,be,been,being,it,its,it's,this,that,these,those,they,them,their,you," +
    "your,you're,he,she,we,our,my,me,i,i'm,i've,i'll,very,really,just,quite," +
    "so,too,also,still,even,only,well,there,here,now,than,from,into,over," +
    "after,before,between,through,during,about,up,down,out,off,again,all," +
    "both,each,other,another,some,any,many,much,more,most,few,several,own," +
    "same,such,nor,do,does,did,has,have,had,will,would,should,could,may,might," +
    "must,get,got,getting,buy,bought,purchase,purchased,amazon,product," +
    "products,item,items,thing,things,stuff,pair,model,unit,day,days,week," +
    "weeks,month,time,times,year,hour,hours,star,stars,price,money,dollar," +
    "dollars,good,great,bad,poor,nice,awesome,amazing,terrible,awful," +
    "excellent,best,worst,fine,decent,love,loved,like,liked,hate,happy," +
    "unhappy,disappointed,satisfied,recommend,worth,overall,generally," +
    "usually,always,definitely,certainly,absolutely,pretty,kind,sort,bit," +
    "little,big,small,long,short,high,low,new,old,easy,simple,comfortable," +
    "uncomfortable,one,two,three,first,second,next,every,everything," +
    "nothing,anything,something,whatever,however,though,although,because," +
    "since,while,when,where,which,who,whom,whose,what,how,why"
  ).split(",")
);

/** Product-boilerplate and recommendation-boilerplate: never a "specific". */
const GENERIC_GRAMS = new Set([
  "the product",
  "this product",
  "these products",
  "the item",
  "this item",
  "the thing",
  "this thing",
  "these earbuds",
  "the earbuds",
  "these headphones",
  "the headphones",
  "five stars",
  "five star",
  "highly recommend",
  "would recommend",
  "recommend to anyone",
  "worth every penny",
  "out of the box",
  "arrived on time",
  "as described",
  "does the job",
  "works as expected",
  "does what it",
  "no complaints",
  "no issues",
  "no problems",
]);

/**
 * Negated positives: a negation word INSIDE the phrase is fine on the
 * for-side only when the whole phrase names a positive ("don't ache").
 * Anything else negated is complaint vocabulary.
 */
const ALLOWED_NEGATED_POSITIVES = new Set([
  "no pain",
  "no ache",
  "don't ache",
  "doesn't ache",
  "didn't ache",
  "dont ache",
  "doesnt ache",
  "didnt ache",
  "no lag",
  "don't fall",
  "doesn't fall",
  "didn't fall",
  "dont fall",
  "doesnt fall",
  "didnt fall",
  "won't fall",
  "wont fall",
  "never falls",
  "stay put",
  "stays put",
  "don't slip",
  "doesn't slip",
  "dont slip",
  "doesnt slip",
  "never slips",
  "no distortion",
  "no fatigue",
]);

/** Same negator family as lib/buyingScore.ts NEGATORS. */
const NEGATOR_WORD =
  /^(no|not|never|without|zero|nothing|didn't|didnt|doesn't|doesnt|hasn't|hasnt|haven't|havent|wasn't|wasnt|isn't|isnt|won't|wont|can't|cant|couldn't|couldnt|wouldn't|wouldnt|shouldn't|shouldnt|hardly|barely)$/;

/** Severity words: the vocabulary that names a red-flag report's substance. */
const SEVERITY_WORD =
  /^(fake|counterfeit|genuine|knockoff|replica|authentic|fire|flame|flames|smoke|smoking|burn|burns|burned|burnt|shock|shocked|dead|died|broken|broke|cracked|melt|melted|spark|sparks|scam|scammed|injury|injured|hospital|bleed|bled|cut)$/;

const MAX_PHRASE_CHARS = 42;
const MAX_WORDS_PER_LINE = 2;

function tokenize(body: string): string[] {
  return body
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .split(/[^a-z0-9']+/)
    .filter(Boolean);
}

/**
 * NEGATORS-style trailing window: token i is negation-scoped when a negator
 * word appears within the 3 preceding tokens (same family as
 * lib/buyingScore.ts's `(?:\W+\w+){0,3}` window).
 */
function negationFlags(tokens: string[]): boolean[] {
  const flags = new Array<boolean>(tokens.length).fill(false);
  for (let i = 0; i < tokens.length; i++) {
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (NEGATOR_WORD.test(tokens[j])) {
        flags[i] = true;
        break;
      }
    }
  }
  return flags;
}

/** Trailing time words are specifics when anchored ("lasts for days"), not dangling. */
const TIME_WORD = new Set([
  "day",
  "days",
  "week",
  "weeks",
  "month",
  "months",
  "hour",
  "hours",
  "minute",
  "minutes",
  "time",
  "times",
  "year",
  "years",
]);
/** Tokens that only ever appear in rating/recommendation boilerplate. */
const BOILERPLATE_TOKEN = new Set([
  "recommend",
  "recommends",
  "recommended",
  "recommending",
  "recommendation",
  "stars",
  "star",
  "rating",
  "ratings",
  "highly",
]);

/**
 * Tokens too weak to carry a "specific" on their own when they are the only
 * content beside stopwords (e.g. "job and arrived"). Legit shipping phrases
 * like "arrived quickly" survive because "quickly" is not weak.
 */
const WEAK_TOKEN = new Set([
  "job",
  "jobs",
  "order",
  "ordered",
  "orders",
  "arrive",
  "arrived",
  "purchase",
  "purchased",
  "five",
]);

function gramOk(gram: string[]): boolean {
  if (gram.length < 2 || gram.length > 4) return false;
  const bare = gram.map((t) => t.replace(/'/g, ""));
  if (STOP.has(gram[0])) return false;
  const lastBare = bare[bare.length - 1];
  if (STOP.has(gram[gram.length - 1])) {
    // A trailing time word is a specific when strongly anchored
    // ("lasts for days", "charge twice a day") — not a dangling preposition.
    const anchored =
      TIME_WORD.has(lastBare) &&
      bare.some(
        (t, i) =>
          t.length >= 5 && !WEAK_TOKEN.has(t) && !BOILERPLATE_TOKEN.has(t) && !STOP.has(gram[i])
      );
    if (!anchored) return false;
  }
  let stops = 0;
  for (const t of gram) if (STOP.has(t)) stops++;
  if (stops > 1) return false;
  if (!bare.some((t) => t.length >= 4)) return false;
  // Two boilerplate tokens = rating/recommendation boilerplate, never a specific.
  if (bare.filter((t) => BOILERPLATE_TOKEN.has(t)).length >= 2) return false;
  // A phrase made only of stopwords, weak tokens, and boilerplate tokens
  // carries no specific (e.g. "job five").
  if (bare.every((t) => STOP.has(t) || WEAK_TOKEN.has(t) || BOILERPLATE_TOKEN.has(t))) return false;
  // A phrase whose only content beside stopwords is weak carries no specific.
  if (stops > 0) {
    const content = bare.filter((t) => !STOP.has(t) && t.length >= 4);
    if (content.length > 0 && content.every((t) => WEAK_TOKEN.has(t))) return false;
  }
  const phrase = gram.join(" ");
  if (GENERIC_GRAMS.has(phrase)) return false;
  if (phrase.length > MAX_PHRASE_CHARS) return false;
  return true;
}

type RankedPhrase = { phrase: string; count: number; specificity: number; first: number };

/**
 * Rank every eligible phrase across the given texts.
 * (support count desc, specificity desc, first occurrence, phrase asc) —
 * fully deterministic.
 */
function rankPhrases(texts: string[], side: WordsmithSide): RankedPhrase[] {
  const bodies = texts.map((t) => String(t || "").trim()).filter((t) => t.length >= 8);
  const need = bodies.length <= 6 ? 1 : 2;
  const hits = new Map<string, Set<number>>();
  const specOf = new Map<string, number>();
  const firstOf = new Map<string, number>();

  bodies.forEach((body, bi) => {
    const tokens = tokenize(body);
    const negated = negationFlags(tokens);
    const seenThisBody = new Set<string>();
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= tokens.length; i++) {
        const gram = tokens.slice(i, i + n);
        if (!gramOk(gram)) continue;
        const phrase = gram.join(" ");
        // Negation gate: on the for-side, a negation-scoped phrase is only
        // buyer vocabulary when it names a positive (e.g. "don't ache").
        const hasNegator = gram.some((t) => NEGATOR_WORD.test(t));
        const scoped = negated.slice(i, i + n).some(Boolean);
        if (side === "for") {
          if (hasNegator && !ALLOWED_NEGATED_POSITIVES.has(phrase)) continue;
          if (scoped && !hasNegator) continue;
        }
        // Never select a whole buyer sentence: a counting body must be
        // strictly longer than the phrase.
        if (body.length <= phrase.length + 4) continue;
        if (seenThisBody.has(phrase)) continue;
        seenThisBody.add(phrase);
        let set = hits.get(phrase);
        if (!set) {
          set = new Set<number>();
          hits.set(phrase, set);
          firstOf.set(phrase, bi * 100000 + i);
          let spec = 0;
          for (const t of gram) {
            const bare = t.replace(/'/g, "");
            spec += bare.length >= 6 ? 2 : bare.length >= 4 ? 1 : 0;
            if (NEGATOR_WORD.test(t) && side === "against") spec += 2;
            if (SEVERITY_WORD.test(bare)) spec += 2;
          }
          specOf.set(phrase, spec);
        }
        set.add(bi);
      }
    }
  });

  const ranked: RankedPhrase[] = [];
  for (const [phrase, set] of hits) {
    if (set.size >= need)
      ranked.push({
        phrase,
        count: set.size,
        specificity: specOf.get(phrase) ?? 0,
        first: firstOf.get(phrase) ?? 0,
      });
  }
  ranked.sort(
    (a, b) =>
      b.count - a.count ||
      b.specificity - a.specificity ||
      a.first - b.first ||
      (a.phrase < b.phrase ? -1 : a.phrase > b.phrase ? 1 : 0)
  );

  // Substring de-dupe: keep the longer phrase when two candidates overlap at
  // equal support.
  const kept: RankedPhrase[] = [];
  for (const cand of ranked) {
    let drop = false;
    for (const k of kept) {
      if (k.count === cand.count && (k.phrase.includes(cand.phrase) || cand.phrase.includes(k.phrase))) {
        if (k.phrase.length >= cand.phrase.length) drop = true;
        break;
      }
    }
    if (!drop) kept.push(cand);
  }
  return kept;
}

/**
 * Mine repeated specific phrases from a theme's evidenced texts.
 * Up to MAX_WORDS_PER_LINE phrases. `excludeKey` drops theme-echo phrases
 * (the theme's own name is never a "specific") before the top-N cut.
 * `titleTokens` (hotfix 2026-10-16) drops phrases that consist solely of
 * the product's own title/category words before the top-N cut, so a weak
 * top phrase never consumes a slot — a corpus with no real specifics
 * honestly yields nothing instead of category filler.
 */
export function mineBuyerWords(
  texts: string[],
  side: WordsmithSide,
  excludeKey?: string,
  titleTokens?: Set<string>
): string[] {
  const nkey = norm(excludeKey || "");
  const ranked = rankPhrases(texts, side);
  let filtered =
    nkey && ranked.length
      ? ranked.filter((r) => {
          const nw = norm(r.phrase);
          return nw && nw !== nkey && !nkey.includes(nw);
        })
      : ranked;
  if (titleTokens && titleTokens.size && filtered.length)
    filtered = filtered.filter((r) => !titleOnlyPhrase(r.phrase, titleTokens));
  return filtered.slice(0, MAX_WORDS_PER_LINE).map((r) => r.phrase);
}

/**
 * Mine the red-flag evidence detail: prefer a phrase that names the report's
 * substance (severity vocabulary or a negation-flipped complaint); fall back
 * to the top buyer-vocabulary phrase. Trailing past-tense verbs are trimmed
 * so the detail names the thing, not the action ("serial number sticker",
 * not "serial number sticker looked"). One phrase, or null.
 */
export function mineRedDetail(texts: string[], titleTokens?: Set<string>): string | null {
  const ranked = rankPhrases(texts, "against");
  if (!ranked.length) return null;
  const severe = ranked.filter((r) =>
    r.phrase.split(" ").some((t) => SEVERITY_WORD.test(t.replace(/'/g, "")) || NEGATOR_WORD.test(t))
  );
  // Hotfix 2026-10-16: same title-token rule as the buyer-words line — the
  // evidence clause must never name the product's own category as the report.
  // A title-emptied pool honestly yields null; it never falls back to
  // unfiltered category echo.
  const base = severe.length ? severe : ranked;
  const pool =
    titleTokens && titleTokens.size
      ? base.filter((r) => !titleOnlyPhrase(r.phrase, titleTokens)).slice(0, 6)
      : base.slice(0, 6);
  for (const r of pool) {
    const toks = r.phrase.split(" ");
    // Trim trailing past-tense verbs ("looked", "photocopied").
    while (
      toks.length > 2 &&
      toks[toks.length - 1].length > 3 &&
      /ed$/.test(toks[toks.length - 1]) &&
      !/^(red|bed|used)$/.test(toks[toks.length - 1])
    ) {
      toks.pop();
    }
    if (toks.length >= 2 && !gramOk(toks)) continue;
    if (toks.length >= 2) return toks.join(" ");
  }
  return null;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * Title tokens: lowercase alphanumeric words of the product title, of
 * length >= 3, minus stopwords and pure numbers. Used to keep category
 * echo out of the mined "specifics" — a hotfix (2026-10-16) after the
 * live Instant Pot page printed "instant pot and electric pressure cooker"
 * as buyers' own vocabulary.
 */
export function titleTokensOf(title: string): Set<string> {
  const set = new Set<string>();
  for (const t of String(title || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.replace(/'/g, ""))) {
    if (t.length < 3 || STOP.has(t) || /^\d+$/.test(t)) continue;
    set.add(t);
  }
  return set;
}

/**
 * True when the phrase's content words are ALL title tokens — i.e. the
 * phrase carries no buyer vocabulary beyond the product's own name/category.
 * "instant pot" on an Instant Pot page is category echo; "quick pairing"
 * on an earbuds page is a real specific and survives.
 */
function titleOnlyPhrase(phrase: string, titleTokens: Set<string>): boolean {
  if (!titleTokens.size) return false;
  const words = phrase
    .toLowerCase()
    .split(" ")
    .map((t) => t.replace(/'/g, ""));
  const content = words.filter((t) => t.length >= 3 && !STOP.has(t));
  if (!content.length) return true;
  return content.every((t) => titleTokens.has(t));
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * The enrichment entry point. Additive + fail-soft by contract: callers wrap
 * this in try/catch and fall back to today's copy on any throw.
 *
 * Hotfix 2026-10-16: the product title is REQUIRED. Without it, the miner
 * cannot tell buyer vocabulary from category echo ("instant pot" on an
 * Instant Pot page) — so it enriches nothing rather than dressing up
 * filler. Weak corpora honestly return specificLine: null and the caller
 * prints the plain basis sentence.
 */
export function wordsmithEnrich(input: WordsmithSignalInput, used: Set<string>): WordsmithEnrichment {
  const empty: WordsmithEnrichment = { specificLine: null, redClause: null, buyerWords: [] };
  const texts = (input.texts || []).map((t) => String(t || "").trim()).filter((t) => t.length >= 8);
  if (!texts.length) return empty;
  const titleTokens = titleTokensOf(input.productTitle || "");
  if (!titleTokens.size) return empty;

  let buyerWords = mineBuyerWords(texts, input.side, input.key, titleTokens);
  const existing = (input.existingPhrases || []).map(norm).filter(Boolean);
  if (existing.length && buyerWords.length) {
    buyerWords = buyerWords.filter((w) => {
      const nw = norm(w);
      return !existing.some((e) => e.includes(nw) || nw.includes(e));
    });
  }
  if (!buyerWords.length) return empty;

  const lineFrames = input.band === "single" ? BUYER_WORDS_SINGLE_FRAMES : BUYER_WORDS_FRAMES;
  const template = pickFrame(
    lineFrames,
    `${input.tallySig}|wordsmith|${input.side}|${input.key}|${input.band}`,
    used
  );
  const specificLine = template.replace("{words}", joinList(buyerWords));

  let redClause: string | null = null;
  const detail = mineRedDetail(texts, titleTokens);
  if (detail) {
    const clause = pickFrame(RED_CLAUSE_FRAMES, `${input.tallySig}|wordsmith|red|${input.key}`, used);
    redClause = clause.replace("{report}", detail);
  }
  return { specificLine, redClause, buyerWords };
}
