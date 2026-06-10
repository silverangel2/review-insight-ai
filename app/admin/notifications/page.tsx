import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { NotificationCenter } from "@/components/NotificationCenter";

export default function AdminNotificationsPage() {
  return (
    <DashboardShell title="Notifications" subtitle="Review and manage this ReviewIntel workspace area.">
      <div className="space-y-6">
        <div className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">Admin notifications</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-ink dark:text-white">Notification command center</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">System alerts, customer messages, security alerts, and operations warnings.</p>
            </div>
            <Link href="/admin" className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
              Back to Admin
            </Link>
          </div>
        </div>

        <NotificationCenter scope="admin" />
      </div>
    </DashboardShell>
  );
}
