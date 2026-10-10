// Plain-language shopper answer derived ONLY from the existing result fields.
// No invented numbers: missing values stay null/"Unknown"; quotes are real
// accepted review bodies linked to a claim by its evidence ids/hashes.

export type ShopperAnswerKind = "buy" | "wait" | "skip" | "not_enough";
export type ShopperPoint = { claim: string; count: number; quote: string | null; sourceHost: string | null; sourceUrl: string | null };
export type ShopperAnswer = {
  kind: ShopperAnswerKind;
  label: string;
  why: string;
  loves: ShopperPoint[];
  complaints: ShopperPoint[];
  reviewCount: number;
  sources: string[];
  trustLine: string;
  confidenceWords: "High" | "Medium" | "Low" | "Unknown";
  /** The API's canonical displayedVerdictConfidence (0-100), null only when genuinely null. */
  confidencePercent: number | null;
  value: string;
  score: number | null;
  nextSteps: Array<{ id: "screenshots" | "another_listing" | "compare"; label: string; detail: string }>;
};

type Rec = Record<string, unknown>;
const obj = (value: unknown): Rec => (value && typeof value === "object" && !Array.isArray(value) ? value as Rec : {});
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

function hostOf(url: unknown): string | null {
  try { return new URL(String(url)).hostname.replace(/^www\./, ""); } catch { return null; }
}

/** A short, real excerpt: first sentence(s) up to ~150 chars, cut at a word boundary. */
export function shortQuote(body: string, max = 150): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const sentenceEnd = clean.slice(0, max).search(/[.!?](?=\s)[^.!?]*$/);
  if (sentenceEnd >= 60) return clean.slice(0, sentenceEnd + 1);
  const cut = clean.lastIndexOf(" ", max);
  return `${clean.slice(0, cut > 40 ? cut : max)}…`;
}

function acceptedRecords(result: Rec): Array<{ id?: string; stableEvidenceHash?: string; body?: string; sourceUrl?: string | null }> {
  const evidence = obj(result.reviewEvidence);
  const adjudication = obj(evidence.evidenceAdjudication);
  const list = adjudication.acceptedRecords;
  return Array.isArray(list) ? list as Array<Rec> as never : [];
}

function claimsOf(result: Rec, kind: "strength" | "complaint"): Array<{ claim: string; supportCount: number; sourceIds: string[]; sourceHashes: string[]; sourceUrls: string[] }> {
  const evidence = obj(result.reviewEvidence);
  const deterministic = obj(result.deterministicResult || evidence.deterministicResult);
  const candidates = kind === "strength"
    ? [result.strengthProvenance, result.strengths, deterministic.strengths]
    : [result.complaintProvenance, result.complaints, deterministic.complaints];
  for (const list of candidates) {
    if (Array.isArray(list) && list.length && typeof list[0] === "object") {
      return (list as Rec[]).filter(item => typeof item.claim === "string").map(item => ({
        claim: String(item.claim),
        supportCount: num(item.supportCount) ?? 0,
        sourceIds: Array.isArray(item.sourceIds) ? item.sourceIds.map(String) : [],
        sourceHashes: Array.isArray(item.sourceHashes) ? item.sourceHashes.map(String) : [],
        sourceUrls: Array.isArray(item.sourceUrls) ? item.sourceUrls.map(String) : [],
      }));
    }
  }
  return [];
}

function verdictOf(result: Rec): string {
  const evidence = obj(result.reviewEvidence);
  const deterministic = obj(result.deterministicResult || evidence.deterministicResult);
  return String(result.verdict || result.finalVerdict || result.customerVerdict || deterministic.customerVerdict || "").toUpperCase();
}

function evidenceStateOf(result: Rec): string {
  const evidence = obj(result.reviewEvidence);
  const deterministic = obj(result.deterministicResult || evidence.deterministicResult);
  return String(result.evidenceState || deterministic.evidenceState || evidence.evidenceState || "").toUpperCase();
}

export function confidenceInWords(value: unknown): ShopperAnswer["confidenceWords"] {
  const n = num(value);
  if (n === null) return "Unknown";
  const pct = n <= 1 ? n * 100 : n;
  return pct >= 75 ? "High" : pct >= 50 ? "Medium" : "Low";
}

