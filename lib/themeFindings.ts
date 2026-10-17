/**
 * Theme findings — RI's native findings engine (2026-10-16, Junel:
 * "build a native ai", zero external AI anywhere in RI).
 *
 * Deterministic, zero external AI. Per theme, the engine extracts CONCRETE
 * specifics from the theme's own bucketed review clauses and renders ONE
 * finding bullet in RI's own sentence frame:
 *
 *   Buyers praise it — 1500W of heating power, mentioned in 35 of 50 reviews.
 *   Buyers flag it — needs a separate MC4 cable, mentioned in 6 of 50 reviews.
 *
 * Design rules (all enforced):
 *  - Clause-level work only: complete clauses (subject + finite verb), never
 *    mid-sentence n-grams (the Wordsmith's fragment disease).
 *  - Theme anchoring: a clause only evidences a theme when it carries one of
 *    the theme's own signal words — generic praise ("I'm impressed!") can
 *    never become a theme's specific.
 *  - Specifics are SHORT detail phrases (parentheticals, measurements,
 *    requirements, "X enough to Y", time phrases), each traced to >= 2
 *    distinct reviews. Nothing longer than a short phrase is ever quoted
 *    (Junel's no-pasted-quotes rule; the 40-char snippet test guards it).
 *  - Every numeral traces to a source clause or the tally; the dead
 *    pattern-frame family (106 frames) can never print; the bullet is one
 *    complete grammatical sentence.
 *  - No qualifying specific -> an honest gloss+support bullet (never an
 *    empty line, never a hidden signal).
 */

import { depthFor, DIMENSION_ALIASES } from "./analysisCopy";

export type FindingsInput = {
  key: string;
  title: string;
  claim: string;
  side: "for" | "against";
  count: number;
  reviewCount: number;
  texts: string[];
  productTitle?: string;
};

// ---------------------------------------------------------------------------
// Lexicons.
// ---------------------------------------------------------------------------

const STOP = new Set(
  ("a,an,the,and,or,but,if,then,else,for,to,of,in,on,at,by,with,from,as,is,are,was,were,be,been,being," +
    "has,have,had,do,does,did,will,would,can,could,should,may,might,must,shall,i,me,my,we,our,you,your," +
    "he,him,his,she,her,it,its,they,them,their,this,that,these,those,there,here,what,which,who,whom," +
    "whose,when,where,why,how,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same," +
    "so,than,too,very,just,also,still,even,ever,never,always,often,usually,sometimes,quite,rather,really," +
    "pretty,up,down,out,off,over,under,again,once,now,today,well,much,many,lot,lots,thing,things," +
    "something,anything,nothing,everything,one,two,three,bit,way,time,times,get,got,gets,getting,go," +
    "goes,going,went,use,used,using,make,made,makes,making,take,takes,took,taken").split(",")
);

const VERB_BASES = new Set(
  ("praise,love,like,enjoy,work,last,charge,hold,heat,warm,cool,clean,fit,stay,keep,feel,sound,look," +
    "seem,run,perform,connect,pair,switch,arrive,buy,replace,return,break,stop,die,fail,slip,hurt,fall," +
    "come,deliver,exceed,impress,recommend,give,provide,offer,include,feature,reduce,improve,save,help," +
    "handle,cook,bake,brew,grind,cut,blend,dry,shine,beep,click,turn,spin,shake,rattle,leak,drip,spill," +
    "scratch,crack,wear,tear,smell,taste,weigh,cost,spend,pay,ship,pack,open,close,seal,lock,fold," +
    "adjust,rotate,oscillate,withstand,survive,matter,count,change,sit,sleep,play,need,want,think,know," +
    "find,try,become,remain,impress,mean,reach,cover,fill,power,flag,praise,live,exist").split(",")
);
const AUX = new Set(
  "is,are,was,were,am,has,have,had,do,does,did,will,would,can,could,should,may,might,must,shall".split(",")
);
const IRREG = new Set(
  ("bought,broke,fell,ran,came,gave,took,made,went,got,kept,felt,held,left,paid,said,told,thought," +
    "knew,found,built,spent,sent,meant,sold,chosen,driven,written").split(",")
);

const DANGLING_END = new Set(
  ("and,or,but,because,with,for,to,of,in,on,at,as,like,than,from,by,about,into,over,after,before," +
    "while,when,if,so,yet,nor,which,that,who,whom,whose,the,a,an,my,its,their,our,your,his,her,no").split(",")
);
const BAD_LEAD = new Set(
  "and,or,but,because,so,however,though,although,which,that,who,when,while,if,then,than,also,plus,as".split(",")
);
/**
 * Lowercase clause starts allowed after comma-splitting: a pronoun or
 * determiner subject ("you need a separate cable", "the remote is handy").
 * Anything else lowercase ("takes about five hours", "with a cable") is an
 * ellipsis or fragment and is rejected.
 */
