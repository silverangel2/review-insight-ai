import { NextResponse } from "next/server";
import { accountFromRequest, readPersistentQuota, recentAnalyses } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  try {
    const account = await accountFromRequest(request);
    const quota = await readPersistentQuota(account, request);
    const analyses = await recentAnalyses(account);

    return NextResponse.json({
      account,
      quota,
      analyses
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Account lookup failed." },
      { status: 400 }
    );
  }
}
