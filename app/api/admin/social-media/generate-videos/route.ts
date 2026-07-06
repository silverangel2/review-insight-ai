import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

function cleanLimit(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 24;
  return Math.max(1, Math.min(100, Math.round(numeric)));
}

export async function POST(request: NextRequest) {
  const session = await adminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limit = cleanLimit(body.limit);
    const scriptPath = path.join(process.cwd(), "scripts", "generate-social-videos.mjs");

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [scriptPath, "--json", "--limit", String(limit)],
      {
        cwd: process.cwd(),
        env: process.env,
        maxBuffer: 1024 * 1024 * 10,
        timeout: 1000 * 60 * 8,
      }
    );

    const result = JSON.parse(stdout.trim() || "{}");

    return NextResponse.json({
      ok: Boolean(result.ok),
      result,
      warning: stderr?.trim() || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Codex social video generation failed.",
      },
      { status: 500 }
    );
  }
}
