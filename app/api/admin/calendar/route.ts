import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { supabaseInsert, supabaseSelect, supabaseUpdate } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const rows = await supabaseSelect(
    "admin_calendar_tasks",
    "select=*&order=task_date.asc,created_at.desc&limit=500"
  );

  return NextResponse.json({ tasks: rows ?? [] });
}

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const row = await supabaseInsert("admin_calendar_tasks", {
    task_date: String(body.task_date ?? new Date().toISOString().slice(0, 10)),
    title,
    note: String(body.note ?? "").trim() || null,
    category: String(body.category ?? "business").trim() || "business",
    status: String(body.status ?? "pending").trim() || "pending",
    priority: String(body.priority ?? "normal").trim() || "normal",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (!row) {
    return NextResponse.json({ error: "Calendar task could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();

  if (!id) {
    return NextResponse.json({ error: "Task ID is required." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };

  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.priority === "string") patch.priority = body.priority;
  if (typeof body.note === "string") patch.note = body.note;

  await supabaseUpdate("admin_calendar_tasks", `id=eq.${encodeURIComponent(id)}`, patch);

  return NextResponse.json({ ok: true });
}
