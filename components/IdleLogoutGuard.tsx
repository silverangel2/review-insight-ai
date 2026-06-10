"use client";

import { useEffect, useRef } from "react";
import { clearClientAccount, getClientAccount } from "@/lib/clientAccount";

const IDLE_LIMIT_MS = 60 * 60 * 1000; // 1 hour
const LAST_ACTIVITY_KEY = "reviewintel_last_activity_at";

export function IdleLogoutGuard() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hasRealLogin = () => {
      const account = getClientAccount();
      return Boolean(account?.email);
    };

    const logoutForIdle = () => {
      if (!hasRealLogin()) return;

      clearClientAccount();
      window.location.href = "/login?reason=idle";
    };

    const scheduleCheck = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const lastActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY) ?? Date.now());
      const elapsed = Date.now() - lastActivity;
      const remaining = Math.max(0, IDLE_LIMIT_MS - elapsed);

      timeoutRef.current = setTimeout(() => {
        const latestActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY) ?? Date.now());
        const latestElapsed = Date.now() - latestActivity;

        if (latestElapsed >= IDLE_LIMIT_MS) {
          logoutForIdle();
          return;
        }

        scheduleCheck();
      }, remaining);
    };

    const markActivity = () => {
      if (!hasRealLogin()) return;

      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      scheduleCheck();
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

    if (hasRealLogin() && !window.localStorage.getItem(LAST_ACTIVITY_KEY)) {
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    }

    events.forEach((event) => window.addEventListener(event, markActivity, { passive: true }));
    scheduleCheck();

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActivity));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return null;
}
