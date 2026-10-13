import { AdvertiserApplyForm } from "@/components/advertising/AdvertiserApplyForm";

export default function AdvertiserApplicationPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] px-6 py-12 text-ink">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-line bg-white p-8 shadow-soft">
        <div className="mb-4 inline-flex rounded-full border border-ocean/20 bg-ocean/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-ocean">
          Advertiser Application
        </div>

        <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
          Advertise on ReviewIntel
        </h1>

        <p className="mt-4 max-w-2xl text-slate-600">
          Upload your campaign creative and submit it for review. Ads go live only after
          ReviewIntel verifies payment and approves the creative.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-line bg-mist p-5">
            <h2 className="font-bold text-ink">1. Apply</h2>
            <p className="mt-2 text-sm text-slate-600">
              Choose a package, add brand details, and upload a banner or short video.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-mist p-5">
            <h2 className="font-bold text-ink">2. Get approved</h2>
            <p className="mt-2 text-sm text-slate-600">
              ReviewIntel verifies payment and checks every creative before activation.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-mist p-5">
            <h2 className="font-bold text-ink">3. Start advertising</h2>
            <p className="mt-2 text-sm text-slate-600">
              Paid and approved ads rotate automatically in selected placements.
            </p>
          </div>
        </div>

        
        <div className="mt-8 rounded-3xl border border-ocean/15 bg-ocean/5 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-ocean">
            Advertising Pricing
          </p>
          <h2 className="mt-2 text-2xl font-black">Review current ad packages before applying</h2>
          <p className="mt-2 text-sm text-slate-600">
            Pay first or submit your payment reference with the campaign. Applications are reviewed before any campaign goes live.
          </p>
          <a
            href="/advertise"
            className="mt-4 inline-flex rounded-full bg-ink px-5 py-2 text-sm font-bold text-white transition hover:bg-ocean"
          >
            View advertising prices
          </a>
        </div>

        <AdvertiserApplyForm />
      </section>
    </main>
  );
}
