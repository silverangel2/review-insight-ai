"use client";

import { useState, type FormEvent } from "react";

export function UnsubscribePanel({ initialToken = "", initialEmail = "", alreadyDone = false }: {
  initialToken?: string;
  initialEmail?: string;
  alreadyDone?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [done, setDone] = useState(alreadyDone);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const response = await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: initialToken, email }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error || "We could not turn those emails off.");
      return;
    }
    setDone(true);
  }

  return (
    <section className="mx-auto max-w-xl rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900 sm:p-8">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-ocean">ReviewIntel</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-ink dark:text-white">Unsubscribe</h1>
      {done ? (
        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300" role="status">
          Product updates and the note after a first scan are off. Account and billing messages can still be sent when they are needed.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            This turns off product updates and the one note after your first scan. It does not close your account.
          </p>
          <form onSubmit={submit} className="mt-6 grid gap-3" action="/api/unsubscribe" method="post">
            {initialToken ? <input type="hidden" name="token" value={initialToken} /> : null}
            <label className="grid gap-2 text-sm font-bold text-ink dark:text-white" htmlFor="unsubscribe-email">
              Email address
              <input
                id="unsubscribe-email"
                name="email"
                type="email"
                required={!initialToken}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-semibold text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>
            <button type="submit" disabled={pending} className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-600">
              {pending ? "Saving..." : "Turn off product emails"}
            </button>
            {error ? <p className="text-sm font-semibold text-coralink" role="alert">{error}</p> : null}
          </form>
        </>
      )}
    </section>
  );
}
