import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { blockIp, logSecurityEvent } from "@/lib/security";

export const runtime = "nodejs";

function isBlockableIp(value: string) {
  const cleanValue = value.trim().toLowerCase();

  if (!cleanValue || cleanValue.length > 64) return false;
  if (["local", "unknown", "::1", "127.0.0.1", "localhost"].includes(cleanValue)) return false;
  if (!/^[a-f0-9:.\/]+$/i.test(cleanValue)) return false;

  return cleanValue.includes(".") || cleanValue.includes(":");
}

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

  if (!isBlockableIp(ipAddress)) {
    return NextResponse.json({ error: "Enter a valid public IP address or CIDR block." }, { status: 400 });
  }

  const blocked = await blockIp(ipAddress, reason.slice(0, 500), adminSession.email);

  if (!blocked) {
    return NextResponse.json({ error: "IP address could not be blocked." }, { status: 500 });
  }

  await logSecurityEvent({
    event_type: "admin_blocked_ip",
    severity: "high",
    request,
    user_email: adminSession.email,
    message: `Admin blocked IP ${ipAddress}.`,
    metadata: {
      blocked_ip: ipAddress,
      reason: reason.slice(0, 500)
    }
  });

  return NextResponse.json({ ok: true });
}
