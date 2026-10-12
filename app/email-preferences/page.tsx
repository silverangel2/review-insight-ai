import type { Metadata } from "next";
import { EmailPreferencesPanel } from "@/components/EmailPreferencesPanel";

export const metadata: Metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
};

export default async function EmailPreferencesPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="min-h-[70vh] bg-mist px-4 py-12 text-ink dark:bg-slate-950 dark:text-white sm:px-6">
      <EmailPreferencesPanel initialToken={params?.token || ""} />
    </main>
  );
}
