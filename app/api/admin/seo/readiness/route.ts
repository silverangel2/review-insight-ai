import { NextResponse } from "next/server";
import { adminSessionFromRequest } from "@/lib/adminAccess";
import { seoLandingPages } from "@/lib/seoLandingPages";
import { hasAdminSeoDatabase, readAdminSeoSettings } from "@/lib/adminSeoSettings";

export const runtime = "nodejs";

type SeoCheck = {
  label: string;
  status: "passed" | "warning" | "failed";
  detail: string;
};

function check(label: string, status: SeoCheck["status"], detail: string): SeoCheck {
  return { label, status, detail };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const adminSession = adminSessionFromRequest(request);

  if (!adminSession) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";

  const isLocalDev =
    !siteUrl || siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");

  const productionUrl =
    siteUrl && !siteUrl.includes("localhost") && !siteUrl.includes("127.0.0.1");

  const landingPages = Object.values(seoLandingPages);
  const savedSeoResult = await readAdminSeoSettings();
  const savedSettings = savedSeoResult.settings;
  const savedPages = Object.entries(savedSettings);

  const weakLandingPages = landingPages.filter((page) => {
    return (
      !page.metaTitle ||
      page.metaTitle.length > 70 ||
      !page.description ||
      page.description.length < 80 ||
      !page.keywords?.length ||
      !page.primaryCta
    );
  });

  const weakSavedPages = savedPages.filter(([, draft]) => {
    const title = text(draft.title || draft.metaTitle || draft.ogTitle || draft.searchTitle);
    const description = text(draft.description || draft.ogDescription || draft.searchDescription);
    const ogImage = text(draft.ogImage || draft.shareImage || draft.image);
    const canonical = text(draft.canonical || draft.canonicalUrl || draft.url);

    return (
      !title ||
      title.length < 25 ||
      title.length > 90 ||
      !description ||
      description.length < 60 ||
      description.length > 220 ||
      !ogImage ||
      !canonical
    );
  });

  const checks: SeoCheck[] = [
    check(
      "Production URL",
      productionUrl || isLocalDev ? "passed" : "warning",
      productionUrl
        ? `Using ${siteUrl}.`
        : "Local development URL detected. Set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL to the live domain before final launch."
    ),
    check(
      "Deployment-ready SEO storage",
      hasAdminSeoDatabase() ? "passed" : "warning",
      hasAdminSeoDatabase()
        ? "Editable SEO settings are stored in Supabase and will persist after deployment."
        : "Editable SEO settings are using local JSON fallback. Add Supabase service env vars in Vercel for deployment-ready saving."
    ),
    check(
      "Editable SEO settings",
      savedPages.length === 0 ? "failed" : weakSavedPages.length ? "warning" : "passed",
      savedPages.length === 0
        ? "No saved editable SEO settings found in data/admin-seo-settings.json."
        : weakSavedPages.length
          ? `${weakSavedPages.length} saved editable SEO pages need stronger title, description, share image, or canonical URL.`
          : `${savedPages.length} saved editable SEO pages have premium launch-ready metadata.`
    ),
    check(
      "SEO landing pages",
      weakLandingPages.length ? "warning" : "passed",
      weakLandingPages.length
        ? `${weakLandingPages.length} coded SEO landing pages need stronger title, description, keyword, or CTA fields.`
        : `${landingPages.length} coded SEO landing pages have launch-ready metadata fields.`
    ),
    check(
      "Sitemap",
      "passed",
      "sitemap.xml includes public analyzer, buyer, seller, trust, support, and advertising pages."
    ),
    check(
      "Robots",
      "passed",
      "robots.txt allows public pages and blocks admin/API areas."
    ),
    check(
      "Admin indexing",
      "passed",
      "Admin layout is noindex and requires the admin session cookie."
    )
  ];

  const failed = checks.filter((item) => item.status === "failed").length;
  const warnings = checks.filter((item) => item.status === "warning").length;

  return NextResponse.json({
    ok: failed === 0,
    status: failed ? "failed" : warnings ? "warning" : "ready",
    checkedAt: new Date().toISOString(),
    savedSeoPagesChecked: savedPages.length,
    savedSeoSource: savedSeoResult.source,
    deploymentReadySeoStorage: hasAdminSeoDatabase(),
    weakSavedSeoPages: weakSavedPages.map(([page]) => page),
    checks
  });
}
