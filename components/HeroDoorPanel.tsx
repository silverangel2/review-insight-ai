"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HeroScanBar } from "@/components/HeroScanBar";

/**
 * HeroDoorPanel — the hero's door panel (homepage overhaul, 2026-10-23).
 * The SCREENSHOT door is the primary action (it is the door most
 * customers use); the paste-a-link bar sits below it as the second door.
 *
 * The screenshot door is first. A chosen or dropped photo is carried to
 * /analyze (session storage, image only, size-capped) so the phone scan
 * starts on that picture. The link bar below is the optional second door.
 */
export function HeroDoorPanel() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const goToScreenshotDoor = () => router.push("/analyze");

  const carryScreenshot = (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/") || file.size > 1_500_000) {
      goToScreenshotDoor();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result === "string") {
          window.sessionStorage.setItem(
            "reviewintel_pending_screenshot",
            JSON.stringify({ name: file.name, type: file.type, dataUrl: reader.result })
          );
        }
      } catch { /* storage full — the analyze page still opens */ }
      goToScreenshotDoor();
    };
    reader.onerror = () => goToScreenshotDoor();
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-[24px] border border-[#e2e8f0] bg-white p-[22px] text-left shadow-[0_18px_44px_rgba(23,32,51,0.08)] dark:border-white/10 dark:bg-[#171824]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          carryScreenshot(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-2xl border-2 border-dashed px-5 py-[26px] text-center transition-colors ${
          dragging
            ? "border-[#5b3df0] bg-[#e0e7ff] dark:bg-[#262254]"
            : "border-[#c4b5fd] bg-[#eef2ff] dark:bg-[#1d1b33]"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="mx-auto size-[30px] text-[#5b3df0]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <p className="mt-1.5 text-[17px] font-bold text-ink dark:text-white">
          Screenshot the reviews, drop them here
        </p>
        <p className="mt-1 text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
          Photos or screenshots of the written reviews — a few screens is plenty.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="ri-btn-gradient mt-4 rounded-full px-[26px] py-3.5 text-base font-bold"
        >
          Upload screenshots
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          aria-label="Upload screenshots of the reviews"
          onChange={(e) => {
            carryScreenshot(e.target.files?.[0]);
          }}
        />
      </div>

      <div
        aria-hidden="true"
        className="mx-1 my-5 flex items-center gap-3.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400"
      >
        <span className="h-px flex-1 bg-[#e2e8f0] dark:bg-white/10" />
        or
        <span className="h-px flex-1 bg-[#e2e8f0] dark:bg-white/10" />
      </div>

      <HeroScanBar />
    </div>
  );
}
