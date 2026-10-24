import { cleanQuoteText, deriveShopperAnswer, type ShopperPoint } from "@/lib/shopperAnswer";
import { gradeCitedFindings } from "@/lib/sophieContributions";

/**
 * Server-only Sophie grade for a finished scan. The shopper client never
 * imports this module: it only reads sophieGradedFindings already stored on
 * the result. The buying-score verdict is not replaced. A finding Sophie
 * cannot cite is dropped — never replaced with a generic sentence.
 */

function reviewBodies(result: Record<string, unknown>): Array<{ body: string; sourceUrl: unknown }> {
  const evidence = result.reviewEvidence;
  const record = evidence && typeof evidence === "object" ? evidence as Record<string, unknown> : {};
  const adjudication = record.evidenceAdjudication;
  const ledger = adjudication && typeof adjudication === "object" ? adjudication as Record<string, unknown> : {};
  const accepted = Array.isArray(ledger.acceptedRecords) ? ledger.acceptedRecords : [];
  return accepted.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const review = item as Record<string, unknown>;
    const body = cleanQuoteText(String(review.body || ""));
    if (!body) return [];
    return [{ body, sourceUrl: review.sourceUrl }];
  });
}

function gradedLines(points: ShopperPoint[], accepted: Set<string>): Array<string | null> {
  return points.map((point) => (point.finding && accepted.has(point.finding) ? point.finding : null));
}

export function attachSophieShopperGrade<T extends Record<string, unknown>>(result: T): T {
  try {
    const answer = deriveShopperAnswer(result);
    const verdict = answer.kind === "buy" ? "Buy" : answer.kind === "skip" ? "Skip" : answer.kind === "wait" ? "Wait" : null;
    if (!verdict) return result;
    const findings = [...answer.loves, ...answer.complaints].flatMap((point) => {
      const quote = String(point.quote || "").replace(/…$/, "").trim().slice(0, 500);
      if (!point.finding || !quote) return [];
      return [{ claim: point.finding, quote }];
    });
    if (!findings.length) return result;
    const graded = gradeCitedFindings({
      productKey: String(result.libraryProductKey || result.productKey || "scan"),
      reviews: reviewBodies(result),
      verdict,
      findings,
    });
    if (!graded.ok || graded.verdict !== verdict) return result;
    const accepted = new Set(graded.claims);
    return {
      ...result,
      sophieGradedFindings: {
        verdict,
        loves: gradedLines(answer.loves, accepted),
        complaints: gradedLines(answer.complaints, accepted),
      },
    };
  } catch {
    return result;
  }
}
