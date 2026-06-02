import { LoginForm } from "@/components/LoginForm";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <LoginForm initialMode="reset" />
    </main>
  );
}
