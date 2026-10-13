// Free (zero OpenAI) seller CSV analysis using the same deterministic brain as shopper scans.
// Every theme comes from the seller's own uploaded review rows; nothing is invented.
import { createHash } from "node:crypto";
import { deriveDeterministicEvidenceResult } from "./reviewEvidenceDeterminism";
import type { AdjudicatedEvidenceRecord } from "./reviewEvidenceAdjudication";

type Row = Record<string, unknown>;
const TEXT_HINT = /review|comment|body|text|content|feedback|title/i;
const RATING_HINT = /rating|stars?|score/i;

export function reviewTextColumn(rows: Row[]): string | null {
  const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  let best: string | null = null, bestScore = 0;
  for (const k of keys) {
    const avg = rows.reduce((s, r) => s + String(r[k] ?? "").length, 0) / Math.max(1, rows.length);
    const score = avg * (TEXT_HINT.test(k) ? 1.5 : 1);
    if (score > bestScore && avg >= 12) { best = k; bestScore = score; }
  }
  return best;
}

function avgRating(rows: Row[]): number | null {
  const key = Object.keys(rows[0] || {}).find(k => RATING_HINT.test(k));
  if (!key) return null;
  const vals = rows.map(r => parseFloat(String(r[key]))).filter(v => v >= 1 && v <= 5);
  return vals.length >= Math.max(3, rows.length / 2) ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function freeSellerAnalysis(rows: Row[]) {
  const col = reviewTextColumn(rows);
  const texts = col ? Array.from(new Set(rows.map(r => String(r[col] ?? "").replace(/\s+/g, " ").trim()).filter(t => t.length >= 12))) : [];
  const records: AdjudicatedEvidenceRecord[] = texts.map((body, i) => {
    const hash = createHash("sha256").update(body).digest("hex");
    return { id: `csv-${i + 1}`, body, source: "seller_csv", sourceUrl: null, reviewId: null, retrievedAt: null, marketplaceProductId: null,
      sourceType: "marketplace", sourceReputation: "unknown", stableEvidenceHash: hash, independentSourceId: "seller_csv",
      exactProductAccepted: true, accepted: true, rejectionReason: null, duplicateOf: null, original: { body } } as unknown as AdjudicatedEvidenceRecord;
  });
  const rating = avgRating(rows);
  const d = deriveDeterministicEvidenceResult({ acceptedRecords: records, exactProductAccepted: records.length > 0, rating, marketplaceReviewCount: records.length });
  const inputs = d.deterministicScoringInputs as Record<string, number>;
  const n = records.length;
  const pos = Number(inputs.positiveSignal ?? 0), neg = Number(inputs.negativeSignal ?? 0), severe = Number(inputs.severeComplaintCount ?? 0);
  const sufficient = d.evidenceState === "SUFFICIENT";
  const praise = d.strengths.map(s => `${s.claim} (${s.supportCount} of ${n} reviews)`);
  const complaints = d.complaints.map(c => `${c.claim} (${c.supportCount} of ${n} reviews)`);
  const satisfaction = n ? Math.round(100 * pos / n) : 0;
  const refundRisk = n ? Math.min(100, Math.round(100 * (neg + severe) / n)) : 0;
  const healthScore = d.buyScore !== null ? Math.round(d.buyScore * 10) : 0;
  const dataQuality = n >= 40 && sufficient ? "Strong" : n >= 12 && sufficient ? "Moderate" : "Limited";
  const top = d.complaints.slice(0, 4);
  return {
    summary: !n ? "No readable review text was found in this CSV." : sufficient
      ? `${n} written reviews read: ${pos} mention something positive, ${neg} mention a problem.${top[0] ? ` Biggest repeated issue: ${top[0].claim}.` : ""}`
      : `Only ${n} usable written reviews were found, which isn't enough for a reliable health score.`,
    healthScore, buyerSatisfaction: satisfaction, refundRisk,
    confidence: sufficient ? Math.min(90, 40 + n) : Math.min(35, n * 5), dataQuality,
    evidenceSummary: [`${n} distinct written reviews from column "${col ?? "none"}"${rating ? `, average star rating ${rating.toFixed(1)}` : ""}.`, ...(sufficient ? [] : ["Too few readable reviews to score reliably."])],
    topComplaints: complaints.slice(0, 6), topPraise: praise.slice(0, 6),
    buyerObjections: top.map(c => `Buyers raise "${c.claim}" in ${c.supportCount} of ${n} reviews.`),
    productFixes: top.map(c => `Investigate "${c.claim}" (${c.supportCount} reviews): check quality control, parts and instructions for this issue.`),
    listingFixes: top.map(c => `Set expectations about "${c.claim}" in your bullets and FAQ so buyers aren't surprised.`),
    adAngles: d.strengths.slice(0, 4).map(s => `Lead with "${s.claim}", which ${s.supportCount} buyers praised in their own words.`),
    nextActions: [...top.slice(0, 2).map(c => `Fix or address "${c.claim}" first (${c.supportCount} reviews).`), ...(n < 12 ? ["Upload more reviews for a reliable score."] : [])],
    analysisEngine: "deterministic-free", openAiCalls: 0,
  };
}
