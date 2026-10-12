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
  nextSteps: Array<{ id: "screenshots" | "amazon_listing" | "compare"; label: string; detail: string; href?: string }>;
};

/** Shown when written evidence is thin. Names the real count elsewhere; this is the next step. */
export const THIN_EVIDENCE_NEXT_STEP = "Low confidence. Scan the Amazon listing link or add a review screenshot to read more real reviews.";

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

/** Written review text only. Star ratings and blank bodies are not reviews. */
export function isWrittenReviewBody(body: string): boolean {
  const text = body.replace(/\s+/g, " ").trim();
  if (text.length < 8 || !/[A-Za-z\u00C0-\u024F\u4E00-\u9FFF]/.test(text)) return false;
  if (/^[\d.]+(\s*\/\s*5)?(\s*stars?)?$/i.test(text)) return false;
  if (/^[★☆✱*\s]+$/.test(text)) return false;
  return true;
}

/** Short excerpts of accepted written reviews. Never invented, never filled from a star rating. */
export function realReviewQuotes(input: unknown, limit = 4): string[] {
  const quotes: string[] = [];
  for (const record of acceptedRecords(obj(input))) {
    const body = String(record.body || "");
    if (!isWrittenReviewBody(body)) continue;
    const quote = shortQuote(body);
    if (!quotes.includes(quote)) quotes.push(quote);
    if (quotes.length >= limit) break;
  }
  return quotes;
}

function listingUrls(result: Rec): string[] {
  const evidence = obj(result.reviewEvidence);
  const listing = obj(evidence.listingEvidence);
  const product = obj(result.product);
  const values = [listing.exactListingUrl, result.exactListingUrl, result.sourceUrl, result.url, result.productUrl, product.url, product.link];
  const urls: string[] = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!/^https?:\/\//i.test(text)) continue;
    try { urls.push(new URL(text).toString()); } catch { /* skip malformed */ }
  }
  return urls;
}

function isAmazonListing(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "amazon.com" || host.startsWith("amazon.") || host.endsWith(".amazon.com");
  } catch {
    return false;
  }
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

function writtenReviewCount(result: Rec, records: ReturnType<typeof acceptedRecords>): number {
  const evidence = obj(result.reviewEvidence);
  const adjudication = obj(evidence.evidenceAdjudication);
  const hasAdjudication = Array.isArray(adjudication.acceptedRecords) || num(adjudication.acceptedRecordCount) !== null;
  if (hasAdjudication) return records.filter(record => isWrittenReviewBody(String(record.body || ""))).length;
  const comments = num(evidence.commentsAnalyzed);
  return comments !== null && comments > 0 ? Math.round(comments) : 0;
}

function quoteOnlyPoints(records: ReturnType<typeof acceptedRecords>): ShopperPoint[] {
  const points: ShopperPoint[] = [];
  for (const record of records) {
    const body = String(record.body || "");
    if (!isWrittenReviewBody(body)) continue;
    const quote = shortQuote(body);
    points.push({
      claim: quote,
      count: 1,
      quote,
      sourceHost: hostOf(record.sourceUrl),
      sourceUrl: record.sourceUrl ? String(record.sourceUrl) : null,
    });
    if (points.length >= 3) break;
  }
  return points;
}

/** Shopper-facing confidence. A missing number stays missing — it is never shown as 0. Thin evidence is labeled Low with the real count. */
export function formatShopperConfidence(answer: Pick<ShopperAnswer, "kind" | "confidencePercent" | "confidenceWords" | "reviewCount">): string {
  const countLabel = `${answer.reviewCount} real review${answer.reviewCount === 1 ? "" : "s"}`;
  if (answer.kind === "not_enough") {
    const percent = answer.confidencePercent !== null && answer.confidencePercent > 0 ? `${answer.confidencePercent}% · ` : "";
    return `${percent}Low · ${countLabel}`;
  }
  if (answer.confidencePercent !== null) return `${answer.confidencePercent}% · ${answer.confidenceWords}`;
  return "Unknown";
}

