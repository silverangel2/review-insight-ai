"use client";
// Renders the real final number on the server; counts up once on reveal (<=600ms) unless reduced motion.
// Writes the text node directly (no React re-renders per frame).
import { useEffect, useRef } from "react";

export function CountUp({ value, decimals = 1, durationMs = 600 }: { value: number; decimals?: number; durationMs?: number }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0; const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      node.textContent = (value * (1 - Math.pow(1 - t, 3))).toFixed(decimals);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); node.textContent = value.toFixed(decimals); };
  }, [value, decimals, durationMs]);
  return <><span className="sr-only">{value.toFixed(decimals)}</span><span ref={el} aria-hidden="true" className="tabular-nums">{value.toFixed(decimals)}</span></>;
}
