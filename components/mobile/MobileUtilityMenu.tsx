"use client";

import Link from "next/link";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function MobileUtilityMenu() {
  return (
    <div className="ri-mobile-utility-menu">
      <div className="ri-mobile-utility-row">
        <Link className="ri-mobile-utility-more-link" href="/mobile-more" prefetch>
          More
        </Link>

        <LanguageSwitcher />
      </div>
    </div>
  );
}