export function deriveShopperAnswer(input: unknown): ShopperAnswer {
  const result = obj(input);
  const records = acceptedRecords(result);
  const reviewCount = writtenReviewCount(result, records);
  const sources = Array.from(new Set(records.map(record => hostOf(record.sourceUrl)).filter((host): host is string => Boolean(host))));
  const verdict = verdictOf(result);
  const state = evidenceStateOf(result);
  const thin = state === "NOT_ENOUGH" || reviewCount === 0 || /NOT[_ ]ENOUGH|NOT SCORED/.test(verdict);

  const toPoints = (kind: "strength" | "complaint"): ShopperPoint[] => claimsOf(result, kind)
    .sort((a, b) => b.supportCount - a.supportCount)
    .slice(0, 3)
    .map(claim => {
      const record = records.find(item => (item.id && claim.sourceIds.includes(item.id)) || (item.stableEvidenceHash && claim.sourceHashes.includes(item.stableEvidenceHash)));
      const body = record?.body && isWrittenReviewBody(String(record.body)) ? String(record.body) : "";
      return { claim: claim.claim, count: claim.supportCount, quote: body ? shortQuote(body) : null, sourceHost: record ? hostOf(record.sourceUrl) : null, sourceUrl: record?.sourceUrl ? String(record.sourceUrl) : null };
    });
  const claimedLoves = toPoints("strength");
  const claimedComplaints = toPoints("complaint");
  const loves = claimedLoves.length || claimedComplaints.length ? claimedLoves : quoteOnlyPoints(records);
  const complaints = claimedComplaints;

  let kind: ShopperAnswerKind = thin ? "not_enough" : verdict === "BUY" ? "buy" : verdict === "AVOID" ? "skip" : "wait";
  if (!thin && !["BUY", "AVOID", "DO NOT BUY YET"].includes(verdict)) kind = "wait";
  const label = { buy: "Buy", wait: "Wait", skip: "Skip", not_enough: "Low confidence" }[kind];

  const topLove = loves[0]?.claim, topComplaint = complaints[0]?.claim;
  const reviewWord = `${reviewCount} real review${reviewCount === 1 ? "" : "s"} analyzed`;
  const why = kind === "not_enough"
    ? `Low confidence, from ${reviewWord}. Scan the Amazon listing link or add a review screenshot to read more real reviews.`
    : kind === "buy"
      ? `Buyers consistently report ${topLove ? lower(topLove) : "good results"}${topComplaint ? `, and complaints like ${lower(topComplaint)} are rare` : ""}.`
      : kind === "skip"
        ? `Too many buyers report ${topComplaint ? lower(topComplaint) : "serious problems"}${topLove ? `, which outweighs ${lower(topLove)}` : ""}.`
        : `Buyers like ${topLove ? lower(topLove) : "parts of it"}${topComplaint ? `, but ${lower(topComplaint)} comes up` : ""}. The reviews aren't strong enough yet for a clear Buy.`;

  const sourceText = sources.length ? sources.join(", ") : "the product listing";
  const trustLine = kind === "not_enough"
    ? `Low confidence · ${reviewWord}${sources.length ? ` from ${sources.join(", ")}` : ""}.`
    : `Based on ${reviewCount} real buyer review${reviewCount === 1 ? "" : "s"} from ${sourceText}.`;

  const storedScore = num(result.buyScore) ?? num(result.score) ?? num(result.productScore);
  const score = reviewCount > 0 ? storedScore : null;
  const storedConfidence = canonicalConfidencePercent(result);
  // Keep a real percent. Never replace a missing or thin-evidence value with 0.
  const confidencePercent = thin && (storedConfidence === null || storedConfidence <= 0) ? null : storedConfidence;
  const confidenceWords: ShopperAnswer["confidenceWords"] = thin ? "Low" : confidenceInWords(confidencePercent);
  const valueRaw = String(result.valueForMoney || obj(result.deterministicResult).valueForMoney || "Unknown");
  const value = ["Good", "Fair", "Poor"].includes(valueRaw) ? valueRaw : "Unknown";

  const urls = listingUrls(result);
  const amazonUrl = urls.find(isAmazonListing) || null;
  const listingUrl = amazonUrl || urls[0] || null;
  const nextSteps: ShopperAnswer["nextSteps"] = (kind === "not_enough" || reviewCount < 10) ? [
    {
      id: "amazon_listing",
      label: "Scan the Amazon listing",
      detail: "Scan the Amazon listing link so we can read more real reviews of this exact product.",
      href: listingUrl ? `/analyze?url=${encodeURIComponent(listingUrl)}` : "/analyze",
    },
    { id: "screenshots", label: "Add a review screenshot", detail: "Upload a screenshot of reviews you can see. We read the text and only keep real reviews of this exact product." },
    { id: "compare", label: "Compare with an alternative", detail: "Scan a similar product and compare what real buyers say." },
  ] : [];

  return { kind, label, why, loves, complaints, reviewCount, sources, trustLine, confidenceWords, confidencePercent, value, score, nextSteps };
}
