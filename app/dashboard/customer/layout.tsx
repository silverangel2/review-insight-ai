import { privatePage } from "@/lib/pageSeo";

export const metadata = privatePage("/dashboard/customer", "Shopper dashboard");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
