import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { listRescueQueue } from "@/lib/rescueQueue";

export const runtime = "nodejs";

function requireAdmin(request: Request) {
  return Boolean(adminSessionFromRequest(request));
}

/** Owner's rescue inbox: pending candidates + the recent rescue history. */
export async function GET(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  try {
    const [pending, rescued, emailed] = await Promise.all([
      listRescueQueue("pending", 50),
      listRescueQueue("rescued", 20),
      listRescueQueue("emailed", 20),
    ]);
    return NextResponse.json({ pending, rescued, emailed });
  } catch {
    return NextResponse.json({ pending: [], rescued: [], emailed: [] });
  }
}
