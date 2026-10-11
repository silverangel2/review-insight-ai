"use client";

import { useEffect, useState, type FormEvent } from "react";

type Prefs = {
  email: string;
  productUpdates: boolean;
  upgradeTips: boolean;
  columnsReady: boolean;
};

export function EmailPreferencesPanel({ initialToken = "" }: { initialToken?: string }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [productUpdates, setProductUpdates] = useState(false);
  const [upgradeTips, setUpgradeTips] = useState(true);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const query = initialToken ? `?token=${encodeURIComponent(initialToken)}` : "";
    fetch(`/api/email-preferences${query}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Email settings could not be loaded.");
        setPrefs(data);
        setProductUpdates(Boolean(data.productUpdates));
        setUpgradeTips(Boolean(data.upgradeTips));
        setStatus("ready");
      })
      .catch((loadError) => {
        setStatus("error");
        setError(loadError instanceof Error ? loadError.message : "Email settings could not be loaded.");
      });
  }, [initialToken]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    setStatus("saving");
    const response = await fetch("/api/email-preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: initialToken, productUpdates, upgradeTips }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("ready");
      setError(data.error || "Email settings could not be saved.");
      return;
    }
    setStatus("ready");
    setMessage(data.message || "Email settings saved.");
  }

  return (
    <section className="mx-auto max-w-xl rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-900 sm:p-8">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-ocean">ReviewIntel</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-ink dark:text-white">Email preferences</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Choose the notes you want. Account, security, and billing messages can still be sent when they are needed.
      </p>

      {status === "loading" ? <p className="mt-6 text-sm text-slate-600" role="status">Loading your email settings...</p> : null}
      {error ? <p className="mt-6 text-sm font-semibold text-coralink" role="alert">{error}</p> : null}

      {prefs ? (
        <form onSubmit={save} className="mt-6 grid gap-4">
          <p className="text-sm font-semibold text-ink dark:text-white">Settings for {prefs.email}</p>
          <label className="flex items-start gap-3 rounded-2xl border border-line p-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:text-slate-200">
            <input type="checkbox" className="mt-1 size-4" checked={productUpdates} onChange={(event) => setProductUpdates(event.target.checked)} />
            <span>Product updates. Occasional news about ReviewIntel. Off unless you asked for them.</span>
          </label>
          <label className="flex items-start gap-3 rounded-2xl border border-line p-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:text-slate-200">
            <input type="checkbox" className="mt-1 size-4" checked={upgradeTips} onChange={(event) => setUpgradeTips(event.target.checked)} />
            <span>One note after your first scan, about what a paid plan adds. No countdown and no repeat series.</span>
          </label>
          {!prefs.columnsReady ? (
            <p className="text-sm leading-6 text-slate-600" role="status">
              The newer email choices are waiting on a database update. Product updates can still be saved.
            </p>
          ) : null}
          <button type="submit" disabled={status === "saving"} className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-600">
            {status === "saving" ? "Saving..." : "Save email settings"}
          </button>
          {message ? <p className="text-sm font-semibold text-teal" role="status">{message}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
