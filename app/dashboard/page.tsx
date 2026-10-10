import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const role = (cookieStore.get("reviewintel_account_role")?.value || "").toLowerCase();
  const plan = (cookieStore.get("reviewintel_account_plan")?.value || "").toLowerCase();

  const hasPaidSellerPlan = plan === "seller_premium" || plan === "seller_beta" || plan === "seller_pro";

  if (hasPaidSellerPlan) {
    redirect("/dashboard/seller");
  }

  if (role === "seller") {
    redirect("/pricing?plan=seller_premium");
  }

  if (role === "buyer") {
    redirect("/dashboard/customer"); // Premium hub, or the Free preview of it
  }

  redirect("/analyze");
}
