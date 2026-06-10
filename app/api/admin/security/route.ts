import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { latestSecurityEvents, logSecurityEvent } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    await logSecurityEvent({
      event_type: "blocked_admin_security_access",
      severity: "medium",
      request,
      message: "Blocked unauthenticated access to admin security endpoint."
    });

    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const events = await latestSecurityEvents(150);

  const summary = {
    total: events.length,
    critical: events.filter((event) => event.severity === "critical").length,
    high: events.filter((event) => event.severity === "high").length,
    medium: events.filter((event) => event.severity === "medium").length,
    low: events.filter((event) => event.severity === "low").length
  };

  return NextResponse.json({
    ok: true,
    summary,
    events
  });
}

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  await logSecurityEvent({
    event_type: "manual_admin_security_test",
    severity: "low",
    request,
    user_email: adminSession.email,
    message: "Admin manually tested security event logging.",
    metadata: {
      source: "admin_security_center"
    }
  });

  return NextResponse.json({ ok: true });
}
