"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { getClientAccount } from "@/lib/clientAccount";
import { formatPercent } from "@/lib/analysisScoring";

const views = {
  clusters: {
    title: "Complaint clusters",
    rows: [
      ["Packaging damage", 71, "High repeat risk"],
      ["Listing mismatch", 58, "Conversion friction"],
      ["Replacement parts", 47, "Support load"],
      ["Durability doubts", 64, "Refund pressure"]
    ]
  },
  keywords: {
    title: "Keyword intelligence",
    rows: [
      ["leak", 66, "Negative shopper language"],
      ["compact", 82, "Positive positioning"],
      ["support", 54, "Trust issue"],
      ["cleanup", 74, "Ad-copy opportunity"]
    ]
  },
  actions: {
    title: "Action plan",
    rows: [
      ["Fix listing photos", 88, "Immediate listing update"],
      ["Improve insert card", 63, "Reduce support tickets"],
      ["Add warranty copy", 52, "Lower purchase anxiety"],
      ["Bundle spare gasket", 44, "Reduce refund risk"]
    ]
  }
};

type ViewKey = keyof typeof views;

function isSellerProAccount() {
  const account = getClientAccount();
  return account?.role === "seller" && account?.plan === "seller_pro";
}

export function SellerProCommandPanel() {
  const [active, setActive] = useState<ViewKey>("clusters");
  const [sellerPro, setSellerPro] = useState(false);

  useEffect(() => {
    setSellerPro(isSellerProAccount());
  }, []);

  if (!sellerPro) {
    return (
      <article className="rounded-[2rem] border border-dashed border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950">
        <Badge tone="warn">Seller Pro feature</Badge>
        <h2 className="mt-3 text-2xl font-black text-ink dark:text-white">Command board is reserved for Seller Pro.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Seller Premium includes seller analytics and product tracking. Seller Pro unlocks command-board intelligence, calendar history, and deeper action planning.
        </p>
      </article>
    );
  }

  const view = views[active];

  return (
    <article className="rounded-[2rem] border border-line bg-ink p-6 text-white shadow-glow dark:border-white/10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-teal">Seller Pro command board</p>
          <h2 className="mt-2 text-3xl font-black">{view.title}</h2>
        </div>
        <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">
          {(Object.keys(views) as ViewKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`rounded-xl px-4 py-2 text-sm font-black capitalize transition ${
                active === key ? "bg-white text-ink" : "text-slate-300 hover:text-white"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {view.rows.map(([label, value, detail], index) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-black">{label}</p>
                <p className="mt-1 text-sm text-slate-400">{detail}</p>
              </div>
              <p className="text-2xl font-black text-teal">{formatPercent(value as number)}</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className={index === 0 ? "h-full rounded-full bg-coral" : index === 1 ? "h-full rounded-full bg-amber" : "h-full rounded-full bg-teal"} style={{ width: `${value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
