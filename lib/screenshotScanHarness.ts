/**
 * Native screenshot-scan harness. Grades identity fixtures and saved analyze
 * results. No network, no OpenAI, no paid APIs. The CLI lives in
 * scripts/screenshot-scan-harness.mjs.
 */
import { productFactsFromOcr, type ScreenshotProductFacts } from "@/lib/screenshotProductFacts";
import type { ScreenshotOcrLine } from "@/lib/reviewScreenshotOcr";
import { briefFactRows } from "@/lib/briefNarration";
import { buyingScoreFromReviews, marketplaceAggregateForScore } from "@/lib/buyingScore";
import { deriveShopperAnswer, shopperVerdictWord } from "@/lib/shopperAnswer";
import { deriveReviewAnalysis } from "@/lib/reviewAnalysis";
import {
  screenshotCollectionPlan,
  shopperFacingProductTitle,
} from "@/lib/screenshotListingIdentity";

export type ScreenshotFixtureLine = { text: string; confidence?: number };
export type ScreenshotIdentityFixture = {
  id: string;
  store?: string;
  listingUrl?: string;
  lines: ScreenshotFixtureLine[];
  /** Substrings the cleaned product title must contain (case-insensitive). */
  expectTitleIncludes: string[];
  /** Substrings the cleaned product title must not contain. */
  expectTitleExcludes?: string[];
  expectCollectionStore?: "Amazon.ca" | "Amazon.com" | null;
  expectCrossStore?: boolean;
  /** Star value read from the screenshot, such as "4.3". */
  expectRating?: string;
  /** Digits only, such as "2553" for "2,553". */
  expectReviewCount?: string;
  /**
   * The screenshot aggregate must produce a provisional Buy, Wait, or Skip
   * when Amazon returned nothing. No review scrape is required.
   */
  expectProvisionalWithoutAmazon?: boolean;
};

export type HarnessCheck = {
  id: string;
  pass: boolean;
  title: string;
  reasons: string[];
  collectionStore: string | null;
  crossStoreAmazon: boolean;
  rating?: string;
  reviewCount?: string;
  score?: number | null;
  shopperVerdict?: string | null;
};

const FORBIDDEN_SHOPPER = [/not scored/i, /not enough evidence/i, /\bvercel\b/i];
const GENERIC_COMPLAINT = /isolated concerns|weighed against the praise above/i;

