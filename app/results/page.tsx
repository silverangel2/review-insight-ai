import type { Metadata } from "next";
import { cookies } from "next/headers";
import { withSeo } from "@/lib/pageSeo";
import { ResultsClient } from "@/components/ResultsClient";
import { CommunityReviewsSection } from "@/components/CommunityReviewsSection";
import { RescueEmailCapture } from "@/components/RescueEmailCapture";
import { normalizeProductKey } from "@/lib/communityReviews";
import { loadServerResult } from "@/lib/serverResult";
import { cookieGrantsScan, SCAN_ACCESS_COOKIE } from "@/lib/scanAccess";
import type { AnalyzeResponse } from "@/lib/types";
import { shouldShowRescueCapture } from "@/lib/rescueCaptureGate";

export const metadata: Metadata = withSeo("/results", {
  title: "Your ReviewIntel result",
  description: "A plain Buy, Wait or Skip answer built only from real written buyer reviews of this exact product.",
  robots: { index: false },
}, { noindex: true });
export const dynamic = "force-dynamic";

/** Server-side insufficient-evidence signal, aligned with the brief's verdict gate. */
function isNoVerdictResult(result: AnalyzeResponse | null): boolean {
  return shouldShowRescueCapture(result);
}

export default async function ResultsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const scanId = typeof params.scanId === "string" ? params.scanId : null;
  const initialResult = (await loadServerResult(scanId)) as AnalyzeResponse | null;
  const accessCookie = (await cookies()).get(SCAN_ACCESS_COOKIE)?.value;
  const initialOwnerGrant = cookieGrantsScan(accessCookie, scanId || "");
  const communityKey = normalizeProductKey(initialResult?.detectedProductKey);
  const noVerdict = isNoVerdictResult(initialResult);
  const resultRecord = (initialResult ?? {}) as Record<string, unknown>;
  return (
    <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-10">
      <ResultsClient initialResult={initialResult} initialScanId={scanId} initialOwnerGrant={initialOwnerGrant} />
      {noVerdict ? (
        <RescueEmailCapture
          scanRef={scanId}
          productName={String(resultRecord.productName ?? resultRecord.name ?? resultRecord.title ?? "") || null}
          productUrl={String(resultRecord.url ?? resultRecord.exactListingUrl ?? "") || null}
          productKey={communityKey}
        />
      ) : null}
      {communityKey ? <CommunityReviewsSection productKey={communityKey} /> : null}
    </main>
  );
}
