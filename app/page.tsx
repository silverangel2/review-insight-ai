import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HouseAdSlot } from "@/components/HouseAdCard";
import { HeroDoorPanel } from "@/components/HeroDoorPanel";
import { HeroSampleLoop } from "@/components/HeroSampleLoop";
import { HomepageInstructionVideo } from "@/components/HomepageInstructionVideo";
import { SponsorAnalytics } from "@/components/SponsorAnalytics";
import { getHomepageVideo } from "@/lib/homepageVideo";
import { withSeo } from "@/lib/pageSeo";

export const metadata = withSeo("/", {
  title: { absolute: "ReviewIntel | Should you buy it? We read the real reviews for you" },
  description: "Paste a product link, add a screenshot, and get a plain Buy, Wait or Skip answer built from grouped analysis of real written buyer reviews, with an honest confidence level. Free to start.",
});

/**
 * Homepage (overhaul, 2026-10-23): one grid (1,120px), one colour system
 * (the indigo family #0a6cff -> #5b3df0, ink/slate words, white + one
 * lavender wash), one card style, and the screenshot door first.
 * Section order: hero (working product moment) -> how it works ->
 * sample verdict -> watch it work -> ONE sponsored strip -> Premium.
 * The seller card, the legacy sponsor carousel, and the second trust
 * printing are gone; the scan itself is untouched.
 */
