import { Suspense } from "react";
import { AccountDashboard } from "@/components/AccountDashboard";
import { QuickNav } from "@/components/QuickNav";
import { ClearScanDataButton } from "@/components/ClearScanDataButton";

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
        <QuickNav mode="general" current="/account" />

      <Suspense fallback={<p className="text-sm text-slate-600">Loading account...</p>}>
        <AccountDashboard />
      </Suspense>
      <section className="mt-6 rounded-[2rem] border border-coral/20 bg-white p-6 shadow-soft dark:border-coral/30 dark:bg-slate-950">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-coral">Privacy control</p>
        <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">Clear saved scan history</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          This removes saved scan results from this browser. It does not delete your account.
        </p>
        <div className="mt-5">
          <ClearScanDataButton />
        </div>
      </section>

    </main>
  );
}
