"use client";
// Premium "Featured deals" card: Owner-promoted ads/affiliate offers from the existing ad settings.
// - Clear "Affiliate" / "Sponsored" labels and the Amazon Associates disclosure.
// - Images/video ONLY from the Owner's own uploaded media (mediaUrl); we never hotlink Amazon
//   product images. Otherwise a neat pastel tile with a category icon.
// - Smooth transform-only carousel; auto-advance pauses offscreen, on hover/focus and for reduced motion.
// - Video: muted, lazy (preload none), plays only while visible, never under reduced motion.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SponsorAd } from "@/lib/adConfig";

export type DealSlide = { ad: SponsorAd; kind: "affiliate" | "direct" | "house"; headline: string; description?: string; partner: string; cta: string };

export const AMAZON_ASSOCIATE_DISCLOSURE = "As an Amazon Associate, ReviewIntel earns from qualifying purchases.";

const TINTS = ["from-[#e6f7f1] to-[#fff6d6]", "from-[#ffeee6] to-[#f1edff]", "from-[#f1edff] to-[#e6f7f1]", "from-[#fff6d6] to-[#ffeee6]"];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function DealIcon({ index }: { index: number }) {
  const paths = [
    "M6 7h12l-1 12H7L6 7Zm3 0a3 3 0 0 1 6 0", // bag
    "M3 12l9-9h7v7l-9 9-7-7Zm13-5h.01", // tag
    "M4 7h16v4H4zM5 11h14v9H5zM12 7v13M12 7c-2-4-6-2-4 0m4 0c2-4 6-2 4 0", // gift
  ];
  return (
    <svg viewBox="0 0 24 24" className="ri-deal-float size-10 text-teal" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[index % paths.length]} />
    </svg>
  );
}

function DealMedia({ ad, index, visible }: { ad: SponsorAd; index: number; visible: boolean }) {
  const url = ad.mediaUrl || ad.imageUrl;
  const ownAsset = Boolean(url) && !/amazon\.|media-amazon|ssl-images-amazon/i.test(String(url));
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible && !prefersReducedMotion()) void v.play().catch(() => {});
    else v.pause();
  }, [visible]);
  const box = "h-28 w-full overflow-hidden rounded-2xl sm:h-full sm:w-40";
  if (ownAsset && ad.mediaType === "video") {
    return <video ref={videoRef} src={url} muted loop playsInline preload="none" aria-hidden="true" className={`${box} object-cover`} />;
  }
  if (ownAsset) return <img src={url} alt="" loading="lazy" decoding="async" className={`${box} object-cover`} />;
  return <div className={`${box} grid place-items-center bg-gradient-to-br ${TINTS[index % TINTS.length]}`} aria-hidden="true"><DealIcon index={index} /></div>;
}

export function FeaturedDeals({ slides, className = "", onImpression, onClickSlide }: {
  slides: DealSlide[]; className?: string;
  onImpression?: (slide: DealSlide) => void; onClickSlide?: (slide: DealSlide) => void;
}) {
  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (slides.length <= 1 || !inView || paused || prefersReducedMotion()) return;
    const id = window.setInterval(() => setIndex(i => (i + 1) % slides.length), 8000);
    return () => window.clearInterval(id);
  }, [slides.length, inView, paused]);

  const current = slides[index % Math.max(1, slides.length)];
  useEffect(() => { if (current && inView) onImpression?.(current); }, [current, inView, onImpression]);
  if (!slides.length) return null;

  const hasAffiliate = slides.some(s => s.kind === "affiliate");
  const hasAmazon = slides.some(s => s.ad.affiliatePartner === "amazon" || /amazon\./i.test(s.ad.destinationUrl));

  return (
    <aside ref={root} aria-label="Featured deals" aria-roledescription="carousel" data-ri-no-translate
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      className={`rounded-[1.75rem] bg-[linear-gradient(135deg,#ffffff_0%,#fff6ec_100%)] p-4 ring-1 ring-slate-900/5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">Featured deals</p>
        <span className="rounded-full bg-peach px-2.5 py-0.5 text-xs font-semibold text-coralink">{current.kind === "affiliate" ? "Affiliate" : current.kind === "direct" ? "Sponsored" : "ReviewIntel"}</span>
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl">
        <ul className="flex transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${(index % slides.length) * 100}%)` }}>
          {slides.map((s, n) => {
            const external = /^https?:\/\//i.test(s.ad.destinationUrl);
            const cls = "ri-lift inline-flex shrink-0 items-center justify-center rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white";
            return (
              <li key={s.ad.id + n} className="w-full shrink-0" aria-hidden={n !== index % slides.length} aria-roledescription="slide" aria-label={`${n + 1} of ${slides.length}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
                  <DealMedia ad={s.ad} index={n} visible={inView && n === index % slides.length} />
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-slate-500">{s.partner}</p>
                      <h3 className="mt-0.5 text-lg font-semibold leading-snug text-slate-900">{s.headline}</h3>
                      {s.description ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{s.description}</p> : null}
                    </div>
                    <div>
                      {external ? (
                        <a href={s.ad.destinationUrl} target="_blank" rel="noopener noreferrer sponsored" tabIndex={n === index % slides.length ? 0 : -1} className={cls} data-sponsor-click={s.ad.id} onClick={() => onClickSlide?.(s)}>{s.cta}</a>
                      ) : (
                        <Link href={s.ad.destinationUrl} tabIndex={n === index % slides.length ? 0 : -1} className={cls} data-sponsor-click={s.ad.id} onClick={() => onClickSlide?.(s)}>{s.cta}</Link>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-slate-500">{hasAmazon ? AMAZON_ASSOCIATE_DISCLOSURE : hasAffiliate ? "We may earn a commission. It never changes a verdict." : "Paid placement. It never changes a verdict."}</p>
        {slides.length > 1 ? (
          <div className="flex shrink-0 gap-1.5">
            {slides.map((s, n) => (
              <button key={s.ad.id + n} type="button" onClick={() => setIndex(n)} aria-label={`Show deal ${n + 1}`} aria-current={n === index % slides.length}
                className={`size-6 rounded-full p-2 after:block after:size-2 after:rounded-full ${n === index % slides.length ? "after:bg-teal" : "after:bg-slate-300"}`} />
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
