"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { listenForTrafficConsent, trackTrafficEvent } from "@/lib/clientTraffic";

function shouldSkipPath(path: string) {
  return (
    path.startsWith("/admin") ||
    path.startsWith("/owner-access") ||
    path.startsWith("/api") ||
    path.startsWith("/_next")
  );
}

export function TrafficTracker() {
  const pathname = usePathname();
  const lastTracked = useRef("");

  useEffect(() => {
    if (!pathname || shouldSkipPath(pathname)) return;

    const trackCurrentPage = () => {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (lastTracked.current === currentPath) return;
      lastTracked.current = currentPath;
      trackTrafficEvent({ eventType: "page_view", path: currentPath });
    };

    const timeout = window.setTimeout(trackCurrentPage, 450);
    const stopListening = listenForTrafficConsent(trackCurrentPage);

    return () => {
      window.clearTimeout(timeout);
      stopListening();
    };
  }, [pathname]);

  return null;
}
