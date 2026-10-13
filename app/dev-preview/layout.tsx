import { privatePage } from "@/lib/pageSeo";

export const metadata = privatePage("/dev-preview", "Preview");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