function includesFold(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function ocrFromFixtureLines(lines: ScreenshotFixtureLine[]) {
  const ocrLines: ScreenshotOcrLine[] = lines.map((line, index) => ({
    text: line.text,
    confidence: line.confidence ?? 90,
    bbox: { x0: 12, y0: 40 + index * 28, x1: 640, y1: 64 + index * 28 },
  }));
  const confidence = ocrLines.length
    ? ocrLines.reduce((sum, line) => sum + line.confidence, 0) / ocrLines.length
    : 0;
  return { fileSha256: "fixture", ocrConfidence: confidence, lines: ocrLines, engine: "fixture" };
}

export function gradeIdentityFixture(fixture: ScreenshotIdentityFixture): HarnessCheck {
  const facts: ScreenshotProductFacts = productFactsFromOcr(ocrFromFixtureLines(fixture.lines));
  const plan = screenshotCollectionPlan({
    store: facts.store || fixture.store || "",
    listingUrl: fixture.listingUrl || "",
    productName: facts.name || facts.normalizedSearchQuery,
  });
  const title = shopperFacingProductTitle(facts.name || plan.productName, "");
  const reasons: string[] = [];
  if (!title) reasons.push("No product title was read from the screenshot text.");
  for (const needle of fixture.expectTitleIncludes) {
    if (!includesFold(title, needle)) reasons.push(`Title "${title}" is missing "${needle}".`);
  }
  for (const needle of fixture.expectTitleExcludes || []) {
    if (title && includesFold(title, needle)) reasons.push(`Title "${title}" still contains chrome "${needle}".`);
  }
  if (fixture.expectCollectionStore !== undefined && plan.collectionStore !== fixture.expectCollectionStore) {
    reasons.push(`Collection store is ${plan.collectionStore || "(unchanged)"}, expected ${fixture.expectCollectionStore || "(unchanged)"}.`);
  }
  if (fixture.expectCrossStore !== undefined && plan.crossStoreAmazon !== fixture.expectCrossStore) {
    reasons.push(`Cross-store Amazon enrichment is ${plan.crossStoreAmazon}, expected ${fixture.expectCrossStore}.`);
  }
  if (fixture.expectRating !== undefined && facts.rating !== fixture.expectRating) {
    reasons.push(`Rating is "${facts.rating || "(empty)"}", expected "${fixture.expectRating}".`);
  }
  if (fixture.expectReviewCount !== undefined && facts.reviewCount !== fixture.expectReviewCount) {
    reasons.push(`Review count is "${facts.reviewCount || "(empty)"}", expected "${fixture.expectReviewCount}".`);
  }
  let score: number | null = null;
  let shopperVerdict: string | null = null;
  if (fixture.expectProvisionalWithoutAmazon) {
    const missed = marketplaceAggregateForScore({
      exactListingAccepted: false,
      pageRating: null,
      pageCount: null,
      screenshotRating: facts.rating,
      screenshotCount: facts.reviewCount,
    });
    const blocked = marketplaceAggregateForScore({
      exactListingAccepted: true,
      pageRating: 4.1,
      pageCount: null,
      screenshotRating: facts.rating,
      screenshotCount: facts.reviewCount,
    });
    if (missed.source !== "screenshot" || missed.rating === null || missed.count === null) {
      reasons.push("Screenshot stars did not score when Amazon returned nothing.");
    }
    if (blocked.source !== "screenshot" || blocked.count !== missed.count) {
      reasons.push("A blocked Amazon page with no count erased the screenshot aggregate.");
    }
    const card = buyingScoreFromReviews({
      marketplace: { rating: missed.rating, count: missed.count, matchesExactModel: true },
      reviews: [],
    });
    score = typeof card.score === "number" ? card.score : null;
    const answer = deriveShopperAnswer({
      product: { title, name: title, store: facts.store || fixture.store || "", rating: facts.rating, reviewCount: facts.reviewCount },
      buyingScoreV2: card,
      buyScore: card.score,
      reviewEvidence: { commentsAnalyzed: 0, evidenceAdjudication: { acceptedRecords: [] } },
    });
    shopperVerdict = shopperVerdictWord({
      product: { title, store: facts.store || fixture.store || "" },
      buyingScoreV2: card,
      buyScore: card.score,
      reviewEvidence: { commentsAnalyzed: 0, evidenceAdjudication: { acceptedRecords: [] } },
    });
    if (card.mode !== "provisional_marketplace" || score === null) {
      reasons.push(`Expected a provisional score from the screenshot, got ${card.mode}.`);
    }
    if (answer.kind === "not_enough" || answer.label === "Low confidence" || shopperVerdict === null) {
      reasons.push("Shopper still lands on the empty Low confidence result.");
    }
    if (answer.kind !== "buy" && answer.kind !== "wait" && answer.kind !== "skip") {
      reasons.push(`Shopper verdict is ${answer.kind}.`);
    }
    const shown = [answer.label, answer.why, answer.trustLine].join(" ");
    for (const pattern of FORBIDDEN_SHOPPER) {
      if (pattern.test(shown)) reasons.push(`Shopper text contains forbidden wording: ${shown.slice(0, 140)}`);
    }
    if (briefFactRows({
      product: { title, store: facts.store || fixture.store || "", rating: facts.rating, reviewCount: facts.reviewCount },
      buyingScoreV2: card,
      reviewEvidence: { commentsAnalyzed: 0, evidenceAdjudication: { acceptedRecords: [] } },
    }).some((row) => row.key === "ratingsCounted")) {
      reasons.push("Shopper answer card still shows a ratings count.");
    }
  }
  return {
    id: fixture.id,
    pass: reasons.length === 0,
    title,
    reasons,
    collectionStore: plan.collectionStore,
    crossStoreAmazon: plan.crossStoreAmazon,
    rating: facts.rating,
    reviewCount: facts.reviewCount,
    score,
    shopperVerdict,
  };
}

function walkStrings(value: unknown, out: string[], depth = 0) {
  if (depth > 8 || out.length > 400) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 40)) walkStrings(item, out, depth + 1);
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
    if (key === "reviewCount" || key === "marketplaceReviewCount" || key === "ratingsCounted") continue;
    walkStrings(item, out, depth + 1);
  }
}

function amazonUrls(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string" && /https?:\/\/[^/\s]*amazon\./i.test(value)) out.push(value);
  else if (value && typeof value === "object") {
    const entries = Array.isArray(value) ? value.slice(0, 40) : Object.values(value as Record<string, unknown>).slice(0, 40);
    for (const item of entries) amazonUrls(item, out);
  }
  return out;
}

