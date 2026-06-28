import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";

const allowedTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"]
]);

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload an SEO image file." }, { status: 400 });
  }

  const extension = allowedTypes.get(file.type);
  if (!extension) {
    return NextResponse.json({ error: "Use PNG, JPG, WEBP, or GIF." }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Keep SEO images under 2 MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadDir = join(process.cwd(), "public", "uploads", "seo");
  const filename = `seo-${Date.now()}-${randomUUID()}.${extension}`;

  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, filename), bytes);

  return NextResponse.json({
    ok: true,
    url: `/uploads/seo/${filename}`
  });
}
