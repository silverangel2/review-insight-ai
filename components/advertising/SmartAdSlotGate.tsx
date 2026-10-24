"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * SmartAdSlotGate (homepage overhaul, 2026-10-23): the homepage carries
 * exactly ONE sponsored strip — its own HouseAdSlot — so the site-wide
 * SmartAdSlot stands down on "/" only. Every other route renders it
 * exactly as before; nothing about the slot itself changes.
 */
export function SmartAdSlotGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <>{children}</>;
}
