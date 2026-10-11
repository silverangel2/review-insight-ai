import { NextResponse } from "next/server";
import { emailLinkSecret, normalizeMailbox, readEmailToken } from "@/lib/emailLinks";
import { saveEmailPrefs } from "@/lib/emailPreferenceStore";
import { rateLimitRequest } from "@/lib/security";

export const runtime = "nodejs";

type UnsubscribeInput = {
  token: string;
  email: string;
  oneClick: boolean;
  formPost: boolean;
};

export async function readUnsubscribeInput(request: Request): Promise<UnsubscribeInput> {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") || "";
  let email = url.searchParams.get("email") || "";
  let oneClick = false;
  const contentType = request.headers.get("content-type") || "";
  const formPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    token = token || String(body.token ?? "");
    email = String(body.email ?? email);
  } else if (formPost) {
    const form = await request.formData().catch(() => null);
    token = token || String(form?.get("token") ?? "");
    email = String(form?.get("email") ?? email);
    oneClick = String(form?.get("List-Unsubscribe") ?? "") === "One-Click";
  }

  return { token, email, oneClick, formPost };
}

export function unsubscribeTarget(input: UnsubscribeInput, secret = emailLinkSecret()) {
  const tokenEmail = readEmailToken(input.token, secret);
  if (input.oneClick) return tokenEmail;
  return tokenEmail || normalizeMailbox(input.email);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dest = new URL("/unsubscribe", url.origin);
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");
  if (token) dest.searchParams.set("token", token);
  if (email) dest.searchParams.set("email", email);
  return NextResponse.redirect(dest, 303);
}

export async function POST(request: Request) {
  const limit = await rateLimitRequest(request, {
    key: "email_unsubscribe",
    limit: 10,
    windowMs: 15 * 60 * 1000,
    eventType: "unsubscribe_rate_limited",
  });
  if (!limit.allowed) {
    return limit.response ?? NextResponse.json({ error: "Too many unsubscribe attempts." }, { status: 429 });
  }

  const input = await readUnsubscribeInput(request);
  const email = unsubscribeTarget(input);
  if (!email) {
    return NextResponse.json({ error: "A valid unsubscribe link is required." }, { status: 400 });
  }

  const saved = await saveEmailPrefs(email, { productUpdates: false, upgradeTips: false });
  if (saved.reason === "not-configured") {
    return NextResponse.json({ error: "Email settings are not connected yet. Nothing was changed." }, { status: 503 });
  }

  if (input.formPost && !input.oneClick) {
    const dest = new URL("/unsubscribe", new URL(request.url).origin);
    dest.searchParams.set("done", "1");
    return NextResponse.redirect(dest, 303);
  }

  return NextResponse.json({
    ok: true,
    message: "Product updates and scan tips are off. Account and billing messages can still be sent when they are needed.",
  });
}
