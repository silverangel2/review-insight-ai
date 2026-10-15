"use client";

import { useState } from "react";

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