export default async function LandingPage() {
  const t = await getTranslations("Home");
  const homepageVideo = await getHomepageVideo();

  return (
    <main className="reviewintel-home-main text-ink">
      <SponsorAnalytics placement="landing" />

      {/* Hero: the screenshot door first, with the product working beside it. */}
      <section className="bg-[linear-gradient(180deg,#f1edff_0%,rgba(241,237,255,0)_90%)] dark:bg-none">
        <div className="mx-auto max-w-[1120px] px-4 pb-12 pt-[52px] text-center sm:px-6 lg:pb-[72px] lg:pt-20">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#5b3df0]">
            Before you buy
          </p>
          <h1 className="mx-auto mt-3.5 max-w-[900px] text-[37px] font-extrabold leading-[1.12] tracking-[-0.01em] text-ink dark:text-white lg:text-[58px]">
            About to buy it?
            <br />
            <span className="ri-gradient-text">See what real buyers said first.</span>
          </h1>
          <p className="mx-auto mt-[22px] max-w-[640px] text-[17px] leading-[1.55] text-slate-600 dark:text-slate-300 lg:text-[19px]">
            Screenshot the reviews on any product page. We group what real buyers said — the good
            and the bad — weigh it as a whole, and give you one plain answer.
          </p>

          <div className="mx-auto mt-8 grid items-stretch gap-5 text-left lg:mt-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-7">
            <HeroDoorPanel />
            <HeroSampleLoop />
          </div>

          <p className="mt-[26px] text-[14.5px] text-slate-500 dark:text-slate-400">
            <strong className="font-bold text-ink dark:text-white">Real buyer reviews only</strong>
            {" · "}No fake or generated reviews{" · "}If there aren&rsquo;t enough reviews, we say so
          </p>
        </div>
      </section>

      {/* How it works */}
      <section aria-label="How it works" className="py-14 lg:py-[88px]">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#5b3df0]">
            How it works
          </p>
          <h2 className="mt-3.5 text-[28px] font-bold leading-[1.12] tracking-[-0.01em] text-ink dark:text-white lg:text-[32px]">
            Three steps, one plain answer
          </h2>
          <ol className="mt-9 grid gap-5 lg:grid-cols-3">
            {[
              [
                "Screenshot the reviews",
                "On the product page, screenshot the written reviews. No link-hunting, no copying web addresses on your phone.",
              ],
              [
                "We read what buyers said",
                "We group the praise and the complaints, check for fake-review patterns, and weigh it all as a whole.",
              ],
              [
                "Get one plain answer",
                "Buy, Wait or Skip — and the reasons, in plain words. If there aren't enough reviews, we say so.",
              ],
            ].map(([title, body], index) => (
              <li key={title} className="ri-home-card p-[26px]">
                <span className="text-sm font-extrabold tracking-[0.1em] text-[#5b3df0]" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2.5 text-xl font-bold text-ink dark:text-white">{title}</h3>
                <p className="mt-2 text-[15.5px] leading-[1.55] text-slate-600 dark:text-slate-300">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What you get: one sample verdict, the same story the hero loop tells. */}
      <section aria-labelledby="home-sample" className="bg-[#f1edff] py-14 dark:bg-white/5 lg:py-[88px]">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#5b3df0]">
            What you get
          </p>
          <h2 id="home-sample" className="mt-3.5 text-[28px] font-bold leading-[1.12] tracking-[-0.01em] text-ink dark:text-white lg:text-[32px]">
            One verdict, with the reasons showing
          </h2>
          <div className="ri-home-card mt-9 grid gap-7 rounded-[24px] p-[22px] sm:p-7 lg:grid-cols-[220px_1fr]">
            <div className="relative min-h-[130px] overflow-hidden rounded-2xl bg-[linear-gradient(140deg,#dbeafe,#ede9fe)] lg:min-h-[190px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/ads/gadget-earbuds.jpg"
                alt="Wireless earbuds and their charging case on a desk beside a laptop"
                className="absolute inset-0 block !h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[linear-gradient(92deg,#0a6cff,#5b3df0)] px-[18px] py-2 text-[15px] font-extrabold tracking-[0.04em] text-white">
                  BUY
                </span>
                <span className="text-[22px] font-extrabold text-ink dark:text-white">82 / 100</span>
                <span className="rounded-full border border-[#e2e8f0] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-slate-500 dark:border-white/15 dark:text-slate-400">
                  Sample result
                </span>
              </div>
              <h3 className="mt-3.5 text-[21px] font-bold text-ink dark:text-white">
                Wireless earbuds — what 2,300 buyers said
              </h3>
              <ul>
                {[
                  ["Buyers liked:", "battery life and fit come up again and again."],
                  ["Buyers complained:", "the case hinge feels loose after a few months."],
                  ["Fake-review check:", "no strong fake pattern found in the written reviews."],
                ].map(([label, body], index) => (
                  <li
                    key={label}
                    className={`py-[9px] text-[15.5px] leading-[1.5] text-slate-600 dark:text-slate-300 ${
                      index > 0 ? "border-t border-[#e2e8f0] dark:border-white/10" : ""
                    }`}
                  >
                    <b className="text-ink dark:text-white">{label}</b> {body}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Watch it work: the video, slimmed to one two-column block. */}
      <section aria-labelledby="home-video" className="py-14 lg:py-[88px]">
        <div className="mx-auto grid max-w-[1120px] items-center gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:gap-10">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#5b3df0]">
              {t("instructionVideo.eyebrow")}
            </p>
            <h2 id="home-video" className="mt-3.5 text-[28px] font-bold leading-[1.12] tracking-[-0.01em] text-ink dark:text-white lg:text-[32px]">
              {t("instructionVideo.title")}
            </h2>
            <p className="mt-3.5 max-w-[46ch] text-[16.5px] leading-[1.6] text-slate-600 dark:text-slate-300">
              {t("instructionVideo.body")}
            </p>
          </div>
          <HomepageInstructionVideo video={homepageVideo} />
        </div>
      </section>

      {/* Exactly one sponsored strip on the homepage. */}
      <section aria-label="Sponsored" className="py-14">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <HouseAdSlot context="home" placement="home" />
        </div>
      </section>

      {/* Premium: one quiet navy strip. */}
      <section aria-labelledby="home-premium" className="bg-ink py-14 lg:py-16">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-7 px-4 sm:px-6">
          <div>
            <h2 id="home-premium" className="text-[28px] font-bold leading-[1.12] tracking-[-0.01em] text-white">
              Unlimited scans with Premium
            </h2>
            <p className="mt-2 max-w-[52ch] text-base leading-[1.55] text-slate-300">
              CAD $9.99/month — unlimited scans and saved results, so your checks are there when
              you need them.
            </p>
          </div>
          <div className="flex-1" />
          <Link
            href="/pricing"
            className="rounded-full bg-white px-[26px] py-3.5 text-[15.5px] font-bold text-ink transition hover:bg-indigo-50"
          >
            See Premium
          </Link>
        </div>
      </section>
    </main>
  );
}
