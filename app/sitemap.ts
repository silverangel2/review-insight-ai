import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const routes = [
    "",
    "/analyze",
    "/compare",
    "/pricing",
    "/reviews",
    "/about",
    "/login",
    "/signup",
    "/consumer-review-analyzer",
    "/amazon-review-analyzer",
    "/fake-review-detector",
    "/seller-review-analytics",
    "/product-complaint-analyzer",
    "/product-feedback-dashboard",
    "/ai-review-intelligence-tool",
    "/terms",
    "/privacy",
    "/disclaimer",
    "/refunds",
    "/faq",
    "/contact",
    "/manage-subscription",
    "/billing-support",
    "/account-support",
    "/delete-account",
    "/cookies",
    "/acceptable-use"
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route.includes("analyzer") || route.includes("detector") ? "weekly" : "monthly",
    priority: route === "" ? 1 : route.includes("analyzer") || route.includes("detector") ? 0.85 : 0.7
  }));
}
