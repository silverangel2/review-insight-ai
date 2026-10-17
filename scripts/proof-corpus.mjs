// Proof-only corpus tooling: parse the owner-fed inbox markdown into review
// records, split sentences, and bucket sentences into themes.
//
// Bucketing = the REAL deterministic sorter (matchThemeTags from the release
// tree) first; sentences it cannot tag fall back to per-product keyword
// groups that emulate the scorer's themes. The module itself is
// bucketing-agnostic: production passes ThemeSignal.texts.
import { matchThemeTags } from "@/lib/reviewSorter.ts";
import { depthFor } from "@/lib/analysisCopy.ts";

export function parseInboxMarkdown(md, productId) {
  const reviews = [];
  const chunks = md.split(/^## \d+\. /m).slice(1);
  for (const chunk of chunks) {
    const header = chunk.split("\n")[0] || "";
    const starMatch = header.match(/(\d)\s+out of 5 stars/i) || chunk.match(/(\d) out of 5 stars/);
    const stars = starMatch ? parseInt(starMatch[1], 10) : null;
    // Body = everything after the "Reviewed in Canada..." line(s).
    const lines = chunk.split("\n");
    let bodyStart = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^Reviewed in Canada/i.test(lines[i].trim())) { bodyStart = i + 1; break; }
    }
    let body = lines.slice(bodyStart).join("\n").trim();
    // Strip markdown bold rating echoes, helpful-counts, and Amazon UI residue.
    body = body
      .replace(/^\*\*Rating:.*$/gim, "")
      .replace(/Helpful count shown:.*$/gim, "")
      .replace(/^Attachments in original:.*$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!body) continue;
    reviews.push({ id: `${productId}-${reviews.length + 1}`, stars, body });
  }
  return reviews;
}

