"use client";

const platforms = [
  {
    name: "Amazon",
    short: "a",
    angle: 205,
    glow: "shadow-[0_0_36px_rgba(255,153,0,0.34)]",
    badge: "bg-[#ff9900] text-white",
    border: "border-[#ff9900]/55"
  },
  {
    name: "Walmart",
    short: "✹",
    angle: 335,
    glow: "shadow-[0_0_36px_rgba(0,113,206,0.36)]",
    badge: "bg-[#0071ce] text-white",
    border: "border-[#0071ce]/55"
  },
  {
    name: "TikTok Shop",
    short: "♪",
    angle: 160,
    glow: "shadow-[0_0_34px_rgba(37,244,238,0.32)]",
    badge: "bg-[#111827] text-white",
    border: "border-cyan-300/45"
  },
  {
    name: "Etsy",
    short: "E",
    angle: 25,
    glow: "shadow-[0_0_34px_rgba(241,100,30,0.3)]",
    badge: "bg-[#f1641e] text-white",
    border: "border-[#f1641e]/55"
  },
  {
    name: "Shopify",
    short: "S",
    angle: 75,
    glow: "shadow-[0_0_34px_rgba(149,191,71,0.32)]",
    badge: "bg-[#95bf47] text-white",
    border: "border-[#95bf47]/55"
  },
  {
    name: "eBay",
    short: "e",
    angle: 55,
    glow: "shadow-[0_0_34px_rgba(134,184,23,0.26)]",
    badge: "bg-[#86b817] text-white",
    border: "border-[#86b817]/55"
  },
  {
    name: "Best Buy",
    short: "B",
    angle: 130,
    glow: "shadow-[0_0_34px_rgba(255,224,0,0.28)]",
    badge: "bg-[#ffe000] text-slate-950",
    border: "border-[#ffe000]/55"
  },
  {
    name: "AliExpress",
    short: "A",
    angle: 105,
    glow: "shadow-[0_0_34px_rgba(230,46,45,0.28)]",
    badge: "bg-[#e62e2d] text-white",
    border: "border-[#e62e2d]/55"
  },
  {
    name: "Temu",
    short: "T",
    angle: 275,
    glow: "shadow-[0_0_34px_rgba(255,106,0,0.28)]",
    badge: "bg-[#fb7701] text-white",
    border: "border-[#fb7701]/55"
  },
  {
    name: "Shein",
    short: "S",
    angle: 245,
    glow: "shadow-[0_0_30px_rgba(255,255,255,0.16)]",
    badge: "bg-black text-white",
    border: "border-white/30"
  }
];

function positionFromAngle(angle: number) {
  const radiusX = 41;
  const radiusY = 34;
  const radians = (angle * Math.PI) / 180;
  const x = 50 + Math.cos(radians) * radiusX;
  const y = 50 + Math.sin(radians) * radiusY;
  return { left: `${x}%`, top: `${y}%` };
}

export function PlatformLogoOrbit() {
  return (
    <section className="relative min-h-[500px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#080f1f] p-5 text-white shadow-[0_24px_90px_rgba(8,15,31,0.25)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(8,183,168,0.30),transparent_28%),radial-gradient(circle_at_70%_18%,rgba(255,178,56,0.20),transparent_22%),radial-gradient(circle_at_25%_75%,rgba(35,86,163,0.30),transparent_28%)]" />
      <div className="absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/10" />
      <div className="absolute left-1/2 top-1/2 h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/10" />
      <div className="absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/10" />
      <div className="absolute left-1/2 top-1/2 h-[86%] w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 border-t-cyan-300/40 border-r-amber/25 animate-[spin_18s_linear_infinite]" />
      <div className="absolute left-1/2 top-1/2 h-[65%] w-[65%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 border-b-ocean/35 border-l-teal/35 animate-[spin_13s_linear_infinite_reverse]" />

      <div className="absolute left-1/2 top-1/2 z-20 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-cyan-200/25 bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,0.55),rgba(8,183,168,0.35)_18%,rgba(35,86,163,0.72)_52%,rgba(8,15,31,0.98)_100%)] shadow-[0_0_80px_rgba(8,183,168,0.42)]">
        <span className="absolute inset-4 rounded-full border border-white/10" />
        <span className="rounded-2xl bg-white/10 px-4 py-3 text-2xl font-black backdrop-blur">RI</span>
        <span className="mt-3 text-sm font-black tracking-[0.22em]">REVIEWINTEL</span>
        <span className="mt-1 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100/70">AI source mesh</span>
      </div>

      <div className="absolute inset-0 z-10 animate-[pulse_5s_ease-in-out_infinite]">
        {platforms.map((platform) => {
          const style = positionFromAngle(platform.angle);
          return (
            <div
              key={platform.name}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-2xl border ${platform.border} bg-white/[0.07] px-4 py-3 backdrop-blur-xl ${platform.glow} transition duration-500 hover:scale-105 hover:bg-white/[0.12]`}
              style={style}
              aria-label={`${platform.name} review source example`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black ${platform.badge}`}>
                {platform.short}
              </span>
              <span className="whitespace-nowrap text-sm font-black">{platform.name}</span>
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-5 left-5 right-5 z-30 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-[11px] font-bold uppercase leading-5 tracking-[0.14em] text-slate-300 backdrop-blur">
        Marketplace names are examples of review sources only. ReviewIntel is not affiliated with, sponsored by, endorsed by, or officially partnered with these marketplaces.
      </div>
    </section>
  );
}
