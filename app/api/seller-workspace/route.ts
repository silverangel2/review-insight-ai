import { NextResponse } from "next/server";
import { isAdminRole, isSellerPlan, normalizePlan, normalizeRole } from "@/lib/account";
import { readAccountSession } from "@/lib/accountSession";
import { isSupabaseConfigured, supabaseSelect, supabaseUpsert } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
const MAX_BYTES = 900_000;

function sellerFromSession(request: Request) {
  const session = readAccountSession(request);
  if (!session?.email) return { error: NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 }) };
  const plan = normalizePlan(session.plan);
  const role = normalizeRole(session.role);
  if (!(isAdminRole(role) || (role === "seller" && isSellerPlan(plan)))) {
    return { error: NextResponse.json({ ok: false, error: "Seller workspace requires a seller plan.", code: "SELLER_PLAN_REQUIRED" }, { status: 403 }) };
  }
  return { email: session.email.trim().toLowerCase() };
}

const local = (reason: string) => NextResponse.json({ ok: true, storage: "local", reason }, { headers: { "cache-control": "no-store" } });

export async function GET(request: Request) {
  const who = sellerFromSession(request);
  if ("error" in who) return who.error;
  if (!isSupabaseConfigured()) return local("database_not_configured");
  try {
    const rows = await supabaseSelect("seller_workspaces", `select=products,journal,notes,updated_at&profile_email=eq.${encodeURIComponent(who.email)}&limit=1`, { failClosed: true });
    const row = rows[0];
    return NextResponse.json({ ok: true, storage: "database", workspace: row ?? null }, { headers: { "cache-control": "no-store" } });
  } catch {
    return local("table_unavailable"); // migration not applied yet
  }
}

export async function PUT(request: Request) {
  const who = sellerFromSession(request);
  if ("error" in who) return who.error;
  const text = await request.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ ok: false, error: "Workspace is too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 }); }
  const products = Array.isArray(body.products) ? body.products : [];
  const journal = Array.isArray(body.journal) ? body.journal : [];
  const notes = body.notes && typeof body.notes === "object" && !Array.isArray(body.notes) ? body.notes : {};
  if (!isSupabaseConfigured()) return local("database_not_configured");
  const saved = await supabaseUpsert("seller_workspaces", { profile_email: who.email, products, journal, notes, updated_at: new Date().toISOString() }, "profile_email");
  if (!saved) return local("table_unavailable");
  return NextResponse.json({ ok: true, storage: "database" });
}
