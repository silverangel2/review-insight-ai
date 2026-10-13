import { NextRequest, NextResponse } from "next/server";
import { collectAndAnalyzeReviewEvidence } from "@/lib/reviewEvidence";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const productName = String(body.productName || body.name || "").trim();
    const brand = body.brand ? String(body.brand).trim() : undefined;
    const model = body.model ? String(body.model).trim() : undefined;

    if (!productName) {
      return NextResponse.json(
        { error: "Missing productName" },
        { status: 400 }
      );
    }

    const evidence = await collectAndAnalyzeReviewEvidence({
      productName,
      brand,
      model,
      store: body.store ? String(body.store).trim() : undefined,
      price: body.price ?? undefined,
      rating: body.rating ?? undefined,
      reviewCount: body.reviewCount ?? undefined,
    });

    return NextResponse.json({ ok: true, evidence });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Review evidence scan failed",
      },
      { status: 500 }
    );
  }
}
