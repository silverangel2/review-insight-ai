import Link from "next/link";
import { Badge } from "@/components/Badge";

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <section className="rounded-2xl border border-line bg-white p-8 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <Badge tone="info">Email verification</Badge>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-ink dark:text-white">Verification flow ready</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Supabase Auth will send verification links after production keys are configured. This page is the user-facing destination for verification status and next steps.
        </p>
        <Link href="/login" className="mt-6 inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink">
          Back to login
        </Link>
      </section>
    </main>
  );
}
