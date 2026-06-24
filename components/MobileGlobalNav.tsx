"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/analyze", label: "Scan" },
  { href: "/pricing", label: "Premium" },
  { href: "/advertise", label: "Advertise" }
];

const moreLinks = [
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
      data-mobile-global-nav="true"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[9999] md:hidden"
      aria-label="Mobile navigation"
    >
      {open ? (
        <div className="mb-2 rounded-3xl border border-white/20 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-2">
            {moreLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-2xl px-3 py-3 text-center text-xs font-black ${
                  isActive(item.href)
                    ? "bg-white text-slate-950"
                    : "bg-white/10 text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-full border border-white/20 bg-slate-950/92 p-1.5 shadow-2xl backdrop-blur-xl">
        <div className="grid grid-cols-5 gap-1">
          {primaryLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-2 py-2 text-center text-[11px] font-black ${
                isActive(item.href)
                  ? "bg-white text-slate-950"
                  : "text-white/85"
              }`}
            >
              {item.label}
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={`rounded-full px-2 py-2 text-center text-[11px] font-black ${
              open ? "bg-cyan-200 text-slate-950" : "text-white/85"
            }`}
          >
            More
          </button>
        </div>
      </div>
    </nav>
  );
}
