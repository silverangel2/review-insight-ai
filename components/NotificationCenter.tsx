"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getClientAccount } from "@/lib/clientAccount";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type?: string | null;
  severity?: string | null;
  status?: string | null;
  action_url?: string | null;
  created_at?: string | null;
};

type NotificationResponse = {
  notifications: NotificationItem[];
  summary: {
    total: number;
    unread: number;
    critical: number;
    warning: number;
  };
};

function severityClass(severity?: string | null) {
  if (severity === "critical") return "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200";
  if (severity === "warning") return "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-100";
  if (severity === "info") return "bg-cyan-100 text-cyan-800 dark:bg-cyan-400/15 dark:text-cyan-200";
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200";
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString();
}

function buildSummary(notifications: NotificationItem[]) {
  return {
    total: notifications.length,
    unread: notifications.filter((item) => item.status === "unread").length,
    critical: notifications.filter((item) => item.severity === "critical").length,
    warning: notifications.filter((item) => item.severity === "warning").length
  };
}

export function NotificationCenter({ scope }: { scope: "admin" | "customer" }) {
  const [data, setData] = useState<NotificationResponse | null>(null);
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const account = useMemo(() => getClientAccount(), []);
  const isAdmin = scope === "admin";

  const endpoint = isAdmin
    ? "/api/admin/notifications"
    : `/api/account/notifications?email=${encodeURIComponent(account?.email ?? "")}`;

  async function loadNotifications() {
    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to load notifications.");
      }

      const notifications = json.notifications ?? [];
      setData({
        notifications,
        summary: json.summary ?? buildSummary(notifications)
      });

      setSelected((current) => {
        if (current) {
          return notifications.find((item: NotificationItem) => item.id === current.id) ?? current;
        }

        return notifications[0] ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  async function createTestNotification() {
    setTesting(true);
    setError("");

    try {
      const response = await fetch(isAdmin ? "/api/admin/notifications" : "/api/account/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          isAdmin
            ? {
                title: "Admin notification test",
                message: "Admin notification system is working.",
                type: "manual_test",
                severity: "info"
              }
            : {
                email: account?.email,
                title: "Customer notification test",
                message: "Customer notification system is working.",
                type: "manual_test",
                severity: "info"
              }
        )
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json?.error ?? "Test notification failed.");
      }

      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test notification failed.");
    } finally {
      setTesting(false);
    }
  }

  async function markRead(item: NotificationItem) {
    setUpdatingId(item.id);
    setError("");

    const previousData = data;
    const previousSelected = selected;

    const nextItem = { ...item, status: "read" };
    const nextNotifications = (data?.notifications ?? []).map((notification) =>
      notification.id === item.id ? nextItem : notification
    );

    setData({
      notifications: nextNotifications,
      summary: buildSummary(nextNotifications)
    });
    setSelected(nextItem);

    try {
      const response = await fetch(isAdmin ? "/api/admin/notifications" : "/api/account/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          isAdmin
            ? { id: item.id, status: "read" }
            : { id: item.id, email: account?.email, status: "read" }
        )
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to mark notification as read.");
      }
    } catch (err) {
      setData(previousData);
      setSelected(previousSelected);
      setError(err instanceof Error ? err.message : "Failed to mark notification as read.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function copyReport() {
    const report = [
      `ReviewIntel ${isAdmin ? "Admin" : "Customer"} Notification Report`,
      "",
      `Generated: ${new Date().toISOString()}`,
      `Total: ${data?.summary.total ?? 0}`,
      `Unread: ${data?.summary.unread ?? 0}`,
      `Critical: ${data?.summary.critical ?? 0}`,
      `Warning: ${data?.summary.warning ?? 0}`,
      "",
      "Latest notifications:",
      ...(data?.notifications.slice(0, 10).map((item) => {
        return [
          "",
          `- ${item.title}`,
          `  Status: ${item.status ?? "unread"}`,
          `  Severity: ${item.severity ?? "normal"}`,
          `  Type: ${item.type ?? "system"}`,
          `  Date: ${item.created_at ?? "unknown"}`,
          `  Message: ${item.message}`
        ].join("\n");
      }) ?? ["No notifications."])
    ].join("\n");

    await navigator.clipboard.writeText(report);
    setCopied(true);
  }

  useEffect(() => {
    void loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
            {isAdmin ? "Admin notifications" : "Customer notifications"}
          </p>
          <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">
            {isAdmin ? "Operations alerts and system messages" : "Your ReviewIntel alerts"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {isAdmin
              ? "Click any notification to open the full details. Mark Read updates without closing the panel."
              : "Click any notification to view details about your scans, reports, plan, or account."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => void loadNotifications()} className="rounded-2xl border border-line px-5 py-3 text-sm font-black text-ink dark:border-white/10 dark:text-white">
            Refresh
          </button>
          <button onClick={() => void createTestNotification()} disabled={testing} className="rounded-2xl bg-ocean px-5 py-3 text-sm font-black text-white disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300">
            {testing ? "Testing..." : "Test Notification"}
          </button>
          <button onClick={() => void copyReport()} className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white dark:bg-white dark:text-ink">
            {copied ? "Copied" : "Copy Report"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Total</p>
          <p className="mt-2 text-3xl font-black text-ink dark:text-white">{data?.summary.total ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Unread</p>
          <p className="mt-2 text-3xl font-black text-amber">{data?.summary.unread ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Critical</p>
          <p className="mt-2 text-3xl font-black text-rose-600 dark:text-rose-300">{data?.summary.critical ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500">Warning</p>
          <p className="mt-2 text-3xl font-black text-orange-600 dark:text-orange-300">{data?.summary.warning ?? 0}</p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{error}</p>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm font-bold text-slate-500">Loading notifications...</p>
        ) : data?.notifications.length === 0 ? (
          <p className="rounded-2xl bg-mist p-5 text-sm font-bold text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
            No notifications yet.
          </p>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-3">
              {data?.notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`w-full rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 ${
                    selected?.id === item.id
                      ? "border-ocean bg-cyan-50 dark:border-cyan-300/40 dark:bg-cyan-400/10"
                      : "border-line bg-mist dark:border-white/10 dark:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${severityClass(item.severity)}`}>
                      {item.severity ?? "normal"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-slate-600 dark:bg-gradient-to-r from-sky-600 to-teal-500/20 dark:text-slate-300">
                      {item.status ?? "unread"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-slate-600 dark:bg-gradient-to-r from-sky-600 to-teal-500/20 dark:text-slate-300">
                      {item.type ?? "system"}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-black text-ink dark:text-white">{item.title}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">{formatDate(item.created_at)}</p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.message}</p>
                </button>
              ))}
            </div>

            <div className="rounded-3xl border border-line bg-white p-6 dark:border-white/10 dark:bg-slate-900">
              {selected ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${severityClass(selected.severity)}`}>
                      {selected.severity ?? "normal"}
                    </span>
                    <span className="rounded-full bg-mist px-3 py-1 text-[10px] font-black uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {selected.status ?? "unread"}
                    </span>
                    <span className="rounded-full bg-mist px-3 py-1 text-[10px] font-black uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {selected.type ?? "system"}
                    </span>
                  </div>

                  <h3 className="mt-4 text-2xl font-black text-ink dark:text-white">{selected.title}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">{formatDate(selected.created_at)}</p>

                  <p className="mt-5 whitespace-pre-wrap rounded-2xl bg-mist p-5 text-sm leading-7 text-slate-700 dark:bg-white/[0.04] dark:text-slate-200">
                    {selected.message}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {selected.action_url ? (
                      <Link href={selected.action_url} className="rounded-2xl bg-ocean px-5 py-3 text-sm font-black text-white">
                        Open Related Page
                      </Link>
                    ) : null}

                    <button
                      onClick={() => void markRead(selected)}
                      disabled={updatingId === selected.id || selected.status === "read"}
                      className="rounded-2xl border border-line bg-white px-5 py-3 text-sm font-black text-ink disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white"
                    >
                      {updatingId === selected.id ? "Updating..." : selected.status === "read" ? "Already Read" : "Mark Read"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm font-bold text-slate-500">Select a notification to view details.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
