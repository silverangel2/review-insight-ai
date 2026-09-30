import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/admin-access", "/dashboard/", "/account", "/owner-access", "/maintenance", "/login", "/signup", "/results", "/auth/"]
    },
    sitemap: `${baseUrl}/sitemap.xml`
  };
}
