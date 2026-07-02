import AnalyzerForm from "@/components/AnalyzerForm";


const SCAN_PROGRESS_STEPS = [
  "Identifying product from screenshot",
  "Creating stable product key",
  "Finding exact online listing",
  "Reading review evidence",
  "Checking AI-like review patterns",
  "Merging product memory",
  "Creating final verdict",
];

function ScanProgressSteps() {
  return (
    <div className="rounded-[2rem] border border-sky-200 bg-sky-50/80 p-4 shadow-soft dark:border-sky-300/20 dark:bg-sky-300/10 sm:p-5">
      <div className="mb-4">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600 dark:text-sky-200">
          AI tools working
        </p>
        <h3 className="mt-1 text-lg font-black text-ink dark:text-white">
          ReviewIntel is checking the product like a human buyer
        </h3>
      </div>

      <div className="space-y-3">
        {SCAN_PROGRESS_STEPS.map((step, index) => (
          <div key={step} className="flex items-center gap-3 rounded-2xl bg-white/80 p-3 dark:bg-slate-950/60">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-black text-white dark:bg-sky-300 dark:text-slate-950">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-ink dark:text-white">{step}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100 dark:bg-slate-800">
                <div
                  className="h-full animate-pulse rounded-full bg-sky-500 dark:bg-sky-300"
                  style={{ width: `${Math.min(100, 22 + index * 12)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">
        Screenshot is used to identify the product. Verdict should be based on product memory, listing evidence, and available review evidence.
      </p>
    </div>
  );
}


export default function AnalyzePage() {
  return <AnalyzerForm />;
}
        <ScanProgressSteps />

