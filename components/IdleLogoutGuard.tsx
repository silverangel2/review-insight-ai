"use client";

import { useEffect, useRef } from "react";
import {
  ACCOUNT_IDLE_TIMEOUT_MS,
  ACCOUNT_LAST_ACTIVE_KEY,
  getClientAccount,
  logoutEverywhere,
  touchClientAccountActivity
} from "@/lib/clientAccount";

export function IdleLogoutGuard() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hasRealLogin = () => {
      const account = getClientAccount();
      return Boolean(account?.email);
    };

    const logoutForIdle = () => {
      if (!hasRealLogin()) return;

      void logoutEverywhere("/login?reason=idle");
    };

    const scheduleCheck = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const lastActivity = Number(window.localStorage.getItem(ACCOUNT_LAST_ACTIVE_KEY) ?? Date.now());
      const elapsed = Date.now() - lastActivity;
      const remaining = Math.max(0, ACCOUNT_IDLE_TIMEOUT_MS - elapsed);

      timeoutRef.current = setTimeout(() => {
        const latestActivity = Number(window.localStorage.getItem(ACCOUNT_LAST_ACTIVE_KEY) ?? Date.now());
        const latestElapsed = Date.now() - latestActivity;

        if (latestElapsed >= ACCOUNT_IDLE_TIMEOUT_MS) {
          logoutForIdle();
          return;
        }

        scheduleCheck();
      }, remaining);
    };

    const markActivity = () => {
      if (!hasRealLogin()) return;

      touchClientAccountActivity();
      scheduleCheck();
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

    if (hasRealLogin() && !window.localStorage.getItem(ACCOUNT_LAST_ACTIVE_KEY)) {
      touchClientAccountActivity();
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
