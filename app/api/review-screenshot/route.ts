import { NextResponse } from "next/server";
import { ocrReviewScreenshot, adjudicateScreenshotReviews } from "@/lib/reviewScreenshotOcr";

export const runtime = "nodejs";
const MAX_FILES = 6;
const MAX_BYTES = 8 * 1024 * 1024;

/** Local OCR hook: returns adjudicated candidate reviews; never scores or persists. */
export async function POST(request: Request) {
  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: "expected multipart/form-data with productName and screenshot files" }, { status: 400 });
  }
  const productName = String(form.get("productName") || "").trim();
  if (!productName) return NextResponse.json({ error: "productName is required" }, { status: 400 });
  const files = form.getAll("screenshots").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f).slice(0, MAX_FILES);
  if (!files.length) return NextResponse.json({ error: "no screenshots" }, { status: 400 });
  const results = [];
  for (const file of files) {
    if (file.size > MAX_BYTES || !/^image\/(png|jpeg|webp)$/.test(file.type)) { results.push({ name: file.name, error: "unsupported image" }); continue; }
    const ocr = await ocrReviewScreenshot(Buffer.from(await file.arrayBuffer()));
    const out = adjudicateScreenshotReviews(ocr, { productName, brand: String(form.get("brand") || "") || null, model: String(form.get("model") || "") || null, exactListingUrl: String(form.get("listingUrl") || "") || null });
    results.push({ name: file.name, fileSha256: ocr.fileSha256, ocrConfidence: ocr.ocrConfidence, titleVerified: out.titleVerified, droppedLowConfidence: out.droppedLowConfidence, accepted: out.corpus.acceptedRecords.map(r => ({ body: r.body, hash: r.stableEvidenceHash })), rejected: out.corpus.rejectedRecords.map(r => r.rejectionReason) });
  }
  return NextResponse.json({ source: "user_screenshot", results });
}
