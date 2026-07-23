export type ProductSearchJob = {
  scanId: string;
  store?: string | null;
  brand?: string | null;
  productName?: string | null;
  productKey?: string | null;
  color?: string | null;
  price?: string | number | null;
  rating?: string | number | null;
  reviewCount?: string | number | null;
};

export type ProductCandidate = {
  url: string | null;
  title?: string | null;
  store?: string | null;
  domain?: string | null;
  price?: string | number | null;
  rating?: string | number | null;
  reviewCount?: string | number | null;
  source?: string | null;
  notes?: string[];
};

export type ProductVerifierDecision =
  | "verified_exact_match"
  | "possible_match_needs_more_search"
  | "rejected_similar_product"
  | "rejected_wrong_store"
  | "rejected_wrong_variant"
  | "rejected_rating_review_count_mismatch"
  | "rejected_missing_distinctive_terms"
  | "rejected_non_product_page";

export type ProductVerifierResult = {
  verifierStatus: ProductVerifierDecision;
  verifierConfidence: number;
  verifierReasons: string[];
  verifiedListingUrl: string | null;
  rejectedListingUrl: string | null;
  rejectedListingTitle: string | null;
  retrySearchQueries: string[];
  canCollectReviews: boolean;
  canScoreProduct: boolean;
};

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/amazon'?s choice/g, " ")
    .replace(/[^a-z0-9.%+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberFrom(value: unknown) {
  const n = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function domainFromUrl(url: string | null | undefined) {
  try {
    return new URL(String(url || "")).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function storeDomain(store: unknown) {
  const s = normalize(store);
  if (s.includes("amazon.ca")) return "amazon.ca";
  if (s.includes("amazon.com")) return "amazon.com";
  if (s.includes("walmart.ca")) return "walmart.ca";
  if (s.includes("walmart.com")) return "walmart.com";
  if (s.includes("bestbuy.ca")) return "bestbuy.ca";
  if (s.includes("costco.ca")) return "costco.ca";
  if (s.includes("sephora")) return "sephora";
  return s;
}

const COLOR_WORDS = new Set([
  "black",
  "white",
  "gray",
  "grey",
  "pink",
  "blue",
  "green",
  "red",
  "purple",
  "yellow",
  "orange",
  "silver",
  "gold",
  "beige",
  "brown",
  "navy",
  "cream",
  "clear",
]);

function colorsIn(value: unknown) {
  const colors = new Set<string>();
  for (const word of normalize(value).split(/\s+/)) {
    const color = word === "grey" ? "gray" : word;
    if (COLOR_WORDS.has(color)) colors.add(color);
  }
  return colors;
}

function importantTerms(job: ProductSearchJob) {
  const text = normalize([job.brand, job.productName, job.productKey].filter(Boolean).join(" "));
  const terms = new Set<string>();

  for (const term of text.split(/\s+/)) {
    if (term.length < 3) continue;
    if (["the", "and", "for", "with", "from", "portable", "rechargeable", "amazon", "walmart"].includes(term)) continue;
    terms.add(term);
  }

  const rawText = [job.productName, job.productKey].filter(Boolean).join(" ");
  for (const match of rawText.matchAll(/\b\d+(?:\.\d+)?\s*(?:mah|ml|oz|inch|inches|cm|mm|w|v|gb|tb|pack|pcs|piece|speed|hours?)\b/gi)) {
    terms.add(match[0].replace(/\s+/g, ""));
  }
  for (const match of rawText.matchAll(/\b[A-Z0-9]{4,}(?:-[A-Z0-9]+)?\b/g)) {
    terms.add(match[0].toLowerCase());
  }

  return Array.from(terms).slice(0, 18);
}

export function buildProductRetryQueries(job: ProductSearchJob, reason?: string) {
  const brand = String(job.brand || "").trim();
  const name = String(job.productName || "").trim();
  const store = String(job.store || "").trim() || "Amazon.ca";
  const rating = job.rating ? `${job.rating} stars` : "";
  const reviews = job.reviewCount ? `${job.reviewCount} reviews` : "";
  const color =
    String(job.color || "").trim() ||
    (name.match(/\b(black|white|gray|grey|pink|blue|green|red|purple|yellow|orange|silver|gold|beige|brown|navy|cream|clear)\b/i)?.[1] || "");
  const important = importantTerms(job).slice(0, 8);
  const quotedImportant = important.slice(0, 5).map((term) => `"${term}"`).join(" ");
  const siteTarget = storeDomain(store) || store.toLowerCase();

  const queries = [
    `${brand} ${name} ${store}`,
    `${brand} ${important.join(" ")} ${color} ${store}`,
    `${brand} ${color} ${rating} ${reviews} ${store}`,
    `"${brand}" ${quotedImportant} "${store}"`,
    `site:${siteTarget} ${brand} ${important.join(" ")}`,
  ];

  if (reason) {
    queries.push(`${brand} ${name} ${store} ${reason}`);
  }

  return Array.from(
    new Set(
      queries
        .map((q) => q.replace(/\s+/g, " ").trim())
        .filter((q) => q.length > 8)
    )
  ).slice(0, 8);
}

export function verifyProductCandidate(job: ProductSearchJob, candidate: ProductCandidate): ProductVerifierResult {
  const reasons: string[] = [];
  const jobText = normalize([job.brand, job.productName, job.productKey].filter(Boolean).join(" "));
  const candidateText = normalize([candidate.title, candidate.url, candidate.notes?.join(" ")].filter(Boolean).join(" "));
  const candidateUrl = candidate.url || null;
  const candidateDomain = domainFromUrl(candidateUrl);
  const expectedDomain = storeDomain(job.store);
  const preferredStoreMismatch = Boolean(expectedDomain && candidateDomain && !candidateDomain.includes(expectedDomain));

  if (!candidateUrl || /\/s\?|search|keyword|category|browse/i.test(candidateUrl)) {
    return {
      verifierStatus: "rejected_non_product_page",
      verifierConfidence: 0,
      verifierReasons: ["Candidate is missing or appears to be a search/category page, not an exact product page."],
      verifiedListingUrl: null,
      rejectedListingUrl: candidateUrl,
      rejectedListingTitle: candidate.title || null,
      retrySearchQueries: buildProductRetryQueries(job, "exact product page"),
      canCollectReviews: false,
      canScoreProduct: false,
    };
  }

  const requestedColors = colorsIn(jobText);
  const candidateColors = colorsIn(candidateText);
  const requested5000 = /5000\s*mah|5000mah/i.test(jobText);
  const candidate5000 = /5000\s*mah|5000mah/i.test(candidateText);

  if (requestedColors.size > 0 && candidateColors.size > 0) {
    const hasRequestedColor = Array.from(requestedColors).some((color) => candidateColors.has(color));
    const hasDifferentColor = Array.from(candidateColors).some((color) => !requestedColors.has(color));
    if (!hasRequestedColor && hasDifferentColor) {
      reasons.push(
        `Requested color/variant ${Array.from(requestedColors).join(", ")}, but candidate appears to be ${Array.from(candidateColors).join(", ")}.`
      );
    }
  }

  if (requested5000 && !candidate5000) {
    reasons.push("Requested 5000mAh but candidate does not confirm 5000mAh.");
  }

  const requestedRating = numberFrom(job.rating);
  const candidateRating = numberFrom(candidate.rating);
  if (
    !preferredStoreMismatch &&
    requestedRating !== null &&
    candidateRating !== null &&
    Math.abs(requestedRating - candidateRating) > 0.15
  ) {
    reasons.push(`Requested rating ${requestedRating}, but candidate rating is ${candidateRating}.`);
  }

  const requestedReviews = numberFrom(job.reviewCount);
  const candidateReviews = numberFrom(candidate.reviewCount);
  if (
    !preferredStoreMismatch &&
    requestedReviews !== null &&
    candidateReviews !== null &&
    requestedReviews > 0 &&
    Math.abs(candidateReviews - requestedReviews) / requestedReviews > 0.35
  ) {
    reasons.push(`Requested review count ${requestedReviews}, but candidate review count is ${candidateReviews}.`);
  }

  const terms = importantTerms(job);
  const matchedTerms = terms.filter((term) => candidateText.includes(term));
  const termCoverage = terms.length ? matchedTerms.length / terms.length : 0;
  const requiredTermCoverage = preferredStoreMismatch ? 0.82 : 0.55;

  if (termCoverage < requiredTermCoverage) {
    reasons.push(
      `Candidate is missing distinctive requested terms. Matched ${matchedTerms.length}/${terms.length}: ${matchedTerms.join(", ")}.`
    );
  }

  if (preferredStoreMismatch && termCoverage < 0.82) {
    reasons.push(
      `Preferred store was ${expectedDomain}, but candidate domain is ${candidateDomain || "missing"} and exact-product term coverage is not strong enough for fallback.`
    );
  }

  if (reasons.length > 0) {
    const variantProblem = reasons.some((r) => /color\/variant|5000mah/i.test(r));
    const ratingProblem = reasons.some((r) => /rating|review count/i.test(r));

    return {
      verifierStatus: variantProblem
        ? "rejected_wrong_variant"
        : ratingProblem
          ? "rejected_rating_review_count_mismatch"
          : "rejected_missing_distinctive_terms",
      verifierConfidence: Math.max(0, Math.round(termCoverage * 45)),
      verifierReasons: reasons,
      verifiedListingUrl: null,
      rejectedListingUrl: candidateUrl,
      rejectedListingTitle: candidate.title || null,
      retrySearchQueries: buildProductRetryQueries(job, reasons[0]),
      canCollectReviews: false,
      canScoreProduct: false,
    };
  }

  return {
    verifierStatus: "verified_exact_match",
    verifierConfidence: Math.max(75, Math.round(termCoverage * 100)),
    verifierReasons: [
      preferredStoreMismatch
        ? "Candidate is outside the preferred store, but passed strict exact-product fallback checks."
        : "Candidate passed store, variant, rating/review-count, and distinctive-term checks.",
    ],
    verifiedListingUrl: candidateUrl,
    rejectedListingUrl: null,
    rejectedListingTitle: null,
    retrySearchQueries: [],
    canCollectReviews: true,
    canScoreProduct: true,
  };
}
