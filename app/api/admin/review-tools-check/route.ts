import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      status: "missing_openai_key",
      message: "OPENAI_API_KEY is missing.",
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REVIEW_SEARCH_MODEL || "gpt-4.1-mini",
        tools: [{ type: "web_search" }],
        input:
          "Quick tool check. Search for public web evidence that Walmart exists. Return one short sentence only.",
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        status: "failed",
        message: `OpenAI web_search failed: ${response.status} ${text.slice(0, 180)}`,
      };
    }

    return {
      ok: true,
      status: "ready",
      message: "OpenAI web_search tool responded.",
    };
  } catch (error: unknown) {
    return {
      ok: false,
      status: "failed",
      message: error instanceof Error ? error.message : "OpenAI web_search check failed.",
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
