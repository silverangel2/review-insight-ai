import type { MetadataRoute } from "next";
import { automatedSeoPages, seoBaseUrl } from "@/lib/seoAutomation";
import { guides } from "@/lib/guides";
import { loadCategoryGuides } from "@/lib/guideData";

const PUBLIC_EXTRA = ["/analyze", "/about", "/pricing", "/advertise", "/faq", "/guides", "/privacy", "/terms", "/affiliate-disclosure", "/contact"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = seoBaseUrl();
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();
  const add = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"], lastModified: Date = new Date()) => {
    const url = `${base}${path === "/" ? "" : path}`;
    if (!entries.has(url)) entries.set(url, { url, lastModified, changeFrequency, priority });
  };

  for (const page of automatedSeoPages) {
    if (page.robots === "index,follow") add(page.path, page.priority, page.changeFrequency);
  }
  for (const path of PUBLIC_EXTRA) add(path, 0.6, "monthly");
  for (const guide of guides) add(`/guides/${guide.slug}`, 0.7, "monthly", new Date(`${guide.publishedAt}T00:00:00Z`));
  try {
    // Category guides are only listed once they have enough real reviews (thin guides are noindex).
    for (const g of await loadCategoryGuides()) if (!g.thin) add(`/guides/${g.slug}`, 0.7, "weekly");
  } catch { /* database unavailable: editorial guides are still listed */ }

  return Array.from(entries.values());
}
