import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/admin/social-media/generate-videos": [
      "./scripts/generate-social-videos.mjs",
      "./scripts/social-storage-public.mjs",
      "./node_modules/@ffmpeg-installer/ffmpeg/**/*",
      "./node_modules/@ffmpeg-installer/linux-x64/**/*",
      "./node_modules/fluent-ffmpeg/**/*"
    ],
    "/api/admin/social-autopost": [
      "./scripts/generate-social-videos.mjs",
      "./scripts/social-storage-public.mjs",
      "./node_modules/@ffmpeg-installer/ffmpeg/**/*",
      "./node_modules/@ffmpeg-installer/linux-x64/**/*",
      "./node_modules/fluent-ffmpeg/**/*"
    ],
    "/api/cron/social-autopost": [
      "./scripts/generate-social-videos.mjs",
      "./scripts/social-storage-public.mjs",
      "./node_modules/@ffmpeg-installer/ffmpeg/**/*",
      "./node_modules/@ffmpeg-installer/linux-x64/**/*",
      "./node_modules/fluent-ffmpeg/**/*"
    ]
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
