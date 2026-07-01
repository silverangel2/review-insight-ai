"use client";

import { useEffect, useMemo, useState } from "react";
import { getClientAccount } from "@/lib/clientAccount";

type ClientAccountShape = {
  email?: string;
  name?: string;
  role?: string;
  plan?: string;
} | null;

function permissionKey(account: ClientAccountShape) {
  const identity = String(account?.email || account?.name || "guest").trim().toLowerCase();
  const role = String(account?.role || "guest").trim().toLowerCase();
  const plan = String(account?.plan || "guest").trim().toLowerCase();

  return `reviewintel:workspace-permission:${role}:${plan}:${identity}`;
}

export default function AccountWorkspacePermission() {
  const [account, setAccount] = useState<ClientAccountShape>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const current = getClientAccount() as ClientAccountShape;
      setAccount(current);

      if (!current?.email && !current?.name) return;

      const key = permissionKey(current);
      const approved = window.localStorage.getItem(key);

      if (!approved) {
        setVisible(true);
      }
    } catch {
      setVisible(false);
    }
  }, []);

  const title = useMemo(() => {
    const role = String(account?.role || "").toLowerCase();
    const plan = String(account?.plan || "").toLowerCase();

    if (role.includes("seller") && plan.includes("seller_pro")) return "Seller Pro workspace";
    if (role.includes("seller")) return "Seller workspace";
    if (plan.includes("buyer_pro")) return "Shopper Premium workspace";
    return "Shopper workspace";
  }, [account]);

  function allowWorkspace() {
    if (!account) return;

    window.localStorage.setItem(permissionKey(account), "approved");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-[9998] mx-auto max-w-sm rounded-3xl border border-white/50 bg-white/90 p-4 text-slate-950 shadow-2xl backdrop-blur-2xl md:hidden">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">One-time access</p>
      <h2 className="mt-1 text-lg font-black">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-5 text-slate-600">
        Allow this account to use its own private ReviewIntel workspace on this device. This keeps scans, results, and dashboards separated by account.
      </p>
      <button
        type="button"
        onClick={allowWorkspace}
        className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
      >
        Allow workspace access
      </button>
    </div>
  );
}
