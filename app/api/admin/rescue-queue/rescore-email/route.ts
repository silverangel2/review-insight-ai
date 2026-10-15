import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { sendReviewIntelEmail } from "@/lib/emailDelivery";
import { buildRescueEmail, RESCUE_EMAIL_TYPE } from "@/lib/rescueEmail";
import { getRescueQueueRow, updateRescueQueueRow } from "@/lib/rescueQueue";
import { rescoreFromLibrary } from "@/lib/rescueRescore";

export const runtime = "nodejs";

/**
 * Rescore a rescued product from its library corpus and email the customer
 * their verdict. Guests (no account email) are scored but not emailed.
 * Fail-soft JSON on every error.
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
    if (!row.product_key) {
      return NextResponse.json(
        { error: "No product identity yet. Save the owner's reviews first." },
        { status: 400 }
      );
    }

    const rescore = await rescoreFromLibrary(row.product_key);
    if (!rescore) {
      return NextResponse.json(
        { error: "No reviews in the library for this product yet. Paste the researched reviews first." },
        { status: 400 }
      );
    }

    await updateRescueQueueRow(id, {
      status: "rescued",
      verdict: rescore.verdict,
      buyingScore: rescore.buyingScore,
    });

    let emailSent = false;
    let emailSkipped: string | null = null;
    if (row.account_email) {
      const email = buildRescueEmail({
        productName: row.product_name || "the product you scanned",
        verdict: rescore.verdict,
        buyingScore: rescore.buyingScore,
        confidence: rescore.confidence,
        quotes: rescore.quotes,
        reviewCount: rescore.reviewCount,
      });
      const sent = await sendReviewIntelEmail({
        emailType: RESCUE_EMAIL_TYPE,
        to: row.account_email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        metadata: { scan_ref: row.scan_ref, product_key: row.product_key },
      }).catch(() => null);
      emailSent = Boolean(sent && (sent as { ok?: boolean }).ok);
      if (emailSent) {
        await updateRescueQueueRow(id, {
          status: "emailed",
          emailedAt: new Date().toISOString(),
        });
      } else {
        emailSkipped = "The email could not be sent. The verdict is saved and the item stays rescued.";
      }
    } else {
      emailSkipped = "Guest scan — no email on file. The verdict is saved for the next shopper.";
    }

    return NextResponse.json({
      ok: true,
      verdict: rescore.verdict,
      buyingScore: rescore.buyingScore,
      confidence: rescore.confidence,
      reviewCount: rescore.reviewCount,
      quotes: rescore.quotes,
      emailSent,
      emailSkipped,
    });
  } catch {
    return NextResponse.json({ error: "Could not rescore this product." }, { status: 500 });
  }
}