const LOWER_START_OK = new Set(
  ("i,you,he,she,it,we,they,the,a,an,this,that,these,those,my,your,his,her,its,our,their,no,not,never," +
    "had,has,have,is,are,was,were,do,does,did,will,would,can,could,should,may,might,must").split(",")
);

/** Words too generic to anchor a clause to a theme. */
const GENERIC_ANCHOR = new Set(
  "good,great,well,nice,excellent,amazing,awesome,perfect,decent,overall,product,item,thing,things,buyers,buyer,review,reviews,love,like".split(",")
);

/**
 * Pure praise words: they carry no specific information, so the Tier-2
 * descriptive-detail extractor skips them (a "specific" of "amazing sound"
 * is not a finding).
 */
const GENERIC_PRAISE = new Set(
  ("excellent,amazing,spectacular,best,wonderful,fantastic,awesome,perfect,superb,outstanding,incredible," +
    "great,good,nice,solid,decent,fine,ok,okay,pretty,really,very,quite,rather,so,too,just,simply," +
    "love,loved,like,liked,enjoy,happy,pleased,impressed,worth").split(",")
);

/**
 * Aspect words: nouns that name a product aspect (fit, battery, price…).
 * Tier-2 consensus must find DESCRIPTIVE vocabulary (bass, crisp, sharp),
 * not re-discover other aspects — a sound-quality finding illustrated by
 * "fit my ears" is a misfire. Excluded from Tier-2 scoring only.
 */
const ASPECT_WORDS = new Set(
  ("fit,fits,fitted,ears,ear,comfort,comfortable,comfortably,battery,batteries,charge,charging,charger," +
    "price,prices,cost,costs,cheap,expensive,weight,light,lightweight,heavy,size,sized,big,small,large," +
    "design,designed,look,looks,looking,color,colour,colors,brand,model,device,product,item,unit").split(",")
);

/**
 * Negation tokens. A detail that drops its clause's negation flips polarity
 * ("doesn't leave skin feeling greasy" -> "skin feeling greasy" reads as a
 * complaint under a praise bullet). Details from negated clauses must carry
 * the negation or be rejected.
 */
const NEGATION = new Set(
  "not,never,no,nor,don't,doesn't,didn't,isn't,aren't,wasn't,weren't,can't,cannot,couldn't,won't,wouldn't,shouldn't,haven't,hasn't,hadn't,without".split(",")
);

function clauseHasNegation(clause: string): boolean {
  for (const t of tokenize(clause)) {
    if (NEGATION.has(t) || t.endsWith("n't")) return true;
  }
  return false;
}

/** A detail preserves polarity when it carries any negation its clause had. */
function polaritySafe(detail: string, clause: string): boolean {
  if (!clauseHasNegation(clause)) return true;
  return clauseHasNegation(detail);
}

/**
 * Hand-curated synonym expansion for theme anchors (RI's own vocabulary —
 * deterministic). Lets "warms the bedroom" anchor to a "heats quickly"
 * theme without an LLM.
 */
