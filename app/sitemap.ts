import type { MetadataRoute } from "next";
import { automatedSeoPages, seoBaseUrl } from "@/lib/seoAutomation";

export default function sitemap(): MetadataRoute.Sitemap {
  const cleanBaseUrl = seoBaseUrl();

  return automatedSeoPages.filter((page) => page.robots === "index,follow").map((page) => ({
    url: `${cleanBaseUrl}${page.path === "/" ? "" : page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority
  }));
}
