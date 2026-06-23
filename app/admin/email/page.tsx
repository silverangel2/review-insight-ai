import AdminEmailLogViewer from "@/components/AdminEmailLogViewer";
import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { SupportContactForm } from "@/components/SupportContactForm";
import { AdminEmailInbox } from "@/components/AdminEmailInbox";

export default function AdminEmailPage() {
  return (
    <DashboardShell title="Admin Email" subtitle="Manage customer email workflows and communication tools." experience="admin">
      <div className="space-y-6">
        <div className="rounded-3xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean dark:text-cyan-300">
                Admin email system
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-ink dark:text-white">
                Messages, customer support, and email workflow
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Read customer messages, search support requests, reply through Resend, archive cases, and copy clean troubleshooting briefs. Marketing broadcasts live in the Marketing Campaigns page.
              </p>
                  <div className="min-w-0 w-full max-w-full overflow-hidden">
        <AdminEmailLogViewer />
      </div>
    </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/marketing"
                className="rounded-2xl border border-line px-5 py-3 text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:text-white"
              >
                Marketing Campaigns
              </Link>
              <Link
                href="/admin"
                className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:bg-ocean dark:bg-white dark:text-ink"
              >
                Back to Admin
              </Link>
            </div>
          </div>
        </div>

        <AdminEmailInbox />

        <SupportContactForm />
      </div>
    </DashboardShell>
  );
}
