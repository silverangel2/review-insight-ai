// Free (zero OpenAI) seller comparison built only from the two products' real
// review-evidence fields. No generic advice: every line names a real signal.
type Rec = Record<string, unknown>;
const obj = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? v as Rec : {});
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function themes(record: Rec, keys: string[]): string[] {
  const evidence = obj(record.reviewEvidence);
  for (const source of [record, evidence]) {
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) {
        const out = value.map(item => typeof item === "string" ? item : String(obj(item).claim || obj(item).theme || obj(item).text || "")).map(s => s.trim()).filter(Boolean);
        if (out.length) return Array.from(new Set(out)).slice(0, 8);
      }
    }
  }
  return [];
}
const praiseOf = (r: Rec) => themes(r, ["topPraise", "topStrengths", "strengths", "praise"]);
const complaintsOf = (r: Rec) => themes(r, ["topComplaints", "complaints", "buyerObjections"]);
function scoreOf(r: Rec): number | null {
  const health = num(r.healthScore) ?? num(r.productScore);
  if (health !== null) return health;
  const buy = num(r.buyScore) ?? num(obj(r.reviewEvidence).buyScore);
  return buy !== null ? buy * 10 : null;
}
function countOf(r: Rec): number | null {
  return num(r.commentsAnalyzed) ?? num(obj(r.reviewEvidence).commentsAnalyzed) ?? num(r.reviewsAnalyzed);
}
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const minus = (a: string[], b: string[]) => { const bk = new Set(b.map(key)); return a.filter(x => !bk.has(key(x))); };

export function freeSellerCompare(yours: Rec, competitor: Rec, labels = { yours: "Your product", competitor: "Competitor" }) {
  const ys = scoreOf(yours), cs = scoreOf(competitor);
  const yp = praiseOf(yours), cp = praiseOf(competitor), yc = complaintsOf(yours), cc = complaintsOf(competitor);
  const yn = countOf(yours), cn = countOf(competitor);
  let position = "Not scored";
  if (ys !== null && cs !== null) position = ys - cs >= 8 ? "Ahead" : cs - ys >= 8 ? "Behind" : "Close fight";
  const scoreLine = ys !== null && cs !== null ? `${labels.yours} ${Math.round(ys)}/100 vs ${labels.competitor} ${Math.round(cs)}/100` : "Scores unavailable for one product";
  const evidenceLine = yn !== null && cn !== null ? ` from ${yn} and ${cn} written reviews` : "";
  const yourAdvantages = minus(yp, cp).slice(0, 4).map(t => `Buyers praise ${t}; competitor reviews don't`);
  const competitorAdvantages = minus(cp, yp).slice(0, 4).map(t => `Competitor buyers praise ${t}`);
  const conversionGaps = minus(yc, cc).slice(0, 4).map(t => `Your buyers complain about ${t}; competitor's don't`);
  const productMoves = yc.slice(0, 4).map(t => `Fix the "${t}" complaint seen in your reviews`);
  const adAngles = minus(yp, cp).concat(cc.filter(t => !yc.map(key).includes(key(t)))).slice(0, 4).map(t => `Lead with "${t}"`);
  const riskWarnings = yc.filter(t => !cc.map(key).includes(key(t))).slice(0, 2).map(t => `"${t}" is a complaint the competitor doesn't have`);
  const fixFirst = productMoves[0] || "No repeated complaint found in your reviews";
  return {
    competitivePosition: position,
    confidence: null as number | null, // not modelled; we never invent a confidence number
    executiveSummary: `${scoreLine}${evidenceLine}.`,
    marketMove: position === "Behind" && conversionGaps[0] ? conversionGaps[0] : yourAdvantages[0] || fixFirst,
    fixFirst,
    outgrowStrategy: [...conversionGaps.slice(0, 2), ...yourAdvantages.slice(0, 2)],
    competitorAdvantages, yourAdvantages, conversionGaps, productMoves, listingMoves: [] as string[], adAngles, riskWarnings,
    thirtyDayPlan: productMoves.slice(0, 2), ninetyDayPlan: [] as string[],
    comparabilityWarning: "",
    source: "free_scorer",
    openAiCalls: 0,
  };
}
