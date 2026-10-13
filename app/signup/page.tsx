import { LoginForm } from "@/components/LoginForm";
import type { Metadata } from "next";
import { withSeo, privatePage } from "@/lib/pageSeo";

export const metadata = privatePage("/signup", "Create your free account");

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <LoginForm initialMode="signup" />
    </main>
  );
}
