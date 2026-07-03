import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type ChecklistItem = {
  label: string;
  done: boolean;
  note: string;
};

type AffiliateDiagnostics = {
  ok?: boolean;
  status?: string;
  amazon?: {
    tagConnected?: boolean;
    tagPreview?: string | null;
    envName?: string;
    sampleAffiliateUrl?: string;
    sampleOriginalUrl?: string;
    linkBuilderWorking?: boolean;
  };
  walmart?: {
    publisherConnected?: boolean;
    affiliateIdConnected?: boolean;
    publisherPreview?: string | null;
    affiliateIdPreview?: string | null;
    envNames?: {
      publisher?: string;
      affiliateId?: string;
      network?: string;
      template?: string;
    };
    network?: string;
    usingDefaultIds?: boolean;
    impactTemplateConfigured?: boolean;
    sampleAffiliateUrl?: string;
    sampleOriginalUrl?: string;
    linkBuilderWorking?: boolean;
  };
  disclosure?: {
    text?: string;
    envName?: string;
    usingDefault?: boolean;
  };
  betterPicks?: {
    endpoint?: string;
    shopperOnly?: boolean;
    resultPage?: string;
  };
  checklist?: ChecklistItem[];
  error?: string;
};

async function getBaseUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/$/, "");

  const headerStore = await headers();
  const host = headerStore.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";

  return `${protocol}://${host}`;
}

async function getDiagnostics(): Promise<AffiliateDiagnostics> {
  const cookieStore = await cookies();
  const baseUrl = await getBaseUrl();

  const response = await fetch(`${baseUrl}/api/admin/affiliate-diagnostics`, {
    cache: "no-store",
    headers: { cookie: cookieStore.toString() },
  });

  if (response.status === 401) redirect("/owner-access");

  return response.json().catch(() => ({
    ok: false,
    error: "Could not read affiliate diagnostics.",
  }));
}

