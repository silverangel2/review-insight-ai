import { privatePage } from "@/lib/pageSeo";

export const metadata = privatePage("/auth", "Account");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
