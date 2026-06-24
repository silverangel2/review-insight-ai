"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/analyze", label: "Scan" },
  { href: "/pricing", label: "Premium" },
  { href: "/advertise", label: "Advertise" },
  { href: "/dashboard/customer", label: "Buyer" },
  { href: "/dashboard/seller", label: "Seller" },
  { href: "/compare", label: "Compare" },
  { href: "/account", label: "Account" },
  { href: "/contact", label: "Support" }
];

export default function MobileGlobalNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  }

  return (
    <nav
      data-mobile-global-nav="compact"
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-[9999] md:hidden"
      aria-label="Mobile navigation"
    >
      {open ? (
        <div className="mb-2 w-[min(18rem,calc(100vw-2rem))] rounded-3xl border border-white/15 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/55">Menu</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-2xl px-3 py-3 text-center text-xs font-black ${
                  isActive(item.href)
                    ? "bg-cyan-200 text-slate-950"
                    : "bg-white/10 text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-white/20 bg-slate-950/95 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white shadow-2xl backdrop-blur-xl"
      >
        {open ? "Close" : "Menu"}
      </button>
    </nav>
  );
}
