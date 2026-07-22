"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type CalendarTask = {
  id: string;
  title: string;
  note?: string | null;
  task_date?: string | null;
  category?: string | null;
  priority?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CalendarForm = {
  title: string;
  note: string;
  task_date: string;
  category: string;
  priority: string;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function readableDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "full",
    }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function startOfMonthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return start;
}

function buildMonthDays(month: Date) {
  const start = startOfMonthGrid(month);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function statusClass(status?: string | null) {
  if (status === "done") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200";
  }

  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200";
}

function categoryClass(category?: string | null) {
  if (category === "tax") return "bg-violet-500";
  if (category === "maintenance") return "bg-sky-500";
  if (category === "launch") return "bg-emerald-500";
  if (category === "customer") return "bg-rose-500";
  return "bg-ocean";
}

function priorityClass(priority?: string | null) {
  if (priority === "high") return "text-rose-600 dark:text-rose-300";
  if (priority === "low") return "text-slate-400";
  return "text-amber dark:text-amber-300";
}

export function AdminBusinessCalendar() {
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [form, setForm] = useState<CalendarForm>({
    title: "",
    note: "",
    task_date: todayKey(),
    category: "business",
    priority: "normal",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadTasks() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/calendar", {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Calendar could not be loaded.");
        setTasks([]);
        return;
      }

      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch {
      setError("Calendar could not be loaded.");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          title: form.title.trim(),
          note: form.note.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Calendar task could not be saved.");
        return;
      }

      setForm((current) => ({
        ...current,
        title: "",
        note: "",
        task_date: selectedDate,
      }));

      await loadTasks();
    } catch {
      setError("Calendar task could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(id: string, patch: Partial<CalendarTask>) {
    setError("");

    try {
      const response = await fetch("/api/admin/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          ...patch,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Calendar task could not be updated.");
        return;
      }

      await loadTasks();
    } catch {
      setError("Calendar task could not be updated.");
    }
  }

  function selectDate(value: string) {
    setSelectedDate(value);
    setForm((current) => ({
      ...current,
      task_date: value,
    }));
  }

  function moveMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function goToday() {
    const now = new Date();
    const key = todayKey();
    setMonth(now);
    selectDate(key);
  }

  const days = useMemo(() => buildMonthDays(month), [month]);

  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, CalendarTask[]>();

    for (const task of tasks) {
      const key = task.task_date || "No date";
      const list = grouped.get(key) || [];
      list.push(task);
      grouped.set(key, list);
    }

    for (const [, list] of grouped) {
      list.sort((a, b) => {
        if ((a.status || "pending") === "done" && (b.status || "pending") !== "done") return 1;
        if ((a.status || "pending") !== "done" && (b.status || "pending") === "done") return -1;
        return String(a.created_at || "").localeCompare(String(b.created_at || ""));
      });
    }

    return grouped;
  }, [tasks]);

  const selectedTasks = tasksByDate.get(selectedDate) || [];

  const upcomingTasks = useMemo(() => {
    const today = todayKey();

    return tasks
      .filter((task) => (task.task_date || "") >= today && task.status !== "done")
      .sort((a, b) => String(a.task_date || "").localeCompare(String(b.task_date || "")))
      .slice(0, 8);
  }, [tasks]);

  const summary = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((task) => task.status !== "done").length,
      done: tasks.filter((task) => task.status === "done").length,
      high: tasks.filter((task) => task.priority === "high").length,
    };
  }, [tasks]);

  useEffect(() => {
    void loadTasks();
  }, []);

  return (
    <section className="rounded-[2rem] border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
            Supabase business calendar
          </p>
          <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">
            Apple-style admin calendar
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Saved in Supabase using admin_calendar_tasks. Use this for ReviewIntel business reminders, tax tasks, launch work, maintenance, and customer follow-ups.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={goToday}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-black text-ink transition hover:bg-mist dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => void loadTasks()}
            className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ocean dark:bg-white dark:text-ink"
          >
            Refresh
          </button>
        </div>
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

      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{error}</p>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 rounded-[1.75rem] border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl font-black text-ink shadow-sm transition hover:bg-slate-100 dark:bg-slate-900 dark:text-white"
                aria-label="Previous month"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl font-black text-ink shadow-sm transition hover:bg-slate-100 dark:bg-slate-900 dark:text-white"
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            <h3 className="text-2xl font-black text-ink dark:text-white">{monthLabel(month)}</h3>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekdayLabels.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-[11px] font-black uppercase tracking-[0.12em] text-slate-400"
              >
                {day}
              </div>
            ))}

            {days.map((day) => {
              const key = dateKey(day);
              const inMonth = day.getMonth() === month.getMonth();
              const isToday = key === todayKey();
              const isSelected = key === selectedDate;
              const dayTasks = tasksByDate.get(key) || [];

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => selectDate(key)}
                  className={`min-h-[118px] rounded-2xl border p-2 text-left transition ${
                    isSelected
                      ? "border-ocean bg-white shadow-lg ring-2 ring-ocean/20 dark:border-cyan-300 dark:bg-slate-900"
                      : "border-white bg-white/80 hover:border-ocean/40 hover:bg-white dark:border-white/5 dark:bg-gradient-to-r from-sky-600 to-teal-500/70 dark:hover:border-cyan-300/30"
                  } ${inMonth ? "opacity-100" : "opacity-40"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${
                        isToday
                          ? "bg-ocean text-white dark:bg-cyan-300 dark:text-ink"
                          : "text-ink dark:text-white"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayTasks.length ? (
                      <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-black text-slate-500 dark:bg-white/10">
                        {dayTasks.length}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 space-y-1">
                    {dayTasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className={`truncate rounded-lg px-2 py-1 text-[11px] font-black ${
                          task.status === "done"
                            ? "bg-emerald-50 text-emerald-700 line-through dark:bg-emerald-400/10 dark:text-emerald-200"
                            : "bg-ocean/10 text-ocean dark:bg-cyan-300/10 dark:text-cyan-200"
                        }`}
                      >
                        <span className={`mr-1 inline-block h-2 w-2 rounded-full ${categoryClass(task.category)}`} />
                        {task.title}
                      </div>
                    ))}
                    {dayTasks.length > 3 ? (
                      <p className="px-2 text-[10px] font-black text-slate-400">
                        +{dayTasks.length - 3} more
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[1.75rem] border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-ocean dark:text-cyan-300">
              Selected day
            </p>
            <h3 className="mt-2 text-xl font-black text-ink dark:text-white">
              {readableDate(selectedDate)}
            </h3>

            <form onSubmit={addTask} className="mt-4 space-y-3">
              <input
                type="hidden"
                value={form.task_date}
                readOnly
              />

              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Event or task title"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />

              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>

              <textarea
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Notes"
                rows={3}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-ocean px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ink disabled:opacity-60"
              >
                {saving ? "Saving..." : "Add to Calendar"}
              </button>
            </form>
          </div>

          <div className="rounded-[1.75rem] border border-line bg-white p-5 dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Events on this day
            </p>

            <div className="mt-4 max-h-[340px] space-y-3 overflow-y-auto pr-1">
              {loading ? (
                <p className="text-sm font-bold text-slate-500">Loading calendar...</p>
              ) : selectedTasks.length === 0 ? (
                <p className="rounded-2xl bg-mist p-4 text-sm font-bold text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
                  No events for this day.
                </p>
              ) : (
                selectedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusClass(task.status)}`}>
                        {task.status ?? "pending"}
                      </span>
                      <span className={`text-[10px] font-black uppercase ${priorityClass(task.priority)}`}>
                        {task.priority ?? "normal"}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-slate-600 dark:bg-gradient-to-r from-sky-600 to-teal-500/20 dark:text-slate-300">
                        {task.category ?? "business"}
                      </span>
                    </div>

                    <h4 className="mt-3 break-words text-sm font-black text-ink dark:text-white">{task.title}</h4>
                    {task.note ? (
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600 dark:text-slate-300">
                        {task.note}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void updateTask(task.id, { status: "done" })}
                        className="rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-black text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
                      >
                        Mark Done
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateTask(task.id, { status: "pending" })}
                        className="rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-black text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white"
                      >
                        Reopen
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-line bg-white p-5 dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Upcoming
            </p>

            <div className="mt-4 space-y-3">
              {upcomingTasks.length === 0 ? (
                <p className="text-sm font-bold text-slate-500">No upcoming pending items.</p>
              ) : (
                upcomingTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => selectDate(task.task_date || todayKey())}
                    className="block w-full rounded-2xl bg-mist p-4 text-left transition hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                  >
                    <p className="text-xs font-black uppercase text-slate-400">{task.task_date}</p>
                    <p className="mt-1 break-words text-sm font-black text-ink dark:text-white">{task.title}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
