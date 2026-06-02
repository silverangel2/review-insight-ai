import { NextResponse } from "next/server";
import { getRuntimeAppSettings } from "@/lib/appSettings";
import { googleAuthUrl } from "@/lib/supabaseAuth";

export async function GET() {
  const appSettings = getRuntimeAppSettings();

  if (appSettings.maintenance_mode) {
    return NextResponse.json({ error: appSettings.announcement_text || "ReviewIntel is temporarily updating. Please check back shortly." }, { status: 503 });
  }

  if (!appSettings.allow_new_signups) {
    return NextResponse.json({ error: "New signups are temporarily closed." }, { status: 503 });
  }

  const url = googleAuthUrl();
  if (!url) {
    return NextResponse.json({
      message: "Google login is ready after NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are configured."
    });
  }

  return NextResponse.json({ url });
}
