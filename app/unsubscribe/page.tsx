import type { Metadata } from "next";
import { UnsubscribePanel } from "@/components/UnsubscribePanel";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; email?: string; done?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="min-h-[70vh] bg-mist px-4 py-12 text-ink dark:bg-slate-950 dark:text-white sm:px-6">
      <UnsubscribePanel
        initialToken={params?.token || ""}
        initialEmail={params?.email || ""}
        alreadyDone={params?.done === "1"}
      />
    </main>
  );
}
