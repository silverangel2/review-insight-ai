import type { Metadata } from "next";
import { OwnerAccessPanel } from "@/components/OwnerAccessPanel";

export const metadata: Metadata = {
  title: "Owner Access | ReviewIntel",
  robots: {
    index: false,
    follow: false
  }
};

export default function OwnerAccessPage() {
  return (
    <main className="min-h-screen bg-mist px-6 py-10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <OwnerAccessPanel />
    </main>
  );
}
