import { NextResponse } from "next/server";
import {
  placeSophieOrder,
  sophieAuthError,
  validateSophieOrder,
} from "@/lib/sophieCommand";

/**
 * Sophie Command Door — ORDERS (command, within the v1 whitelist).
 * Accepted orders are enqueued into RI's own ri_ops_* ledger with
 * payload.source = "sophie"; the existing ri-ops-worker executes them
 * under its authority ceiling (read-only suite for level 1–2,
 * preparation-only for level 3+). This route executes nothing itself.
 * Auth: Bearer SOPHIE_COMMAND_KEY. Fail-closed; never throws.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = sophieAuthError(request);
  if (authError) {
    return NextResponse.json({ ok: false, error: authError }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Order body must be valid JSON." },
      { status: 400 }
    );
  }

  const validation = validateSophieOrder(body);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: validation.error },
      { status: 422 }
    );
  }

  const result = await placeSophieOrder(validation);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    job: {
      id: result.job.id,
      job_type: result.job.job_type,
      level: result.job.level,
      status: result.job.status,
    },
  });
}
