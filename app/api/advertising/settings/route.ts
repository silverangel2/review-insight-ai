import { NextResponse } from "next/server";
import { readAdSettings, writeAdSettings } from "@/lib/adSettingsStore";

export async function GET(): Promise<Response> {
  const settings = await readAdSettings();

  return NextResponse.json({ settings });
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const settings = await writeAdSettings(body);

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not update ad settings.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
