import { DashboardShell } from "@/components/DashboardShell";
import { auditAccountAllowlist } from "@/lib/auditAccess";
import { AuditAccountRow } from "./AuditAccountRow";

export default function AdminAuditAccessPage() {
  const accounts = auditAccountAllowlist();

  return (
    <DashboardShell
      title="Audit Access"
      subtitle="Issue long-lived audit sessions for allowlisted test accounts — audits never need their passwords."
      experience="admin"
    >
      {accounts.length === 0 ? (
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <p className="text-sm font-bold text-ink">Audit access is not configured.</p>
          <p className="mt-2 text-sm text-ink/70">
            Set the <code className="font-mono">REVIEWINTEL_AUDIT_ACCOUNTS</code> environment
            variable to a comma-separated list of the test-account emails the
            automated audits may sign in as, then redeploy.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-line bg-white p-4 shadow-soft">
            <p className="text-sm text-ink/70">
              Each account below can receive a 90-day session via{" "}
              <code className="font-mono">/api/admin/audit-session</code>. Minting is
              recorded in the security log. Only use this for your own test accounts.
            </p>
          </section>
          <div className="mt-4 grid gap-4">
            {accounts.map((email) => (
              <AuditAccountRow key={email} email={email} />
            ))}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
