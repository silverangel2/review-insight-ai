import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminBetaPanel } from "@/components/AdminBetaPanel";
import { DashboardShell } from "@/components/DashboardShell";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionCookie } from "@/lib/adminAccess";

export const metadata: Metadata = {
  title: "Admin Beta Panel",
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminBetaPage() {
  const cookieStore = await cookies();
  const adminSession = verifyAdminSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (!adminSession) {
    redirect("/admin-access");
  }

  return (
    <DashboardShell
      title="Beta Panel"
      subtitle="Monitor active beta accounts, customer observations, replies, and beta expiry."
      experience="admin"
    >
      <AdminBetaPanel />
    </DashboardShell>
  );
}
