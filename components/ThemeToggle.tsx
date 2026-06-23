"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("reviewintel:theme");
    const nextDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", nextDark);
    setIsDark(nextDark);
  }, []);

  function toggleTheme() {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    localStorage.setItem("reviewintel:theme", nextDark ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="grid size-10 place-items-center rounded-xl border border-line bg-white text-sm font-black text-ink transition hover:border-ocean dark:border-white/10 dark:bg-white/5 dark:text-white"
      aria-label="Toggle color theme"
      title="Toggle color theme"
    >
      {isDark ? "L" : "D"}
    </button>
  );
}
