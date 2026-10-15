"use client";

import { useEffect, useState } from "react";
import { claimReveal, easeOutCubic, peekReveal } from "@/lib/revealOnce";

/**
 * ScoreCountUp — the Buying Score counts 0 -> value over the unlock beat.
 *
 * Only on a fresh reveal (mount-once flag via revealOnce, same key family as
 * BriefReveal) and only when the user allows motion. Otherwise — repeat
 * views, back-navigation, reduced motion, SSR — the real score renders
 * instantly. The number at rest is ALWAYS the real score; the animation ends
 * on the exact value.
 */
export function ScoreCountUp({ value, revealKey }: { value: number; revealKey: string | null }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const key = revealKey ? `${revealKey}:score` : null;
    if (!peekReveal(key)) return; // already revealed -> keep the real value
    claimReveal(key);
    // The unlock animation covers the first frames (card starts at opacity
    // 0), so the reset to 0 below is never perceived as a flicker.
    setDisplay(0);
    const duration = 700;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(value * easeOutCubic(p)));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(value); // exact final value, always
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, revealKey]);

  return <>{display}</>;
}
