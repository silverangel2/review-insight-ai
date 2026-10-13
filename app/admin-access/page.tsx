import type { Metadata } from "next";
import { withSeo } from "@/lib/pageSeo";
import { AdminAccessForm } from "@/components/AdminAccessForm";

export const metadata: Metadata = withSeo("/admin-access", {
  title: "Secure Access",
  robots: {
    index: false,
    follow: false
  }
}, { noindex: true });

export default function AdminAccessPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <AdminAccessForm />
    </main>
  );
}
