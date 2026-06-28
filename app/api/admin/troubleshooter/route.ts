import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";

export const runtime = "nodejs";

function fallbackAnswer(question: string) {
  return [
    "Fallback checklist:",
    "",
    "1. Confirm OPENAI_API_KEY exists in .env.local.",
    "2. Restart the dev server after changing .env.local.",
    "3. Confirm the selected model is valid.",
    "4. Check OpenAI billing, quota, and project permissions.",
    "",
    `Question: ${question || "No question provided."}`
  ].join("\n");
}

function extractText(payload: unknown) {
  const row = payload as Record<string, unknown>;

  if (typeof row.output_text === "string" && row.output_text.trim()) {
    return row.output_text;
  }

  const output = Array.isArray(row.output) ? row.output : [];
  const parts: string[] = [];

  for (const item of output) {
    const itemRow = item as Record<string, unknown>;
    const content = Array.isArray(itemRow.content) ? itemRow.content : [];

    for (const contentItem of content) {
      const contentRow = contentItem as Record<string, unknown>;
      if (typeof contentRow.text === "string") parts.push(contentRow.text);
    }
  }

  return parts.join("\n").trim();
}

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let question = "";

  try {
    const body = await request.json().catch(() => ({}));
    question = String(body.question || body.message || body.prompt || "").trim();

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        answer: "I can help, but OPENAI_API_KEY is not configured for the admin troubleshooter.\n\n" + fallbackAnswer(question),
        usedAi: false,
        diagnostics: {
          openaiKeyLoaded: false,
          openaiModel: model
        }
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You are the ReviewIntel admin troubleshooter. Give direct, practical diagnostic steps. Keep answers concise."
          },
          {
            role: "user",
            content: question || "Test OpenAI connection."
          }
        ]
      })
    });

    const payload = await response.json().catch(() => ({}));
    const answer = extractText(payload);

    if (!response.ok || !answer) {
      return NextResponse.json({
        ok: true,
        answer: [
          "The AI troubleshooter could not complete the OpenAI request, so here is the fallback path.",
          "",
          fallbackAnswer(question),
          "",
          `OpenAI key loaded: ${Boolean(apiKey)}`,
          `OpenAI model: ${model}`,
          `OpenAI status: ${response.status}`,
          `OpenAI error: ${JSON.stringify(payload).slice(0, 1200)}`
        ].join("\n"),
        usedAi: false,
        diagnostics: {
          openaiKeyLoaded: Boolean(apiKey),
          openaiModel: model,
          openaiStatus: response.status,
          openaiPayload: payload
        }
      });
    }

    return NextResponse.json({
      ok: true,
      answer,
      usedAi: true,
      diagnostics: {
        openaiKeyLoaded: true,
        openaiModel: model,
        openaiStatus: response.status
      }
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      answer: [
        "The AI troubleshooter route crashed, so here is the fallback path.",
        "",
        fallbackAnswer(question),
        "",
        `Route error: ${error instanceof Error ? error.message : "Unknown error"}`
      ].join("\n"),
      usedAi: false,
      diagnostics: {
        openaiKeyLoaded: Boolean(process.env.OPENAI_API_KEY),
        openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini"
      }
    });
  }
}
