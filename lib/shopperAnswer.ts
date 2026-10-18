import { BUY_THRESHOLD, WAIT_THRESHOLD, provisionalShopperFacing } from "@/lib/buyingScore";
import { isQuoteEchoOfClaim, quoteIdentityKey, sameDisplayedQuote } from "@/lib/evidenceConsistency";
import { claimRules, supportingClauseForClaim } from "@/lib/claimClauseEvidence";
import { fillFrame, resolveBriefDict } from "@/lib/briefI18n";

// Plain-language shopper answer derived ONLY from the existing result fields.
// No invented numbers: missing values stay null/"Unknown"; quotes are real
// accepted review bodies linked to a claim by its evidence ids/hashes.

export type ShopperAnswerKind = "buy" | "wait" | "skip" | "not_enough";
export type ShopperPoint = { claim: string; count: number; quote: string | null; sourceHost: string | null; sourceUrl: string | null; sourceIds: string[]; sourceHashes: string[] };
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
  /** True when confidenceWords is buyingScoreV2.confidence, which the card shows instead of a remapped percent. */
  confidenceFromV2: boolean;
  /** The API's canonical displayedVerdictConfidence (0-100), null only when genuinely null. */
  confidencePercent: number | null;
  value: string;
  score: number | null;
  /** The Amazon page was blank or unreadable, so this answer must not talk about review counts. */
  unreadable: boolean;
  nextSteps: Array<{ id: "screenshots" | "amazon_listing" | "compare" | "retry"; label: string; detail: string; href?: string }>;
};

/** Drop hosting, provider, and internal evidence labels from text a shopper can read. */
export function shopperSafeText(value: unknown): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (/openai|evidenceState|\bNOT_ENOUGH\b|\bvercel\b|review analysis failed|could not access enough/i.test(text)) {
    return "Written reviews were not available for a verdict.";
  }
  return text;
}

export const UNREADABLE_AMAZON_MESSAGE = "We couldn't read this Amazon page right now.";
export const UNREADABLE_LISTING_MESSAGE = "We couldn't read this product page right now.";
export const NEUTRAL_AMAZON_PRODUCT_LABEL = "Amazon product";

export function isAsinPlaceholder(value: unknown) {
  return /^Amazon [A-Z0-9]{10}$/i.test(String(value || "").replace(/\s+/g, " ").trim());
}

/** Shopper-facing name. A raw ASIN placeholder becomes a neutral label. */
export function neutralProductLabel(value: unknown, locale: string = "en") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (isAsinPlaceholder(text)) return resolveBriefDict(locale).answer.neutralProduct;
  return text;
}

/** Shown when written evidence is thin and the shopper has not already given a listing link. */
export const THIN_EVIDENCE_NEXT_STEP = "Low confidence. Scan the Amazon listing link or add a review screenshot to read more real reviews.";

/** A release that did not succeed must not promise a free retry. */
export function unreadableRetryPhrase(input: unknown, locale: string = "en"): string {
  const copy = resolveBriefDict(locale).answer;
  return String(obj(obj(input).quota).code || "") === "released" ? copy.retryFree : copy.retryLater;
}

type Rec = Record<string, unknown>;
const obj = (value: unknown): Rec => (value && typeof value === "object" && !Array.isArray(value) ? value as Rec : {});
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

function hostOf(url: unknown): string | null {
  try { return new URL(String(url)).hostname.replace(/^www\./, ""); } catch { return null; }
}

/** A short, real excerpt: first sentence(s) up to ~150 chars, cut at a word boundary. */
export function shortQuote(body: string, max = 150): string {
  const clean = cleanQuoteText(body);
  if (clean.length <= max) return clean;
  const sentenceEnd = clean.slice(0, max).search(/[.!?](?=\s)[^.!?]*$/);
  if (sentenceEnd >= 60) return clean.slice(0, sentenceEnd + 1);
  const cut = clean.lastIndexOf(" ", max);
  return `${clean.slice(0, cut > 40 ? cut : max)}…`;
}

export function acceptedRecords(result: Rec): Array<{ id?: string; stableEvidenceHash?: string; body?: string; sourceUrl?: string | null }> {
  const evidence = obj(result.reviewEvidence);
  const adjudication = obj(evidence.evidenceAdjudication);
  const list = adjudication.acceptedRecords;
  return Array.isArray(list) ? list as Array<Rec> as never : [];
}


