type UnsubscribePageProps = {
  searchParams?: Promise<{
    email?: string;
  }>;
};

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const params = await searchParams;
  const email = params?.email ?? "";

  return (
    <main className="min-h-screen bg-sand px-6 py-12 text-ink dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-line bg-white p-8 shadow-soft dark:border-white/10 dark:bg-slate-900">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
          ReviewIntel
        </p>
        <h1 className="mt-3 text-4xl font-black">Unsubscribe</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">
          Stop receiving ReviewIntel marketing emails. Support and account-related emails may still be sent when needed.
        </p>

        <form action="/api/unsubscribe" method="post" className="mt-6 grid gap-3">
          <input
            name="email"
            defaultValue={email}
            type="email"
            required
            placeholder="your@email.com"
            className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
          />
          <button className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
            Unsubscribe me
          </button>
        </form>
      </section>
    </main>
  );
}