export type SavedResultExpectation = {
  id?: string;
  /** Prominent products must earn Buy, Wait, or Skip with both sides filled. */
  prominent?: boolean;
  expectTitleIncludes?: string[];
  expectTitleExcludes?: string[];
};

/**
 * Grade a saved analyze payload (the result object the shopper page renders).
 * Prominent products fail when the verdict is empty Low confidence, when
 * either side has no useful point, or when an Amazon link is missing its
 * associate tag.
 */
export function gradeSavedScanResult(result: unknown, expect: SavedResultExpectation = {}): HarnessCheck {
  const record = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const product = record.product && typeof record.product === "object" ? record.product as Record<string, unknown> : {};
  const rawTitle = String(product.title || product.name || record.productName || record.title || "");
  const title = shopperFacingProductTitle(rawTitle, "");
  const answer = deriveShopperAnswer(result);
  const analysis = deriveReviewAnalysis(result);
  const reasons: string[] = [];
  const id = expect.id || title || "saved-result";

  for (const needle of expect.expectTitleIncludes || []) {
    if (!includesFold(title, needle)) reasons.push(`Title "${title}" is missing "${needle}".`);
  }
  for (const needle of expect.expectTitleExcludes || []) {
    if ((rawTitle && includesFold(rawTitle, needle)) || (title && includesFold(title, needle))) {
      reasons.push(`Title "${rawTitle || title}" still contains "${needle}".`);
    }
  }

  const texts: string[] = [];
  walkStrings(result, texts);
  for (const text of texts) {
    for (const pattern of FORBIDDEN_SHOPPER) {
      if (pattern.test(text)) reasons.push(`Shopper text contains forbidden wording: ${text.slice(0, 140)}`);
    }
  }
  if (briefFactRows(result).some((row) => row.key === "ratingsCounted")) {
    reasons.push("Shopper answer card still shows a ratings count.");
  }

  const complaintTitles = analysis.againstFactors.map((factor) => factor.title).filter(Boolean);
  const strengthTitles = analysis.forFactors.map((factor) => factor.title).filter(Boolean);
  const genericOnly = complaintTitles.length === 0 && GENERIC_COMPLAINT.test(texts.join(" "));

  if (expect.prominent) {
    if (answer.kind === "not_enough" || answer.score === null) {
      reasons.push("Prominent product has no Buy, Wait, or Skip score.");
    }
    if (strengthTitles.length === 0 && answer.loves.length === 0) reasons.push("No strengths from the reviews.");
    if (complaintTitles.length === 0 || genericOnly) reasons.push("No useful complaint from the reviews.");
  }

  const links = amazonUrls(result);
  const untagged = links.filter((url) => {
    try {
      return !new URL(url).searchParams.get("tag")?.trim();
    } catch {
      return false;
    }
  });
  if (untagged.length) reasons.push(`Amazon link is missing the associate tag: ${untagged[0].slice(0, 180)}`);

  return {
    id,
    pass: reasons.length === 0,
    title,
    reasons,
    collectionStore: null,
    crossStoreAmazon: false,
  };
}

export function harnessReport(checks: HarnessCheck[]): { pass: number; fail: number; ok: boolean; markdown: string } {
  const pass = checks.filter((check) => check.pass).length;
  const fail = checks.length - pass;
  const lines = [
    `# Screenshot scan harness`,
    ``,
    `${pass} passed, ${fail} failed, ${checks.length} total.`,
    ``,
  ];
  for (const check of checks) {
    lines.push(`## ${check.pass ? "PASS" : "FAIL"} ${check.id}`);
    lines.push(``);
    lines.push(`Title: ${check.title || "(none)"}`);
    if (check.rating || check.reviewCount) lines.push(`Screenshot aggregate: ${check.rating || "(no rating)"} / ${check.reviewCount || "(no count)"}`);
    if (typeof check.score === "number") lines.push(`Provisional score without Amazon: ${check.score} ${check.shopperVerdict || ""}`.trim());
    if (check.collectionStore) lines.push(`Amazon enrichment: ${check.collectionStore}`);
    if (!check.pass) {
      for (const reason of check.reasons) lines.push(`- ${reason}`);
    }
    lines.push(``);
  }
  return { pass, fail, ok: fail === 0 && checks.length > 0, markdown: lines.join("\n") };
}
