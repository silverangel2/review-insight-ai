import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { ingestOwnerFeedBatchLive, parseOwnerFeedBatch } from "@/lib/ownerFeedIngest";
import { keeperRegistrationEvent } from "@/lib/riKeeperLedger";

function requireAdmin(request: Request) {
  const session = adminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "admin required" }, { status: 403 });
  }
  return null;
}

/**
 * POST /api/admin/owner-feed-ingest
 * Admin-only. Ingests one Owner-Feed batch file (.md, the structured format
 * from ~/workspace/review-library-inbox/) into product_review_library.
 *
 * Body: { "batchText": "<full batch file text>" }
 * Idempotent: re-ingesting the same batch adds nothing (body-key dedupe);
 * merges with any scan-collected corpus already stored for the product key.
 * Ingestion does not change scan_count.
 *
 * Keeper wiring (additive): on success, the batch is registered to the ops
 * ledger (keeper.batch_registered) with the stored batch text, so the RI
 * Keeper can reconcile "fed but not ingested" and self-repair future
 * batches. The registration write is fail-soft and never blocks the
 * response.
 */
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body: { batchText?: unknown };
  try {
    body = (await request.json()) as { batchText?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "request body must be JSON" }, { status: 400 });
  }
  const batchText = typeof body?.batchText === "string" ? body.batchText : "";
  if (!batchText.trim()) {
    return NextResponse.json({ ok: false, error: "batchText is required" }, { status: 400 });
  }
  try {
    const receipt = await ingestOwnerFeedBatchLive(batchText);
    // Register for keeper reconciliation (fail-soft).
    try {
      const batch = parseOwnerFeedBatch(batchText);
      const batchId = `owner-feed-${batch.productId.toLowerCase()}-${batch.receivedAt.slice(0, 10)}`;
      await keeperRegistrationEvent({
        batchId,
        batchLabel: `${batch.productTitle} owner-feed batch (${batch.receivedAt.slice(0, 10)})`,
        productKey: receipt.productKey,
        expectedIngested: receipt.ingested,
        declaredCount: receipt.parsed,
        skippedShortBodies: receipt.skippedShortBodies.length,
        batchText,
      });
    } catch {
      // Registration failure must never fail the ingest.
    }
    return NextResponse.json(receipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
