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
  totalScanCount?: number;
  lastScanAt?: string;
  updatedAt?: string;
};

type AdminAction = "refresh" | "force_logout" | "reset_quota" | "note" | "make_beta_shopper" | "make_beta_seller" | "remove_beta" | "suspend" | "ban" | "unban";

const actionCopy: Record<AdminAction, { label: string; busy: string; done: string; helper: string }> = {
  refresh: {
    label: "Refresh counts",
    busy: "Refreshing...",
    done: "Refreshed",
    helper: "Recalculates this row from live Supabase profile and scan usage."
  },
  force_logout: {
    label: "Force logout",
    busy: "Saving logout...",
    done: "Logout saved",
    helper: "Marks the account for forced sign-out on the next account check."
  },
  reset_quota: {
    label: "Reset free scans",
    busy: "Resetting...",
    done: "Quota reset",
    helper: "Clears today’s counted scans so Shopper Free can scan again."
  },
  note: {
    label: "Add note",
    busy: "Saving note...",
    done: "Note saved",
    helper: "Stores a private admin note on this customer row."
  },
  make_beta_shopper: {
    label: "Beta Shopper",
    busy: "Granting Beta Shopper Premium...",
    done: "Beta Shopper Premium granted.",
    helper: "Gives this customer beta shopper premium access with unlimited scans.",
  },
  make_beta_seller: {
    label: "Beta Seller",
    busy: "Granting Beta Seller Premium...",
    done: "Beta Seller Premium granted.",
    helper: "Gives this customer beta seller premium access with unlimited scans.",
  },
  remove_beta: {
    label: "Remove Beta",
    busy: "Removing beta access...",
    done: "Beta access removed.",
    helper: "Returns the customer to a normal base plan.",
  },
  suspend: {
    label: "Suspend",
    busy: "Suspending...",
    done: "Suspended",
    helper: "Temporarily restricts the account and records the reason."
  },
  ban: {
    label: "Ban",
    busy: "Banning...",
    done: "Banned",
    helper: "Blocks the account and records the reason."
  },
  unban: {
    label: "Restore",
    busy: "Restoring...",
    done: "Restored",
    helper: "Returns a banned or suspended account to active."
  }
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
  const [busyAction, setBusyAction] = useState("");
  const [actionNotice, setActionNotice] = useState<{ email: string; action: AdminAction; message: string } | null>(null);

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
    const totalScans = users.reduce((total, user) => total + Number(user.totalScanCount ?? user.monthlyScanCount ?? 0), 0);
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

  async function runAction(user: AdminUserRow, action: AdminAction) {
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
    setBusyAction(`${user.email}:${action}`);
    setActionNotice({
      email: user.email,
      action,
      message: `${actionCopy[action].busy} ${actionCopy[action].helper}`
    });

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          plan: user.rawPlan,
          action,
          reason,
          note: action === "note" ? reason : "",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Admin action failed.");
      const quota = data.quota as { used?: number; remaining?: number | null; limit?: number | null } | null;
      const quotaMessage =
        action === "reset_quota" && quota
          ? ` Server quota now: ${quota.used ?? 0} used, ${quota.remaining ?? "unlimited"} remaining.`
          : "";

      await loadUsers();
      setActionNotice({
        email: user.email,
        action,
        message: `${data.message || `${actionCopy[action].done}. ${actionCopy[action].helper}`}${quotaMessage}`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Admin action failed.";
      setActionNotice({
        email: user.email,
        action,
        message
      });
      alert(message);
    } finally {
      setLoading(false);
      setBusyAction("");
    }
  }

  function actionButton(user: AdminUserRow, action: AdminAction, className: string) {
    const busy = busyAction === `${user.email}:${action}`;
    return (
      <button
        type="button"
        onClick={() => runAction(user, action)}
        disabled={Boolean(busyAction)}
        title={actionCopy[action].helper}
        aria-label={`${actionCopy[action].label}: ${actionCopy[action].helper}`}
        className={`${className} disabled:cursor-wait disabled:opacity-60`}
      >
        {busy ? actionCopy[action].busy : actionCopy[action].label}
      </button>
    );
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
          {actionNotice ? (
            <p className="mt-3 rounded-2xl border border-teal/25 bg-teal/10 px-4 py-3 text-xs font-black leading-5 text-teal dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-200">
              {actionCopy[actionNotice.action].done} for {actionNotice.email}: {actionNotice.message}
            </p>
          ) : null}
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
        <div className="w-full overflow-x-auto rounded-xl border border-line dark:border-white/10">
          <table className="min-w-[1900px] w-full table-fixed divide-y divide-line text-sm dark:divide-white/10">
            <thead className="sticky top-0 z-20 bg-mist text-xs font-black uppercase tracking-wide text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">
              <tr>
                <th className="w-[330px] border-r border-line px-4 py-3 text-left dark:border-white/10">Email</th>
                <th className="w-[140px] border-r border-line px-4 py-3 text-left dark:border-white/10">Role</th>
                <th className="w-[170px] border-r border-line px-4 py-3 text-left dark:border-white/10">Plan</th>
                <th className="w-[130px] border-r border-line px-4 py-3 text-left dark:border-white/10">Status</th>
                <th className="w-[180px] border-r border-line px-4 py-3 text-left dark:border-white/10">Signup</th>
                <th className="w-[180px] border-r border-line px-4 py-3 text-left dark:border-white/10">Last login</th>
                <th className="w-[220px] border-r border-line px-4 py-3 text-left dark:border-white/10">Scans</th>
                <th className="w-[120px] border-r border-line px-4 py-3 text-left dark:border-white/10">Consent</th>
                <th className="w-[600px] px-4 py-3 text-left">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-white/10">
              {users.map((user) => (
                <tr key={user.id} className="bg-white transition hover:bg-cyan-50/40 dark:bg-slate-950 dark:hover:bg-white/[0.04]">
                  <td className="border-r border-line px-4 py-3 text-xs font-black text-ink dark:border-white/10 dark:text-white">{user.email}</td>
                  <td className="border-r border-line px-4 py-3 capitalize text-slate-600 dark:border-white/10 dark:text-slate-300">{displayRole(user.role)}</td>
                  <td className="border-r border-line px-4 py-3 text-slate-600 dark:border-white/10 dark:text-slate-300">{user.plan}</td>
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
                    <div className="flex min-w-[580px] flex-nowrap items-center gap-2 whitespace-nowrap">
                      <button onClick={() => setSelectedUser(user)} className="rounded-full bg-mist px-3 py-2 text-xs font-black text-ink" title="Open full profile details, scan counts, restrictions, and notes.">View details</button>
                      {actionButton(user, "refresh", "rounded-full bg-ocean px-3 py-2 text-xs font-black text-white")}
                      {actionButton(user, "force_logout", "rounded-full bg-slate-700 px-3 py-2 text-xs font-black text-white")}
                      {actionButton(user, "reset_quota", "rounded-full bg-teal px-3 py-2 text-xs font-black text-ink")}
                      {actionButton(user, "make_beta_shopper", "rounded-full bg-cyan-600 px-3 py-2 text-xs font-black text-white")}
                      {actionButton(user, "make_beta_seller", "rounded-full bg-purple-600 px-3 py-2 text-xs font-black text-white")}
                      {user.rawPlan === "buyer_beta" || user.rawPlan === "seller_beta" ? (
                        actionButton(user, "remove_beta", "rounded-full bg-slate-900 px-3 py-2 text-xs font-black text-white")
                      ) : null}
                      {actionButton(user, "note", "rounded-full bg-white px-3 py-2 text-xs font-black text-ink ring-1 ring-line")}
                      {user.status === "banned" || user.status === "suspended" ? (
                        actionButton(user, "unban", "rounded-full bg-green-600 px-3 py-2 text-xs font-black text-white")
                      ) : (
                        <>
                          {actionButton(user, "suspend", "rounded-full bg-amber-500 px-3 py-2 text-xs font-black text-ink")}
                          {actionButton(user, "ban", "rounded-full bg-red-600 px-3 py-2 text-xs font-black text-white")}
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
