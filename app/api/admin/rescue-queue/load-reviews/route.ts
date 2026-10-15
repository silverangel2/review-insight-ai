import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { libraryProductKeyFor } from "@/lib/productReviewLibrary";
import { getRescueQueueRow, updateRescueQueueRow } from "@/lib/rescueQueue";
import { parseOwnerPastedReviews, saveRescueReviewsToLibrary } from "@/lib/rescueReviews";

export const runtime = "nodejs";

/**
 * Owner pastes the reviews they researched for a queue item. The paste is
 * parsed into library records and consolidated into the product library
 * (load-merge-save — never wipes existing corpus). The queue row moves to
 * "rescued". Fail-soft JSON on every error.
 */
export async function POST(request: Request) {
  if (!adminSessionFromRequest(request)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const row = await getRescueQueueRow(id);
    if (!row) return NextResponse.json({ error: "Rescue item not found." }, { status: 404 });

    const text = String(body?.text ?? "");
    if (!text.trim()) return NextResponse.json({ error: "No review text provided." }, { status: 400 });

    const productUrl = row.product_url;
    const productKey =
      row.product_key ||
      (productUrl ? libraryProductKeyFor({ listingUrl: productUrl }) : null);
    if (!productKey) {
      return NextResponse.json(
        { error: "No product identity to save these reviews under. Add a product link first." },
        { status: 400 }
      );
    }

    let marketplace: string | null = null;
    if (productUrl) {
      try {
        marketplace = new URL(productUrl).hostname.toLowerCase().replace(/^www\./, "") || null;
      } catch {
        marketplace = null;
      }
    }

    const records = parseOwnerPastedReviews(text, { productUrl, marketplace });
    if (!records.length) {
      return NextResponse.json(
        { error: "Nothing readable in that paste. One review per paragraph, at least a sentence each." },
        { status: 400 }
      );
    }

    const { saved } = await saveRescueReviewsToLibrary({
      productKey,
      productUrl,
      productName: row.product_name,
      records,
    });

    const now = new Date().toISOString();
    await updateRescueQueueRow(id, {
      status: "rescued",
      productKey,
      rescuedAt: now,
    });

    return NextResponse.json({ ok: true, saved, productKey, parsed: records.length });
  } catch {
    return NextResponse.json({ error: "Could not save those reviews." }, { status: 500 });
  }
}
