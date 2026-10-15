"use client";

import { useEffect, useState } from "react";

/**
 * ThemeEffects — the interactive layer of the premium theme.
 *
 * - Cursor-follow glow (pointer:fine only, rAF-throttled, CSS variables).
 * - IntersectionObserver scroll reveals: `.ri-reveal` -> `.ri-in`.
 * - Slow aurora drift on the body (background-level, exempt from the
 *   "result pages stay still" rule).
 *
 * ALL effects are disabled under prefers-reduced-motion; the cursor glow is
 * also skipped on touch devices. No data fetching, no layout changes.
 */
export function ThemeEffects() {
  const [glowOn, setGlowOn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    if (reduceMotion) return; // instant-render path: CSS guards show final states.

    document.body.classList.add("ri-drift-on");

    // Scroll reveals: observe existing and future .ri-reveal nodes.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("ri-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    const watch = (root: ParentNode) => {
      root.querySelectorAll(".ri-reveal:not(.ri-in)").forEach((el) => io.observe(el));
    };
    watch(document);
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n instanceof Element) {
            if (n.classList?.contains("ri-reveal") && !n.classList.contains("ri-in")) io.observe(n);
            watch(n);
          }
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Cursor glow: rAF-throttled pointer tracking, pointer:fine only.
    let raf = 0;
    let lastX = -999;
    let lastY = -999;
    const onMove = (e: PointerEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const doc = document.documentElement;
        doc.style.setProperty("--mx", `${lastX}px`);
        doc.style.setProperty("--my", `${lastY}px`);
      });
    };
    if (finePointer) {
      setGlowOn(true);
      window.addEventListener("pointermove", onMove, { passive: true });
    }

    return () => {
      document.body.classList.remove("ri-drift-on");
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  if (!glowOn) return null;
  return <div className="ri-glow" aria-hidden="true" />;
}
