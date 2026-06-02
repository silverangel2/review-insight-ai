"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";

type AdminUserRow = {
  id: string;
  email: string;
  plan: string;
  role: string;
  signupDate: string;
  lastLogin: string;
  marketingConsent: boolean;
};

const fallbackUsers: AdminUserRow[] = [
  {
    id: "qa-shopper-free",
    email: "shopper.free@reviewintel.test",
    plan: "Shopper Free",
    role: "shopper",
    signupDate: "2026-06-01",
    lastLogin: "2026-06-02",
    marketingConsent: true
  },
  {
    id: "qa-shopper-premium",
    email: "shopper.premium@reviewintel.test",
    plan: "Shopper Premium",
    role: "shopper",
    signupDate: "2026-06-01",
    lastLogin: "2026-06-02",
    marketingConsent: true
  },
  {
    id: "qa-seller-starter",
    email: "seller.starter@reviewintel.test",
    plan: "Seller Starter",
    role: "seller",
    signupDate: "2026-06-01",
    lastLogin: "2026-06-02",
    marketingConsent: true
  },
  {
    id: "qa-seller-pro",
    email: "seller.pro@reviewintel.test",
    plan: "Seller Pro",
    role: "seller",
    signupDate: "2026-06-01",
    lastLogin: "2026-06-02",
    marketingConsent: false
  }
];

function csvEscape(value: string | boolean) {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value: string) {
  if (!value) return "Not tracked yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function displayRole(role: string) {
  return role === "buyer" ? "shopper" : role;
}

export function AdminUserSystem() {
  const [users, setUsers] = useState<AdminUserRow[]>(fallbackUsers);
  const [status, setStatus] = useState("QA customer-mode accounts loaded");

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "User lookup failed.");
        if (Array.isArray(data.users) && data.users.length) {
          setUsers(data.users as AdminUserRow[]);
          setStatus(data.source === "supabase" ? "Live Supabase customers" : "QA customer-mode accounts loaded");
        }
      })
      .catch(() => setStatus("QA customer-mode accounts loaded"));
  }, []);

  const summary = useMemo(() => {
    const paid = users.filter((user) => user.plan !== "Shopper Free").length;
    const consent = users.filter((user) => user.marketingConsent).length;
    return { paid, consent };
  }, [users]);

  function exportCsv() {
    const header = ["Email", "Role", "Plan", "Signup date", "Last login", "Marketing consent"];
    const rows = users.map((user) => [
      user.email,
      displayRole(user.role),
      user.plan,
      user.signupDate,
      user.lastLogin,
      user.marketingConsent
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

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">Admin user system</Badge>
            <Badge tone={status.includes("Live") ? "good" : "warn"}>{status}</Badge>
          </div>
          <h2 className="mt-4 text-2xl font-black text-ink dark:text-white">Customer list for future email integration</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Tracks customer email, role, plan, signup date, last activity, and marketing consent. Export is ready for email tools.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-ocean dark:bg-white dark:text-ink"
        >
          Export CSV
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Users</p>
          <p className="mt-2 text-3xl font-black text-ink dark:text-white">{users.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Paid plans</p>
          <p className="mt-2 text-3xl font-black text-teal">{summary.paid}</p>
        </div>
        <div className="rounded-2xl border border-line bg-mist p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Marketing consent</p>
          <p className="mt-2 text-3xl font-black text-ocean dark:text-cyan-300">{summary.consent}</p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-line dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-sm dark:divide-white/10">
            <thead className="bg-mist text-xs font-black uppercase text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
              <tr>
                {["Email", "Role", "Plan", "Signup date", "Last login", "Consent"].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-white/10">
              {users.map((user) => (
                <tr key={user.id} className="bg-white dark:bg-slate-950">
                  <td className="px-4 py-4 font-black text-ink dark:text-white">{user.email}</td>
                  <td className="px-4 py-4 capitalize text-slate-600 dark:text-slate-300">{displayRole(user.role)}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{user.plan}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{formatDate(user.signupDate)}</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{formatDate(user.lastLogin)}</td>
                  <td className="px-4 py-4">
                    <Badge tone={user.marketingConsent ? "good" : "warn"}>{user.marketingConsent ? "Yes" : "No"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
