"use client";

type AppleWatchScanRingProps = {
  progress: number;
};

const SEGMENTS = 60;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function AppleWatchScanRing({ progress }: AppleWatchScanRingProps) {
  const safeProgress = clamp(progress, 0, 100);
  const filled = Math.floor((safeProgress / 100) * SEGMENTS);

  return (
    <div className="relative mx-auto grid size-56 place-items-center" aria-hidden="true">
      <div className="absolute inset-0">
        {Array.from({ length: SEGMENTS }).map((_, index) => {
          const isOn = index < filled;

          return (
            <span
              key={index}
              className="absolute left-1/2 top-1/2 h-[22px] w-[3.5px] -ml-[1.75px] -mt-[11px] rounded-full transition-opacity duration-500 ease-out"
              style={{
                transform: `rotate(${index * (360 / SEGMENTS)}deg) translateY(-104px)`,
                opacity: isOn ? 1 : 0.04,
                background: isOn ? "rgba(157,255,242,0.95)" : "rgba(255,255,255,0.08)",
              }}
            />
          );
        })}
      </div>

      <div className="ri-crystal-ball relative grid size-20 place-items-center overflow-hidden rounded-full">
        <div className="ri-crystal-core absolute inset-0" />
        <div className="ri-crystal-lightning ri-bolt-one" />
        <div className="ri-crystal-lightning ri-bolt-two" />
        <div className="ri-crystal-lightning ri-bolt-three" />
        <div className="absolute left-4 top-3 size-5 rounded-full bg-white/80 blur-[1px]" />
        <div className="absolute left-7 top-7 size-2.5 rounded-full bg-cyan-100/80 blur-[1px]" />
        <div className="absolute inset-[7px] rounded-full border border-white/25" />
        <div className="absolute inset-0 rounded-full shadow-[inset_-10px_-12px_18px_rgba(2,6,23,0.45),inset_7px_7px_18px_rgba(255,255,255,0.28)]" />
      </div>

      <style jsx>{`
        .ri-crystal-ball {
          background: rgba(180, 255, 248, 0.16);
          box-shadow:
            0 0 18px rgba(125, 249, 232, 0.36),
            inset 0 0 16px rgba(255,255,255,0.22);
          animation: crystalPulse 3.8s ease-in-out infinite;
          will-change: transform, filter;
        }

        .ri-crystal-core {
          background:
            radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95), transparent 0 15%, transparent 16%),
            radial-gradient(circle at 65% 68%, rgba(34,211,238,0.75), transparent 0 18%, transparent 19%),
            radial-gradient(circle at 45% 44%, rgba(167,255,242,0.95), rgba(45,212,191,0.55) 32%, rgba(8,145,178,0.35) 58%, rgba(15,23,42,0.84) 100%);
          animation: crystalEnergyMove 4.2s ease-in-out infinite alternate;
        }

        .ri-crystal-lightning {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 2px;
          height: 34px;
          border-radius: 999px;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.75), rgba(103,232,249,0.75), transparent);
          filter: drop-shadow(0 0 5px rgba(125,249,232,0.65));
          transform-origin: center;
          opacity: 0;
          animation: electricSnap 3.2s ease-in-out infinite;
        }

        .ri-bolt-one {
          transform: translate(-50%, -50%) rotate(28deg);
        }

        .ri-bolt-two {
          transform: translate(-50%, -50%) rotate(105deg);
          animation-delay: 0.42s;
          height: 34px;
        }

        .ri-bolt-three {
          transform: translate(-50%, -50%) rotate(-48deg);
          animation-delay: 0.86s;
          height: 36px;
        }

        @keyframes crystalPulse {
          0%, 100% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.08);
            filter: brightness(1.25);
          }
        }

        @keyframes crystalEnergyMove {
          0% {
            transform: scale(1.12) rotate(0deg) translate3d(-2px, -1px, 0);
          }
          100% {
            transform: scale(1.2) rotate(16deg) translate3d(3px, 2px, 0);
          }
        }

        @keyframes electricSnap {
          0%, 72%, 100% {
            opacity: 0;
            clip-path: inset(50% 0 50% 0);
          }
          76% {
            opacity: 1;
            clip-path: inset(0 0 0 0);
          }
          80% {
            opacity: 0.35;
          }
          84% {
            opacity: 1;
          }
          90% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
