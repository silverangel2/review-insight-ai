import type { Metadata } from "next";
import { cookies } from "next/headers";
import { withSeo } from "@/lib/pageSeo";
import { ResultsClient } from "@/components/ResultsClient";
import { CommunityReviewsSection } from "@/components/CommunityReviewsSection";
import { ReviewAskCta } from "@/components/ReviewAskCta";
import { WatchProductButton } from "@/components/WatchProductButton";
import { normalizeProductKey } from "@/lib/communityReviews";
import { loadServerResult } from "@/lib/serverResult";
import { cookieGrantsScan, SCAN_ACCESS_COOKIE } from "@/lib/scanAccess";
import type { AnalyzeResponse } from "@/lib/types";

export const metadata: Metadata = withSeo("/results", {
  title: "Your ReviewIntel result",
  description: "A plain Buy, Wait or Skip answer built only from real written buyer reviews of this exact product.",
  robots: { index: false },
}, { noindex: true });
export const dynamic = "force-dynamic";

export default async function ResultsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const scanId = typeof params.scanId === "string" ? params.scanId : null;
  const initialResult = (await loadServerResult(scanId)) as AnalyzeResponse | null;
  const accessCookie = (await cookies()).get(SCAN_ACCESS_COOKIE)?.value;
  const initialOwnerGrant = cookieGrantsScan(accessCookie, scanId || "");
  const communityKey = normalizeProductKey(initialResult?.detectedProductKey);

  // Props for the watch button + review ask: derived defensively from the
  // stored result shape (never throws when a field is absent).
  const resultRecord = (initialResult ?? {}) as unknown as Record<string, unknown>;
  const reviewEvidenceRecord = (resultRecord.reviewEvidence ?? {}) as Record<string, unknown>;
  const listingEvidenceRecord = (reviewEvidenceRecord.listingEvidence ?? {}) as Record<string, unknown>;
  const listingUrl =
    (typeof resultRecord.exactListingUrl === "string" && resultRecord.exactListingUrl.trim()) ||
    (typeof listingEvidenceRecord.exactListingUrl === "string" && listingEvidenceRecord.exactListingUrl.trim()) ||
    null;
  const productLike = (resultRecord.product ?? {}) as { title?: unknown; name?: unknown };
  const productName =
    (
      (typeof productLike.title === "string" && productLike.title.trim()) ||
      (typeof productLike.name === "string" && productLike.name.trim()) ||
      ""
    ).slice(0, 120) || undefined;

  return (
    <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-10">
      <ResultsClient initialResult={initialResult} initialScanId={scanId} initialOwnerGrant={initialOwnerGrant} />
      {listingUrl ? (
        <div className="mt-6">
          <WatchProductButton listingUrl={listingUrl} productName={productName} />
        </div>
      ) : null}
      {scanId && communityKey ? (
        <div className="mt-6">
          <ReviewAskCta scanId={scanId} productName={productName} />
        </div>
      ) : null}
      {communityKey ? <CommunityReviewsSection productKey={communityKey} /> : null}
    </main>
  );
}
