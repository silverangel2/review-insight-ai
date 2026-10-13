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
    // tesseract.js loads its .wasm core and worker script from disk at runtime, which
    // Next's file tracer cannot see. Without these the OCR worker aborts (ENOENT
    // tesseract-core-*.wasm) and the scan hangs until the time budget fires.
    "/api/analyze": [
      "./node_modules/tesseract.js-core/*.wasm",
      "./node_modules/tesseract.js-core/*.js",
      "./node_modules/tesseract.js/src/worker-script/**/*",
      "./node_modules/@tesseract.js-data/eng/**/*"
    ],
    "/api/review-screenshot": [
      "./node_modules/tesseract.js-core/*.wasm",
      "./node_modules/tesseract.js-core/*.js",
      "./node_modules/tesseract.js/src/worker-script/**/*",
      "./node_modules/@tesseract.js-data/eng/**/*"
    ],
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
