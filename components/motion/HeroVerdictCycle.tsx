"use client";
// Hero illustration of the three possible answers. Gently cycles; static for reduced motion.
// It is an explanation of the answer types, not a verdict for any product.
import { useEffect, useState } from "react";

const WORDS = [
  { word: "Buy", cls: "bg-emerald-700 text-white" },
  { word: "Wait", cls: "bg-[#fdf0d5] text-[#7a4a06]" },
  { word: "Skip", cls: "bg-rose-700 text-white" },
];

export function HeroVerdictCycle() {
  const [i, setI] = useState(0);
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;
    setMotion(true);
    const id = window.setInterval(() => setI(n => (n + 1) % WORDS.length), 2600);
    return () => window.clearInterval(id);
  }, []);
  return (
    <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
      <span>You get one clear answer:</span>
      <span className="sr-only">Buy, Wait or Skip.</span>
      <span aria-hidden="true" className="inline-flex gap-1.5">
        {WORDS.map((w, n) => (
          <span key={w.word}
            className={`rounded-full px-3 py-1 text-sm font-semibold transition-[transform,box-shadow] duration-300 ${w.cls} ${motion && n === i ? "scale-110 shadow-md" : "scale-100"}`}>
            {w.word}
          </span>
        ))}
      </span>
    </p>
  );
}
