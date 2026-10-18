import { NextResponse } from "next/server";
import { buildSophieSitrep, sophieAuthError } from "@/lib/sophieCommand";

/**
 * Sophie Command Door — SITREP (watch).
 * Read-only picture of RI's bots for Sophie, Junel's local AI:
 * rescue queue counts + the ri_ops ledger's recent jobs.
 * Auth: Bearer SOPHIE_COMMAND_KEY. Fail-soft; never throws.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = sophieAuthError(request);
  if (authError) {
    return NextResponse.json({ ok: false, error: authError }, { status: 401 });
  }
  try {
    const sitrep = await buildSophieSitrep();
    return NextResponse.json(sitrep);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Sitrep failed safely." },
      { status: 500 }
    );
  }
}
