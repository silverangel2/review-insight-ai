import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionCookie } from "@/lib/adminAccess";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const adminSession = verifyAdminSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (!adminSession) {
    redirect("/admin-access");
  }

  return children;
}
