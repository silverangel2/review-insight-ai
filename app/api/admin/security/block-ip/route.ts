import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { blockIp, logSecurityEvent } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const ipAddress = String(body.ip_address ?? "").trim();
  const reason = String(body.reason ?? "Blocked by admin.").trim();

  if (!ipAddress) {
    return NextResponse.json({ error: "IP address is required." }, { status: 400 });
  }

  await blockIp(ipAddress, reason, adminSession.email);

  await logSecurityEvent({
    event_type: "admin_blocked_ip",
    severity: "high",
    request,
    user_email: adminSession.email,
    message: `Admin blocked IP ${ipAddress}.`,
    metadata: {
      blocked_ip: ipAddress,
      reason
    }
  });

  return NextResponse.json({ ok: true });
}
