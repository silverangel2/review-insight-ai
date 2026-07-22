"use client";

import { useEffect, useMemo, useState } from "react";

type FinanceEntry = {
  id: string;
  entry_date?: string | null;
  type: "income" | "expense";
  category: string;
  amount: number;
  currency?: string | null;
  description?: string | null;
  tax_note?: string | null;
  receipt_url?: string | null;
  created_at?: string | null;
};

const defaultForm = {
  entry_date: new Date().toISOString().slice(0, 10),
  type: "expense",
  category: "",
  amount: "",
  currency: "CAD",
  description: "",
  tax_note: "",
  receipt_url: ""
};

function money(value: number, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency
  }).format(value);
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function AdminFinanceTracker() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const summary = useMemo(() => {
    const income = entries
      .filter((entry) => entry.type === "income")
      .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);

    const expenses = entries
      .filter((entry) => entry.type === "expense")
      .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);

    return {
      income,
      expenses,
      net: income - expenses,
      total: entries.length
    };
  }, [entries]);

  const categorySummary = useMemo(() => {
    const groups = new Map<string, { income: number; expense: number }>();

    for (const entry of entries) {
      const key = entry.category || "Uncategorized";
      const current = groups.get(key) ?? { income: 0, expense: 0 };

      if (entry.type === "income") {
        current.income += Number(entry.amount ?? 0);
      } else {
        current.expense += Number(entry.amount ?? 0);
      }

      groups.set(key, current);
    }

    return Array.from(groups.entries())
      .map(([category, values]) => ({ category, ...values, net: values.income - values.expense }))
      .sort((a, b) => Math.abs(b.income + b.expense) - Math.abs(a.income + a.expense));
  }, [entries]);

  async function loadEntries() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/finance", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load finance entries.");
      }

      setEntries(data.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load finance entries.");
    } finally {
      setLoading(false);
    }
  }

  async function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");

    try {
      const response = await fetch("/api/admin/finance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount)
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to save finance entry.");
      }

      setSaved("Saved.");
      setForm({ ...defaultForm, entry_date: form.entry_date });
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save finance entry.");
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const rows = [
      ["Date", "Type", "Category", "Amount", "Currency", "Description", "Tax note", "Receipt URL", "Created At"],
      ...entries.map((entry) => [
        entry.entry_date ?? "",
        entry.type,
        entry.category,
        entry.amount,
        entry.currency ?? "CAD",
        entry.description ?? "",
        entry.tax_note ?? "",
        entry.receipt_url ?? "",
        entry.created_at ?? ""
      ])
    ];

    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `reviewintel-tax-finance-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    void loadEntries();
  }, []);


  async function deleteEntry(entryId: string, label: string) {
    const confirmed = window.confirm(`Delete this finance entry?\n\n${label}\n\nThis will recalculate totals and save a delete log.`);

    if (!confirmed) {
      return;
    }

    setDeletingId(entryId);

    try {
      const response = await fetch(`/api/admin/finance?id=${encodeURIComponent(entryId)}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        window.alert(data.error || "Finance entry could not be deleted.");
        return;
      }

      setEntries(data.entries || []);
    } catch {
      window.alert("Finance entry could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
            Finance tracker
          </p>
          <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">
            Revenue, expenses, and tax notes
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Add income and business expenses here. Export the CSV when you need records for tax organization.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadEntries()}
            className="rounded-2xl border border-line px-5 py-3 text-sm font-black text-ink transition hover:-translate-y-0.5 dark:border-white/10 dark:text-white"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ocean dark:bg-white dark:text-ink"
          >
            Export Tax CSV
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Income</p>
          <p className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-300">{money(summary.income)}</p>
        </div>
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Expenses</p>
          <p className="mt-2 text-3xl font-black text-rose-600 dark:text-rose-300">{money(summary.expenses)}</p>
        </div>
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Net</p>
          <p className="mt-2 text-3xl font-black text-ink dark:text-white">{money(summary.net)}</p>
        </div>
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Entries</p>
          <p className="mt-2 text-3xl font-black text-ocean dark:text-cyan-300">{summary.total}</p>
        </div>
      </div>

      <form onSubmit={saveEntry} className="mt-6 grid gap-3 rounded-3xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04] lg:grid-cols-4">
        <input
          type="date"
          value={form.entry_date}
          onChange={(event) => setForm((current) => ({ ...current, entry_date: event.target.value }))}
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
        />

        <select
          value={form.type}
          onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>

        <input
          value={form.category}
          onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
          placeholder="Category, e.g. OpenAI, Domain, Sales"
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white lg:col-span-2"
        />

        <input
          value={form.amount}
          onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
          placeholder="Amount"
          inputMode="decimal"
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
        />

        <input
          value={form.currency}
          onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
          placeholder="CAD"
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
        />

        <input
          value={form.receipt_url}
          onChange={(event) => setForm((current) => ({ ...current, receipt_url: event.target.value }))}
          placeholder="Receipt URL optional"
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white lg:col-span-2"
        />

        <textarea
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          placeholder="Description / comment"
          rows={3}
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white lg:col-span-2"
        />

        <textarea
          value={form.tax_note}
          onChange={(event) => setForm((current) => ({ ...current, tax_note: event.target.value }))}
          placeholder="Tax note, claim reason, business purpose"
          rows={3}
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white lg:col-span-2"
        />

        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl bg-ocean px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ink disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 lg:col-span-4"
        >
          {saving ? "Saving..." : "Add Finance Entry"}
        </button>
      </form>

      {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{error}</p> : null}
      {saved ? <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{saved}</p> : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-line p-5 dark:border-white/10">
          <h3 className="text-lg font-black text-ink dark:text-white">Category summary</h3>
          <div className="mt-4 space-y-3">
            {categorySummary.length === 0 ? (
              <p className="text-sm font-bold text-slate-500">No categories yet.</p>
            ) : (
              categorySummary.map((item) => (
                <div key={item.category} className="rounded-2xl bg-mist p-4 text-sm dark:bg-white/[0.04]">
                  <p className="font-black text-ink dark:text-white">{item.category}</p>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">
                    Income {money(item.income)} · Expenses {money(item.expense)} · Net {money(item.net)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-line p-5 dark:border-white/10">
          <h3 className="text-lg font-black text-ink dark:text-white">Recent entries</h3>

          {loading ? (
            <p className="mt-4 text-sm font-bold text-slate-500">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="mt-4 text-sm font-bold text-slate-500">No finance entries yet.</p>
          ) : (
            <div className="mt-4 max-h-[520px] space-y-3 overflow-auto pr-2">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-ink dark:text-white">
                        {entry.category} · {entry.entry_date}
                      </p>
                      <p className="mt-1 text-xs font-black uppercase text-slate-500">{entry.type}</p>
                    </div>
                    <p className={`text-lg font-black ${entry.type === "income" ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
                      {entry.type === "income" ? "+" : "-"}{money(Number(entry.amount ?? 0), entry.currency ?? "CAD")}
                    </p>
                  </div>

                  {entry.description ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{entry.description}</p> : null}
                  {entry.tax_note ? <p className="mt-2 rounded-xl bg-white p-3 text-xs font-bold text-slate-600 dark:bg-gradient-to-r from-sky-600 to-teal-500/20 dark:text-slate-300">Tax note: {entry.tax_note}</p> : null}
                  {entry.receipt_url ? (
                    <a href={entry.receipt_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-black text-ocean dark:text-cyan-300">
                      Open receipt
                    </a>
                  ) : null}

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => deleteEntry(entry.id, `${entry.category} · ${entry.entry_date} · ${money(Number(entry.amount ?? 0), entry.currency ?? "CAD")}`)}
                      disabled={deletingId === entry.id}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200"
                    >
                      {deletingId === entry.id ? "Deleting..." : "Delete mistaken entry"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
