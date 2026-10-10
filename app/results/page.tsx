import type { Metadata } from "next";
import { ResultsClient } from "@/components/ResultsClient";

export const metadata: Metadata = {
  title: "Your ReviewIntel result",
  description: "A plain Buy, Wait or Skip answer built only from real written buyer reviews of this exact product.",
  robots: { index: false },
};

export default function ResultsPage() {
  return (
    <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-10">
      <ResultsClient />
    </main>
  );
}
