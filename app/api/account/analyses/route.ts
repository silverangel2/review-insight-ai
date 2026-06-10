import { NextResponse } from "next/server";
import { supabaseSelect } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = String(url.searchParams.get("email") ?? "").toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Account email is required." }, { status: 400 });
  }

  const rows = await supabaseSelect(
    "analyses",
    `select=*&profile_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=500`
  );

  const sellerRows = (rows ?? []).filter((row) => {
    const mode = String(row.mode ?? "").toLowerCase();
    return mode === "seller" || mode === "both" || mode.includes("seller");
  });

  return NextResponse.json({ analyses: sellerRows });
}
