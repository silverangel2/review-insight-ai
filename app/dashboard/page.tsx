import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("reviewintel_account_role")?.value;

  if (role === "seller") redirect("/dashboard/seller");
  if (role === "admin") redirect("/admin");
  if (role === "buyer") redirect("/dashboard/customer");

  redirect("/login?next=/dashboard");
}
