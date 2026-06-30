import { NextResponse } from "next/server";
import crypto from "crypto";
import { getTikTokAuthUrl, getTikTokOAuthHealth } from "@/lib/tiktokConnector";

export const dynamic = "force-dynamic";

function html(status: "error" | "ready", message: string, details?: Record<string, unknown>) {
  const color = status === "ready" ? "#0891b2" : "#dc2626";
  const title = status === "ready" ? "TikTok connection ready" : "TikTok connection cannot start";
  const safeMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const detailText = details ? JSON.stringify(details, null, 2).replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;background:#f8fbff;color:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
      .card{max-width:720px;background:white;border:1px solid #dbe4ef;border-radius:22px;padding:28px;box-shadow:0 20px 60px rgba(15,23,42,.12)}
      h1{margin:0 0 12px;color:${color};font-size:28px}
      p{line-height:1.55;color:#475569}
      pre{white-space:pre-wrap;word-break:break-word;background:#f1f5f9;border-radius:16px;padding:16px;color:#334155;font-size:13px}
      a{display:inline-flex;margin-top:12px;border-radius:14px;background:#0f172a;color:white;text-decoration:none;padding:12px 16px;font-weight:800}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${safeMessage}</p>
      ${detailText ? `<pre>${detailText}</pre>` : ""}
      <a href="/admin/social">Return to Admin Social</a>
    </div>
  </body>
</html>`;
}

export async function GET() {
  try {
    const health = getTikTokOAuthHealth();
    if (!health.clientKeyConfigured) {
      return new NextResponse(
        html(
          "error",
          "TikTok cannot connect because TIKTOK_CLIENT_KEY is missing. Add the TikTok app Client Key in Vercel, then redeploy.",
          health
        ),
        { status: 500, headers: { "Content-Type": "text/html" } }
      );
    }

    const state = crypto.randomBytes(24).toString("hex");
    const response = NextResponse.redirect(getTikTokAuthUrl(state));

    response.cookies.set("tiktok_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "TikTok connection failed";
    return new NextResponse(
      html("error", message, getTikTokOAuthHealth()),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