/** Same field order the API writes (verdictConfidence = buyerConfidence = buyingConfidence = confidence = displayedVerdictConfidence). */
export function canonicalConfidencePercent(result: Record<string, unknown>): number | null {
  for (const key of ["verdictConfidence", "buyerConfidence", "buyingConfidence", "confidence"]) {
    const n = num(result[key]);
    if (n !== null) return Math.round(n <= 1 && n > 0 ? n * 100 : n);
  }
  return null;
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export function deriveShopperAnswer(input: unknown): ShopperAnswer {
  const result = obj(input);
  const records = acceptedRecords(result);
  const evidence = obj(result.reviewEvidence);
  const reviewCount = records.length || num(evidence.commentsAnalyzed) || 0;
  const sources = Array.from(new Set(records.map(record => hostOf(record.sourceUrl)).filter((host): host is string => Boolean(host))));
  const verdict = verdictOf(result);
  const state = evidenceStateOf(result);
  const notEnough = state === "NOT_ENOUGH" || reviewCount === 0 || /NOT[_ ]ENOUGH/.test(verdict);

  const toPoints = (kind: "strength" | "complaint"): ShopperPoint[] => claimsOf(result, kind)
    .sort((a, b) => b.supportCount - a.supportCount)
    .slice(0, 3)
    .map(claim => {
      const record = records.find(item => (item.id && claim.sourceIds.includes(item.id)) || (item.stableEvidenceHash && claim.sourceHashes.includes(item.stableEvidenceHash)));
      const body = record?.body ? String(record.body) : "";
      return { claim: claim.claim, count: claim.supportCount, quote: body ? shortQuote(body) : null, sourceHost: record ? hostOf(record.sourceUrl) : null, sourceUrl: record?.sourceUrl ? String(record.sourceUrl) : null };
    });
  const loves = notEnough ? [] : toPoints("strength");
  const complaints = notEnough ? [] : toPoints("complaint");

  let kind: ShopperAnswerKind = notEnough ? "not_enough" : verdict === "BUY" ? "buy" : verdict === "AVOID" ? "skip" : "wait";
  if (!notEnough && !["BUY", "AVOID", "DO NOT BUY YET"].includes(verdict)) kind = "wait";
  const label = { buy: "Buy", wait: "Wait", skip: "Skip", not_enough: "Not enough reviews yet" }[kind];

  const topLove = loves[0]?.claim, topComplaint = complaints[0]?.claim;
  const why = kind === "not_enough"
    ? reviewCount === 0
      ? "We couldn't read any written reviews of this exact product yet, so we won't guess."
      : `We only found ${reviewCount} real review${reviewCount === 1 ? "" : "s"} of this exact product. That's too few for a fair call.`
    : kind === "buy"
      ? `Buyers consistently report ${topLove ? lower(topLove) : "good results"}${topComplaint ? `, and complaints like ${lower(topComplaint)} are rare` : ""}.`
      : kind === "skip"
        ? `Too many buyers report ${topComplaint ? lower(topComplaint) : "serious problems"}${topLove ? `, which outweighs ${lower(topLove)}` : ""}.`
        : `Buyers like ${topLove ? lower(topLove) : "parts of it"}${topComplaint ? `, but ${lower(topComplaint)} comes up` : ""}. The reviews aren't strong enough yet for a clear Buy.`;

  const sourceText = sources.length ? sources.join(", ") : "the product listing";
  const trustLine = reviewCount
    ? `Based on ${reviewCount} real buyer review${reviewCount === 1 ? "" : "s"} from ${sourceText}.`
    : "No written buyer reviews could be read for this exact product.";

  const score = notEnough ? null : num(result.buyScore) ?? num(result.score) ?? num(result.productScore) ?? null;
  const confidencePercent = notEnough ? null : canonicalConfidencePercent(result);
  const valueRaw = String(result.valueForMoney || obj(result.deterministicResult).valueForMoney || "Unknown");
  const value = ["Good", "Fair", "Poor"].includes(valueRaw) ? valueRaw : "Unknown";

  const nextSteps: ShopperAnswer["nextSteps"] = (kind === "not_enough" || reviewCount < 10) ? [
    { id: "screenshots", label: "Add review screenshots", detail: "Upload screenshots of reviews you can see. We read the text and only keep real reviews of this exact product." },
    { id: "another_listing", label: "Try another listing", detail: "Scan the same product from a different store page with more written reviews." },
    { id: "compare", label: "Compare with an alternative", detail: "Scan a similar product and compare what real buyers say." },
  ] : [];

  return { kind, label, why, loves, complaints, reviewCount, sources, trustLine, confidenceWords: confidenceInWords(confidencePercent), confidencePercent, value, score, nextSteps };
}
