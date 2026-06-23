"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  if (!value) return "Unknown date";

  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusClass(status?: string | null) {
  if (status === "replied") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200";
  if (status === "archived") return "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300";
  if (status === "read") return "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-200";
  return "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200";
}

export function AdminEmailInbox() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const summary = useMemo(() => {
    return {
      total: messages.length,
      unread: messages.filter((message) => (message.status ?? "unread") === "unread").length,
      replied: messages.filter((message) => message.status === "replied").length
    };
  }, [messages]);

  const visibleMessages = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return messages.filter((message) => {
      const status = message.status ?? "unread";
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const searchable = [
        message.name,
        message.email,
        message.subject,
        message.message,
        message.source,
        message.priority
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!cleanQuery || searchable.includes(cleanQuery));
    });
  }, [messages, query, statusFilter]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/messages", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error ?? "Could not load messages.");
        return;
      }

      const nextMessages = Array.isArray(data.messages) ? data.messages : [];
      setMessages(nextMessages);

      setSelected((current) => {
        if (current) {
          const refreshed = nextMessages.find((message: ContactMessage) => message.id === current.id);
          return refreshed ?? null;
        }

        return nextMessages[0] ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  async function updateMessage(id: string, patch: Partial<ContactMessage>) {
    setError("");
    setNotice("");

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

  async function sendReply() {
    if (!selected) return;

    setError("");
    setNotice("");

    if (!selected.email) {
      setError("This message has no customer email address.");
      return;
    }

    if (!replyBody.trim()) {
      setError("Write a reply before sending.");
      return;
    }

    setSendingReply(true);

    try {
      const response = await fetch("/api/admin/messages/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          subject: selected.subject?.startsWith("Re:") ? selected.subject : `Re: ${selected.subject ?? "ReviewIntel Support"}`,
          message: replyBody
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.error ?? "Reply failed.");
        return;
      }

      setReplyBody("");
      setNotice(`Reply sent to ${selected.email}.`);
      await loadMessages();
    } finally {
      setSendingReply(false);
    }
  }

  async function copySupportBrief(message: ContactMessage) {
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
      "Please help me reply or troubleshoot this customer issue."
    ].join("\n");

    await navigator.clipboard.writeText(report);
    setCopied(true);
  }

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  return (
    <section className="rounded-[2rem] border border-line bg-white shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="border-b border-line px-5 py-4 dark:border-white/10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
              Admin email center
            </p>
            <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">
              Customer messages
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Gmail-style inbox for support messages, replies, and customer follow-up.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadMessages()}
            className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-2xl bg-mist px-4 py-3 dark:bg-white/[0.04]">
            <p className="text-[11px] font-black uppercase text-slate-500">Total</p>
            <p className="mt-1 text-2xl font-black text-ink dark:text-white">{summary.total}</p>
          </div>
          <div className="rounded-2xl bg-mist px-4 py-3 dark:bg-white/[0.04]">
            <p className="text-[11px] font-black uppercase text-slate-500">Unread</p>
            <p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-300">{summary.unread}</p>
          </div>
          <div className="rounded-2xl bg-mist px-4 py-3 dark:bg-white/[0.04]">
            <p className="text-[11px] font-black uppercase text-slate-500">Replied</p>
            <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-300">{summary.replied}</p>
          </div>
          <div className="rounded-2xl bg-mist px-4 py-3 dark:bg-white/[0.04]">
            <p className="text-[11px] font-black uppercase text-slate-500">Visible</p>
            <p className="mt-1 text-2xl font-black text-ocean dark:text-cyan-300">{visibleMessages.length}</p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mx-5 mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mx-5 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <p className="p-6 text-sm font-bold text-slate-500">Loading messages...</p>
      ) : messages.length === 0 ? (
        <p className="m-5 rounded-2xl bg-mist p-5 text-sm font-bold text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
          No customer messages yet.
        </p>
      ) : (
        <div className="grid min-h-[620px] lg:grid-cols-[360px_1fr]">
          <div className="border-r border-line bg-slate-50/70 dark:border-white/10 dark:bg-white/[0.02]">
            <div className="grid gap-3 border-b border-line p-3 dark:border-white/10">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, subject, message..."
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink outline-none transition focus:border-ocean dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm font-black text-ink outline-none transition focus:border-ocean dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                <option value="all">All messages</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
                <option value="replied">Replied</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="max-h-[720px] overflow-y-auto p-3">
              {visibleMessages.length === 0 ? (
                <p className="rounded-2xl bg-white p-4 text-sm font-bold text-slate-500 dark:bg-white/[0.04] dark:text-slate-300">
                  No messages match this search.
                </p>
              ) : null}

              {visibleMessages.map((message) => {
                const isSelected = selected?.id === message.id;

                return (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => {
                      setSelected(message);
                      setCopied(false);
                      setReplyBody("");
                      setNotice("");
                    }}
                    className={`mb-2 w-full rounded-2xl border p-4 text-left transition hover:bg-white dark:hover:bg-white/[0.06] ${
                      isSelected
                        ? "border-ocean bg-white shadow-sm dark:border-cyan-300/50 dark:bg-white/[0.08]"
                        : "border-transparent bg-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-ink dark:text-white">
                          {message.name || message.email || "Customer"}
                        </p>
                        <p className="mt-1 truncate text-xs font-bold text-slate-500">
                          {message.subject ?? "No subject"}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${statusClass(message.status)}`}>
                        {message.status ?? "unread"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {message.message}
                    </p>
                    <p className="mt-2 text-[11px] font-bold text-slate-400">
                      {formatDate(message.created_at)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {selected ? (
            <div className="flex min-h-[620px] flex-col">
              <div className="border-b border-line p-6 dark:border-white/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-black text-ink dark:text-white">
                      {selected.subject ?? "No subject"}
                    </p>
                    <p className="mt-2 text-sm font-bold text-slate-500">
                      From: {selected.name || "Customer"} · {selected.email ?? "No email"}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {formatDate(selected.created_at)} · {selected.source ?? "website"}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${statusClass(selected.status)}`}>
                    {selected.status ?? "unread"}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => void updateMessage(selected.id, { status: "read" })} className="rounded-xl border border-line px-3 py-2 text-xs font-black dark:border-white/10">Mark Read</button>
                  <button onClick={() => void updateMessage(selected.id, { status: "replied" })} className="rounded-xl border border-line px-3 py-2 text-xs font-black dark:border-white/10">Mark Replied</button>
                  <button onClick={() => void updateMessage(selected.id, { status: "archived" })} className="rounded-xl border border-line px-3 py-2 text-xs font-black dark:border-white/10">Archive</button>
                  <button onClick={() => void copySupportBrief(selected)} className="rounded-xl bg-ocean px-3 py-2 text-xs font-black text-white">{copied ? "Copied" : "Copy Support Brief"}</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="rounded-3xl bg-mist p-5 text-sm leading-7 text-slate-700 dark:bg-white/[0.04] dark:text-slate-200">
                  <p className="whitespace-pre-wrap">{selected.message}</p>
                </div>

                {selected.admin_notes ? (
                  <div className="mt-4 rounded-2xl border border-line p-4 text-xs font-bold text-slate-500 dark:border-white/10">
                    Admin note: {selected.admin_notes}
                  </div>
                ) : null}
              </div>

              <div className="border-t border-line bg-white p-5 dark:border-white/10 dark:bg-slate-950">
                <div className="rounded-3xl border border-line bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-ocean dark:text-cyan-300">
                    Reply to customer
                  </p>
                  <textarea
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    placeholder={selected.email ? "Write your customer reply here..." : "This message has no customer email."}
                    disabled={!selected.email || sendingReply}
                    className="mt-3 min-h-32 w-full resize-y rounded-2xl border border-line bg-mist p-4 text-sm font-semibold text-ink outline-none transition focus:border-ocean dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-bold text-slate-500">
                      Sends from ReviewIntel through Resend and marks this message as replied.
                    </p>
                    <button
                      type="button"
                      onClick={() => void sendReply()}
                      disabled={!selected.email || sendingReply || !replyBody.trim()}
                      className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-ink"
                    >
                      {sendingReply ? "Sending..." : "Send Reply"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center p-8 text-sm font-bold text-slate-500">
              Select a message to read and reply.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
