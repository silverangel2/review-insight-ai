import Link from "next/link";

export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-mist px-6 py-16 dark:bg-slate-950">
      <section className="max-w-xl rounded-2xl border border-line bg-white p-8 text-center shadow-soft dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">ReviewIntel</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-ink dark:text-white">ReviewIntel is temporarily updating.</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">Please check back shortly. Admin accounts can still use the System Control Center.</p>
        <Link href="/admin" className="mt-6 inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
          Admin dashboard
        </Link>
      </section>
    </main>
  );
}
