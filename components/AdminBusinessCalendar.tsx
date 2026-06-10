"use client";

import { useEffect, useMemo, useState } from "react";

type CalendarTask = {
  id: string;
  task_date?: string | null;
  title: string;
  note?: string | null;
  category?: string | null;
  status?: string | null;
  priority?: string | null;
  created_at?: string | null;
};

const defaultForm = {
  task_date: new Date().toISOString().slice(0, 10),
  title: "",
  note: "",
  category: "business",
  priority: "normal"
};

function statusClass(status?: string | null) {
  if (status === "done") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200";
  if (status === "cancelled") return "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300";
  return "bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-100";
}

export function AdminBusinessCalendar() {
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((task) => task.status !== "done").length,
      done: tasks.filter((task) => task.status === "done").length,
      high: tasks.filter((task) => task.priority === "high").length
    };
  }, [tasks]);

  async function loadTasks() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/calendar", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load calendar tasks.");
      }

      setTasks(data.tasks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar tasks.");
    } finally {
      setLoading(false);
    }
  }

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/calendar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to save calendar task.");
      }

      setForm({ ...defaultForm, task_date: form.task_date });
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save calendar task.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(id: string, patch: Record<string, unknown>) {
    const response = await fetch("/api/admin/calendar", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id, ...patch })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data?.error ?? "Failed to update task.");
      return;
    }

    await loadTasks();
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
            Supabase business calendar
          </p>
          <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">
            Admin business tasks, tax reminders, and operations calendar
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Saved in Supabase using admin_calendar_tasks. Use this for ReviewIntel business reminders, tax tasks, launch work, and maintenance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadTasks()}
          className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ocean dark:bg-white dark:text-ink"
        >
          Refresh Calendar
        </button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Total</p>
          <p className="mt-2 text-3xl font-black text-ink dark:text-white">{summary.total}</p>
        </div>
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Pending</p>
          <p className="mt-2 text-3xl font-black text-amber">{summary.pending}</p>
        </div>
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Done</p>
          <p className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-300">{summary.done}</p>
        </div>
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">High priority</p>
          <p className="mt-2 text-3xl font-black text-rose-600 dark:text-rose-300">{summary.high}</p>
        </div>
      </div>

      <form onSubmit={addTask} className="mt-6 grid gap-3 rounded-3xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04] lg:grid-cols-4">
        <input
          type="date"
          value={form.task_date}
          onChange={(event) => setForm((current) => ({ ...current, task_date: event.target.value }))}
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
        />

        <select
          value={form.category}
          onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
        >
          <option value="business">Business</option>
          <option value="tax">Tax</option>
          <option value="maintenance">Maintenance</option>
          <option value="launch">Launch</option>
          <option value="customer">Customer</option>
        </select>

        <select
          value={form.priority}
          onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
        >
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>

        <input
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          placeholder="Task title"
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
        />

        <textarea
          value={form.note}
          onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
          placeholder="Task note / comment"
          rows={3}
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white lg:col-span-4"
        />

        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl bg-ocean px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ink disabled:opacity-60 lg:col-span-4"
        >
          {saving ? "Saving..." : "Add Calendar Task"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{error}</p>
      ) : null}

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm font-bold text-slate-500">Loading calendar...</p>
        ) : tasks.length === 0 ? (
          <p className="rounded-2xl bg-mist p-5 text-sm font-bold text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
            No business calendar tasks yet.
          </p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${statusClass(task.status)}`}>
                      {task.status ?? "pending"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-slate-600 dark:bg-black/20 dark:text-slate-300">
                      {task.priority ?? "normal"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-slate-600 dark:bg-black/20 dark:text-slate-300">
                      {task.category ?? "business"}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-black text-ink dark:text-white">{task.title}</h3>
                  <p className="mt-1 text-sm font-bold text-slate-500">{task.task_date ?? "No date"}</p>
                  {task.note ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{task.note}</p> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void updateTask(task.id, { status: "done" })}
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-xs font-black text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  >
                    Mark Done
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateTask(task.id, { status: "pending" })}
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-xs font-black text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  >
                    Reopen
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
