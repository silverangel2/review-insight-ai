import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(process.cwd(), { alias: { "@": process.cwd() }, cache: false });

// Expose private pure result functions in memory only; never invoke POST,
// provider discovery, storage or a new scan.
export function loadResultAuditFunctions() {
  const filename = resolve("app/api/analyze/route.ts");
  return jiti.evalModule(readFileSync(filename, "utf8") +
    "\nexport { buildReviewEvidenceShopperResult, computeVerdictConfidenceAudit };\n", { filename, ext: ".ts" });
}

export function auditCapturedResult(capturePath) {
  const bytes = readFileSync(capturePath);
  const capture = JSON.parse(bytes);
  const adjudication = capture.events.filter(event => event.stage === "adjudication").sort((a,b) => b.data.args[0].length - a.data.args[0].length)[0];
  const evaluation = capture.events.find(event => event.stage === "evaluation");
  if (!adjudication || !evaluation) throw new Error("Capture lacks written evidence/evaluation inputs");
  const { adjudicateReviewEvidence } = jiti("./lib/reviewEvidenceAdjudication.ts");
  const { deriveDeterministicEvidenceResult } = jiti("./lib/reviewEvidenceDeterminism.ts");
  const corpus = adjudicateReviewEvidence(...adjudication.data.args);
  const metadata = evaluation.data.args[0];
  const deterministic = deriveDeterministicEvidenceResult({ ...metadata, acceptedRecords: corpus.acceptedRecords });
  const identity = capture.events.find(event => event.stage === "identity").data;
  const options = adjudication.data.args[1];
  const { buildReviewEvidenceShopperResult } = loadResultAuditFunctions();
  const input = {
    scanId: capture.scanId || capture.metadata?.scanId || capturePath.match(/(scan_[a-f0-9-]+)\.json/)?.[1],
    vision: { ...identity, name: identity.productName },
    reviewEvidence: {
      exactListingAccepted: options.exactListingAccepted,
      collectorSourceAccepted: true,
      listingEvidence: {
        exactListingUrl: options.exactListingUrl,
        exactListingTitle: options.exactListingTitle,
        brand: options.brand, store: identity.store,
        rating: metadata.rating, reviewCount: metadata.marketplaceReviewCount,
        price: metadata.price,
        asin: metadata.verifiedProductMetadata?.asin,
      },
      rating: metadata.rating,
      marketplaceReviewCount: metadata.marketplaceReviewCount,
      reviewsFound: metadata.marketplaceReviewCount,
      reviewsCollected: corpus.acceptedRecordCount,
      commentsAnalyzed: corpus.acceptedRecordCount,
      evidenceAdjudication: corpus,
      // These are reconstructed canonical labels, not historical AI themes.
      productPros: deterministic.strengths.map(claim => claim.claim),
      productCons: deterministic.complaints.map(claim => claim.claim),
    },
    reviewAuthenticity: { score: null, suspiciousReviewRisk: "Not scored" },
  };
  const result = buildReviewEvidenceShopperResult(input);
  return {
    kind: "CURRENT_CODE_OFFLINE_REANALYSIS_WITH_RECONSTRUCTED_RESULT_ENVELOPE",
    capturePath, captureSha256: createHash("sha256").update(bytes).digest("hex"),
    limitations: "Captured review and identity inputs; reconstructed result envelope. Does not mutate or verify current persisted rows or a physical browser session.",
    input, result, deterministic,
    rejected: corpus.rejectedRecords.map(record => ({ hash: record.stableEvidenceHash, reason: record.rejectionReason })),
    usage: { networkCalls: 0, providerCalls: 0, firecrawlCalls: 0, newScans: 0 },
  };
}

// Compatibility export for the earlier regression harness.
export const auditRingConnCapture = auditCapturedResult;
