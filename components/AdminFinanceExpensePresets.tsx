"use client";

import { FormEvent, useMemo, useState } from "react";

type ExpensePreset = {
  label: string;
  category: string;
  description: string;
  taxNote: string;
};

const expensePresets: ExpensePreset[] = [
  {
    label: "Vercel Hosting",
    category: "Hosting",
    description: "Vercel hosting / deployment expense",
    taxNote: "Website hosting / cloud infrastructure expense for ReviewIntel.",
  },
  {
    label: "Vercel Domain",
    category: "Domain",
    description: "Domain renewal / domain registration",
    taxNote: "Business domain expense for ReviewIntel website.",
  },
  {
    label: "Supabase",
    category: "Database",
    description: "Supabase database / backend expense",
    taxNote: "Database and backend storage expense.",
  },
  {
    label: "Resend Email",
    category: "Email",
    description: "Resend email provider expense",
    taxNote: "Business email delivery provider for support, marketing, and transactional emails.",
  },
  {
    label: "OpenAI API",
    category: "AI/API",
    description: "OpenAI API usage expense",
    taxNote: "AI API expense used for product review analysis and admin tools.",
  },
  {
    label: "Stripe Fees",
    category: "Payment Fees",
    description: "Stripe payment processing fees",
    taxNote: "Payment processing fees for ReviewIntel customer payments.",
  },
  {
    label: "Google Ads / Marketing",
    category: "Marketing",
    description: "Advertising or marketing campaign expense",
    taxNote: "Marketing and advertising expense.",
  },
  {
    label: "Canva / Design Assets",
    category: "Design",
    description: "Design software, creative assets, or branding expense",
    taxNote: "Design and creative asset expense for business marketing.",
  },
  {
    label: "Software Subscription",
    category: "Software",
    description: "Business software subscription",
    taxNote: "Software subscription used for ReviewIntel operations.",
  },
  {
    label: "Bank / Payment Fees",
    category: "Bank Fees",
    description: "Bank fee, card fee, or payment-related charge",
    taxNote: "Business banking or payment fee.",
  },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminFinanceExpensePresets() {
  const [selectedLabel, setSelectedLabel] = useState(expensePresets[0].label);
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayKey());
  const [currency, setCurrency] = useState("CAD");
  const [extraNote, setExtraNote] = useState("");
  const [status, setStatus] = useState("Choose a preset, enter the real amount, then log it.");
  const [saving, setSaving] = useState(false);

  const selectedPreset = useMemo(() => {
    return expensePresets.find((preset) => preset.label === selectedLabel) || expensePresets[0];
  }, [selectedLabel]);

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setStatus("Enter the real expense amount first.");
      return;
    }

    setSaving(true);
    setStatus("Logging expense...");

    try {
      const response = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "expense",
          amount: numericAmount,
          currency,
          entry_date: entryDate,
          category: selectedPreset.category,
          description: extraNote
            ? `${selectedPreset.description} — ${extraNote}`
            : selectedPreset.description,
          tax_note: selectedPreset.taxNote,
          status: "logged",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setStatus(data.error || "Expense could not be logged.");
        return;
      }

      setAmount("");
      setExtraNote("");
      setStatus(`${selectedPreset.label} expense logged and included in finance totals.`);
    } catch {
      setStatus("Expense could not be logged.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
            Forgotten expenses
          </p>
          <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">
            Quick expense logger
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Use this for common ReviewIntel expenses you might forget, like Vercel domain renewal, hosting, Supabase, Resend, OpenAI API, Stripe fees, and marketing. Amounts are not guessed — enter the real charge from your bill.
          </p>
        </div>
      </div>

      <form onSubmit={submitExpense} className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.6fr_0.5fr_0.7fr]">
        <label className="space-y-2">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Expense type
          </span>
          <select
            value={selectedLabel}
            onChange={(event) => setSelectedLabel(event.target.value)}
            className="w-full rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-black text-ink outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            {expensePresets.map((preset) => (
              <option key={preset.label} value={preset.label}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Amount
          </span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className="w-full rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-black text-ink outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Currency
          </span>
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="w-full rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-black text-ink outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            <option value="CAD">CAD</option>
            <option value="USD">USD</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Date
          </span>
          <input
            type="date"
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
            className="w-full rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-black text-ink outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
        </label>

        <label className="space-y-2 xl:col-span-3">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Extra note
          </span>
          <input
            value={extraNote}
            onChange={(event) => setExtraNote(event.target.value)}
            placeholder="Example: June invoice, domain renewal, API usage, card charge..."
            className="w-full rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold text-ink outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="self-end rounded-2xl bg-ocean px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Logging..." : "Log Expense"}
        </button>
      </form>

      <div className="mt-5 rounded-2xl border border-ocean/15 bg-ocean/5 p-4 dark:border-cyan-300/20 dark:bg-cyan-300/10">
        <p className="text-sm font-black text-ocean dark:text-cyan-200">{status}</p>
        <p className="mt-2 text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">
          Selected tax note: {selectedPreset.taxNote}
        </p>
      </div>
    </section>
  );
}