const ANCHOR_SYNONYMS: Record<string, string[]> = {
  heat: ["warm", "hot", "toasty", "heating", "warming"],
  heats: ["warm", "hot", "toasty"],
  warm: ["heat", "hot", "toasty"],
  warms: ["heat", "hot"],
  hot: ["heat", "warm"],
  cool: ["chill", "cold", "cooling"],
  cold: ["cool", "chill"],
  clean: ["wash", "wipe", "rinse", "washing", "wiping"],
  cleans: ["wash", "wipe", "rinse"],
  quiet: ["silent", "noiseless"],
  silent: ["quiet"],
  loud: ["noisy"],
  noisy: ["loud"],
  fast: ["quick", "quickly", "rapid", "speedy"],
  quick: ["fast", "rapid"],
  quickly: ["fast", "rapid"],
  slow: ["sluggish"],
  easy: ["simple", "effortless", "straightforward"],
  simple: ["easy", "effortless"],
  cheap: ["affordable", "inexpensive", "budget"],
  affordable: ["cheap", "inexpensive"],
  expensive: ["pricey", "costly"],
  pricey: ["expensive"],
  big: ["large", "huge", "spacious"],
  large: ["big", "huge"],
  small: ["compact", "tiny", "little", "mini"],
  compact: ["small", "tiny"],
  tiny: ["small", "compact"],
  little: ["small"],
  light: ["lightweight", "weigh", "weighs", "weight", "pound", "pounds", "lbs"],
  lightweight: ["light", "weigh", "weight"],
  portable: ["carry", "travel", "pack", "lightweight"],
  heavy: ["bulky", "weighty"],
  strong: ["sturdy", "durable", "solid"],
  sturdy: ["strong", "durable"],
  durable: ["strong", "sturdy"],
  weak: ["flimsy", "fragile"],
  flimsy: ["weak"],
  bright: ["vivid"],
  sharp: ["crisp"],
  crisp: ["sharp"],
  soft: ["comfortable", "plush", "cushioned"],
  comfortable: ["comfy", "soft", "plush"],
  comfy: ["comfortable"],
  fit: ["fitting", "size", "sized"],
  fits: ["fit", "size"],
  pair: ["connect", "bluetooth"],
  pairs: ["connect"],
  pairing: ["connect", "connecting"],
  connect: ["pair", "pairing"],
  charge: ["recharge"],
  charges: ["recharge"],
  last: ["endure"],
  lasts: ["endure"],
  break: ["broke", "broken", "snap", "crack"],
  broke: ["break", "broken"],
  broken: ["break", "broke"],
  stop: ["stopped", "quit"],
  stopped: ["stop"],
  slip: ["slide"],
  slips: ["slide"],
  hurt: ["painful", "ache", "sore"],
  uncomfortable: ["painful", "hurt"],
  accurate: ["precise"],
  precise: ["accurate"],
  handy: ["convenient", "useful"],
  convenient: ["handy", "useful"],
};

