import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { AdminBusinessCalendar } from "@/components/AdminBusinessCalendar";


export default function AdminCalendarPage() {
  return (
    <DashboardShell title="Admin Calendar" subtitle="Review and manage scheduled admin items." experience="admin">
      <div className="space-y-6">
        <div className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-gradient-to-r from-sky-600 to-teal-500">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
                Admin calendar
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-ink dark:text-white">
                Business calendar, tax reminders, and launch tasks
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Personal business reminders for ReviewIntel operations, tax records, maintenance, and growth tasks.
              </p>
            </div>

            <Link
              href="/admin"
              className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
            >
              Back to Admin
            </Link>
          </div>
        </div>

        <AdminBusinessCalendar />

      </div>
    </DashboardShell>
  );
}
