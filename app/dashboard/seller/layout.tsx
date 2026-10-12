import { privatePage } from "@/lib/pageSeo";

export const metadata = privatePage("/dashboard/seller", "Seller dashboard");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
