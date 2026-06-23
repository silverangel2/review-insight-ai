import type { Metadata } from "next";
import { AdminAccessForm } from "@/components/AdminAccessForm";

export const metadata: Metadata = {
  title: "Secure Access",
  robots: {
    index: false,
    follow: false
  }
};

export default function AdminAccessPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <AdminAccessForm />
    </main>
  );
}
