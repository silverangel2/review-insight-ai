"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdSlot } from "@/components/advertising/AdSlot";
import type { AdPlacement } from "@/lib/adConfig";
import { getClientAccount } from "@/lib/clientAccount";

type SmartAdSlotProps = {
  placement?: AdPlacement;
  className?: string;
  compact?: boolean;
};

function canShowAds() {
  const account = getClientAccount();

  // Guests can see public ads.
  if (!account) return true;

  // Sellers should not see shopper ad slots.
  if (account.role === "seller") return false;

  // Shopper Free sees ads.
  if (account.role === "buyer" && account.plan === "free_buyer") return true;

  // Shopper Premium / paid buyer does not see ads.
  return false;
}

function placementFromPath(pathname: string): AdPlacement {
  if (pathname === "/analyze") return "analyze_below_card";
  if (pathname === "/analyze/result") return "results_below_verdict";
  if (pathname.startsWith("/dashboard/customer")) return "buyer_dashboard";
  if (pathname === "/pricing") return "pricing";
  return "footer";
}

export function SmartAdSlot({
  placement,
  className = "",
  compact = false,
}: SmartAdSlotProps) {
  const pathname = usePathname();
  const [showAds, setShowAds] = useState(false);

  useEffect(() => {
    setShowAds(canShowAds());
  }, [pathname]);

  if (!showAds) return null;

  return (
    <AdSlot
      placement={placement || placementFromPath(pathname)}
      compact={compact}
      className={className}
    />
  );
}
