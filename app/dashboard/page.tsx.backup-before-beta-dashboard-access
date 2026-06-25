import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const role = (cookieStore.get("reviewintel_account_role")?.value || "").toLowerCase();
  const plan = (cookieStore.get("reviewintel_account_plan")?.value || "").toLowerCase();

  const hasPaidSellerPlan = plan === "seller_premium" || plan === "seller_pro";

  if (hasPaidSellerPlan) {
    redirect("/dashboard/seller");
  }

  if (role === "seller") {
    redirect("/pricing?plan=seller_premium");
  }

  if (role === "buyer" && plan === "buyer_pro") {
    redirect("/analyze");
  }

  redirect("/analyze");
}
