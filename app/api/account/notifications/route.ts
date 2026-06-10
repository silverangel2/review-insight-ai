import { NextResponse } from "next/server";
import { createCustomerNotification, listCustomerNotifications, markCustomerNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = String(url.searchParams.get("email") ?? "").toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Account email is required." }, { status: 400 });
  }

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
  const email = String(body.email ?? "").toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Account email is required." }, { status: 400 });
  }

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
  const email = String(body.email ?? "").toLowerCase().trim();

  if (!id || !email) {
    return NextResponse.json({ error: "Notification ID and email are required." }, { status: 400 });
  }

  await markCustomerNotification(id, email, String(body.status ?? "read"));

  return NextResponse.json({ ok: true });
}
