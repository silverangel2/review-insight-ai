import fs from "node:fs";
import path from "node:path";

const CAPTURE_DIR =
  process.env.REVIEWINTEL_CAPTURE_DIR ||
  "/private/tmp/reviewintel-replay-captures";

fs.mkdirSync(CAPTURE_DIR, { recursive: true });

function jsonFiles() {
  return fs
    .readdirSync(CAPTURE_DIR)
    .filter((name) => name.endsWith(".json"));
}

const baseline = new Set(jsonFiles());
const monitorStartedAt = Date.now();

console.log("BLIND_MONITOR_VERSION=2");
console.log("BASELINE_CAPTURE_COUNT=" + baseline.size);
console.log("OLD_CAPTURES_IGNORED=YES");
console.log("PASSIVE_MONITOR_WAITING_FOR_NEW_SCAN=YES");

let activeFile = null;
let lastMtime = 0;

function findFirst(obj, names, seen = new Set()) {
  if (!obj || typeof obj !== "object") return undefined;
  if (seen.has(obj)) return undefined;
  seen.add(obj);

  if (!Array.isArray(obj)) {
    for (const name of names) {
      if (
        Object.prototype.hasOwnProperty.call(obj, name) &&
        obj[name] !== undefined &&
        obj[name] !== null
      ) {
        return obj[name];
      }
    }
  }

  const values = Array.isArray(obj) ? obj : Object.values(obj);

  for (const value of values) {
    if (value && typeof value === "object") {
      const found = findFirst(value, names, seen);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

function scalar(value) {
  if (value === undefined || value === null || value === "") return "UNKNOWN";
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.length;
    return "PRESENT";
  }
  return value;
}

function countValue(data, names) {
  const value = findFirst(data, names);

  if (Array.isArray(value)) return value.length;
  if (typeof value === "number") return value;

  return scalar(value);
}

function printCapture(data, file) {
  const scanId =
    findFirst(data, ["scanId", "scan_id"]) ||
    path.basename(file, ".json");

  const productName = findFirst(data, [
    "productName",
    "product_name",
    "resolvedProductName",
  ]);

  const asin = findFirst(data, [
    "asin",
    "ASIN",
    "productId",
    "product_id",
    "canonicalIdentifier",
  ]);

  const rawReviews = countValue(data, [
    "rawReviews",
    "rawReviewRecords",
    "rawReviewCandidates",
    "rawReviewsRetrieved",
  ]);

  const uniqueReviews = countValue(data, [
    "uniqueReviews",
    "dedupedReviews",
    "deduplicatedReviews",
  ]);

  const acceptedReviews = countValue(data, [
    "acceptedExactProductReviews",
    "acceptedReviews",
    "acceptedRecords",
  ]);

  const rejectedReviews = countValue(data, [
    "rejectedReviews",
    "rejectedRecords",
  ]);

  const corpusHash = findFirst(data, [
    "corpusHash",
    "acceptedCorpusHash",
  ]);

  const openAiCalls = findFirst(data, [
    "openAiCalls",
    "openAICalls",
  ]);

  const openAiTokens = findFirst(data, [
    "openAiTotalTokens",
    "openAITotalTokens",
    "totalOpenAiTokens",
  ]);

  const searchCalls = findFirst(data, [
    "searchProviderCalls",
    "searchCalls",
  ]);

  const firecrawlCalls = findFirst(data, [
    "firecrawlCalls",
    "firecrawl_calls",
  ]);

  const score = findFirst(data, [
    "buyScore",
    "score",
  ]);

  const verdict = findFirst(data, [
    "verdict",
    "finalVerdict",
  ]);

  const finalCompleted = findFirst(data, [
    "finalEvaluationCompleted",
    "evaluationCompleted",
  ]);

  const handoff = findFirst(data, [
    "analysisCorpusHandoff",
    "analysisReceivedAcceptedCorpus",
  ]);

  console.log("");
  console.log("===== LIVE BLIND SCAN =====");
  console.log("SCAN_ID=" + scalar(scanId));
  console.log("PRODUCT_NAME=" + scalar(productName));
  console.log("ASIN_OR_PRODUCT_ID=" + scalar(asin));
  console.log("RAW_REVIEWS=" + rawReviews);
  console.log("UNIQUE_REVIEWS=" + uniqueReviews);
  console.log("ACCEPTED_REVIEWS=" + acceptedReviews);
  console.log("REJECTED_REVIEWS=" + rejectedReviews);
  console.log("CORPUS_HASH=" + scalar(corpusHash));
  console.log("ANALYSIS_CORPUS_HANDOFF=" + scalar(handoff));
  console.log("OPENAI_CALLS=" + scalar(openAiCalls));
  console.log("OPENAI_TOTAL_TOKENS=" + scalar(openAiTokens));
  console.log("SEARCH_PROVIDER_CALLS=" + scalar(searchCalls));
  console.log("FIRECRAWL_CALLS=" + scalar(firecrawlCalls));
  console.log("BUY_SCORE=" + scalar(score));
  console.log("VERDICT=" + scalar(verdict));
  console.log("FINAL_EVALUATION_COMPLETED=" + scalar(finalCompleted));
  console.log("REPLAY_CAPTURE_SAVED=YES");
}

setInterval(() => {
  let files;

  try {
    files = jsonFiles();
  } catch {
    return;
  }

  if (!activeFile) {
    const candidates = files
      .filter((name) => !baseline.has(name))
      .map((name) => {
        const full = path.join(CAPTURE_DIR, name);
        try {
          return { full, stat: fs.statSync(full) };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter(({ stat }) => stat.mtimeMs >= monitorStartedAt)
      .sort((a, b) => a.stat.mtimeMs - b.stat.mtimeMs);

    if (candidates.length) {
      activeFile = candidates[0].full;
      console.log("");
      console.log("NEW_SCAN_CAPTURE_DETECTED=YES");
      console.log("ACTIVE_CAPTURE=" + path.basename(activeFile));
    }
  }

  if (!activeFile) return;

  try {
    const stat = fs.statSync(activeFile);
    if (stat.mtimeMs === lastMtime) return;

    lastMtime = stat.mtimeMs;

    const data = JSON.parse(fs.readFileSync(activeFile, "utf8"));
    printCapture(data, activeFile);
  } catch {
    // Capture can be briefly incomplete while the app is writing it.
  }
}, 500);
