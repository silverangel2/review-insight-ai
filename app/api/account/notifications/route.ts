import { NextResponse } from "next/server";
import { readAccountSession } from "@/lib/accountSession";
import { createCustomerNotification, listCustomerNotifications, markCustomerNotification } from "@/lib/notifications";

export const runtime = "nodejs";

function readRequestCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return "";
}

function getAuthenticatedAccountEmail(request: Request) {
  const session = readAccountSession(request);
  return String(session?.email ?? "").toLowerCase().trim();
}

function rejectEmailSwitch(requestedEmail: string, authenticatedEmail: string) {
  if (!authenticatedEmail) {
    return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
  }

  if (requestedEmail && requestedEmail !== authenticatedEmail) {
    return NextResponse.json(
      { error: "You are not allowed to access another account's notifications." },
      { status: 403 }
    );
  }

  return null;
}


export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedEmail = String(url.searchParams.get("email") ?? "").toLowerCase().trim();
  const email = getAuthenticatedAccountEmail(request);
  const rejected = rejectEmailSwitch(requestedEmail, email);
  if (rejected) return rejected;

  const notifications = await listCustomerNotifications(email, 150);

  return NextResponse.json({
    notifications,
    summary: {
      total: notifications.length,
      unread: notifications.filter((item) => item.status === "unread").length,
      critical: notifications.filter((item) => item.severity === "critical").length,
      warning: notifications.filter((item) => item.severity === "warning").length
    }
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const requestedEmail = String(body.email ?? "").toLowerCase().trim();
  const email = getAuthenticatedAccountEmail(request);
  const rejected = rejectEmailSwitch(requestedEmail, email);
  if (rejected) return rejected;

  await createCustomerNotification({
    profile_email: email,
    title: String(body.title ?? "ReviewIntel notification"),
    message: String(body.message ?? "This is a test notification."),
    type: String(body.type ?? "manual_test"),
    severity: body.severity === "critical" || body.severity === "warning" || body.severity === "info" ? body.severity : "normal",
    action_url: typeof body.action_url === "string" ? body.action_url : "/dashboard/notifications",
    metadata: {
      source: "customer_notifications_api"
    }
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();
  const requestedEmail = String(body.email ?? "").toLowerCase().trim();
  const email = getAuthenticatedAccountEmail(request);
  const rejected = rejectEmailSwitch(requestedEmail, email);
  if (rejected) return rejected;

  if (!id) {
    return NextResponse.json({ error: "Notification ID is required." }, { status: 400 });
  }

  await markCustomerNotification(id, email, String(body.status ?? "read"));

  return NextResponse.json({ ok: true });
}
