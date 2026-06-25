"use client";

import { useEffect, useRef } from "react";
import { getClientAccount, logoutEverywhere } from "@/lib/clientAccount";

const ONE_HOUR = 60 * 60 * 1000;
const CHECK_EVERY = 60 * 1000;
const LAST_ACTIVITY_KEY = "reviewintel_last_activity_at";

export default function SessionIdleLogout() {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    function markActivity() {
      if (!getClientAccount()) return;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    }

    function checkIdle() {
      const account = getClientAccount();

      if (!account) {
        return;
      }

      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());

      if (Date.now() - lastActivity >= ONE_HOUR) {
        void logoutEverywhere("/login?expired=1");
      }
    }

    markActivity();

    const events = ["click", "keydown", "mousemove", "touchstart", "scroll"];

    for (const event of events) {
      window.addEventListener(event, markActivity, { passive: true });
    }

    timerRef.current = window.setInterval(checkIdle, CHECK_EVERY);

    return () => {
      for (const event of events) {
        window.removeEventListener(event, markActivity);
      }

      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  return null;
}
