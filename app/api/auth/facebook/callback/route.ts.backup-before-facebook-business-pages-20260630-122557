import { NextRequest, NextResponse } from "next/server";
import {
  exchangeFacebookCodeForUserToken,
  exchangeForLongLivedUserToken,
  getFacebookOAuthConfig,
  getFacebookPages,
  getFacebookScopes,
  storeFacebookConnection,
  verifyFacebookPageToken,
} from "@/lib/facebookConnector";

export const dynamic = "force-dynamic";

type FacebookPageResult = {
  id: string;
  name?: string;
  access_token?: string;
  tasks?: string[];
  perms?: string[];
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Facebook connection failed.";
}

function html(status: "success" | "error", message: string) {
  const color = status === "success" ? "#16a34a" : "#dc2626";
  const title = status === "success" ? "Facebook connected" : "Facebook connection failed";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;background:#0f172a;color:#e5e7eb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
      .card{max-width:560px;background:#111827;border:1px solid #334155;border-radius:18px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
      h1{margin:0 0 12px;color:${color};font-size:26px}
      p{line-height:1.5}
      a{color:#38bdf8}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      <p><a href="/admin/social">Return to ReviewIntel admin social</a></p>
    </div>
  </body>
</html>`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("reviewintel_fb_oauth_state")?.value;

  if (error) {
    return new NextResponse(html("error", error), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!code) {
    return new NextResponse(html("error", "Facebook did not return an authorization code."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!state || !cookieState || state !== cookieState) {
    return new NextResponse(html("error", "Facebook OAuth state check failed. Please try connecting again."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const config = getFacebookOAuthConfig();

    const shortUserToken = await exchangeFacebookCodeForUserToken(code);
    const longUserToken = await exchangeForLongLivedUserToken(shortUserToken.access_token);

    const pages = await getFacebookPages(longUserToken.access_token);

    const page =
      pages.find((p: FacebookPageResult) => String(p.id) === String(config.pageId)) ||
      pages.find((p: FacebookPageResult) => String(p.name || "").toLowerCase() === "reviewintel");

    if (!page) {
      const visiblePages = pages
        .map((p: FacebookPageResult) => `${p.name || "Unnamed Page"} (${p.id})`)
        .join(", ");

      return new NextResponse(
        html(
          "error",
          `Facebook connected, but the configured ReviewIntel Page ID ${config.pageId} was not found. Facebook returned these Pages for this account: ${visiblePages || "none"}. Copy the correct Page ID into FACEBOOK_PAGE_ID in Vercel, then redeploy and reconnect.`
        ),
        { status: 404, headers: { "Content-Type": "text/html" } }
      );
    }

    if (!page.access_token) {
      return new NextResponse(
        html(
          "error",
          "Facebook returned the Page, but did not return a Page access token. Reconnect with full Page permissions."
        ),
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    const verified = await verifyFacebookPageToken(page.id, page.access_token);

    await storeFacebookConnection({
      pageId: page.id,
      pageName: verified.name || page.name || "ReviewIntel",
      pageAccessToken: page.access_token,
      tokenType: longUserToken.token_type || "bearer",
      expiresIn: undefined,
      scopes: getFacebookScopes(),
      metadata: {
        graphVersion: config.graphVersion,
        tasks: page.tasks || page.perms || [],
        connectedAt: new Date().toISOString(),
        tokenSource: "facebook-oauth",
        userTokenExchangeWarning: (longUserToken as { exchange_warning?: string }).exchange_warning || null,
      },
    });

    const response = new NextResponse(
      html("success", `Connected to ${verified.name || "ReviewIntel"}. You can now return to /admin/social and test posting.`),
      { status: 200, headers: { "Content-Type": "text/html" } }
    );

    response.cookies.delete("reviewintel_fb_oauth_state");

    return response;
  } catch (err: unknown) {
    return new NextResponse(
      html("error", getErrorMessage(err)),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
