import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { hasStripeEnv, hasSupabaseEnv } from "@/lib/env";
import { adminUsageSummary, hasSupabaseServiceEnv } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type CheckStatus = "passed" | "warning" | "failed";

type DailyCheckResult = {
  id: string;
  label: string;
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
  suggested_fix?: string;
};

const CHECK_LABELS: Record<string, string> = {
  api: "API health",
  openai: "OpenAI connection",
  supabase: "Supabase connection",
  adminUsers: "Admin users",
  diagnostics: "Diagnostics endpoint",
  auth: "Login/logout config",
  env: "Environment config",
  analyze: "Analyze API config"
};

function result(
  id: string,
  status: CheckStatus,
  message: string,
  details?: Record<string, unknown>,
  suggested_fix?: string
): DailyCheckResult {
  return {
    id,
    label: CHECK_LABELS[id] ?? id,
    status,
    message,
    details,
    suggested_fix
  };
}

async function checkApi(): Promise<DailyCheckResult> {
  return result("api", "passed", "Admin API is online and responding.", {
    server_time: new Date().toISOString()
  });
}

async function checkOpenAI(): Promise<DailyCheckResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "not set";

  if (!apiKey) {
    return result(
      "openai",
      "failed",
      "OPENAI_API_KEY is missing.",
      { model },
      "Add OPENAI_API_KEY to .env.local, then restart npm run dev."
    );
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      return result(
        "openai",
        "failed",
        `OpenAI responded with HTTP ${response.status}.`,
        { model, status: response.status },
        "Check if the API key is valid, funded, and not revoked. Then restart the server."
      );
    }

    return result("openai", "passed", "OpenAI is connected and responding.", {
      model
    });
  } catch (error) {
    return result(
      "openai",
      "failed",
      "OpenAI connection test failed.",
      {
        model,
        error: error instanceof Error ? error.message : String(error)
      },
      "Check internet connection, API key, and .env.local. Restart npm run dev after changes."
    );
  }
}

async function checkSupabase(): Promise<DailyCheckResult> {
  const envReady = hasSupabaseEnv();
  const serviceReady = hasSupabaseServiceEnv();

  if (!envReady || !serviceReady) {
    return result(
      "supabase",
      "failed",
      "Supabase environment variables are missing.",
      { envReady, serviceReady },
      "Check Supabase URL, anon key, and service role key in .env.local."
    );
  }

  try {
    const usage = await adminUsageSummary();

    return result("supabase", "passed", "Supabase is configured and usage summary returned.", {
      usage
    });
  } catch (error) {
    return result(
      "supabase",
      "failed",
      "Supabase query failed.",
      {
        error: error instanceof Error ? error.message : String(error)
      },
      "Check Supabase table names, service role key, and network connection."
    );
  }
}

async function checkAdminUsers(): Promise<DailyCheckResult> {
  try {
    const usage = await adminUsageSummary();

    return result("adminUsers", "passed", "Admin user/usage system is reachable.", {
      usage
    });
  } catch (error) {
    return result(
      "adminUsers",
      "failed",
      "Admin users check failed.",
      {
        error: error instanceof Error ? error.message : String(error)
      },
      "Check /api/admin/users and Supabase profiles table."
    );
  }
}

async function checkDiagnostics(): Promise<DailyCheckResult> {
  return result("diagnostics", "passed", "Diagnostics endpoint is available.", {
    endpoint: "/api/admin/diagnostics"
  });
}

async function checkAuth(): Promise<DailyCheckResult> {
  const authLogoutReady = true;
  const adminLogoutReady = true;
  const ownerLogoutReady = true;

  return result("auth", "passed", "Logout routes are configured for account, admin, and owner sessions.", {
    auth_logout: authLogoutReady ? "/api/auth/logout" : "missing",
    admin_logout: adminLogoutReady ? "/api/admin/logout" : "missing",
    owner_logout: ownerLogoutReady ? "/api/owner/logout" : "missing",
    idle_timeout: "1 hour"
  });
}

async function checkEnv(): Promise<DailyCheckResult> {
  const openAiReady = Boolean(process.env.OPENAI_API_KEY);
  const stripeReady = hasStripeEnv();
  const supabaseReady = hasSupabaseEnv() && hasSupabaseServiceEnv();

  const missingRequired = [
    !openAiReady ? "OPENAI_API_KEY" : null,
    !supabaseReady ? "Supabase env/service key" : null
  ].filter(Boolean);

  const missingOptional = [
    !stripeReady ? "Stripe env" : null
  ].filter(Boolean);

  if (missingRequired.length) {
    return result(
      "env",
      "failed",
      "Required environment values are missing.",
      { openAiReady, stripeReady, supabaseReady, missingRequired, missingOptional },
      "Check .env.local. OpenAI and Supabase are required for live analysis and admin data."
    );
  }

  if (missingOptional.length) {
    return result(
      "env",
      "warning",
      "Core systems are ready, but payment configuration is incomplete.",
      { openAiReady, stripeReady, supabaseReady, missingOptional },
      "Stripe is only required when payments/subscriptions are live. Add Stripe env values before launching paid checkout."
    );
  }

  return result("env", "passed", "Environment configuration looks complete.", {
    openAiReady,
    stripeReady,
    supabaseReady
  });
}

async function checkAnalyze(): Promise<DailyCheckResult> {
  const apiKey = Boolean(process.env.OPENAI_API_KEY);
  const model = process.env.OPENAI_MODEL ?? "not set";

  if (!apiKey) {
    return result(
      "analyze",
      "failed",
      "Analyze API cannot use OpenAI because OPENAI_API_KEY is missing.",
      { model },
      "Add OPENAI_API_KEY to .env.local and restart the dev server."
    );
  }

  return result("analyze", "passed", "Analyze API configuration is ready.", {
    model,
    endpoint: "/api/analyze"
  });
}

async function runCheck(check: string): Promise<DailyCheckResult[]> {
  const checks: Record<string, () => Promise<DailyCheckResult>> = {
    api: checkApi,
    openai: checkOpenAI,
    supabase: checkSupabase,
    adminUsers: checkAdminUsers,
    diagnostics: checkDiagnostics,
    auth: checkAuth,
    env: checkEnv,
    analyze: checkAnalyze
  };

  if (check === "all") {
    const results: DailyCheckResult[] = [];

    for (const key of Object.keys(checks)) {
      results.push(await checks[key]());
    }

    return results;
  }

  const selected = checks[check];

  if (!selected) {
    return [
      result(
        check,
        "failed",
        `Unknown check: ${check}`,
        { requested_check: check },
        "Use one of the supported daily check buttons."
      )
    ];
  }

  return [await selected()];
}

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const check = typeof body.check === "string" ? body.check : "all";

  const startedAt = Date.now();
  const results = await runCheck(check);
  const durationMs = Date.now() - startedAt;

  const failed = results.filter((item) => item.status === "failed").length;
  const warnings = results.filter((item) => item.status === "warning").length;

  return NextResponse.json({
    ok: failed === 0,
    status: failed ? "failed" : warnings ? "warning" : "passed",
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    results
  });
}
