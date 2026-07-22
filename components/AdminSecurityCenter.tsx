"use client";

import { useEffect, useMemo, useState } from "react";

type SecurityEvent = {
  id: string;
  event_type: string;
  severity?: string | null;
  ip_address?: string | null;
  route?: string | null;
  user_email?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

type SecurityResponse = {
  ok: boolean;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  events: SecurityEvent[];
};

function severityClass(severity?: string | null) {
  if (severity === "critical") return "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200";
  if (severity === "high") return "bg-orange-100 text-orange-800 dark:bg-orange-400/15 dark:text-orange-200";
  if (severity === "medium") return "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-100";
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200";
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString();
}

function canBlockIp(ip?: string | null) {
  if (!ip) return false;
  const cleanIp = ip.trim().toLowerCase();
  return !["local", "unknown", "::1", "127.0.0.1"].includes(cleanIp);
}

export function AdminSecurityCenter() {
  const [data, setData] = useState<SecurityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [blockIp, setBlockIp] = useState("");
  const [blockReason, setBlockReason] = useState("Suspicious activity detected in admin security center.");

  const status = useMemo(() => {
    if (!data) return "Not checked";
    if (data.summary.critical > 0) return "Critical attention needed";
    if (data.summary.high > 0) return "High-risk events found";
    if (data.summary.medium > 0) return "Watchlist";
    return "Working good";
  }, [data]);

  async function loadSecurity() {
    setLoading(true);
    setError("");
    setNotice("");
    setCopied(false);

    try {
      const response = await fetch("/api/admin/security", { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to load security center.");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load security center.");
    } finally {
      setLoading(false);
    }
  }

  async function testSecurityLog() {
    setTesting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/security", {
        method: "POST"
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json?.error ?? "Security test failed.");
      }

      await loadSecurity();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Security test failed.");
    } finally {
      setTesting(false);
    }
  }

  async function copyReport() {
    const report = [
      "ReviewIntel Security Center Report",
      "",
      `Status: ${status}`,
      `Generated: ${new Date().toISOString()}`,
      "",
      `Total events: ${data?.summary.total ?? 0}`,
      `Critical: ${data?.summary.critical ?? 0}`,
      `High: ${data?.summary.high ?? 0}`,
      `Medium: ${data?.summary.medium ?? 0}`,
      `Low: ${data?.summary.low ?? 0}`,
      "",
      "Latest events:",
      ...(data?.events.slice(0, 10).map((event) => {
        return [
          "",
          `- ${event.event_type} (${event.severity ?? "low"})`,
          `  Route: ${event.route ?? "unknown"}`,
          `  IP: ${event.ip_address ?? "unknown"}`,
          `  User: ${event.user_email ?? "none"}`,
          `  Time: ${event.created_at ?? "unknown"}`,
          `  Message: ${event.message ?? "none"}`
        ].join("\n");
      }) ?? ["No events."]),
      "",
      "Please troubleshoot any high or critical events."
    ].join("\n");

    await navigator.clipboard.writeText(report);
    setCopied(true);
  }

  async function blockIpAddress(ipOverride?: string | null) {
    const ipAddress = (ipOverride ?? blockIp).trim();

    if (!canBlockIp(ipAddress)) {
      setError("Enter a real public IP address before blocking.");
      return;
    }

    setBlocking(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/security/block-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip_address: ipAddress,
          reason: blockReason || "Blocked from admin security center."
        })
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json?.error ?? "Could not block this IP.");
      }

      setBlockIp("");
      await loadSecurity();
      setNotice(`Blocked IP ${ipAddress}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not block this IP.");
    } finally {
      setBlocking(false);
    }
  }

  useEffect(() => {
    void loadSecurity();
  }, []);


  async function deleteSecurityEvent(id: string) {
    if (!id) return;

    await fetch("/api/admin/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-security-event", id }),
    });

    await loadSecurity();
  }

  async function clearSecurityEvents() {
    const confirmed = window.confirm("Clear all Security Centre logs?");
    if (!confirmed) return;

    await fetch("/api/admin/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear-security-events" }),
    });

    await loadSecurity();
  }


  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
            Security center
          </p>
          <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">
            Hacker, abuse, and suspicious activity monitor
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Tracks security events saved in Supabase, including admin access attempts, rate-limit lockouts, manually blocked IPs, and Cloudflare/request signals when available.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadSecurity()}
            className="rounded-2xl border border-line px-5 py-3 text-sm font-black text-ink transition hover:-translate-y-0.5 dark:border-white/10 dark:text-white"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={() => void testSecurityLog()}
            disabled={testing}
            className="rounded-2xl bg-ocean px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ink disabled:opacity-60"
          >
            {testing ? "Testing..." : "Test Security Log"}
          </button>

          <button
            type="button"
            onClick={() => void copyReport()}
            className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ocean dark:bg-white dark:text-ink"
          >
            {copied ? "Copied" : "Copy Report"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-mist p-5 dark:bg-white/[0.04]">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Current status</p>
        <p className="mt-2 text-3xl font-black text-ink dark:text-white">{loading ? "Checking..." : status}</p>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{error}</p>
      ) : null}

      {notice ? (
        <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{notice}</p>
      ) : null}

      {data ? (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-5">
            <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
              <p className="text-xs font-black uppercase text-slate-500">Total</p>
              <p className="mt-2 text-3xl font-black text-ink dark:text-white">{data.summary.total}</p>
            </div>
            <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
              <p className="text-xs font-black uppercase text-slate-500">Critical</p>
              <p className="mt-2 text-3xl font-black text-rose-600 dark:text-rose-300">{data.summary.critical}</p>
            </div>
            <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
              <p className="text-xs font-black uppercase text-slate-500">High</p>
              <p className="mt-2 text-3xl font-black text-orange-600 dark:text-orange-300">{data.summary.high}</p>
            </div>
            <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
              <p className="text-xs font-black uppercase text-slate-500">Medium</p>
              <p className="mt-2 text-3xl font-black text-amber">{data.summary.medium}</p>
            </div>
            <div className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
              <p className="text-xs font-black uppercase text-slate-500">Low</p>
              <p className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-300">{data.summary.low}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-line bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="grid flex-1 gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Block IP address</span>
                <input
                  value={blockIp}
                  onChange={(event) => setBlockIp(event.target.value)}
                  placeholder="Example: 203.0.113.10"
                  className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <label className="grid flex-[1.4] gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Reason</span>
                <input
                  value={blockReason}
                  onChange={(event) => setBlockReason(event.target.value)}
                  className="rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold text-ink outline-none focus:border-ocean dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <button
                type="button"
                onClick={() => void blockIpAddress()}
                disabled={blocking || !blockIp.trim()}
                className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-ink"
              >
                {blocking ? "Blocking..." : "Block IP"}
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Security logs</p>
              <button
                type="button"
                onClick={() => void clearSecurityEvents()}
                disabled={data.events.length === 0}
                className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-black uppercase text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-400/30 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-red-300"
              >
                Clear all logs
              </button>
            </div>

            {data.events.length === 0 ? (
              <p className="rounded-2xl bg-mist p-5 text-sm font-bold text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
                No security events yet.
              </p>
            ) : (
              data.events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-line bg-mist p-5 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-ink dark:text-white">{event.event_type}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {formatDate(event.created_at)} · {event.route ?? "unknown route"} · {event.ip_address ?? "unknown IP"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void deleteSecurityEvent(event.id)}
                        className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-black uppercase text-red-600 transition hover:bg-red-50 dark:border-red-400/30 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-red-300"
                      >
                        Delete log
                      </button>

                      {canBlockIp(event.ip_address) ? (
                        <button
                          type="button"
                          onClick={() => void blockIpAddress(event.ip_address)}
                          disabled={blocking}
                          className="rounded-full border border-line bg-white px-3 py-1 text-xs font-black uppercase text-ink transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-50 dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500 dark:text-white"
                        >
                          Block IP
                        </button>
                      ) : null}
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${severityClass(event.severity)}`}>
                        {event.severity ?? "low"}
                      </span>
                    </div>
                  </div>

                  {event.message ? (
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{event.message}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
