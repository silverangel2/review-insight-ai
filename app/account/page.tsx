import { Suspense } from "react";
import { AccountDashboard } from "@/components/AccountDashboard";

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <Suspense fallback={<p className="text-sm text-slate-600">Loading account...</p>}>
        <AccountDashboard />
      </Suspense>
    </main>
  );
}
