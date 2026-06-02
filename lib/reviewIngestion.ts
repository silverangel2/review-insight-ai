import type { AnalyzeRequest, ReviewIngestionMode, ReviewTextSection } from "@/lib/types";

export const MAX_BULK_REVIEW_CHARS = 120000;
export const MAX_MODEL_REVIEW_CHARS = 60000;
export const REVIEW_CHUNK_CHARS = 12000;
export const MAX_TEXT_UPLOAD_BYTES = 350000;

export type ReviewConfidenceLabel = "Low" | "Medium" | "High";
export type RatingBreakdown = Record<"1" | "2" | "3" | "4" | "5", number>;

const EMPTY_RATING_BREAKDOWN: RatingBreakdown = {
  "1": 0,
  "2": 0,
  "3": 0,
  "4": 0,
  "5": 0
};

export const REVIEW_INGESTION_METHODS: Array<{
  key: ReviewIngestionMode;
  label: string;
  availability: "live" | "planned";
  summary: string;
}> = [
  {
    key: "deep_paste",
    label: "Deep Analysis = Paste Reviews",
    availability: "live",
    summary: "Bulk pasted reviews, multiple text sections, TXT uploads, and power-user batches."
  },
  {
    key: "quick_screenshot",
    label: "Quick Scan Beta = Screenshot Upload",
    availability: "live",
    summary: "Fast shopper checks from mobile screenshots or small visible review samples."
  },
  {
    key: "mixed_upload",
    label: "Mixed Evidence",
    availability: "live",
    summary: "Combines pasted review batches with screenshot evidence for stronger context."
  },
  {
    key: "future_url_import",
    label: "Product URL Import",
    availability: "planned",
    summary: "Reserved for compliant URL imports, marketplace APIs, and approved connectors."
  },
  {
    key: "future_connector",
    label: "Ecommerce Connectors",
    availability: "planned",
    summary: "Future integrations for seller-owned stores, APIs, CSV feeds, and review platforms."
  }
];

export function normalizeReviewSections(sections: ReviewTextSection[] | undefined) {
  return (sections ?? [])
    .map((section, index) => ({
      id: section.id || `section-${index + 1}`,
      title: section.title?.trim() || `Review batch ${index + 1}`,
      text: section.text?.trim() ?? "",
      source: section.source,
      size: section.size
    }))
    .filter((section) => section.text.length > 0);
}

function emptyRatingBreakdown(): RatingBreakdown {
  return { ...EMPTY_RATING_BREAKDOWN };
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((item) => item.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((item) => item.length > 0)) rows.push(row);
  return rows;
}

