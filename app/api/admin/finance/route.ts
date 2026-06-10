import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { supabaseInsert, supabaseSelect } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const rows = await supabaseSelect(
    "admin_finance_entries",
    "select=*&order=entry_date.desc,created_at.desc&limit=500"
  );

  return NextResponse.json({ entries: rows ?? [] });
}

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const type = String(body.type ?? "").trim().toLowerCase();
  const category = String(body.category ?? "").trim();
  const amount = Number(body.amount ?? 0);

  if (!["income", "expense"].includes(type)) {
    return NextResponse.json({ error: "Type must be income or expense." }, { status: 400 });
  }

  if (!category) {
    return NextResponse.json({ error: "Category is required." }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0." }, { status: 400 });
  }

  const row = await supabaseInsert("admin_finance_entries", {
    entry_date: String(body.entry_date ?? new Date().toISOString().slice(0, 10)),
    type,
    category,
    amount,
    currency: String(body.currency ?? "CAD").trim() || "CAD",
    description: String(body.description ?? "").trim() || null,
    tax_note: String(body.tax_note ?? "").trim() || null,
    receipt_url: String(body.receipt_url ?? "").trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (!row) {
    return NextResponse.json({ error: "Finance entry could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
