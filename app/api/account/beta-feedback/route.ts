import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/accountSession";
import { supabaseInsert } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  const session = readAccountSession(request);

  if (!session?.email) {
    return NextResponse.json({ error: "Please log in to send beta feedback." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const message = String(body?.message || "").trim();
  const feedbackType = String(body?.feedbackType || "feedback").trim() === "survey" ? "survey" : "feedback";
  const surveyKey = String(body?.surveyKey || "").trim();
  const surveyNumber = Number(body?.surveyNumber || 0) || null;

  if (message.length < 5) {
    return NextResponse.json({ error: "Please enter a little more detail." }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ error: "Beta feedback is too long. Please keep it under 2000 characters." }, { status: 400 });
  }

  const row = await supabaseInsert("beta_feedback", {
    email: session.email,
    role: session.role || null,
    plan: session.plan || null,
    message,
    feedback_type: feedbackType,
    survey_key: surveyKey || null,
    survey_number: surveyNumber,
    status: "open",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (!row) {
    return NextResponse.json({ error: "Could not save beta feedback." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
