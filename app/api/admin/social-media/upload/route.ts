import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";

export const runtime = "nodejs";

const allowedTypes: Record<string, { ext: string; mediaType: "image" | "video"; maxBytes: number }> = {
  "image/jpeg": { ext: "jpg", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/png": { ext: "png", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/webp": { ext: "webp", mediaType: "image", maxBytes: 8 * 1024 * 1024 },
  "image/gif": { ext: "gif", mediaType: "image", maxBytes: 10 * 1024 * 1024 },
  "video/mp4": { ext: "mp4", mediaType: "video", maxBytes: 60 * 1024 * 1024 },
  "video/webm": { ext: "webm", mediaType: "video", maxBytes: 60 * 1024 * 1024 },
  "video/quicktime": { ext: "mov", mediaType: "video", maxBytes: 60 * 1024 * 1024 },
};

async function requireAdmin(request: NextRequest) {
  const session = await adminSessionFromRequest(request);
  return Boolean(session);
}

function cleanBaseName(name: string) {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 36);
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Upload a photo or video file." }, { status: 400 });
    }

    const config = allowedTypes[file.type];
    if (!config) {
      return NextResponse.json(
        { ok: false, error: "Use JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV media." },
        { status: 400 }
      );
    }

    if (file.size > config.maxBytes) {
      return NextResponse.json(
        { ok: false, error: config.mediaType === "image" ? "Images must be 8 MB or smaller." : "Videos must be 60 MB or smaller." },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "social");
    await mkdir(uploadDir, { recursive: true });

    const base = cleanBaseName(file.name) || "reviewintel-social";
    const filename = `${base}-${randomUUID()}.${config.ext}`;
    const destination = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());

    await writeFile(destination, buffer);

    const url = `/uploads/social/${filename}`;

    return NextResponse.json({
      ok: true,
      url,
      thumbnailUrl: config.mediaType === "image" ? url : "",
      mediaType: config.mediaType,
      title: file.name.replace(/\.[a-z0-9]+$/i, ""),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Social media upload failed." },
      { status: 500 }
    );
  }
}
