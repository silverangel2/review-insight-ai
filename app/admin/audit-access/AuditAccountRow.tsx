"use client";

import { useState } from "react";
import { clearClientAccount, saveClientAccount } from "@/lib/clientAccount";

function landingForRole(role: string) {
  const r = role.toLowerCase();
  if (r === "seller") return "/seller/analyze";
  return "/account";
}

export function AuditAccountRow({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInAs() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/audit-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || `Minting failed (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }
      // The admin session cookie makes every page resolve the operator
      // identity, masking the minted test account. Clear ONLY the admin
      // cookie (the logout route leaves the account session untouched) so
      // the browser truly becomes the test account. The operator re-enters
      // via /admin-access when needed.
      await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
      // The app ALSO caches the signed-in account in localStorage, and the
      // account dashboard renders from that cache alone: with no cached
      // account it shows "Account required" and never asks the server, and
      // with a stale operator entry its identity headers clash with the
      // minted session. So mirror what the normal login flow does: clear
      // the stale cache, read the fresh account for the minted session from
      // /api/account, and save it as the client account before navigating.
      clearClientAccount();
      window.sessionStorage.removeItem("reviewintel:owner-unlocked");
      window.sessionStorage.removeItem("reviewintel:owner-last-active");
      const accountRes = await fetch("/api/account").catch(() => null);
      const accountData = accountRes ? await accountRes.json().catch(() => null) : null;
      if (accountData?.account?.email) {
        saveClientAccount(accountData.account);
      }
      window.location.href = landingForRole(String(data.role ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Minting failed.");
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-soft">
      <div>
        <p className="text-sm font-black text-ink">{email}</p>
        {error && <p className="mt-1 text-sm font-semibold" style={{ color: "#b91c1c" }}>{error}</p>}
      </div>
      <button
        type="button"
        onClick={signInAs}
        disabled={busy}
        className="rounded-full bg-ink px-4 py-2 text-sm font-black text-white disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in as"}
      </button>
    </section>
  );
}
