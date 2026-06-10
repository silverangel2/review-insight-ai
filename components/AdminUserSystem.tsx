"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import Link from "next/link";

type AdminUserRow = {
  id: string;
  email: string;
  name?: string;
  plan: string;
  rawPlan?: string;
  role: string;
  rawRole?: string;
  signupDate: string;
  lastLogin: string;
  marketingConsent: boolean;
  status?: string;
  banReason?: string;
  suspendedReason?: string;
  adminNotes?: string;
  forceLogoutAt?: string;
  dailyScanCount?: number;
  monthlyScanCount?: number;
  lastScanAt?: string;
  updatedAt?: string;
};

const fallbackUsers: AdminUserRow[] = [];

function csvEscape(value: string | number | boolean | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value?: string) {
  if (!value) return "Not tracked yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function displayRole(role: string) {
  return role === "buyer" ? "shopper" : role;
}

function statusTone(status?: string) {
  if (status === "banned") return "bad";
  if (status === "suspended") return "warn";
  return "good";
}

export function AdminUserSystem() {
  const [users, setUsers] = useState<AdminUserRow[]>(fallbackUsers);
  const [status, setStatus] = useState("No live users yet");
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "User lookup failed.");
      setUsers(Array.isArray(data.users) ? data.users : []);
      setStatus(data.source === "supabase" ? "Live Supabase customers" : "Local customers");
    } catch {
      setUsers([]);
      setStatus("No live users yet");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const summary = useMemo(() => {
    const paid = users.filter((user) => user.plan !== "Shopper Free").length;
    const consent = users.filter((user) => user.marketingConsent).length;
    const banned = users.filter((user) => user.status === "banned").length;
    const suspended = users.filter((user) => user.status === "suspended").length;
    const dailyScans = users.reduce((total, user) => total + Number(user.dailyScanCount ?? 0), 0);
    const monthlyScans = users.reduce((total, user) => total + Number(user.monthlyScanCount ?? 0), 0);
    const totalScans = monthlyScans;
    return { paid, consent, banned, suspended, dailyScans, monthlyScans, totalScans };
  }, [users]);

  function exportCsv() {
    const header = [
      "Email",
      "Name",
      "Role",
      "Plan",
      "Status",
      "Signup date",
      "Last login",
      "Marketing consent",
      "Daily scans",
      "Monthly scans",
      "Last scan",
      "Admin notes",
    ];

    const rows = users.map((user) => [
      user.email,
      user.name || "",
      displayRole(user.role),
      user.plan,
      user.status || "active",
      user.signupDate,
      user.lastLogin,
      user.marketingConsent,
      user.dailyScanCount ?? 0,
      user.monthlyScanCount ?? 0,
      user.lastScanAt || "",
      user.adminNotes || "",
    ]);

    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `reviewintel-customers-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function runAction(user: AdminUserRow, action: string) {
    let reason = "";

    if (["suspend", "ban", "note"].includes(action)) {
      reason = window.prompt(
        action === "note"
          ? `Add admin note for ${user.email}`
          : `Reason for ${action} ${user.email}`
      ) || "";

      if (!reason.trim()) return;
    }

    const confirmDanger =
      action === "ban" || action === "suspend" || action === "force_logout";

    if (confirmDanger && !window.confirm(`Run ${action.replace("_", " ")} for ${user.email}?`)) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          action,
          reason,
          note: action === "note" ? reason : "",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Admin action failed.");

      await loadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Admin action failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-950 sm:p-5">
      <div className="mb-5 rounded-2xl border border-line bg-white/95 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
              Admin quick control
            </p>
            <h2 className="text-lg font-black leading-tight text-ink dark:text-white">
              Users, scans, plans, and account actions
            </h2>
          </div>

          <div className="flex flex-wrap gap-2 xl:max-w-xl xl:justify-end">
            <Link
              href="/dashboard"
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-black text-ink transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              Return to Dashboard
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-black text-ink transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              View Site
            </Link>

            <Link
              href="/analyze"
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-black text-ink transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              Analyze
            </Link>

            <Link
              href="/compare"
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-black text-ink transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              Compare
            </Link>

            <button
              type="button"
              onClick={loadUsers}
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-black text-ink transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              Refresh Users
            </button>

            <button
              type="button"
              onClick={exportCsv}
              className="rounded-xl bg-ink px-3 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-ocean dark:bg-white dark:text-ink"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-mist px-3 py-2 dark:bg-white/[0.04]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Daily scans</p>
            <p className="text-xl font-black text-ocean dark:text-cyan-300">{summary.dailyScans}</p>
          </div>
          <div className="rounded-xl bg-mist px-3 py-2 dark:bg-white/[0.04]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Monthly scans</p>
            <p className="text-xl font-black text-ocean dark:text-cyan-300">{summary.monthlyScans}</p>
          </div>
          <div className="rounded-xl bg-mist px-3 py-2 dark:bg-white/[0.04]">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Total scans</p>
            <p className="text-xl font-black text-ink dark:text-white">{summary.totalScans}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">Admin user system</Badge>
            <Badge tone={status.includes("Live") ? "good" : "warn"}>{status}</Badge>
            {loading ? <Badge tone="warn">Refreshing</Badge> : null}
          </div>
          <h2 className="mt-4 text-2xl font-black text-ink dark:text-white">
            Live customer access control
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            View accounts, refresh access, reset quota, force logout, suspend, ban, unban, and export users.
            CSV is export-only. Live users should come from Supabase profiles.
          </p>
        </div>


      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Users</p>
          <p className="mt-2 text-3xl font-black text-ink dark:text-white">{users.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Paid plans</p>
          <p className="mt-2 text-3xl font-black text-teal">{summary.paid}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Daily scans</p>
          <p className="mt-2 text-3xl font-black text-ocean dark:text-cyan-300">{summary.dailyScans}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Monthly scans</p>
          <p className="mt-2 text-3xl font-black text-ocean dark:text-cyan-300">{summary.monthlyScans}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Total scans</p>
          <p className="mt-2 text-3xl font-black text-ink dark:text-white">{summary.totalScans}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Consent</p>
          <p className="mt-2 text-3xl font-black text-ocean dark:text-cyan-300">{summary.consent}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Suspended</p>
          <p className="mt-2 text-3xl font-black text-amber-600">{summary.suspended}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Banned</p>
          <p className="mt-2 text-3xl font-black text-red-600">{summary.banned}</p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-line dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm dark:divide-white/10">
            <thead className="bg-mist text-xs font-black uppercase text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
              <tr>
                {["Email", "Role", "Plan", "Status", "Signup", "Last login", "Scans", "Consent", "Actions"].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-white/10">
              {users.map((user) => (
                <tr key={user.id} className="bg-white dark:bg-slate-950">
                  <td className="max-w-[260px] break-all px-4 py-4 text-xs font-black text-ink dark:text-white">{user.email}</td>
                  <td className="px-4 py-4 capitalize text-slate-600 dark:text-slate-300">{displayRole(user.role)}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{user.plan}</td>
                  <td className="px-4 py-4">
                    <Badge tone={statusTone(user.status)}>{user.status || "active"}</Badge>
                  </td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{formatDate(user.signupDate)}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{formatDate(user.lastLogin)}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                    <div className="min-w-[170px] space-y-1 text-xs font-bold">
                      <p><span className="text-slate-400">Daily:</span> {user.dailyScanCount ?? 0}</p>
                      <p><span className="text-slate-400">Monthly:</span> {user.monthlyScanCount ?? 0}</p>
                      <p><span className="text-slate-400">Last:</span> {formatDate(user.lastScanAt)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={user.marketingConsent ? "good" : "warn"}>{user.marketingConsent ? "Yes" : "No"}</Badge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-[520px] flex-wrap gap-2">
                      <button onClick={() => setSelectedUser(user)} className="rounded-full bg-mist px-3 py-2 text-xs font-black text-ink">View</button>
                      <button onClick={() => runAction(user, "refresh")} className="rounded-full bg-ocean px-3 py-2 text-xs font-black text-white">Refresh</button>
                      <button onClick={() => runAction(user, "force_logout")} className="rounded-full bg-slate-700 px-3 py-2 text-xs font-black text-white">Force logout</button>
                      <button onClick={() => runAction(user, "reset_quota")} className="rounded-full bg-teal px-3 py-2 text-xs font-black text-ink">Reset quota</button>
                      <button onClick={() => runAction(user, "note")} className="rounded-full bg-white px-3 py-2 text-xs font-black text-ink ring-1 ring-line">Note</button>
                      {user.status === "banned" || user.status === "suspended" ? (
                        <button onClick={() => runAction(user, "unban")} className="rounded-full bg-green-600 px-3 py-2 text-xs font-black text-white">Unban</button>
                      ) : (
                        <>
                          <button onClick={() => runAction(user, "suspend")} className="rounded-full bg-amber-500 px-3 py-2 text-xs font-black text-ink">Suspend</button>
                          <button onClick={() => runAction(user, "ban")} className="rounded-full bg-red-600 px-3 py-2 text-xs font-black text-white">Ban</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!users.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm font-bold text-slate-500">
                    No users found yet. New signups should appear here after profiles are saved.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/60 px-4 backdrop-blur">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge tone={statusTone(selectedUser.status)}>{selectedUser.status || "active"}</Badge>
                <h3 className="mt-3 text-2xl font-black text-ink dark:text-white">{selectedUser.email}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{selectedUser.name || "No name saved"}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="rounded-full bg-mist px-4 py-2 text-sm font-black text-ink">
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ["Role", selectedUser.role],
                ["Plan", selectedUser.plan],
                ["Signup", formatDate(selectedUser.signupDate)],
                ["Last login", formatDate(selectedUser.lastLogin)],
                ["Last scan", formatDate(selectedUser.lastScanAt)],
                ["Daily scans", String(selectedUser.dailyScanCount ?? 0)],
                ["Monthly scans", String(selectedUser.monthlyScanCount ?? 0)],
                ["Force logout at", formatDate(selectedUser.forceLogoutAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
                  <p className="text-xs font-black uppercase text-slate-500">{label}</p>
                  <p className="mt-2 font-black text-ink dark:text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-mist p-4 dark:bg-white/[0.04]">
              <p className="text-xs font-black uppercase text-slate-500">Admin notes</p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-700 dark:text-slate-300">
                {selectedUser.adminNotes || "No admin notes yet."}
              </p>
            </div>

            {selectedUser.banReason || selectedUser.suspendedReason ? (
              <div className="mt-4 rounded-2xl bg-red-50 p-4 text-red-800">
                <p className="text-xs font-black uppercase">Restriction reason</p>
                <p className="mt-2 text-sm font-bold">{selectedUser.banReason || selectedUser.suspendedReason}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