function expandAnchors(anchors: string[]): string[] {
  const out = new Set<string>(anchors);
  for (const a of anchors) {
    for (const [k, syns] of Object.entries(ANCHOR_SYNONYMS)) {
      // "light" expands for a "lightweight" anchor and vice versa.
      if (a === k || a === stem(k) || (a.length >= 4 && k.length >= 4 && (a.includes(k) || k.includes(a)))) {
        for (const s of syns) out.add(stem(s));
      }
    }
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Text utilities.
// ---------------------------------------------------------------------------

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9'\s-]/g, " ").split(/\s+/).filter(Boolean);
}

function verbAt(toks: string[], i: number): boolean {
  const t = toks[i];
  if (AUX.has(t) || IRREG.has(t)) return true;
  const m = t.match(/^(.*?)(ing|ed|es|s|d)$/);
  if (m && m[1].length >= 3) {
    const st = m[1];
    // e-restoration: lives->live, bakes->bake, charges->charge.
    if (VERB_BASES.has(st) || VERB_BASES.has(st + "e")) return true;
    if (/([bcdfghjklmnpqrstvwxyz])\1$/.test(st) && VERB_BASES.has(st.slice(0, -1))) return true;
    if (t.endsWith("ies") && VERB_BASES.has(st.slice(0, -1) + "y")) return true;
  }
  // Bare base form ("praise", "love"): finite only with a pronoun or
  // plural-noun subject directly before it — "they praise", "buyers praise".
  // After a determiner/adjective ("great sound quality") it is a noun.
  if (VERB_BASES.has(t) && i > 0) {
    const prev = toks[i - 1];
    if (PRONOUNS.has(prev)) return true;
    if (prev.length > 3 && prev.endsWith("s") && !VERB_BASES.has(prev)) return true;
  }
  return false;
}

const PRONOUNS = new Set("i,you,he,she,it,we,they,who,that".split(","));

function clauseHasVerb(s: string): boolean {
  const toks = tokenize(s);
  return toks.some((_, i) => verbAt(toks, i));
}

function stem(t: string): string {
  if (t.length <= 3) return t;
  if (t.endsWith("ies") && t.length > 4) return t.slice(0, -3) + "y";
  if (t.endsWith("es") && t.length > 4) return t.slice(0, -2);
  if (t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  if (t.endsWith("ing") && t.length > 5) {
    const s = t.slice(0, -3);
    if (/([bcdfghjklmnpqrstvwxyz])\1$/.test(s)) return s.slice(0, -1);
    return s;
  }
  if (t.endsWith("ed") && t.length > 4) {
    const s = t.slice(0, -2);
    if (/([bcdfghjklmnpqrstvwxyz])\1$/.test(s)) return s.slice(0, -1);
    return s;
  }
  return t;
}

function trigrams(s: string): Set<string> {
  const t = "  " + s.toLowerCase().replace(/[^a-z0-9 ]/g, "") + "  ";
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}

function stemmedContentTokens(s: string): Set<string> {
  return new Set(tokenize(s).filter((t) => !STOP.has(t) && t.length > 2).map(stem));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Paraphrase similarity: surface form OR stemmed content words. */
function clauseSim(a: string, b: string): number {
  return Math.max(jaccard(trigrams(a), trigrams(b)), jaccard(stemmedContentTokens(a), stemmedContentTokens(b)));
}

const MERGE_SIM = 0.22;

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Clause splitting + completeness.
// ---------------------------------------------------------------------------

type Clause = { text: string; src: number; mid: boolean };

function splitClauses(texts: string[]): Clause[] {
  const out: Clause[] = [];
  texts.forEach((body, src) => {
    const sentences = String(body ?? "")
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 10);
    for (const sent of sentences) {
      const parts = sent
        .split(/[,;:—–]\s+|\s+—\s+/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 8);
      if (parts.length > 1) {
        parts.forEach((u, i) =>
          out.push({ text: u.replace(/[.!?]+$/, "").trim(), src, mid: i > 0 })
        );
      } else {
        out.push({ text: sent.replace(/[.!?]+$/, "").trim(), src, mid: false });
      }
    }
  });
  // Exact-duplicate clauses collapse to one entry (sources merge later).
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = norm(c.text);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function isCompleteClause(raw: string, mid = false): boolean {
  const s = raw.trim().replace(/[.!?]+$/, "").trim();
  const words = s.split(/\s+/);
  if (words.length < 3 || words.length > 24) return false;
  const first = words[0].replace(/^["'“”]+/, "");
  // Mid-sentence clauses (after a comma split) may start lowercase — they are
  // still complete when they carry subject + verb. BAD_LEAD still rejects
  // conjunction-led fragments ("and the bass is decent too").
  if (!mid && !/^[A-Z0-9]/.test(first) && !LOWER_START_OK.has(first.toLowerCase())) return false;
  if (BAD_LEAD.has(first.toLowerCase())) return false;
  const last = words[words.length - 1].toLowerCase().replace(/["'”.,!?]+$/, "");
  if (DANGLING_END.has(last)) return false;
  return clauseHasVerb(s);
}

// ---------------------------------------------------------------------------
// Theme anchoring: a clause evidences a theme only when it carries one of the
// theme's own signal words. Generic praise can never become a specific.
// ---------------------------------------------------------------------------

function themeAnchors(key: string, title: string, claim: string): string[] {
  const words = new Set<string>();
  const addTokens = (s: string) => {
    for (const t of tokenize(s)) {
      const st = stem(t);
      if (st.length >= 4 && !GENERIC_ANCHOR.has(st) && !STOP.has(t)) words.add(st);
    }
  };
  addTokens(key.replace(/[_:]/g, " "));
  addTokens(title);
  addTokens(claim);
  const depth = depthFor(key);
  for (const sig of depth?.signals ?? []) addTokens(sig);
  for (const [alias, canonical] of Object.entries(DIMENSION_ALIASES)) {
    if (canonical === key || depthFor(canonical) === depth) addTokens(alias);
  }
  return expandAnchors([...words]);
}

function isAnchored(clause: string, anchors: string[]): boolean {
  const low = ` ${clause.toLowerCase()} `;
  return anchors.some((a) => low.includes(a));
}

// ---------------------------------------------------------------------------
// Clustering of near-duplicate clauses.
// ---------------------------------------------------------------------------

type Cluster = { members: Clause[]; sources: Set<number> };

/** Normalized numeral+unit measurements in a clause: "about 5 hours" -> "5 hours". */
function measurementsOf(text: string): Set<string> {
  const out = new Set<string>();
  const re = /\d[\d.,]*\s*(lbs?|pounds?|kgs?|oz|ounces?|hours?|hrs?|minutes?|mins?|seconds?|secs?|days?|weeks?|months?|years?|feet|ft|inches?|cm|mm|miles?|mph|watts?|volts?|gb|db|%|percent)\b/gi;
  for (const m of text.matchAll(re)) out.add(norm(m[0]));
  return out;
}

function clusterClauses(clauses: Clause[]): Cluster[] {
  const meas = clauses.map((c) => measurementsOf(c.text));
  const clusters: { members: Clause[]; rep: string }[] = [];
  clauses.forEach((c, ci) => {
    let best: { members: Clause[]; rep: string } | null = null;
    let bestSim = 0;
    for (const cl of clusters) {
      let sim = clauseSim(c.text, cl.rep);
      // Same measurement = same specific, even when phrased differently
      // ("just over 2 pounds" vs "barely 2 pounds").
      const mi = meas[ci];
      let sharedMeas = false;
      for (const m of cl.members) {
        const mj = meas[clauses.indexOf(m)];
        for (const x of mi) if (mj.has(x)) { sharedMeas = true; break; }
        if (sharedMeas) break;
      }
      if (sharedMeas) sim = Math.max(sim, 0.5);
      if (sim > bestSim) {
        bestSim = sim;
        best = cl;
      }
    }
    if (best && bestSim >= MERGE_SIM) best.members.push(c);
    else clusters.push({ members: [c], rep: c.text });
  });
  return clusters.map((cl) => ({
    members: cl.members,
    sources: new Set(cl.members.map((m) => m.src)),
  }));
}

function specificityScore(text: string): number {
  const toks = stemmedContentTokens(text);
  let s = toks.size;
  if (/\d/.test(text)) s += 3;
  return s;
}

function pickRepresentative(cluster: Cluster): Clause {
  const cands = cluster.members.filter((m) => m.text.split(/\s+/).length <= 14);
  const pool = cands.length ? cands : cluster.members;
  let best: Clause | null = null;
  let bestScore = -1;
  for (const m of pool) {
    let sim = 0;
    for (const o of cluster.members) if (o !== m) sim += clauseSim(m.text, o.text);
    const total = sim * 10 + specificityScore(m.text);
    if (
      !best ||
      total > bestScore ||
      (total === bestScore &&
        (m.text.length < best.text.length ||
          (m.text.length === best.text.length && m.text < best.text)))
    ) {
      best = m;
      bestScore = total;
    }
  }
  return best!;
}

// ---------------------------------------------------------------------------
// Specific-detail extraction. Short phrases only (<= 32 chars), each traced
// to >= 2 distinct reviews. Priority: parenthetical -> measurement ->
// requirement -> "X enough to Y" -> time phrase.
// ---------------------------------------------------------------------------

const MEASURE_RE =
  /\b(about|around|roughly|approx\.?|~|up to|over|under|more than|less than)?\s*\d[\d.,]*\s*(lbs?|pounds?|kgs?|oz|ounces?|hours?|hrs?|minutes?|mins?|seconds?|secs?|days?|weeks?|months?|years?|feet|ft|inches?|in|cm|mm|miles?|mph|watts?|w|volts?|v|gb|db|%|percent)\b/i;
const REQUIRE_RE = /\b(?:needs?|requires?|must buy)\s+(?:a\s+|an\s+|the\s+)?([^,.;()]{3,30}?)(?=\s*(?:purchase|to\s|for\s|,|\.|$))/i;
const ENOUGH_RE = /\b([a-z]+ enough to [^,.;()]{3,26})/i;
const TIME_RE = /\bin (seconds|minutes|hours|days|no time)\b/i;
const NOT_INCLUDED_RE = /\b(not included|sold separately)\b/i;

function titleWordFilter(productTitle: string | undefined): (phrase: string) => boolean {
  const banned = new Set<string>();
  for (const t of tokenize(productTitle ?? "")) {
    if (/[a-z]/.test(t) && !/\d/.test(t) && t.length >= 4 && !STOP.has(t)) banned.add(t);
  }
  if (!banned.size) return () => true;
  return (phrase: string) => {
    const words = new Set(tokenize(phrase));
    for (const b of banned) if (words.has(b)) return false;
    return true;
  };
}

function extractCandidates(clause: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (p: string | null | undefined) => {
    if (!p) return;
    const c = p.replace(/[().]+$/, "").trim().replace(/\s+/g, " ");
    if (c.length >= 3 && c.length <= 32 && /[a-z0-9]/i.test(c) && !seen.has(norm(c))) {
      seen.add(norm(c));
      out.push(c);
    }
  };
  const paren = clause.match(/\(([^()]{3,30})\)/);
  if (paren && /[a-z]/i.test(paren[1])) push(paren[1]);
  const meas = clause.match(MEASURE_RE);
  if (meas) {
    push(meas[0]);
    // Also the bare numeral+unit: "about five hours" may be phrased
    // differently across reviews ("nearly five hours") while "five hours"
    // is the shared specific.
    const bare = meas[0].match(/\d[\d.,]*\s*(lbs?|pounds?|kgs?|oz|ounces?|hours?|hrs?|minutes?|mins?|seconds?|secs?|days?|weeks?|months?|years?|feet|ft|inches?|in|cm|mm|miles?|mph|watts?|w|volts?|v|gb|db|%|percent)\b/i);
    if (bare && norm(bare[0]) !== norm(meas[0])) push(bare[0]);
  }
  const req = clause.match(REQUIRE_RE);
  if (req) {
    push(req[0].trim());
    push(req[1].trim()); // the object alone: "a separate MC4 cable"
  }
  const ni = clause.match(NOT_INCLUDED_RE);
  if (ni) push(ni[0]);
  const enough = clause.match(ENOUGH_RE);
  if (enough) push(enough[0]);
  const time = clause.match(TIME_RE);
  if (time) push(time[0]);
  return out;
}

/**
 * Tier-1b: word-cluster detail. Finds the stemmed content word with the
 * highest document frequency (>= 2) across the theme's kept clauses, then
 * the best short phrase containing it. Catches descriptive repeats like
 * "smooth" (4 reviews) that never form lexical clause clusters.
 */
function wordClusterDetail(
  clauses: Clause[],
  anchors: string[],
  allowTitle: (phrase: string) => boolean
): { detail: string; source: string } | null {
  if (clauses.length < 2) return null;
  const anchorSet = new Set(anchors);
  const isContentStem = (st: string, raw: string): boolean =>
    !STOP.has(raw) && !anchorSet.has(st) && !GENERIC_PRAISE.has(raw) && !GENERIC_PRAISE.has(st) &&
    !ASPECT_WORDS.has(raw) && !ASPECT_WORDS.has(st) && st.length >= 4;
  // df over clauses (distinct src).
  const df = new Map<string, Set<number>>();
  const stemsPerClause: string[][] = [];
  for (const c of clauses) {
    const stems: string[] = [];
    for (const t of tokenize(c.text)) {
      const st = stem(t.toLowerCase());
      if (isContentStem(st, t.toLowerCase())) stems.push(st);
    }
    const uniq = [...new Set(stems)];
    stemsPerClause.push(uniq);
    for (const st of uniq) {
      let s = df.get(st);
      if (!s) { s = new Set<number>(); df.set(st, s); }
      s.add(c.src);
    }
  }
  let bestWord: string | null = null;
  let bestDf = 1;
  for (const [w, s] of df) {
    if (s.size > bestDf) {
      bestDf = s.size;
      bestWord = w;
    }
  }
  if (!bestWord || bestDf < 2) return null;
  // Clauses containing the winning word.
  const hitClauses = clauses.filter((_, i) => stemsPerClause[i].includes(bestWord!));
  if (hitClauses.length < 2) return null;
  // Best phrase: shortest content run (2-4 words) containing the word.
  let bestPhrase: string | null = null;
  let bestSource = "";
  for (const c of hitClauses) {
    const toks = tokenize(c.text).map((t) => t.toLowerCase());
    let cur: string[] = [];
    const flush = (): string[] | null => {
      const r = cur.length >= 2 && cur.length <= 4 ? cur : null;
      cur = [];
      return r;
    };
    const runs: string[][] = [];
    for (const t of toks) {
      const st = stem(t);
      if (isContentStem(st, t)) cur.push(t);
      else {
        const r = flush();
        if (r) runs.push(r);
      }
    }
    const r = flush();
    if (r) runs.push(r);
    for (const run of runs) {
      if (!run.some((t) => stem(t) === bestWord)) continue;
      const phrase = run.join(" ");
      if (!allowTitle(phrase) || hasBannedFragment(phrase)) continue;
      if (!bestPhrase || run.length < bestPhrase.split(" ").length) {
        bestPhrase = phrase;
        bestSource = c.text;
      }
    }
    if (bestPhrase && bestPhrase.split(" ").length === 2) break;
  }
  if (!bestPhrase) return null;
  return { detail: bestPhrase, source: bestSource };
}

/**
 * Tier-2 clause pick: the kept clause whose content words sit closest to the
 * theme's anchors (anchor-proximity), tie-broken by specificity. A clause
 * like "I love how quickly it pairs ... sound quality has been very good"
 * loses to "The sound quality is excellent — crisp highs" because its
 * content ("quickly pairs") is far from the anchor. Returns null when no
 * clause has anchor-proximal content.
 */
function representativeClause(clauses: Clause[], anchors: string[]): Clause | null {
  if (clauses.length < 2) return null;
  const anchorSet = new Set(anchors);
  const toksOf = (text: string): string[] => tokenize(text).map((t) => t.toLowerCase());
  const isAnchor = (t: string): boolean => anchorSet.has(stem(t)) || anchors.some((a) => t.includes(a) || a.includes(t));
  const isContent = (t: string): boolean => {
    const st = stem(t);
    return !STOP.has(t) && !anchorSet.has(st) && !GENERIC_PRAISE.has(t) && !GENERIC_PRAISE.has(st) &&
      !ASPECT_WORDS.has(t) && !ASPECT_WORDS.has(st) && st.length >= 3;
  };
  let best: Clause | null = null;
  let bestScore = 0;
  for (const c of clauses) {
    const toks = toksOf(c.text);
    const anchorIdx: number[] = [];
    toks.forEach((t, i) => { if (isAnchor(t)) anchorIdx.push(i); });
    if (!anchorIdx.length) continue;
    let score = 0;
    toks.forEach((t, i) => {
      if (!isContent(t)) return;
      let d = Infinity;
      for (const a of anchorIdx) d = Math.min(d, Math.abs(i - a));
      score += 1 / (1 + d);
    });
    score *= 1 + specificityScore(c.text) * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (!best || bestScore < 0.3) return null;
  return best;
}

/** A detail qualifies when >= 2 distinct reviews carry it (normalized substring). */
function qualifies(
  detail: string,
  members: Clause[],
  allowTitle: (phrase: string) => boolean
): boolean {
  if (!allowTitle(detail)) return false;
  const n = norm(detail);
  const srcs = new Set<number>();
  for (const m of members) {
    if (norm(m.text).includes(n)) {
      srcs.add(m.src);
      if (srcs.size >= 2) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Honesty gates.
// ---------------------------------------------------------------------------

/** Distinctive fragments of the dead pattern-frame family: none may print. */
export const BANNED_FRAGMENTS = [
  "circling back",
  "steady drumbeat",
  "can't stop talking about",
  "keep coming back to this",
  "lead with this almost",
  "loudest about this",
  "dominates the conversation",
  "single biggest theme",
  "headline, this would be it",
  "buyer after buyer",
  "keep naming this",
  "comes up almost as often",
  "rave about",
  "dwell on this",
  "chorus in the reviews",
  "runner-up in the reviews",
  "comes through as well",
  "give this its due",
  "rounds out the picture",
  "nod to this as well",
  "warmly in passing",
  "share of praise",
  "quietly agree",
  "buyers are clear",
  "do the math",
  "for the money, this is where",
  "price-to-quality ratio gets its own fan club",
  "feels overcharged",
  "most repeated complaint",
  "complaint buyers repeat most",
  "sore spot",
  "agree on the weak point",
  "turn critical",
  "converge on this problem",
  "warn each other",
  "comes up again and again",
  "keep flagging this",
  "grumble about",
  "won't go away",
  "trips over this",
  "docking points",
  "surfaces too often",
  "strongest pattern in the reviews",
  "no other point comes close",
  "beats every other theme",
  "clearest signal",
  "weight of opinion",
  "towers over",
  "close to consensus",
  "speak with one voice",
  "leads the reviews",
  "get concrete about this",
  "the detail that keeps coming up",
  "in the reviewers' own specifics",
  "what buyers name, again and again",
  "it's the pattern, not the exception",
  "steady drumbeat",
  "return to this more than",
  "more than anything else",
  "what stands out",
  "gets this much love",
  "first thing buyers mention",
  "buyers point to this",
  "reviews land here",
  "not the headline",
  "when it comes to the price",
  "price comes up constantly",
  "justifying the price",
  "no complaint comes up more",
  "circle this as the next issue",
  "nothing else buyers mention comes close",
  "strongest patterns in the reviews",
  "emphatic about this",
  "loudest themes",
  "unusually united",
  "stands out sharply",
  "landing here with force",
  "top-tier theme",
  "half the reviews",
  "half of buyers",
  "can't be wrong about this",
  "full half of buyers",
  "review after review",
  "mentioned about as often as not",
  "repeat this like a refrain",
  "say it independently",
  "echoes through the reviews",
  "keep confirming each other",
  "same point, over and over",
  "too often to be coincidence",
  "pattern repeats across",
  "a few buyers raise it",
  "handful of buyers",
  "comes up in a few reviews",
  "small number of buyers",
  "few reviewers land here",
  "minority view, but a real one",
  "only a few buyers say it",
  "modest slice",
  "consistency is the tell",
  "breadth is what makes it convincing",
  "hard to argue with that level of agreement",
  "alignment by accident",
  "agree with each other on this one",
  "solid as review evidence gets",
  "when reviews align like this",
];

function hasBannedFragment(bullet: string): boolean {
  const low = bullet.toLowerCase();
  return BANNED_FRAGMENTS.some((f) => low.includes(f));
}

/** Exported for unit tests. */
export function bulletHasBannedFragment(bullet: string): boolean {
  return hasBannedFragment(bullet);
}

function numerals(s: string): string[] {
  const out = new Set<string>();
  for (const m of s.matchAll(/\d[\d.,]*/g)) out.add(m[0]);
  return [...out];
}

/** Every numeral in the bullet traces to a source clause or the tally. Exported for unit tests. */
export function numeralsTrace(
  bullet: string,
  sourceText: string,
  count: number,
  reviewCount: number
): boolean {
  const src = norm(sourceText);
  const allowed = new Set([String(count), String(reviewCount)]);
  for (const n of numerals(bullet)) {
    if (allowed.has(n)) continue;
    if (src.includes(n.toLowerCase())) continue;
    return false;
  }
  return true;
}

function isWellFormedBullet(bullet: string): boolean {
  if (bullet.length > 240) return false;
  if (!/^[A-Z0-9]/.test(bullet)) return false;
  if (!/\.$/.test(bullet)) return false;
  if (!clauseHasVerb(bullet)) return false;
  if (hasBannedFragment(bullet)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Render + main entry.
// ---------------------------------------------------------------------------

function lowerFirst(s: string): string {
  if (/^I('|$)/.test(s)) return s; // keep "I", "I've"
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Build the findings bullet for one theme. Returns null only when the
 * module cannot run (no texts) — otherwise always returns a bullet:
 * a specific-detail bullet when the evidence earns one, else the honest
 * gloss+support fallback. Never throws.
 */
export function themeFinding(input: FindingsInput): string | null {
  try {
    const { key, title, claim, side, count, reviewCount, texts } = input;
    if (!texts || !texts.length || count < 1 || reviewCount < 1) return null;

    const frame = side === "for" ? "Buyers praise it" : "Buyers flag it";
    const support = `mentioned in ${count} of ${reviewCount} review${reviewCount === 1 ? "" : "s"}`;
    const allowTitle = titleWordFilter(input.productTitle);

    // 1. Clauses: complete + theme-anchored.
    const anchors = themeAnchors(key, title, claim);
    const clauses = splitClauses(texts).filter(
      (c) => isCompleteClause(c.text, c.mid) && isAnchored(c.text, anchors)
    );

    // 2. Cluster near-duplicates; keep clusters with >= 2 distinct reviews.
    const clusters = clusterClauses(clauses)
      .filter((c) => c.sources.size >= 2)
      .sort(
        (a, b) =>
          b.sources.size - a.sources.size ||
          Math.max(...b.members.map((m) => specificityScore(m.text))) -
            Math.max(...a.members.map((m) => specificityScore(m.text))) ||
          b.members.length - a.members.length
      );

    // 3. First qualifying detail across the top clusters.
    let detail: string | null = null;
    let detailSources = "";
    for (const cluster of clusters.slice(0, 3)) {
      const ordered = [...cluster.members].sort((a, b) => {
        const sa = specificityScore(a.text);
        const sb = specificityScore(b.text);
        return sb - sa || a.text.length - b.text.length || (a.text < b.text ? -1 : 1);
      });
      for (const m of ordered) {
        for (const cand of extractCandidates(m.text)) {
          if (qualifies(cand, cluster.members, allowTitle) && polaritySafe(cand, m.text)) {
            detail = cand;
            detailSources = cluster.members.map((x) => x.text).join(" ");
            break;
          }
        }
        if (detail) break;
      }
      if (detail) break;
    }

    // 3b. Tier-1b DISABLED 2026-10-17: word-cluster produced fragmentary
    // phrases ("feel kind"). Falls back to the honest gloss+tally below.
    if (!detail) {
      // const wordDetail = wordClusterDetail(clauses, anchors, allowTitle);
      // if (wordDetail && polaritySafe(wordDetail.detail, wordDetail.source)) {
      //   detail = wordDetail.detail;
      //   detailSources = wordDetail.source;
      // }
    }

    // 3c. Tier 2 DISABLED 2026-10-17: anchor-proximity descriptive mining
    // produced worse-than-fallback specifics ("headset mode altogether").
    // Falls back to the honest gloss+tally below. Re-enable only with a
    // conservative, validated approach.
    if (!detail) {
      // const rep = representativeClause(clauses, anchors);
      // if (rep) {
      //   const cand = descriptiveDetail(rep.text, anchors);
      //   if (cand && allowTitle(cand) && !hasBannedFragment(cand) && polaritySafe(cand, rep.text)) {
      //     detail = cand;
      //     detailSources = rep.text;
      //   }
      // }
    }

    const sourceText = clauses.map((c) => c.text).join(" ");
    let bullet: string;
    if (detail) {
      bullet = `${frame} — ${lowerFirst(detail)}, ${support}.`;
    } else {
      bullet = `${frame} — ${support}.`;
    }

    // 4. Honesty gates: all must pass or no bullet ships.
    if (!isWellFormedBullet(bullet)) return null;
    if (!numeralsTrace(bullet, `${sourceText} ${detailSources}`, count, reviewCount)) return null;
    return bullet;
  } catch {
    return null;
  }
}
