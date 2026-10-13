import { PasswordResetCompleteForm } from "@/components/PasswordResetCompleteForm";
import type { Metadata } from "next";
import { withSeo, privatePage } from "@/lib/pageSeo";

export const metadata = privatePage("/auth/reset-password", "Reset password");

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <PasswordResetCompleteForm />
    </main>
  );
}