/**
 * Strip markdown/display artifacts from review text before it reaches
 * shoppers. Stored review bodies sometimes carry metadata prefixes like
 * "**Rating: \u2605\u2605\u2605\u2605\u2605**", which the old code
 * rendered literally. This cleans at the display boundary; stored data is
 * never mutated.
 */
export function cleanQuoteText(body: string): string {
  let text = String(body ?? "");
  text = text.replace(/\*\*([^*]+?)\*\*/g, "$1"); // **bold** -> bold
  text = text.replace(/\*([^\*\n]+?)\*/g, "$1"); // *italic* -> italic
  text = text.replace(/__([^_]+?)__/g, "$1"); // __bold__ -> bold
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // [text](url) -> text
  text = text.replace(/^(?:rating|note)\s*:\s*[\u2605\u2606]{1,5}\s*/i, ""); // leading "Rating: stars" metadata
  text = text.replace(/(?<!\w)\*+(?!\w)/g, ""); // stray asterisk runs
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/** Canonical identity for a displayed quote: identical text = identical quote. */
export function normalizeQuoteKey(quote: string): string {
  return cleanQuoteText(quote).toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * One canonical attribution per quote, from the quote's own provenance.
 * Iterates the accepted records once; the first record carrying a given
 * quote text wins, so the same text always carries the same source label
 * everywhere it renders.
 */
export function canonicalQuoteAttribution(input: unknown): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const record of acceptedRecords(obj(input))) {
    const body = String(record.body || "");
    if (!isWrittenReviewBody(body)) continue;
    const key = normalizeQuoteKey(shortQuote(body));
    if (!map.has(key)) map.set(key, hostOf(record.sourceUrl));
  }
  return map;
}

/**
 * One coherent shopper-facing evidence-strength label, from the single
 * source of truth (the evidence decision state). Never concatenates two
 * vocabularies, never leaks internal strings.
 */
export function evidenceStrengthLabel(state: "not_enough" | "limited" | "usable" | null): string {
  if (state === "usable") return "Strong";
  if (state === "limited") return "Moderate";
  return "Low";
}

/**
 * The marketplace aggregate rating for the headline card, mirroring the
 * precedence the "How we checked" disclosure uses (listing evidence first,
 * then product-level fallbacks). Display-only.
 */
export function marketplaceAggregateForDisplay(input: unknown): { rating: string | null; countLine: string | null } {
  const result = obj(input);
  const evidence = obj(result.reviewEvidence);
  const listing = obj(evidence.listingEvidence);
  const product = obj(result.product);
  const rating = num(listing.rating) ?? num(product.rating) ?? num(result.marketplaceRating) ?? num(result.rating);
  const count =
    num(listing.reviewCount) ??
    num(evidence.marketplaceReviewCount) ??
    num(product.reviewCount) ??
    num(result.marketplaceReviewCount);
  const ratingText = rating !== null && rating > 0 ? `${trimRating(rating)} / 5` : null;
  const countText = count !== null && count > 0 ? `from ${Math.round(count).toLocaleString("en-US")} ratings` : null;
  return { rating: ratingText, countLine: countText };
}

function trimRating(rating: number): string {
  const rounded = Math.round(rating * 10) / 10;
  return String(rounded);
}

/**
 * Raw marketplace aggregate numbers for the decision-brief answer card,
 * using the SAME precedence as marketplaceAggregateForDisplay (listing
 * evidence first, then product-level fallbacks). Display-only.
 */
export function marketplaceAggregateNumbers(input: unknown): { rating: number | null; count: number | null } {
  const result = obj(input);
  const evidence = obj(result.reviewEvidence);
  const listing = obj(evidence.listingEvidence);
  const product = obj(result.product);
  const rating =
    num(listing.rating) ?? num(product.rating) ?? num(result.marketplaceRating) ?? num(result.rating);
  const count =
    num(listing.reviewCount) ??
    num(evidence.marketplaceReviewCount) ??
    num(product.reviewCount) ??
    num(result.marketplaceReviewCount);
  return {
    rating: rating !== null && rating > 0 ? Math.round(rating * 10) / 10 : null,
    count: count !== null && count > 0 ? Math.round(count) : null,
  };
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
    // Round 2 defect 4b: never surface review text that failed the exact-product match.
    if ((record as unknown as Rec).exactProductAccepted === false) continue;
    const body = String(record.body || "");
    if (!isWrittenReviewBody(body)) continue;
    const quote = shortQuote(body);
    if (!quotes.includes(quote)) quotes.push(quote);
    if (quotes.length >= limit) break;
  }
  return quotes;
}

