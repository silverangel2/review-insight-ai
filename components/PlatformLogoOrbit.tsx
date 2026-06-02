import type { CSSProperties } from "react";
import { Badge } from "@/components/Badge";

const platforms = [
  { name: "Amazon", mark: "a", color: "#ff9900" },
  { name: "Shein", mark: "S", color: "#111827" },
  { name: "Temu", mark: "T", color: "#ff6a00" },
  { name: "Walmart", mark: "W", color: "#0071ce" },
  { name: "Etsy", mark: "E", color: "#f1641e" },
  { name: "eBay", mark: "e", color: "#86b817" },
  { name: "Shopify", mark: "S", color: "#95bf47" },
  { name: "AliExpress", mark: "A", color: "#e43225" },
  { name: "Best Buy", mark: "B", color: "#f5c400" },
  { name: "TikTok Shop", mark: "T", color: "#00f2ea" }
];

const captions = [
  "Analyze reviews from the places shoppers already trust.",
  "Turn messy reviews into clear buying decisions.",
  "For shoppers. For sellers. For smarter product decisions.",
  "From product reviews to instant intelligence."
];

export function PlatformLogoOrbit() {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_12%_20%,rgba(8,183,168,0.16),transparent_30%),radial-gradient(circle_at_88%_28%,rgba(35,86,163,0.18),transparent_30%),linear-gradient(180deg,#f8fdff,#edf7ff)] px-6 py-14 text-ink dark:bg-slate-950 dark:text-white">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <Badge tone="info">Platform-friendly review text</Badge>
          <h2 className="mt-5 text-4xl font-black leading-tight md:text-5xl">Works with review text from major shopping platforms.</h2>
          <div className="mt-6 grid gap-3">
            {captions.map((caption, index) => (
              <p key={caption} className="group flex items-center gap-3 rounded-2xl border border-ocean/15 bg-white/75 px-4 py-3 text-sm font-black text-slate-700 shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-teal/50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#08b7a8,#2356a3)] text-xs text-white shadow-[0_0_28px_rgba(8,183,168,0.32)]">
                  {index + 1}
                </span>
                <span>{caption}</span>
              </p>
            ))}
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Marketplace names are examples of review sources. ReviewIntel is not claiming official partnership or endorsement.
          </p>
        </div>
        <div className="ri-platform-orbit" aria-label="Shopping platforms supported by pasted review text">
          <div className="ri-platform-spark ri-platform-spark-a" />
          <div className="ri-platform-spark ri-platform-spark-b" />
          <div className="ri-platform-scanline" />
          <div className="ri-platform-center">
            <span>RI</span>
            <strong>ReviewIntel</strong>
            <em>Review source mesh</em>
          </div>
          {platforms.map((platform, index) => {
            const angle = index * (360 / platforms.length);
            return (
              <span
                key={platform.name}
                className="ri-platform-node"
                style={
                  {
                    "--i": index,
                    "--angle": `${angle}deg`,
                    "--reverse-angle": `${-angle}deg`,
                    "--brand": platform.color
                  } as CSSProperties & Record<"--i", number> & Record<"--angle" | "--reverse-angle" | "--brand", string>
                }
              >
                <span className="ri-platform-mark">{platform.mark}</span>
                <span>{platform.name}</span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
