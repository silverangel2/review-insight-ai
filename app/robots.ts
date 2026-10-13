import type { MetadataRoute } from "next";
import { seoBaseUrl } from "@/lib/seoAutomation";

const PRIVATE_PATHS = [
  "/api/",
  "/admin",
  "/admin-access",
  "/account",
  "/dashboard",
  "/auth/",
  "/login",
  "/signup",
  "/unsubscribe",
  "/email-preferences",
  "/dev-preview",
  "/maintenance",
  "/owner-access",
  "/results",
  "/analyze/result",
  "/seller/",
  "/seller-upsell",
  "/manage-subscription",
  "/delete-account",
  "/mobile-more",
  "/advertise/report/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS,
    },
    sitemap: `${seoBaseUrl()}/sitemap.xml`,
  };
}
