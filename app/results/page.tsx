import type { Metadata } from "next";
import { ResultsClient } from "@/components/ResultsClient";
import { loadServerResult } from "@/lib/serverResult";
import type { AnalyzeResponse } from "@/lib/types";

export const metadata: Metadata = {
  title: "Your ReviewIntel result",
  description: "A plain Buy, Wait or Skip answer built only from real written buyer reviews of this exact product.",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function ResultsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const scanId = typeof params.scanId === "string" ? params.scanId : null;
  const initialResult = (await loadServerResult(scanId)) as AnalyzeResponse | null;
  return (
    <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-10">
      <ResultsClient initialResult={initialResult} initialScanId={scanId} />
    </main>
  );
}