function normalizeReviewText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b(?:verified purchase|verified buyer|vine customer review|helpful votes?|report abuse)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyMetadata(value: string) {
  const clean = value.trim().toLowerCase();
  if (!clean) return true;
  if (/^(rating|stars?|score|review|reviews?|review text|review body|comment|comments?|feedback|body|content|title|headline|subject|date|review date|created at|updated at|user|username|reviewer|customer|customer id|profile name|asin|sku|product|product id|product name|variant|size|color|verified|verified purchase|verified buyer|helpful|helpful votes?|country|marketplace|order id)$/i.test(clean)) return true;
  if (/^[,|\-_\s]+$/.test(clean)) return true;
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(clean)) return true;
  if (/^(yes|no|true|false|null|n\/a|na)$/i.test(clean)) return true;
  if (/^[\d\s.,$%:/#-]+$/.test(clean) && clean.length < 28) return true;
  return clean.length < 18;
}

function normalizeDedupKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function ratingFromText(value: string) {
  const match =
    value.match(/\b([1-5])(?:\.\d)?\s*(?:\/\s*5|stars?|star rating)\b/i) ??
    value.match(/\brating\s*[:=-]?\s*([1-5])(?:\.\d)?\b/i) ??
    value.match(/^\s*([1-5])(?:\.\d)?\s*$/);
  return match?.[1] as keyof RatingBreakdown | undefined;
}

function bestColumnIndex(headers: string[], patterns: RegExp[]) {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}

function bestReviewCell(row: string[], preferredIndex: number) {
  if (preferredIndex >= 0 && row[preferredIndex]) {
    const preferred = normalizeReviewText(row[preferredIndex]);
    if (!isLikelyMetadata(preferred) && !ratingFromText(preferred)) return preferred;
  }

  return [...row]
    .map((value) => normalizeReviewText(value))
    .filter((value) => !isLikelyMetadata(value) && !ratingFromText(value))
    .sort((left, right) => right.length - left.length)[0] ?? "";
}

export function extractValidReviewsFromCsv(csv: string) {
  const rows = parseCsvRows(csv);
  const headers = (rows[0] ?? []).map((header) => header.trim().toLowerCase());
  const hasHeader = headers.some((header) => /(review|comment|feedback|body|content|rating|stars?|score|title)/i.test(header));
  const reviewColumn = hasHeader
    ? bestColumnIndex(headers, [/review.*text/, /review/, /comment/, /feedback/, /body/, /content/, /^text$/])
    : -1;
  const ratingColumn = hasHeader ? bestColumnIndex(headers, [/rating/, /stars?/, /score/]) : -1;
  const titleColumn = hasHeader ? bestColumnIndex(headers, [/title/, /headline/, /subject/]) : -1;
  const breakdown = emptyRatingBreakdown();
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const row of rows.slice(hasHeader ? 1 : 0)) {
    const text = normalizeReviewText(bestReviewCell(row, reviewColumn));
    if (isLikelyMetadata(text)) continue;

    const dedupKey = normalizeDedupKey(text);
    if (!dedupKey || seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const title = titleColumn >= 0 ? normalizeReviewText(row[titleColumn] ?? "") : "";
    const rating = ratingFromText(ratingColumn >= 0 ? row[ratingColumn] ?? "" : "") ?? ratingFromText(row.join(" "));
    if (rating) breakdown[rating] += 1;

    const prefix = [`Review ${lines.length + 1}:`];
    if (rating) prefix.push(`Rating: ${rating}/5`);
    if (title && !isLikelyMetadata(title) && normalizeDedupKey(title) !== dedupKey) prefix.push(`Title: ${title}`);
    lines.push(`${prefix.join(" | ")} | ${text}`);
  }

  return {
    text: lines.join("\n"),
    validReviewCount: lines.length,
    ratingBreakdown: breakdown
  };
}

export function normalizeUploadedReviewText(fileName: string, text: string) {
  if (fileName.toLowerCase().endsWith(".csv")) {
    return extractValidReviewsFromCsv(text);
  }

  const clean = text.trim();
  return {
    text: clean,
    validReviewCount: 0,
    ratingBreakdown: ratingBreakdownFromText(clean)
  };
}

export function ratingBreakdownFromText(text: string) {
  const breakdown = emptyRatingBreakdown();
  const matches = text.matchAll(/\b(?:rating\s*[:=-]?\s*)?([1-5])(?:\.\d)?\s*(?:\/\s*5|stars?)\b/gi);

  for (const match of matches) {
    const rating = match[1] as keyof RatingBreakdown;
    breakdown[rating] += 1;
  }

  return breakdown;
}

export function reviewEvidenceFromText(text: string) {
  const clean = text.trim();
  const empty = {
    text: clean,
    validReviewCount: 0,
    ratingBreakdown: ratingBreakdownFromText(clean)
  };

  if (!clean) return empty;

  const rows = parseCsvRows(clean);
  const firstRow = rows[0] ?? [];
  const headerLike = firstRow.some((cell) => /(rating|stars?|score|review|comment|feedback|body|content|title|headline)/i.test(cell));

  if (rows.length > 1 && headerLike) {
    const csvEvidence = extractValidReviewsFromCsv(clean);
    if (csvEvidence.validReviewCount > 0) return csvEvidence;
  }

  const breakdown = ratingBreakdownFromText(clean);
  const explicitReviewLines = clean
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /^review\s+\d+\s*:/i.test(line))
    .map((line) => normalizeReviewText(line.replace(/^review\s+\d+\s*:\s*/i, "")))
    .filter((line) => !isLikelyMetadata(line));

  if (explicitReviewLines.length > 0) {
    return {
      text: clean,
      validReviewCount: new Set(explicitReviewLines.map(normalizeDedupKey)).size,
      ratingBreakdown: breakdown
    };
  }

  const countableLines = clean
    .split(/\n+/)
    .map((line) => normalizeReviewText(line.replace(/^#+\s*/, "")))
    .filter((line) => !isLikelyMetadata(line))
    .filter((line) => line.length > 28 || ratingFromText(line));
  const uniqueLines = new Set(countableLines.map(normalizeDedupKey).filter((line) => line.length > 20));
  const explicitRatingCount = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const blockCount = clean
    .split(/\n\s*\n+/)
    .map((block) => normalizeReviewText(block))
    .filter((block) => !isLikelyMetadata(block) && block.length > 45).length;

  return {
    text: clean,
    validReviewCount: Math.max(uniqueLines.size, explicitRatingCount, blockCount),
    ratingBreakdown: breakdown
  };
}

export function combineReviewSections(sections: ReviewTextSection[] | undefined) {
  const normalized = normalizeReviewSections(sections);
  return normalized
    .map((section, index) => `### ${section.title || `Review batch ${index + 1}`}\n${section.text}`)
    .join("\n\n");
}

export function inferIngestionMode(input: AnalyzeRequest, reviews: string): ReviewIngestionMode {
  if (input.ingestionMode) return input.ingestionMode;

  const imageCount = input.images?.length ?? 0;
  const sectionCount = normalizeReviewSections(input.reviewSections).length;

  if (reviews && imageCount > 0) return "mixed_upload";
  if (imageCount > 0) return "quick_screenshot";
  if (input.productUrl?.trim()) return "future_url_import";
  if (sectionCount > 1 || reviews.length > 5000) return "deep_paste";
  return "deep_paste";
}

export function ingestionLabel(mode: ReviewIngestionMode) {
  return REVIEW_INGESTION_METHODS.find((method) => method.key === mode)?.label ?? "Deep Analysis = Paste Reviews";
}

export function confidenceFromReviewCount(reviewCount: number): {
  label: ReviewConfidenceLabel;
  score: number;
  detail: string;
} {
  if (reviewCount < 10) {
    return {
      label: "Low",
      score: 0.35,
      detail: "Low confidence: fewer than 10 reviews were supplied."
    };
  }

  if (reviewCount < 50) {
    return {
      label: "Medium",
      score: 0.65,
      detail: "Medium confidence: 10-50 reviews were supplied."
    };
  }

  return {
    label: "High",
    score: 0.88,
    detail: "High confidence: 50+ reviews were supplied."
  };
}

export function normalizeConfidenceScore(currentScore: number | undefined, reviewCount: number) {
  const evidence = confidenceFromReviewCount(reviewCount);
  const current = Number.isFinite(currentScore) ? Number(currentScore) : evidence.score;

  if (evidence.label === "Low") return Math.min(0.39, Math.max(0.2, current));
  if (evidence.label === "Medium") return Math.min(0.74, Math.max(0.45, current));
  return Math.min(0.98, Math.max(0.75, current));
}

export function chunkReviewText(text: string, chunkSize = REVIEW_CHUNK_CHARS) {
  const clean = text.trim();
  if (!clean) return [];

  const lines = clean.split(/\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > chunkSize && current) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function prepareReviewTextForModel(text: string) {
  const clean = text.trim();
  if (clean.length <= MAX_MODEL_REVIEW_CHARS) {
    return {
      text: clean,
      wasChunked: false,
      chunkCount: clean ? 1 : 0,
      originalChars: clean.length,
      modelChars: clean.length
    };
  }

  const chunks = chunkReviewText(clean);
  const perChunkBudget = Math.max(1400, Math.floor((MAX_MODEL_REVIEW_CHARS - chunks.length * 80) / Math.max(1, chunks.length)));
  const sampled = chunks.map((chunk, index) => {
    const body = chunk.length > perChunkBudget ? `${chunk.slice(0, perChunkBudget)}\n[Chunk trimmed for model stability.]` : chunk;
    return `--- REVIEW CHUNK ${index + 1} OF ${chunks.length} ---\n${body}`;
  });
  const prepared = sampled.join("\n\n").slice(0, MAX_MODEL_REVIEW_CHARS);

  return {
    text: prepared,
    wasChunked: true,
    chunkCount: chunks.length,
    originalChars: clean.length,
    modelChars: prepared.length
  };
}
