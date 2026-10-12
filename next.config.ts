import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Render <title>/<meta description>/canonical in the initial <head> for every client
  // (not streamed into <body>), so all crawlers and SEO audits see them.
  htmlLimitedBots: /.*/,
  // OCR runs in Node from node_modules (worker + language data files), not bundled.
  serverExternalPackages: ["tesseract.js", "@tesseract.js-data/eng", "playwright", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/admin/social-media/generate-videos": [
      "./node_modules/@ffmpeg-installer/linux-x64/ffmpeg",
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe"
    ],
    "/api/admin/social-autopost": [
      "./node_modules/@ffmpeg-installer/linux-x64/ffmpeg",
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe"
    ],
    "/api/cron/social-autopost": [
      "./node_modules/@ffmpeg-installer/linux-x64/ffmpeg",
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe"
    ]
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
