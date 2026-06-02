import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSEOManager } from "@/components/AdminSEOManager";
import { DashboardShell } from "@/components/DashboardShell";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionCookie } from "@/lib/adminAccess";

export const metadata: Metadata = {
  title: "SEO Manager",
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminSEOPage() {
  const cookieStore = await cookies();
  const adminSession = verifyAdminSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (!adminSession) {
    redirect("/admin-access");
  }

  return (
    <DashboardShell
      title="SEO manager"
      subtitle="Launch metadata, Open Graph previews, canonical URLs, robots settings, sitemap status, and SEO landing-page structure."
      experience="admin"
    >
      <AdminSEOManager />
    </DashboardShell>
  );
}
