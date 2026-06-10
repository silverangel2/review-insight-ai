import { AdvertiserApplyForm } from "@/components/advertising/AdvertiserApplyForm";

export default function AdvertiserApplicationPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-cyan-200/15 bg-white/[0.04] p-8 shadow-[0_0_60px_rgba(34,211,238,0.12)]">
        <div className="mb-4 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
          Advertiser Application
        </div>

        <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
          Advertise on ReviewIntel
        </h1>

        <p className="mt-4 max-w-2xl text-slate-300">
          Apply for a sponsored placement inside ReviewIntel. Once approved, your brand can run
          clean sponsored placements beside product research, buyer decisions, and seller insights.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h2 className="font-bold text-cyan-100">1. Apply</h2>
            <p className="mt-2 text-sm text-slate-300">
              Submit your brand, website, placement, and destination link.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h2 className="font-bold text-cyan-100">2. Get approved</h2>
            <p className="mt-2 text-sm text-slate-300">
              ReviewIntel reviews every advertiser before activation.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h2 className="font-bold text-cyan-100">3. Start advertising</h2>
            <p className="mt-2 text-sm text-slate-300">
              Approved ads can be activated, paused, or replaced anytime.
            </p>
          </div>
        </div>

        
        <div className="mt-8 rounded-3xl border border-cyan-200/15 bg-cyan-300/[0.06] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
            Advertising Pricing
          </p>
          <h2 className="mt-2 text-2xl font-black">Review current ad packages before applying</h2>
          <p className="mt-2 text-sm text-slate-300">
            Advertising packages are listed on the main advertising page. Applications are reviewed before any campaign goes live.
          </p>
          <a
            href="/advertise"
            className="mt-4 inline-flex rounded-full bg-cyan-300 px-5 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
          >
            View advertising prices
          </a>
        </div>

        <AdvertiserApplyForm />
      </section>
    </main>
  );
}
