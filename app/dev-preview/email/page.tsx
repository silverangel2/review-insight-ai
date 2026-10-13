import { notFound } from "next/navigation";
import { buildFirstScanUpgradeEmail, buildWelcomeEmail } from "@/lib/lifecycleEmail";
import { emailActionLinks } from "@/lib/emailLinks";

export default function EmailPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const links = emailActionLinks("preview@example.com", "https://getreviewintel.com", "preview-secret");
  const welcome = buildWelcomeEmail({
    name: "Alex",
    role: "buyer",
    ...links,
    siteUrl: "https://getreviewintel.com",
  });
  const upgrade = buildFirstScanUpgradeEmail({
    name: "Alex",
    role: "buyer",
    productName: "Weekend travel kettle",
    verdict: "REVIEW FIRST",
    ...links,
    siteUrl: "https://getreviewintel.com",
    env: {},
  });

  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-10">
      <h1 className="text-xl font-semibold text-slate-900">Email preview</h1>
      <p className="text-sm text-slate-600">Development only. Nothing is sent from this page.</p>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Welcome</h2>
        <iframe title="Welcome email preview" className="h-[720px] w-full rounded-2xl border border-slate-200 bg-white" srcDoc={welcome.html} />
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">After the first scan</h2>
        <iframe title="First scan email preview" className="h-[720px] w-full rounded-2xl border border-slate-200 bg-white" srcDoc={upgrade.html} />
      </section>
    </main>
  );
}
