import type { Metadata } from "next";

const OG_IMAGE = { url: "/og-reviewintel.png", width: 1200, height: 630, alt: "ReviewIntel: real buyer reviews turned into a Buy, Wait or Skip answer" };

type SeoOptions = { noindex?: boolean; type?: "website" | "article" };

function plainTitle(title: Metadata["title"]): string | undefined {
  if (!title) return undefined;
  if (typeof title === "string") return title;
  if ("absolute" in title && title.absolute) return title.absolute;
  if ("default" in title && title.default) return title.default;
  return undefined;
}

/**
 * Gives a page its own canonical URL, Open Graph and Twitter tags (derived from its
 * title and description) and, for private pages, a noindex robots rule.
 * Without this every page inherited the root canonical ("/").
 */
export function withSeo(path: string, metadata: Metadata = {}, options: SeoOptions = {}): Metadata {
  const title = plainTitle(metadata.title);
  const description = metadata.description || undefined;
  const ogTitle = title ? (title.includes("ReviewIntel") ? title : `${title} | ReviewIntel`) : "ReviewIntel";
  // A title that already names the brand must not get the "| ReviewIntel" template suffix again.
  const fixedTitle = typeof metadata.title === "string" && metadata.title.includes("ReviewIntel") ? { absolute: metadata.title } : metadata.title;
  return {
    ...metadata,
    ...(fixedTitle !== undefined ? { title: fixedTitle } : {}),
    alternates: { canonical: path, ...(metadata.alternates || {}) },
    openGraph: {
      title: ogTitle,
      description: description || undefined,
      url: path,
      siteName: "ReviewIntel",
      type: options.type || "website",
      images: [OG_IMAGE],
      ...(metadata.openGraph || {}),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: description || undefined,
      images: [OG_IMAGE.url],
      ...(metadata.twitter || {}),
    },
    ...(options.noindex ? { robots: { index: false, follow: true, ...(typeof metadata.robots === "object" && metadata.robots ? metadata.robots : {}) } } : {}),
  };
}

/** Private, signed-in or per-result pages: never indexed. */
export function privatePage(path: string, title: string, description?: string): Metadata {
  return withSeo(path, { title, description }, { noindex: true });
}
