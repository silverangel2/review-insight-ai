"use client";

import { useEffect, useMemo, useState } from "react";

type ContactMessage = {
  id: string;
  name?: string | null;
  email?: string | null;
  subject?: string | null;
  message: string;
  status?: string | null;
  priority?: string | null;
  source?: string | null;
  admin_notes?: string | null;
  created_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString();
}

function statusClass(status?: string | null) {
  if (status === "unread") return "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200";
  if (status === "replied") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200";
  if (status === "archived") return "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300";
  return "bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200";
}

export function AdminEmailInbox() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [copied, setCopied] = useState(false);

  const summary = useMemo(() => {
    return {
      total: messages.length,
      unread: messages.filter((item) => item.status === "unread").length,
      replied: messages.filter((item) => item.status === "replied").length
    };
  }, [messages]);

  async function loadMessages() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/messages", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load messages.");
      }

      setMessages(data.messages ?? []);
      setSelected(data.messages?.[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }

  async function updateMessage(id: string, patch: Record<string, unknown>) {
    const response = await fetch("/api/admin/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data?.error ?? "Update failed.");
      return;
    }

    await loadMessages();
  }

  async function copyForRusty(message: ContactMessage) {
    const report = [
      "ReviewIntel Customer Message",
      "",
      `Status: ${message.status ?? "unknown"}`,
      `Priority: ${message.priority ?? "normal"}`,
      `From: ${message.email ?? "No email"}`,
      `Subject: ${message.subject ?? "No subject"}`,
      `Date: ${formatDate(message.created_at)}`,
      `Source: ${message.source ?? "website"}`,
      "",
      "Message:",
      message.message,
      "",
      "Admin notes:",
      message.admin_notes ?? "None",
      "",
      "Please help me reply or troubleshoot this."
    ].join("\n");

    await navigator.clipboard.writeText(report);
    setCopied(true);
  }

  useEffect(() => {
    void loadMessages();
  }, []);

  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
            Admin inbox
          </p>
          <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">
            Customer messages
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Messages submitted from the website support form are saved here.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadMessages()}
          className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
        >
          Refresh Messages
        </button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Total</p>
          <p className="mt-2 text-3xl font-black text-ink dark:text-white">{summary.total}</p>
        </div>
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Unread</p>
          <p className="mt-2 text-3xl font-black text-rose-600 dark:text-rose-300">{summary.unread}</p>
        </div>
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Replied</p>
          <p className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-300">{summary.replied}</p>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm font-bold text-slate-500">Loading messages...</p>
      ) : messages.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-mist p-5 text-sm font-bold text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
          No customer messages yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            {messages.map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => {
                  setSelected(message);
                  setCopied(false);
                }}
                className="w-full rounded-2xl border border-line bg-mist p-4 text-left transition hover:-translate-y-0.5 hover:border-ocean dark:border-white/10 dark:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-ink dark:text-white">{message.subject ?? "No subject"}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{message.email ?? "No email"} · {formatDate(message.created_at)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${statusClass(message.status)}`}>
                    {message.status ?? "read"}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{message.message}</p>
              </button>
            ))}
          </div>

          {selected ? (
            <div className="rounded-3xl border border-line bg-white p-5 dark:border-white/10 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black text-ink dark:text-white">{selected.subject ?? "No subject"}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{selected.email ?? "No email"} · {formatDate(selected.created_at)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${statusClass(selected.status)}`}>
                  {selected.status ?? "read"}
                </span>
              </div>

              <p className="mt-5 whitespace-pre-wrap rounded-2xl bg-mist p-4 text-sm leading-6 text-slate-700 dark:bg-white/[0.04] dark:text-slate-200">
                {selected.message}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={() => void updateMessage(selected.id, { status: "read" })} className="rounded-2xl border border-line px-4 py-3 text-xs font-black dark:border-white/10">Mark Read</button>
                <button onClick={() => void updateMessage(selected.id, { status: "replied" })} className="rounded-2xl border border-line px-4 py-3 text-xs font-black dark:border-white/10">Mark Replied</button>
                <button onClick={() => void updateMessage(selected.id, { status: "archived" })} className="rounded-2xl border border-line px-4 py-3 text-xs font-black dark:border-white/10">Archive</button>
                <button onClick={() => void copyForRusty(selected)} className="rounded-2xl bg-ocean px-4 py-3 text-xs font-black text-white">{copied ? "Copied" : "Copy for Rusty"}</button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
