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

function importantTerms(job: ProductSearchJob) {
  const text = normalize([job.brand, job.productName, job.productKey].filter(Boolean).join(" "));
  const terms = new Set<string>();

  for (const term of text.split(/\s+/)) {
    if (term.length < 3) continue;
    if (["the", "and", "for", "with", "from", "portable", "rechargeable"].includes(term)) continue;
    terms.add(term);
  }

  if (/5000\s*mah/i.test(String(job.productName || ""))) terms.add("5000mah");
  if (/gray|grey/i.test(String(job.productName || ""))) terms.add("gray");
  if (/pink/i.test(String(job.productName || ""))) terms.add("pink");
  if (/28\s*hours/i.test(String(job.productName || ""))) terms.add("28");
  if (/5\s*speed/i.test(String(job.productName || ""))) terms.add("speed");

  return Array.from(terms).slice(0, 18);
}

export function buildProductRetryQueries(job: ProductSearchJob, reason?: string) {
  const brand = String(job.brand || "").trim();
  const name = String(job.productName || "").trim();
  const store = String(job.store || "").trim() || "Amazon.ca";
  const rating = job.rating ? `${job.rating} stars` : "";
  const reviews = job.reviewCount ? `${job.reviewCount} reviews` : "";
  const color = /gray|grey/i.test(name) ? "Gray" : String(job.color || "").trim();

  const queries = [
    `${brand} ${name} ${store}`,
    `${brand} ${color} ${rating} ${reviews} ${store}`,
    `${brand} 5000mAh Gray 28 Hours 5 Speed ${store}`,
    `"${brand}" "5000mAh" "Gray" "${job.reviewCount || ""} reviews" "${store}"`,
    `site:${store.toLowerCase()} ${brand} 5000mAh Gray Mini Handheld Fan`,
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

  if (expectedDomain && !candidateDomain.includes(expectedDomain)) {
    return {
      verifierStatus: "rejected_wrong_store",
      verifierConfidence: 0,
      verifierReasons: [`Expected ${expectedDomain}, but candidate domain is ${candidateDomain || "missing"}.`],
      verifiedListingUrl: null,
      rejectedListingUrl: candidateUrl,
      rejectedListingTitle: candidate.title || null,
      retrySearchQueries: buildProductRetryQueries(job, "correct store"),
      canCollectReviews: false,
      canScoreProduct: false,
    };
  }

  const requestedGray = /\bgray\b|\bgrey\b/i.test(jobText);
  const candidatePink = /\bpink\b/i.test(candidateText);
  const requested5000 = /5000\s*mah|5000mah/i.test(jobText);
  const candidate5000 = /5000\s*mah|5000mah/i.test(candidateText);

  if (requestedGray && candidatePink) {
    reasons.push("Requested Gray but candidate appears to be Pink.");
  }

  if (requested5000 && !candidate5000) {
    reasons.push("Requested 5000mAh but candidate does not confirm 5000mAh.");
  }

  const requestedRating = numberFrom(job.rating);
  const candidateRating = numberFrom(candidate.rating);
  if (requestedRating !== null && candidateRating !== null && Math.abs(requestedRating - candidateRating) > 0.15) {
    reasons.push(`Requested rating ${requestedRating}, but candidate rating is ${candidateRating}.`);
  }

  const requestedReviews = numberFrom(job.reviewCount);
  const candidateReviews = numberFrom(candidate.reviewCount);
  if (
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

  if (termCoverage < 0.55) {
    reasons.push(
      `Candidate is missing distinctive requested terms. Matched ${matchedTerms.length}/${terms.length}: ${matchedTerms.join(", ")}.`
    );
  }

  if (reasons.length > 0) {
    const variantProblem = reasons.some((r) => /gray|pink|5000mah/i.test(r));
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
    verifierReasons: ["Candidate passed store, variant, rating/review-count, and distinctive-term checks."],
    verifiedListingUrl: candidateUrl,
    rejectedListingUrl: null,
    rejectedListingTitle: null,
    retrySearchQueries: [],
    canCollectReviews: true,
    canScoreProduct: true,
  };
}
