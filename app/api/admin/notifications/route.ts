import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { createAdminNotification, listAdminNotifications, markAdminNotification } from "@/lib/notifications";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const notifications = await listAdminNotifications(150);

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
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  await createAdminNotification({
    title: String(body.title ?? "Manual admin notification"),
    message: String(body.message ?? "Admin manually created a test notification."),
    type: String(body.type ?? "manual_test"),
    severity: body.severity === "critical" || body.severity === "warning" || body.severity === "info" ? body.severity : "normal",
    action_url: typeof body.action_url === "string" ? body.action_url : "/admin/notifications",
    metadata: {
      created_by: adminSession.email,
      source: "admin_notifications_api"
    }
  });

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
    return NextResponse.json({ error: "Notification ID is required." }, { status: 400 });
  }

  await markAdminNotification(id, String(body.status ?? "read"));

  return NextResponse.json({ ok: true });
}
