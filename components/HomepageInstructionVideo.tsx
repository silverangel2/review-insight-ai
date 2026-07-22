"use client";

import { useState } from "react";
import type { HomepageVideo } from "@/lib/homepageVideo";

type HomepageInstructionVideoProps = {
  video: HomepageVideo | null;
};

export function HomepageInstructionVideo({ video }: HomepageInstructionVideoProps) {
  const [loopEnabled, setLoopEnabled] = useState(true);
  const poster = video?.thumbnail_url || "/reviewintel-video-cover.svg";

  if (!video) {
    return (
      <div className="flex aspect-[9/16] w-full flex-col items-center justify-center rounded-[1.35rem] bg-[linear-gradient(135deg,#10182a,#0ea5a3_55%,#f5c15c)] p-6 text-center text-white">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
          ReviewIntel video
        </p>
        <h3 className="mt-3 text-3xl font-black">Scan reviews before you buy</h3>
        <p className="mt-3 max-w-xl text-sm font-bold leading-6 text-white/82">
          A branded cover is ready for the homepage instruction video.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <video
        className="aspect-[9/16] w-full rounded-[1.35rem] bg-ink object-contain"
        src={video.file_url}
        poster={poster}
        playsInline
        controls
        muted
        loop={loopEnabled}
        preload="metadata"
      />
      <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full border border-white/72 bg-white/86 px-2.5 py-1.5 text-[11px] font-black text-ink shadow-soft backdrop-blur">
        <button
          type="button"
          aria-pressed={loopEnabled}
          onClick={() => setLoopEnabled((current) => !current)}
          className={`relative h-5 w-9 rounded-full transition ${loopEnabled ? "bg-ocean" : "bg-slate-300"}`}
        >
          <span
            className={`absolute left-0 top-1 size-3 rounded-full bg-white shadow-sm transition-transform ${
              loopEnabled ? "translate-x-5" : "translate-x-1"
            }`}
          />
          <span className="sr-only">{loopEnabled ? "Turn loop off" : "Turn loop on"}</span>
        </button>
        <span>{loopEnabled ? "Loop" : "No loop"}</span>
      </div>
    </div>
  );
}
