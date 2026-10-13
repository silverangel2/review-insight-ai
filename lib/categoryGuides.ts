// Category guides generated ONLY from real stored scans. No OpenAI, no invented text.
// - A guide is "thin" (noindex + clearly labelled) below a minimum-data threshold.
// - Aggregated facts use neutral attribution ("buyers reported"); quotes are verbatim accepted reviews.
import { deriveShopperAnswer } from "./shopperAnswer";
import { storedReviewSummary } from "./betterPicks";

type Rec = Record<string, unknown>;
const obj = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});

/** Generic product types (never brands). First match wins; longer phrases first. */
export const PRODUCT_TYPES: Array<{ slug: string; name: string; match: RegExp }> = [
  { slug: "air-fryers", name: "Air fryers", match: /\bair\s*fryer/i },
  { slug: "coffee-makers", name: "Coffee makers", match: /\b(coffee|espresso)\s*(maker|machine|brewer)/i },
  { slug: "robot-vacuums", name: "Robot vacuums", match: /\brobot(ic)?\s*vacuum/i },
  { slug: "vacuums", name: "Vacuums", match: /\bvacuum/i },
  { slug: "smart-rings", name: "Smart rings", match: /\bsmart\s*ring/i },
  { slug: "fitness-trackers", name: "Fitness trackers", match: /\b(fitness|activity)\s*tracker|smart\s*watch|smartwatch/i },
  { slug: "earbuds", name: "Earbuds", match: /\bear\s*buds?|\bin-ear\b/i },
  { slug: "headphones", name: "Headphones", match: /\bheadphones?|\bheadset/i },
  { slug: "speakers", name: "Speakers", match: /\bspeaker/i },
  { slug: "drills", name: "Drills", match: /\bdrill/i },
  { slug: "mice", name: "Computer mice", match: /\bmouse\b|\bmice\b/i },
  { slug: "keyboards", name: "Keyboards", match: /\bkeyboard/i },
  { slug: "printers", name: "Printers", match: /\bprinter/i },
  { slug: "blenders", name: "Blenders", match: /\bblender/i },
  { slug: "water-filters", name: "Water filters", match: /\bwater\s*filter|filter\s*pitcher/i },
  { slug: "monitors", name: "Monitors", match: /\bmonitor\b/i },
];

export const GUIDE_MIN_PRODUCTS = 3;
export const GUIDE_MIN_REVIEWS = 15;

export type GuideProduct = { title: string; verdict: string; label: string; score: number | null; reviewCount: number; scanId: string | null };
export type GuideTheme = { claim: string; products: number; quote: string | null; sourceHost: string | null };
export type CategoryGuide = { slug: string; name: string; products: GuideProduct[]; totalReviews: number; loves: GuideTheme[]; complaints: GuideTheme[]; thin: boolean };

export function productTypeFor(title: string, category?: string | null) {
  const hay = `${category || ""} ${title}`;
  return PRODUCT_TYPES.find(t => t.match.test(hay)) || null;
}

function aggregate(list: Array<{ claim: string; quote: string | null; sourceHost: string | null }[]>): GuideTheme[] {
  const m = new Map<string, GuideTheme>();
  for (const points of list) for (const p of points) {
    const k = p.claim.toLowerCase();
    const cur = m.get(k) || { claim: p.claim, products: 0, quote: null, sourceHost: null };
    cur.products += 1;
    if (!cur.quote && p.quote) { cur.quote = p.quote; cur.sourceHost = p.sourceHost; }
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.products - a.products).slice(0, 5);
}

export function buildCategoryGuides(rows: Rec[]): CategoryGuide[] {
  const groups = new Map<string, { name: string; items: Array<{ p: GuideProduct; loves: GuideTheme[]; complaints: GuideTheme[] }> }>();
  for (const row of rows) {
    const summary = storedReviewSummary(row);
    if (!summary) continue; // only SUFFICIENT real-review results
    const type = productTypeFor(summary.title, summary.category);
    if (!type) continue;
    const json = obj(row.analysis_json);
    const result = obj(json.result && typeof json.result === "object" ? json.result : json);
    const answer = deriveShopperAnswer(result);
    const g = groups.get(type.slug) || { name: type.name, items: [] };
    if (g.items.some(i => i.p.title.toLowerCase() === summary.title.toLowerCase())) continue; // newest scan per product
    g.items.push({
      p: { title: summary.title, verdict: summary.verdict, label: answer.label, score: answer.score, reviewCount: answer.reviewCount || summary.acceptedReviews, scanId: String(result.scanId || obj(result.meta).scanId || "") || null },
      loves: answer.loves.map(l => ({ claim: l.claim, products: 1, quote: l.quote, sourceHost: l.sourceHost })),
      complaints: answer.complaints.map(c => ({ claim: c.claim, products: 1, quote: c.quote, sourceHost: c.sourceHost })),
    });
    groups.set(type.slug, g);
  }
  return [...groups.entries()].map(([slug, g]) => {
    const totalReviews = g.items.reduce((n, i) => n + i.p.reviewCount, 0);
    return {
      slug, name: g.name, totalReviews,
      products: g.items.map(i => i.p).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
      loves: aggregate(g.items.map(i => i.loves)), complaints: aggregate(g.items.map(i => i.complaints)),
      thin: g.items.length < GUIDE_MIN_PRODUCTS || totalReviews < GUIDE_MIN_REVIEWS,
    };
  }).sort((a, b) => b.products.length - a.products.length);
}
