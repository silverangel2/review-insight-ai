"use client";

import { useEffect, useRef } from "react";

export function BookmarkletLink({ code }: { code: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("href", code);
  }, [code]);
  return (
    <a
      ref={ref}
      href="#analyze-this-page"
      className="inline-flex rounded-full bg-ink px-5 py-3 text-sm font-black text-white"
    >
      Analyze this page
    </a>
  );
}
