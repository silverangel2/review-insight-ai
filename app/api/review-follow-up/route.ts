import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || "").trim();
    const product = body.product || body.result || {};

    const allowed = [
      "why_not_buy",
      "show_complaints",
      "find_better_option",
      "is_good_for_travel",
      "explain_verdict",
    ];

    if (!allowed.includes(action)) {
      return NextResponse.json({ ok: false, error: "Unknown follow-up action." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY." }, { status: 500 });
    }

    const prompt = `
You are ReviewIntel's product follow-up assistant.

User action:
${action}

Product/result data:
${JSON.stringify(product, null, 2)}

Answer like a direct human shopping assistant.
Keep it short, practical, and evidence-based.
Do not invent facts.
If evidence is weak, say that clearly.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REVIEW_SEARCH_MODEL || "gpt-4.1-mini",
        input: prompt,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `OpenAI follow-up failed: ${response.status} ${text.slice(0, 180)}` },
        { status: 500 }
      );
    }

    const data = await response.json();

    const answer =
      data.output_text ||
      data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
        ?.map((content: { text?: string }) => content.text || "")
        ?.join("\n") ||
      "";

    return NextResponse.json({ ok: true, action, answer });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Follow-up failed.",
      },
      { status: 500 }
    );
  }
}
