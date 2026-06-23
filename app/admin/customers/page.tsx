import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { AdminUserSystem } from "@/components/AdminUserSystem";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionCookie } from "@/lib/adminAccess";

export default async function AdminCustomersPage() {
  const cookieStore = await cookies();
  const adminSession = verifyAdminSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (!adminSession) {
    redirect("/admin-access");
  }

  return (
    <DashboardShell title="Admin Customers" subtitle="Review customer accounts, plans, and usage activity." experience="admin">
      <div className="space-y-6">
        <div className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
                Admin customers
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-ink dark:text-white">
                Signed customers, plans, scans, and account status
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                View customers, sort by plan/status/scans, export users, and manage account status.
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

        <AdminUserSystem />
      </div>
    </DashboardShell>
  );
}
