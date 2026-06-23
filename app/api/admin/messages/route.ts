import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { supabaseSelect, supabaseUpdate } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const rows = await supabaseSelect(
    "contact_messages",
    "select=*&order=created_at.desc&limit=100"
  );

  return NextResponse.json({ messages: rows });
}

export async function PATCH(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();

  if (!id) {
    return NextResponse.json({ error: "Message ID is required." }, { status: 400 });
  }

  const status = String(body.status ?? "").trim();
  const admin_notes = typeof body.admin_notes === "string" ? body.admin_notes : undefined;

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };

  if (["unread", "read", "replied", "archived"].includes(status)) {
    patch.status = status;
  }

  if (admin_notes !== undefined) {
    patch.admin_notes = admin_notes;
  }

  await supabaseUpdate("contact_messages", `id=eq.${encodeURIComponent(id)}`, patch);

  return NextResponse.json({ ok: true });
}
