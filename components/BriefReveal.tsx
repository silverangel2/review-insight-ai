"use client";

import { useEffect, useRef, useState } from "react";
import { claimReveal, peekReveal } from "@/lib/revealOnce";

/**
 * BriefReveal — arms the Phase 7 unlock choreography for a FRESH result only.
 *
 * Adds `ri-reveal-armed` to the wrapper when (a) this result key has never
 * revealed in this tab and (b) the user allows motion. The theme CSS runs
 * the unlock / stagger / glimmer animations only under that class, so repeat
 * views, back-navigation, SSR first paint, and reduced-motion all render the
 * final state instantly — no replay, no flash.
 */
export function BriefReveal({
  revealKey,
  children,
  className = "",
}: {
  revealKey: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const [armed, setArmed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true; // SSR: assume fresh; effect corrects.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return peekReveal(revealKey);
  });
  const claimed = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setArmed(false);
      return;
    }
    if (!claimed.current) {
      claimed.current = true;
      // Consume the claim on mount so SPA back-navigation never replays.
      if (armed) claimReveal(revealKey);
    }
  }, [armed, revealKey]);

  return <div className={armed ? `ri-reveal-armed ${className}`.trim() : className}>{children}</div>;
}
