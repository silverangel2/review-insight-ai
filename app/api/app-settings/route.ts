import { NextResponse } from "next/server";
import { canManageAppSettings, getRuntimeAppSettings, updateRuntimeAppSettings, type RuntimeAppSettings } from "@/lib/appSettings";
import { accountFromRequest } from "@/lib/supabaseServer";

const allowedKeys: Array<keyof RuntimeAppSettings> = [
  "maintenance_mode",
  "allow_new_signups",
  "ai_enabled",
  "payments_enabled",
  "sponsored_section_enabled",
  "announcement_enabled",
  "announcement_text",
  "stripe_sandbox_mode"
];

function sanitizeSettings(input: unknown) {
  const source = input as Partial<RuntimeAppSettings>;
  const next: Partial<RuntimeAppSettings> = {};

  for (const key of allowedKeys) {
    if (!(key in source)) continue;
    const value = source[key];
    if (key === "announcement_text") {
      next.announcement_text = typeof value === "string" ? value.slice(0, 240) : "";
    } else if (typeof value === "boolean") {
      next[key] = value;
    }
  }

  return next;
}

export async function GET() {
  return NextResponse.json({ settings: getRuntimeAppSettings() });
}

export async function PATCH(request: Request) {
  const account = await accountFromRequest(request);
  if (!account || !canManageAppSettings(account)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  return NextResponse.json({ settings: updateRuntimeAppSettings(sanitizeSettings(body)) });
}