export default async function AffiliateAdminPage() {
  const diagnostics = await getDiagnostics();
  const tagConnected = Boolean(diagnostics.amazon?.tagConnected);
  const walmartConnected = Boolean(diagnostics.walmart?.publisherConnected);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600">
            ReviewIntel admin
          </p>
          <h1 className="mt-2 text-3xl font-black">Affiliate Settings</h1>
          <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">
            Amazon and Walmart affiliate readiness, Better Picks status, and disclosure diagnostics.
          </p>

          <div className="mt-4 inline-flex rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
            {tagConnected || walmartConnected ? "Affiliate active" : "Ready, not connected"}
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Amazon Associates
            </p>
            <h2 className="mt-2 text-xl font-black">Amazon Tag</h2>

            <div className="mt-4 space-y-3 text-sm font-bold text-slate-600 dark:text-slate-300">
              <p>Status: <span className="font-black text-slate-950 dark:text-white">{tagConnected ? "Connected" : "Not connected yet"}</span></p>
              <p>Env: <code className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-white/10">{diagnostics.amazon?.envName || "AMAZON_ASSOCIATE_TAG"}</code></p>
              <p>Tag preview: <span className="font-black text-slate-950 dark:text-white">{diagnostics.amazon?.tagPreview || "—"}</span></p>
              <p>Link builder: <span className="font-black text-slate-950 dark:text-white">{diagnostics.amazon?.linkBuilderWorking ? "Working" : "Waiting"}</span></p>
            </div>

            {diagnostics.amazon?.sampleAffiliateUrl ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Click test
                </p>
                <p className="mt-2 break-all text-xs font-bold text-slate-500 dark:text-slate-300">
                  {diagnostics.amazon.sampleAffiliateUrl}
                </p>
                <a
                  href={diagnostics.amazon.sampleAffiliateUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white dark:bg-white dark:text-slate-950"
                >
                  Open Amazon test link
                </a>
                {!tagConnected ? (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 dark:bg-amber-400/10 dark:text-amber-100">
                    This opens Amazon, but commission tracking will not work until AMAZON_ASSOCIATE_TAG is added in Vercel.
                  </p>
                ) : null}
              </div>
            ) : null}

            <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs font-bold dark:bg-white/5">
{`AMAZON_ASSOCIATE_TAG=your-tag-here`}
            </pre>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Walmart Affiliate
            </p>
            <h2 className="mt-2 text-xl font-black">Walmart SID</h2>

            <div className="mt-4 space-y-3 text-sm font-bold text-slate-600 dark:text-slate-300">
              <p>Status: <span className="font-black text-slate-950 dark:text-white">{walmartConnected ? "Connected" : "Not connected yet"}</span></p>
              <p>SID / publisher env: <code className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-white/10">{diagnostics.walmart?.envNames?.publisher || "WALMART_PUBLISHER_ID"}</code></p>
              <p>Affiliate ID env: <code className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-white/10">{diagnostics.walmart?.envNames?.affiliateId || "WALMART_AFFILIATE_ID"}</code></p>
              <p>Network env: <code className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-white/10">{diagnostics.walmart?.envNames?.network || "WALMART_AFFILIATE_NETWORK"}</code></p>
              <p>SID preview: <span className="font-black text-slate-950 dark:text-white">{diagnostics.walmart?.publisherPreview || "—"}</span></p>
              <p>Affiliate ID preview: <span className="font-black text-slate-950 dark:text-white">{diagnostics.walmart?.affiliateIdPreview || "—"}</span></p>
              <p>Network: <span className="font-black text-slate-950 dark:text-white">{diagnostics.walmart?.network || "impact"}</span></p>
              <p>Official Impact template: <span className="font-black text-slate-950 dark:text-white">{diagnostics.walmart?.impactTemplateConfigured ? "Configured" : "Using default path"}</span></p>
              <p>Link builder: <span className="font-black text-slate-950 dark:text-white">{diagnostics.walmart?.linkBuilderWorking ? "Working" : "Waiting"}</span></p>
            </div>

            {diagnostics.walmart?.sampleAffiliateUrl ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Click test
                </p>
                <p className="mt-2 break-all text-xs font-bold text-slate-500 dark:text-slate-300">
                  {diagnostics.walmart.sampleAffiliateUrl}
                </p>
                <a
                  href={diagnostics.walmart.sampleAffiliateUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white dark:bg-white dark:text-slate-950"
                >
                  Open Walmart test link
                </a>
                {!diagnostics.walmart.impactTemplateConfigured ? (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 dark:bg-amber-400/10 dark:text-amber-100">
                    Walmart can give a specific Impact template. Add it later with WALMART_IMPACT_TRACKING_URL_TEMPLATE if needed.
                  </p>
                ) : null}
              </div>
            ) : null}

            <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs font-bold dark:bg-white/5">
{`WALMART_AFFILIATE_ID=ReviewIntel
WALMART_PUBLISHER_ID=4722495
WALMART_AFFILIATE_NETWORK=rakuten
# Optional if Walmart gives you an exact Impact template:
WALMART_IMPACT_TRACKING_URL_TEMPLATE=https://goto.walmart.com/c/{publisherId}/...?...&u={encodedUrl}`}
            </pre>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Disclosure
            </p>
            <h2 className="mt-2 text-xl font-black">Affiliate Disclosure</h2>

            <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-relaxed text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-100">
              {diagnostics.disclosure?.text ||
                "ReviewIntel may earn a commission from qualifying purchases through affiliate links. This does not affect our verdicts or review analysis."}
            </p>

            <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs font-bold dark:bg-white/5">
{`NEXT_PUBLIC_AFFILIATE_DISCLOSURE=ReviewIntel may earn from qualifying purchases through Amazon Associates and Walmart affiliate links. Affiliate compensation does not affect ReviewIntel verdicts or review analysis.`}
            </pre>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Facebook posts
            </p>
            <h2 className="mt-2 text-xl font-black">Optional Qualifying Link</h2>
            <p className="mt-4 text-sm font-bold leading-6 text-slate-600 dark:text-slate-300">
              Turn this on when you want daily Facebook auto-posts to mention ReviewIntel affiliate-ready picks.
              If you add one exact Amazon/Walmart product URL, Facebook posts will append that qualifying source.
              If you leave the URL empty, Facebook posts will link to ReviewIntel instead, where shopper result pages show affiliate-ready Amazon/Walmart picks.
            </p>

            <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs font-bold dark:bg-white/5">
{`SOCIAL_AFFILIATE_POSTS_ENABLED=true
# Optional direct product link:
# SOCIAL_AFFILIATE_URL=https://www.amazon.ca/dp/...
# SOCIAL_AFFILIATE_URL=https://www.walmart.ca/en/ip/...
SOCIAL_AFFILIATE_DISCLOSURE=Affiliate link. ReviewIntel may earn from qualifying purchases.`}
            </pre>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Better Picks
          </p>
          <h2 className="mt-2 text-xl font-black">Shopper Recommendation System</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Endpoint</p>
              <p className="mt-2 text-sm font-black">{diagnostics.betterPicks?.endpoint || "/api/product-recommendations"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Placement</p>
              <p className="mt-2 text-sm font-black">{diagnostics.betterPicks?.resultPage || "/results"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Mode</p>
              <p className="mt-2 text-sm font-black">{diagnostics.betterPicks?.shopperOnly ? "Shopper only" : "Check placement"}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Checklist
          </p>
          <h2 className="mt-2 text-xl font-black">Affiliate Launch Checklist</h2>

          <div className="mt-5 space-y-3">
            {(diagnostics.checklist || []).map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="font-black">{item.done ? "✓ " : "! "}{item.label}</p>
                <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">{item.note}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
