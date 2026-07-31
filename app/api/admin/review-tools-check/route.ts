import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  callOpenAiWebSearchResponse,
  createOpenAiWebSearchContext,
  describeOpenAiWebSearchSkip,
  getOpenAiWebSearchDiagnostics,
  OPENAI_WEB_SEARCH_TOOL,
} from "@/lib/openAiWebSearch";

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function checkTable(table: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      table,
      ok: false,
      status: "missing_supabase_env",
      message: "Supabase URL or service role key is missing.",
    };
  }

  const { error } = await supabase.from(table).select("*").limit(1);

  if (error) {
    return {
      table,
      ok: false,
      status: "failed",
      message: error.message,
    };
  }

  return {
    table,
    ok: true,
    status: "ready",
    message: "Table is reachable.",
  };
}

async function checkOpenAIWebSearch() {
  const openAiWebSearchContext = createOpenAiWebSearchContext({ maxCalls: 1 });
  try {
    const response = await callOpenAiWebSearchResponse({
      model: process.env.OPENAI_REVIEW_SEARCH_MODEL,
      toolType: OPENAI_WEB_SEARCH_TOOL,
      searchContextSize: "low",
      input:
        "Quick tool check. Search for public web evidence that Walmart exists. Return one short sentence only.",
      temperature: 0,
      context: openAiWebSearchContext,
      purpose: "admin-review-tools-check",
      dedupeKey: "admin-review-tools-check:walmart-exists",
    });

    if (!response.ok) {
      const skippedMessage = response.skipped ? describeOpenAiWebSearchSkip(response) : "";
      const disabled = response.skipReason === "disabled";

      return {
        ok: disabled,
        status: disabled ? "disabled" : response.skipReason === "missing_api_key" ? "missing_openai_key" : "failed",
        message: skippedMessage || `OpenAI Web Search failed: ${response.status || "network"} ${(response.error || "").slice(0, 180)}`,
        diagnostics: getOpenAiWebSearchDiagnostics(openAiWebSearchContext),
      };
    }

    return {
      ok: true,
      status: "ready",
      message: "OpenAI Web Search tool responded.",
      diagnostics: getOpenAiWebSearchDiagnostics(openAiWebSearchContext),
    };
  } catch (error: unknown) {
    return {
      ok: false,
      status: "failed",
      message: error instanceof Error ? error.message : "OpenAI Web Search check failed.",
      diagnostics: getOpenAiWebSearchDiagnostics(openAiWebSearchContext),
    };
  }
}

export async function GET() {
  const tables = await Promise.all([
    checkTable("reviewintel_product_memory"),
    checkTable("reviewintel_product_sources"),
    checkTable("reviewintel_review_authenticity_analysis"),
  ]);

  const openaiWebSearch = await checkOpenAIWebSearch();

  const allTablesReady = tables.every((table) => table.ok);
  const overallReady = allTablesReady && openaiWebSearch.ok;

  return NextResponse.json({
    ok: overallReady,
    status: overallReady ? "ready" : "needs_attention",
    checks: {
      openaiWebSearch,
      supabaseMemoryTables: tables,
    },
    toolsExpected: [
      "vision_product_identity",
      "exact_listing_search",
      "review_evidence_scan",
      "supabase_product_memory",
      "stable_verdict_engine",
      "tool_proof_ui",
    ],
    message: overallReady
      ? "ReviewIntel review tools are ready."
      : "Some ReviewIntel review tools need attention.",
  });
}