export function splitSentences(text) {
  return String(text ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
}

// Proof-only keyword fallback for product-specific themes the generic
// dimension deck has no keys for. Documented emulation, not production logic.
// Groups are ordered specific-first: the first matching group wins, so
// complaint wordings ("hard to clean") precede their positive twins.
// Fresh corpora 2026-10-17: chopper (kitchen) and cream (beauty) groups added
// Product-specific keyword groups (proof-only emulation of the sorter's
// product rules). A flat cross-product list misfires ("multiple" -> Blade
// variety on AirPods, "devices" -> Pairing on a heater), so each corpus gets
// its own groups.
const PRODUCT_GROUPS = {
  airpods4: [
    { label: "Call quality", side: "for", words: ["call", "mic", "microphone", "voice"] },
    { label: "Pairing and connectivity", side: "for", words: ["pair", "bluetooth", "connect", "switching"] },
    { label: "Charging case", side: "for", words: ["charging case", "usb-c"] },
    { label: "Siri and voice control", side: "for", words: ["siri", "hands-free"] },
    { label: "Quiet operation", side: "for", words: ["quiet", "noise", "noisy", "silent", "loud"] },
    { label: "Easy to use", side: "for", words: ["easy to use", "simple", "convenient", "effortless"] },
    { label: "Comfortable fit", side: "for", words: ["comfortable", "secure fit", "perfect fit", "fit well", "fit great", "fit my ears", "stay in"] },
    { label: "Fit problems", side: "against", words: ["fall out", "slipping", "uncomfortable"] },
  ],
  dreo1500w: [
    { label: "Heats quickly", side: "for", words: ["heat", "warm", "heats", "warming", "toasty", "hot"] },
    { label: "Quiet operation", side: "for", words: ["quiet", "noise", "noisy", "silent", "loud"] },
    { label: "Temperature control", side: "for", words: ["thermostat", "temperature", "timer"] },
    { label: "Oscillation", side: "for", words: ["oscillat"] },
    { label: "Remote control", side: "for", words: ["remote"] },
    { label: "Safety features", side: "for", words: ["safety", "tip-over", "tip over", "overheat", "protection"] },
    { label: "Easy to use", side: "for", words: ["easy to use", "simple", "convenient", "effortless"] },
    { label: "Durability issues", side: "against", words: ["stopped working", "broke", "broken", "died", "defect"] },
  ],
  fullstar: [
    { label: "Blades too sharp — finger cuts", side: "against", words: ["sliced my finger", "cut me", "cut my finger", "ask me how i know", "send you to the hospital", "watch your fingers", "be careful"] },
    { label: "Hard to clean", side: "against", words: ["hard to clean", "harder to clean", "tricky to clean", "tough to clean", "pain to clean", "difficult to clean", "not easy to clean", "gets stuck", "food gets stuck", "stuck in"] },
    { label: "Durability issues", side: "against", words: ["blade broke", "blades broke", "a piece broke", "flimsy", "snap off", "it has broken", "broken after", "blades are dull", "fell apart"] },
    { label: "Hard to press", side: "against", words: ["punch the lid", "good thump", "strength to push", "hard to chop", "needs a good"] },
    { label: "Chops fast", side: "for", words: ["time saver", "saves time", "saves so much time", "record time", "half the time", "flawless", "hassle free"] },
    { label: "Sharp blades", side: "for", words: ["sharp", "blades are very sharp", "so sharp"] },
    { label: "Easy to clean", side: "for", words: ["easy to clean", "easy clean", "dishwasher safe", "cleans up easily", "easy to wash", "does a great job"] },
    { label: "Catch container", side: "for", words: ["container", "catches", "caught in", "drops into"] },
    { label: "Blade variety", side: "for", words: ["blade options", "interchangeable", "attachments", "different size", "templates", "functions"] },
    { label: "Sturdy build", side: "for", words: ["sturdy", "well-made", "well made", "durable", "held up well"] },
    { label: "Easy to use", side: "for", words: ["easy to use", "simple", "convenient", "effortless"] },
  ],
  cerave: [
    { label: "Breakouts and irritation", side: "against", words: ["broke me out", "break out", "breakouts", "irritat", "burning", "turned red", "sticky"] },
    { label: "No safety seal", side: "against", words: ["no seal", "unsealed", "no protective seal", "protective seal"] },
    { label: "Deep hydration", side: "for", words: ["hydrat", "moisturiz", "moisture", "soft", "smooth", "locks in"] },
    { label: "Absorbs without grease", side: "for", words: ["absorbs", "soaks in", "soak in", "no greasy", "not greasy", "non-greasy", "no oily", "greasy shine", "zero greasy"] },
    { label: "Fragrance-free", side: "for", words: ["fragrance-free", "no scent", "unscented", "no odor", "no fragrance", "scentless"] },
    { label: "Good for eczema and sensitive skin", side: "for", words: ["eczema", "sensitive skin", "dermatologist"] },
    { label: "Great value tub", side: "for", words: ["great value", "lasts a long time", "value priced", "lasts me", "a little goes a long way", "large container"] },
  ],
};
// Dim tags that are inherently negative — a "for" review sentence mentioning
// them (e.g. "overheat protection", "secure fit") must not create a negative-
// labeled bucket on the praise side. Such sentences fall through to the kw
// groups (or go unbucketed) instead.
const NEGATIVE_DIM_TAGS = new Set(["overheating", "burns", "fit not secure"]);

function sideOf(stars, body) {
  if (stars >= 4) return "for";
  // NOTE: stars can be null (search-excerpt corpora) — and null <= 2 is TRUE
  // in JS (null coerces to 0), so the null check must come first.
  if (stars !== null && stars !== undefined && stars <= 2) return "against";
  // 3-star or unrated (search-excerpt corpora): follow a strong complaint
  // signal in the text; "but"/"not" alone are not enough to flip a review.
  return /broke|broken|disappoint|terrible|awful|horrible|hate\b|useless|don't waste|do not buy|not happy|stopped working|fell apart|flimsy|\bdull\b|irritat|burning|sticky|broke me out|hard to clean|tricky to clean|tough to clean|difficult to clean|not easy to clean|no seal|unsealed/i.test(body) ? "against" : "for";
}

function themeLabelFor(key) {
  const d = depthFor(key);
  return d?.title || key;
}

/**
 * Bucket review sentences into themes. Returns array of:
 * { themeKey, themeLabel, side, supportCount, reviewCount, texts[] }
 * texts = the sentences evidencing the theme (a review may evidence a theme
 * once; a review counts once per theme).
 */
function productIdFor(title) {
  const t = String(title || "").toLowerCase();
  if (t.includes("airpods")) return "airpods4";
  if (t.includes("dreo")) return "dreo1500w";
  if (t.includes("fullstar") || t.includes("chopper")) return "fullstar";
  if (t.includes("cerave")) return "cerave";
  return null;
}

export function bucketThemes(reviews, productTitle, minSupport = 2) {
  const buckets = new Map(); // key -> { key, label, side, reviewIds:Set, texts:[] }
  const hit = (key, label, side, reviewId, sentence) => {
    let b = buckets.get(key);
    if (!b) { b = { key, label, side, reviewIds: new Set(), texts: [] }; buckets.set(key, b); }
    b.texts.push(sentence);
    b.reviewIds.add(reviewId);
  };
  const groups = PRODUCT_GROUPS[productIdFor(productTitle)] || [];
  for (const review of reviews) {
    const side = sideOf(review.stars, review.body);
    for (const sentence of splitSentences(review.body)) {
      const tags = matchThemeTags(sentence).filter(
        (tag) => !(side === "for" && NEGATIVE_DIM_TAGS.has(tag))
      );
      if (tags.length) {
        for (const tag of tags) hit(`dim:${tag}`, themeLabelFor(tag), side, review.id, sentence);
      } else {
        const low = sentence.toLowerCase();
        for (const g of groups) {
          // Word-boundary matching: "quick" must not fire inside "quickly".
          // Phrases match as substrings.
          if (g.words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(low))) {
            hit(`kw:${g.label}`, g.label, g.side, review.id, sentence);
            break;
          }
        }
      }
    }
  }
  const reviewCount = reviews.length;
  return [...buckets.values()]
    .map((b) => ({
      themeKey: b.key,
      themeLabel: b.label,
      side: b.side,
      supportCount: b.reviewIds.size,
      texts: b.texts,
      reviewCount,
      productTitle,
    }))
    .filter((t) => t.supportCount >= minSupport)
    .sort((a, b2) => b2.supportCount - a.supportCount);
}

/** Production-mirror band rule (lib/reviewAnalysis.ts bandFor/basisFor). */
export function bandFor(supportCount, reviewCount) {
  const dominantAt = Math.max(2, Math.ceil(reviewCount / 3));
  if (supportCount >= dominantAt && supportCount >= 3) return "dominant";
  if (supportCount >= 2) return "repeated";
  return "single";
}
export function basisFor(band) {
  if (band === "dominant") return "Pattern across most reviews";
  if (band === "repeated") return "Repeated across reviews";
  return "One buyer reported this";
}
