"use client";

import { useEffect, useState } from "react";

type EmailLog = {
  id: string;
  created_at: string;
  email_type: string;
  provider: string;
  status: "sent" | "failed" | "skipped";
  recipient: string | null;
  sender: string | null;
  subject: string | null;
  provider_message_id: string | null;
  error: string | null;
};

function statusClass(status: EmailLog["status"]) {
  if (status === "sent") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminEmailLogViewer() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [status, setStatus] = useState("Loading email logs...");
  const [testStatus, setTestStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  async function loadLogs() {
    setIsLoading(true);
    setStatus("Loading email logs...");

    try {
      const response = await fetch("/api/admin/email/logs?limit=50", {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setStatus(data.error || "Email logs could not be loaded.");
        setLogs([]);
        return;
      }

      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setStatus(
        data.deploymentReady
          ? "Email logs are connected to Supabase."
          : "Email logs are not deployment-ready yet."
      );
    } catch {
      setStatus("Email logs could not be loaded.");
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function sendTestEmail() {
    setIsSendingTest(true);
    setTestStatus("Sending test email...");

    try {
      const response = await fetch("/api/admin/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "support@getreviewintel.com" }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setTestStatus(data.error || "Test email failed.");
        return;
      }

      setTestStatus("Test email sent. Refreshing logs...");
      await loadLogs();
    } catch {
      setTestStatus("Test email failed.");
    } finally {
      setIsSendingTest(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  return (
    <section className="min-w-0 w-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="flex min-w-0 flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal">
            Email Delivery Logs
          </p>
          <h2 className="mt-2 text-2xl font-black text-ink dark:text-white">
            Sent / Failed Email Activity
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">{status}</p>
          {testStatus ? (
            <p className="mt-1 text-sm font-black text-teal">{testStatus}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void sendTestEmail()}
            disabled={isSendingTest}
            className="rounded-xl bg-teal px-4 py-2 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300"
          >
            {isSendingTest ? "Sending..." : "Send Test Email"}
          </button>

          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={isLoading}
            className="rounded-xl bg-ink px-4 py-2 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 dark:bg-white dark:text-ink"
          >
            {isLoading ? "Refreshing..." : "Refresh Logs"}
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          No email logs yet. Send a test email, contact form message, admin reply, or marketing campaign.
        </div>
      ) : (
        <div className="mt-6 max-h-[520px] min-w-0 space-y-3 overflow-y-auto pr-1">
          {logs.map((log) => (
            <article
              key={log.id}
              className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase ${statusClass(
                        log.status
                      )}`}
                    >
                      {log.status}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black uppercase text-slate-500 dark:border-slate-700 dark:bg-gradient-to-r from-sky-600 to-teal-500">
                      {log.email_type}
                    </span>
                  </div>

                  <h3 className="mt-3 break-words text-base font-black text-ink dark:text-white">
                    {log.subject || "No subject"}
                  </h3>

                  <p className="mt-2 break-all text-sm font-semibold text-slate-600 dark:text-slate-300">
                    To: {log.recipient || "—"}
                  </p>

                  <p className="mt-1 break-all text-xs font-semibold text-slate-500">
                    From: {log.sender || "ReviewIntel"}
                  </p>
                </div>

                <p className="shrink-0 text-xs font-black uppercase tracking-wide text-slate-400">
                  {formatDate(log.created_at)}
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-gradient-to-r from-sky-600 to-teal-500">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {log.status === "failed" ? "Error" : "Provider ID"}
                </p>
                <p
                  className={`mt-1 break-all text-xs font-bold ${
                    log.status === "failed" ? "text-red-600" : "font-mono text-slate-500"
                  }`}
                >
                  {log.status === "failed"
                    ? log.error || "Unknown error"
                    : log.provider_message_id || log.provider || "—"}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
