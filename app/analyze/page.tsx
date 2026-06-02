import { AnalyzerForm } from "@/components/AnalyzerForm";
import { Badge } from "@/components/Badge";

const quickSignals = [
  ["87%", "Overall score", "Shared score"],
  ["Buy", "Worth buying", "Fast verdict"],
  ["Low", "Fake risk", "Pattern check"],
  ["Great", "Value", "Money call"]
];

export default function AnalyzePage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6">
      <section className="ri-reveal-pop relative mb-8 overflow-hidden rounded-[2rem] border border-white/15 bg-[linear-gradient(130deg,#050816_0%,#2356a3_34%,#08b7a8_62%,#ffb238_84%,#ff5d8f_100%)] p-5 text-white shadow-[0_34px_120px_rgba(35,86,163,0.34)] sm:p-7">
        <div className="ri-scan-grid absolute inset-0 opacity-30" />
        <div className="ri-scan-beam absolute inset-x-0 top-0 h-28 opacity-80" />
        <div className="ri-result-firework absolute right-8 top-7 hidden md:block" />

        <div className="relative grid gap-6 lg:grid-cols-[1fr_0.92fr] lg:items-center">
          <div>
            <Badge tone="good">AI review scanner</Badge>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight sm:text-6xl">
              Paste reviews. Get the buying answer.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-100">
              ReviewIntel turns messy customer reviews into a score, verdict, fake-risk read, value call, and top complaint.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#review-paste-area" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-ink shadow-soft transition hover:-translate-y-0.5 hover:bg-cyan-100">
                Paste reviews
              </a>
              <a href="#quick-scan-area" className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15">
                Upload screenshots
              </a>
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-white/15 bg-slate-950/55 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <div className="grid gap-3 sm:grid-cols-2">
              {quickSignals.map(([value, label, detail]) => (
                <article key={label} className="rounded-2xl border border-white/15 bg-white/90 p-4 text-ink shadow-soft">
                  <p className="text-3xl font-black">{value}</p>
                  <p className="mt-1 text-sm font-black">{label}</p>
                  <p className="mt-1 text-xs font-bold uppercase text-slate-500">{detail}</p>
                </article>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Shopper quick answer</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-100">
                Best for: students, office work, travel. Top complaint: battery life.
              </p>
            </div>
          </div>
        </div>
      </section>
      <AnalyzerForm />
    </main>
  );
}
