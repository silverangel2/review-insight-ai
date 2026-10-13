import type { MetadataRoute } from "next";
import { automatedSeoPages } from "@/lib/seoAutomation";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  return automatedSeoPages.filter((page) => page.robots === "index,follow").map((page) => ({
    url: `${cleanBaseUrl}${page.path === "/" ? "" : page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority
  }));
}