function buyingScoreCard(result: Rec): Rec | null {
  const card = obj(result.buyingScoreV2);
  if (String(result.finalDecisionSource || "") === "buyingScoreV2") return card;
  if (card.version === "buying-score-v2" || card.mode) return card;
  return null;
}

function listingUrls(result: Rec): string[] {
  const evidence = obj(result.reviewEvidence);
  const listing = obj(evidence.listingEvidence);
  const product = obj(result.product);
  const identity = obj(result.productIdentity);
  const verified = obj(result.verifiedProductMetadata);
  const values = [
    listing.exactListingUrl,
    identity.exactListingUrl,
    verified.canonicalListingUrl,
    result.exactListingUrl,
    result.sourceUrl,
    result.url,
    result.productUrl,
    product.url,
    product.link,
  ];
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

function quoteOnlyPoints(records: ReturnType<typeof acceptedRecords>, attribution: Map<string, string | null>): ShopperPoint[] {
  const points: ShopperPoint[] = [];
  for (const record of records) {
    const body = String(record.body || "");
    if (!isWrittenReviewBody(body)) continue;
    const quote = shortQuote(body);
    const host = attribution.get(normalizeQuoteKey(quote)) ?? hostOf(record.sourceUrl);
    points.push({
      claim: quote,
      count: 1,
      quote,
      sourceHost: host,
      sourceUrl: record.sourceUrl ? String(record.sourceUrl) : null,
      sourceIds: record.id ? [String(record.id)] : [],
      sourceHashes: record.stableEvidenceHash ? [String(record.stableEvidenceHash)] : [],
    });
    if (points.length >= 3) break;
  }
  return points;
}

export function productTitleOf(result: Rec) {
  const product = obj(result.product);
  return String(product.title || product.name || result.productName || result.title || "").trim();
}

function positiveAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const text = String(value ?? "").replace(/,/g, "").trim();
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Stars or an Amazon rating count mean the listing was actually read. A guessed title does not. */
function marketplaceSignalsKnown(result: Rec): boolean {
  const product = obj(result.product);
  const evidence = obj(result.reviewEvidence);
  const listing = obj(evidence.listingEvidence);
  const audit = obj(obj(result.buyingScoreV2).audit);
  const rating = [product.rating, result.rating, result.marketplaceRating, listing.rating, audit.Rbar].some((value) => {
    const n = positiveAmount(value);
    return n !== null && n <= 5;
  });
  const count = [product.reviewCount, result.reviewCount, result.marketplaceReviewCount, listing.reviewCount, evidence.marketplaceReviewCount, audit.N]
    .some((value) => positiveAmount(value) !== null);
  return rating || count;
}

function v2ConfidenceLevel(result: Rec): ShopperAnswer["confidenceWords"] | null {
  const word = String(obj(result.buyingScoreV2).confidence || "");
  return word === "High" || word === "Medium" || word === "Low" ? word : null;
}

/**
 * Blank Amazon page: a listing link was given, nothing written was read, and no marketplace
 * rating or rating count came back. A title guessed from the URL is not a successful read.
 */
export function isUnreadableAmazonPage(input: unknown): boolean {
  const result = obj(input);
  if (result.pageUnreadable === true && writtenReviewCount(result, acceptedRecords(result)) === 0 && !marketplaceSignalsKnown(result)) return true;
  if (result.identityUnconfirmed === true && writtenReviewCount(result, acceptedRecords(result)) === 0) return true;
  if (writtenReviewCount(result, acceptedRecords(result)) > 0) return false;
  const buying = obj(result.buyingScoreV2);
  if (buying.mode === "provisional_marketplace" || buying.mode === "buying_score" || buying.mode === "written_only") return false;
  if (marketplaceSignalsKnown(result)) return false;
  const title = productTitleOf(result);
  const urls = listingUrls(result);
  const retailerLink = urls.some((url) => /(?:^|\.)(?:walmart|bestbuy|target|homedepot)\./i.test(hostOf(url) || ""));
  return urls.some(isAmazonListing) || isAsinPlaceholder(title) || title === NEUTRAL_AMAZON_PRODUCT_LABEL || retailerLink;
}

/** Shopper-facing confidence. v2's High/Medium/Low wins over a remapped percent. A missing number stays missing. */
export function formatShopperConfidence(answer: Pick<ShopperAnswer, "kind" | "confidencePercent" | "confidenceWords"> & { unreadable?: boolean; confidenceFromV2?: boolean }): string {
  if (answer.unreadable) return "Try again";
  if (answer.confidenceFromV2 && answer.confidenceWords !== "Unknown") return answer.confidenceWords;
  if (answer.kind === "not_enough") return "Low";
  if (answer.confidencePercent !== null && answer.confidencePercent > 0) return `${answer.confidencePercent}% · ${answer.confidenceWords}`;
  return answer.confidenceWords === "Unknown" ? "Unknown" : answer.confidenceWords;
}

export function deriveShopperAnswer(input: unknown, locale: string = "en"): ShopperAnswer {
  const result = obj(input);
  const records = acceptedRecords(result);
  const attribution = canonicalQuoteAttribution(result);
  const reviewCount = writtenReviewCount(result, records);
  const sources = Array.from(new Set(records.map(record => hostOf(record.sourceUrl)).filter((host): host is string => Boolean(host))));
  const verdict = verdictOf(result);
  const state = evidenceStateOf(result);
  const card = buyingScoreCard(result);
  const writtenOnCard = card ? num(obj(card.audit).n) : null;
  const cardCount = writtenOnCard === null ? null : Math.max(0, Math.floor(writtenOnCard));
  // Legacy NOT_ENOUGH and a legacy accepted-count of 0 must not override a v2 decision.
  const thin = card
    ? cardCount === 0 || String(card.mode || "") === "no_score"
    : state === "NOT_ENOUGH" || reviewCount === 0 || /NOT[_ ]ENOUGH|NOT SCORED/.test(verdict);

  // Round 2 defect 4: evidence hygiene for theme points.
  // - 4b: a candidate record that failed the exact-product match is never quoted.
  // - 4c: a quote rendered under a theme must actually support that theme. A
  //   rule-matched clause supports it by construction; a whole-body fallback
  //   quote is used only when no claim rule exists for the theme (the engine's
  //   attribution is then the evidence). A body that matches no clause of an
  //   existing rule is never quoted as evidence for that theme.
  // - 4a: a "quote" that merely echoes the theme heading is not review evidence —
  //   the next candidate record is tried instead.
  // Claims themselves are never dropped here: the red-flag rule forbids hiding
  // negatives, and the engine's normalized labels (e.g. a French review mined
  // as "suspected counterfeit") are authoritative for what the corpus says.
  // Note: echo detection uses the canonical isQuoteEchoOfClaim from
  // lib/evidenceConsistency (single source of truth).

  // Page-level single assignment: a quote shown under one theme is never
  // repeated under another (defect batch 2, rule 1).
  const usedQuoteKeys = new Set<string>();
  const claimUsedKey = (quote: string | null): string | null => {
    if (!quote) return null;
    const key = quoteIdentityKey(quote);
    for (const used of usedQuoteKeys) {
      if (used === key || sameDisplayedQuote(used, quote)) return used;
    }
    return null;
  };
  // Clause-level evidence (defect batch 2, rule 2): the quote shown for a
  // theme claim is the clause that matched the theme's rule — the clause is
  // guaranteed complaint-bearing (complaint themes) or praise-bearing
  // (strength themes) by the same guards provenance used. A positive quote
  // can never again sit under a complaint theme.
  const toPoints = (kind: "strength" | "complaint"): ShopperPoint[] => claimsOf(result, kind)
    .sort((a, b) => b.supportCount - a.supportCount)
    .slice(0, 3)
    .map(claim => {
      const candidates = records.filter(item =>
        (item as unknown as Rec).exactProductAccepted !== false &&
        ((item.id && claim.sourceIds.includes(item.id)) || (item.stableEvidenceHash && claim.sourceHashes.includes(item.stableEvidenceHash))));
      // Defect batch 2, rule 2: the displayed quote is the clause that matched
      // the theme's rule (same guards provenance used) — a positive quote can
      // never sit under a complaint theme. Each displayed quote is used once
      // page-wide (rule 1).
      let quote: string | null = null;
      let host: string | null = null;
      let sourceUrl: string | null = null;
      for (const record of candidates) {
        const body = record?.body && isWrittenReviewBody(String(record.body)) ? String(record.body) : "";
        if (!body) continue;
        const clause = supportingClauseForClaim(body, claim.claim);
        if (!clause && claimRules.some((rule) => rule.claim === claim.claim)) {
          // Round 2 defect 4c: a rule exists for this theme but this review's
          // text contains no supporting clause — quoting the whole body would
          // misattribute it. Try the next record instead.
          continue;
        }
        const candidate = clause ? shortQuote(clause) : shortQuote(body);
        // Round 2 defect 4a: a clause that merely echoes the theme heading is
        // not evidence — try the next record's text instead.
        if (isQuoteEchoOfClaim(candidate, claim.claim)) continue;
        if (claimUsedKey(candidate)) continue;
        quote = candidate;
        usedQuoteKeys.add(quoteIdentityKey(quote));
        host = attribution.get(normalizeQuoteKey(quote)) ?? (record ? hostOf(record.sourceUrl) : null);
        sourceUrl = record.sourceUrl ? String(record.sourceUrl) : null;
        break;
      }
      return { claim: claim.claim, count: claim.supportCount, quote, sourceHost: host, sourceUrl, sourceIds: claim.sourceIds, sourceHashes: claim.sourceHashes };
    });
  const storeLabel = String(obj(result.product).store || result.store || "");
  const facing = card && String(card.mode || "") === "provisional_marketplace"
    ? provisionalShopperFacing(card, storeLabel)
    : null;
  const provisional = Boolean(facing && cardCount === 0);
  const claimedLoves = provisional ? [] : toPoints("strength");
  const claimedComplaints = provisional ? [] : toPoints("complaint");
  // Quotes can fill the quotes section. They are not claims, so they never enter the one-line summary.
  const loves = provisional ? [] : (claimedLoves.length || claimedComplaints.length ? claimedLoves : quoteOnlyPoints(records, attribution));
  const complaints = provisional ? [] : claimedComplaints;

  // Round 3: canonical producer vocabulary is BUY / WAIT / SKIP
  // ("AVOID" still accepted for legacy stored records).
  let kind: ShopperAnswerKind = provisional
    ? (facing!.firmBuy || facing!.leaning === "Buy" ? "buy" : facing!.leaning === "Skip" ? "skip" : "wait")
    : thin ? "not_enough" : verdict === "BUY" ? "buy" : verdict === "SKIP" || verdict === "AVOID" ? "skip" : "wait";
  if (!provisional && !thin && !["BUY", "SKIP", "AVOID", "DO NOT BUY YET"].includes(verdict)) kind = "wait";
  if (!provisional && card && !thin) {
    const cardVerdict = String(card.verdict || "").toLowerCase();
    kind = cardVerdict === "buy" ? "buy" : cardVerdict === "skip" ? "skip" : "wait";
  }
  if (!provisional && card && thin) kind = "not_enough";
  // The printed Buying Score is picked before the verdict word is finalized:
  // the band-consistency fence below needs it (Buy-57 fix).
  const storedScore = num(result.buyScore) ?? num(result.score) ?? num(result.productScore);
  const provisionalScore = obj(result.buyingScoreV2).mode === "provisional_marketplace" ? num(obj(result.buyingScoreV2).score) : null;
  const v2Score = card && String(card.mode || "") !== "no_score" ? num(card.score) : null;
  const score = card ? v2Score : provisionalScore !== null ? provisionalScore : reviewCount > 0 ? storedScore : null;
  // Buy-57 band-consistency fence: when a 0–100 Buying Score will print, the
  // verdict word must sit in the score's band (Buy ≥ 75, Wait 50–74, Skip < 50).
  // The number is the canonical v2 output; on a mismatch the WORD follows the
  // SCORE. The fence only applies to scores that come from a v2 card (always
  // 0–100); legacy 0–10 engine scores keep their own verdict words. Provisional,
  // thin/not-enough, and score-less states are untouched: with no score there
  // is nothing to fence against, and provisional facing keeps its own honest
  // in-progress presentation.
  const scoreFromV2 = Boolean(card) || provisionalScore !== null;
  if (!provisional && kind !== "not_enough" && scoreFromV2 && typeof score === "number" && Number.isFinite(score)) {
    kind = score >= BUY_THRESHOLD ? "buy" : score >= WAIT_THRESHOLD ? "wait" : "skip";
  }
  // TRANSLATOR (bot round): display strings resolve through the brief
  // dictionary. Embedded buyer-mined vocabulary (claims, review text)
  // stays in its source language by design — only RI's frames translate.
  const briefAnswer = resolveBriefDict(locale).answer;
  const briefVerdict = resolveBriefDict(locale).verdict;
  const label = provisional
    ? (facing!.firmBuy ? briefVerdict.buy : facing!.leaning === "Buy" ? briefVerdict.leaningBuy : facing!.leaning === "Skip" ? briefVerdict.skip : briefVerdict.wait)
    // Round 3 (owner rule): the only shopper-facing verdict words are
    // Buy / Wait / Skip. "Review first", "Avoid", "Low confidence" and
    // every other legacy label are retired from the verdict slot.
    : { buy: briefVerdict.buy, wait: briefVerdict.wait, skip: briefVerdict.skip, not_enough: briefVerdict.lowConfidence }[kind];

  const topLove = claimedLoves[0]?.claim;
  const topComplaint = claimedComplaints[0]?.claim;
  const hasListing = listingUrls(result).length > 0;
  const neutralSummary = kind === "buy"
    ? briefAnswer.neutralBuy
    : kind === "skip"
      ? briefAnswer.neutralSkip
      : briefAnswer.neutralWait;
  const whyBuyBase = fillFrame(briefAnswer.whyBuyBase, { love: topLove ? lower(topLove) : briefAnswer.whyBuyDefaultLove });
  const whySkipBase = fillFrame(briefAnswer.whySkipBase, { complaint: topComplaint ? lower(topComplaint) : briefAnswer.whySkipDefaultComplaint });
  const whyWaitBase = fillFrame(briefAnswer.whyWaitBase, { love: topLove ? lower(topLove) : briefAnswer.whyWaitDefaultLove });
  const why = provisional && facing
    ? facing.line
    : kind === "not_enough"
    ? (hasListing
      ? briefAnswer.whyNotEnoughListing
      : briefAnswer.whyNotEnoughNoListing)
    : !topLove && !topComplaint
      ? neutralSummary
      : kind === "buy"
        ? `${whyBuyBase}${topComplaint ? fillFrame(briefAnswer.whyBuyComplaintTail, { complaint: lower(topComplaint) }) : ""}.`
        : kind === "skip"
          ? `${whySkipBase}${topLove ? fillFrame(briefAnswer.whySkipLoveTail, { love: lower(topLove) }) : ""}.`
          : `${whyWaitBase}${topComplaint ? fillFrame(briefAnswer.whyWaitComplaintTail, { complaint: lower(topComplaint) }) : ""}. ${fillFrame(briefAnswer.whyWaitCloser, { buy: briefVerdict.buy })}`;

  const sourceText = sources.length ? sources.join(", ") : "the product listing";
  const trustLine = provisional && facing
    ? facing.line
    : kind === "not_enough"
    ? briefAnswer.trustLow
    : fillFrame(briefAnswer.trustBasedOn, { sources: sourceText });

  // Buying Score is picked above the verdict-word fence (Buy-57 fix).
  const storedConfidence = canonicalConfidencePercent(result);
  // Keep a real percent. Never replace a missing or thin-evidence value with 0.
  const confidencePercent = !provisional && thin && (storedConfidence === null || storedConfidence <= 0) ? null : storedConfidence;
  const v2Level = facing?.confidence || v2ConfidenceLevel(result);
  const confidenceWords: ShopperAnswer["confidenceWords"] = v2Level || (thin ? "Low" : confidenceInWords(confidencePercent));
  const confidenceFromV2 = Boolean(v2Level);
  const valueRaw = String(result.valueForMoney || obj(result.deterministicResult).valueForMoney || "Unknown");
  const value = ["Good", "Fair", "Poor"].includes(valueRaw) ? valueRaw : "Unknown";

  const urls = listingUrls(result);
  const amazonUrl = urls.find(isAmazonListing) || null;
  const listingUrl = amazonUrl || urls[0] || null;
  if (isUnreadableAmazonPage(result)) {
    const amazonPage = urls.some(isAmazonListing) || isAsinPlaceholder(productTitleOf(result)) || productTitleOf(result) === NEUTRAL_AMAZON_PRODUCT_LABEL;
    const whyMessage = amazonPage ? briefAnswer.unreadableAmazon : briefAnswer.unreadableListing;
    const retryPhrase = unreadableRetryPhrase(result, locale);
    return {
      kind: "not_enough",
      label: briefVerdict.tryAgain,
      why: whyMessage,
      loves: [],
      complaints: [],
      reviewCount: 0,
      sources: [],
      trustLine: fillFrame(briefAnswer.trustUnreadable, { retry: retryPhrase }),
      confidenceWords: "Unknown",
      confidenceFromV2: false,
      confidencePercent: null,
      value: "Unknown",
      score: null,
      unreadable: true,
      nextSteps: [
        {
          id: "retry",
          label: briefAnswer.steps.retry.label,
          detail: fillFrame(briefAnswer.steps.retry.detail, { unreadable: whyMessage, retry: retryPhrase }),
          href: listingUrl ? `/analyze?url=${encodeURIComponent(listingUrl)}` : "/analyze",
        },
        {
          id: "screenshots",
          label: briefAnswer.steps.screenshots.label,
          detail: briefAnswer.steps.screenshots.detail,
        },
      ],
    };
  }
  const writtenForSteps = cardCount !== null ? cardCount : reviewCount;
  const nextSteps: ShopperAnswer["nextSteps"] = (kind === "not_enough" || writtenForSteps < 10) ? [
    ...(hasListing ? [] : [{
      id: "amazon_listing" as const,
      label: briefAnswer.steps.amazonListing.label,
      detail: briefAnswer.steps.amazonListing.detail,
      href: listingUrl ? `/analyze?url=${encodeURIComponent(listingUrl)}` : "/analyze",
    }]),
    { id: "screenshots", label: briefAnswer.steps.reviewScreenshot.label, detail: briefAnswer.steps.reviewScreenshot.detail },
    { id: "compare", label: briefAnswer.steps.compare.label, detail: briefAnswer.steps.compare.detail },
  ] : [];

  return { kind, label, why, loves, complaints, reviewCount: provisional ? 0 : reviewCount, sources, trustLine, confidenceWords, confidenceFromV2, confidencePercent, value, score, unreadable: false, nextSteps };
}

/**
 * The single shopper-facing verdict word for a result: Buy / Wait / Skip.
 * Round 2 defect 1: ONE derivation (deriveShopperAnswer kind) feeds the brief
 * headline, the results-page headline, the cards, and the compare view — no
 * parallel verdict sources. Round 3: the owner retired every other verdict
 * word, so "Review first" -> "Wait" and "Avoid" -> "Skip" here at the source.
 * Returns null when there is no verdict to show (insufficient evidence /
 * unreadable), so surfaces can render their empty state.
 */
export function shopperVerdictWord(input: unknown): "Buy" | "Wait" | "Skip" | null {
  const kind = deriveShopperAnswer(input).kind;
  if (kind === "buy") return "Buy";
  if (kind === "skip") return "Skip";
  if (kind === "wait") return "Wait";
  return null;
}

/**
 * Render-boundary guard for the verdict word. Whatever value is stored or
 * generated — legacy labels ("Review first", "VERIFIED BUY", "Avoid"),
 * engine strings, null, empty — the result page can only ever display
 * Buy / Wait / Skip. Canonical implementation lives in lib/shopperVerdictWord
 * (single source of truth); re-exported here so existing import sites keep
 * working.
 */
export { sanitizeVerdictWord } from "./shopperVerdictWord";
