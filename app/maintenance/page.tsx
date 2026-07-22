export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-mist px-6 py-16 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <section className="max-w-xl rounded-2xl border border-line bg-white p-8 text-center shadow-soft dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">ReviewIntel</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-ink dark:text-white">ReviewIntel is temporarily updating.</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">Please check back shortly. We are making a few updates and will be back online soon.</p>
      </section>
    </main>
  );
}
