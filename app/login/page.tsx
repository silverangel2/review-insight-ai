import { LoginForm } from "@/components/LoginForm";
import type { Metadata } from "next";
import { withSeo, privatePage } from "@/lib/pageSeo";

export const metadata = privatePage("/login", "Sign in");

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <LoginForm />
    </main>
  );
}
