"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type QuickNavProps = {
  mode?: "seller" | "shopper" | "general";
  current?: string;
};

export function QuickNav({ mode = "general", current = "" }: QuickNavProps) {
  const router = useRouter();

  const links =
    mode === "seller"
      ? [
          { label: "Analyze", href: "/analyze" },
          { label: "Seller Dashboard", href: "/dashboard/seller" },
          { label: "Compare", href: "/compare" },
          { label: "Account", href: "/account" },
        ]
      : mode === "shopper"
        ? [
            { label: "Analyze", href: "/analyze" },
            { label: "Shopper Dashboard", href: "/dashboard/customer" },
            { label: "Pricing", href: "/pricing" },
            { label: "Account", href: "/account" },
          ]
        : [
            { label: "Analyze", href: "/analyze" },
            { label: "Dashboard", href: "/dashboard" },
            { label: "Pricing", href: "/pricing" },
            { label: "Account", href: "/account" },
          ];

  return (
    <nav className="mb-5 rounded-[1.5rem] border border-line bg-white/90 p-3 shadow-soft backdrop-blur dark:border-white/10 dark:bg-slate-950/90">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-line px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-600 transition hover:border-ocean hover:text-ocean dark:border-white/10 dark:text-slate-300"
        >
          ← Back
        </button>

        {links.map((link) => {
          const active = current === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition",
                active
                  ? "bg-ink text-white dark:bg-white dark:text-ink"
                  : "bg-slate-50 text-slate-600 hover:bg-ocean/10 hover:text-ocean dark:bg-white/5 dark:text-slate-300",
              ].join(" ")}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
