"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const topNavLinks = [
  { href: "/analyze", label: "Analyze" },
  { href: "/results", label: "Results" },
  { href: "/pricing", label: "Pricing" },
  { href: "/advertise", label: "Advertise" },
  { href: "/account", label: "Profile" },
];

export default function MobileTinyNav() {
  const pathname = usePathname();

  function handleLogout() {
    const buttons = Array.from(document.querySelectorAll("button, a"));
    const logoutButton = buttons.find((element) =>
      element.textContent?.trim().toLowerCase().includes("log out")
    ) as HTMLElement | undefined;

    if (logoutButton) {
      logoutButton.click();
      return;
    }

    window.location.href = "/";
  }

  return (
    <nav className="ri-mobile-tiny-nav" aria-label="Mobile top navigation">
      <div className="ri-mobile-tiny-nav-scroll">
        {topNavLinks.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/" && pathname?.startsWith(link.href));

          return (
            <Link
              key={link.href}
              href={link.href}
              className={active ? "active" : ""}
            >
              {link.label}
            </Link>
          );
        })}

        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </nav>
  );
}
