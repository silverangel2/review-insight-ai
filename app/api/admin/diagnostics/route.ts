import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { getRuntimeAppSettings } from "@/lib/appSettings";
import { hasStripeEnv, hasSupabaseEnv } from "@/lib/env";
import { adminUsageSummary, hasSupabaseServiceEnv } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const appSettings = getRuntimeAppSettings();
  const openAiReady = Boolean(process.env.OPENAI_API_KEY);
  const stripeReady = hasStripeEnv();
  const supabaseReady = hasSupabaseEnv() && hasSupabaseServiceEnv();

  const usage = await adminUsageSummary();

  return NextResponse.json({
    mode: "developer",
    admin: {
      email: adminSession.email,
      expires_at: new Date(adminSession.exp * 1000).toISOString()
    },
    usage,
    services: {
      openai: openAiReady ? "configured" : "missing",
      stripe: stripeReady ? "configured" : "missing",
      supabase: supabaseReady ? "configured" : "missing",
      api: "online"
    },
    feature_flags: appSettings,
    route_access: {
      guest: "analyze only",
      shopper: "shopper dashboard",
      seller: "seller dashboard",
      admin: "all routes"
    },
    performance: {
      max_text_chars: 120000,
      max_upload_mb: 6,
      screenshot_mode: "compressed browser-side",
      large_batch_strategy: "chunked before model"
    },
    validation: {
      lint: "run locally after patch",
      typecheck: "run locally after patch",
      build: "run locally after patch",
      smoke: "browser route check after patch"
    }
  });
}
